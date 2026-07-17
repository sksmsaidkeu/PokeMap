-- catch-attempt 트랜잭션 코어 (DB.md §10 "catch-attempt", §13.1)
-- fn_move_city와 동일한 이유로 락/판정을 plpgsql SECURITY DEFINER 함수로 격리한다.
-- 성공→caught+도감, 3실패→fled+전설 pity/쿨다운은 트리거(fn_pokedex_upsert/
-- fn_session_flee)가 처리하므로 여기서는 INSERT/카운트 증가만 한다.

-- 1) 포획 가능성 tier (DB.md §13.1 표 그대로) — fn_move_city 인라인 CASE의 추출·공용화
create or replace function public.calc_catch_rate_tier(rate numeric)
returns text
language sql
immutable
as $$
  select case
    when rate < 0.30 then '매우 낮음'
    when rate < 0.50 then '낮음'
    when rate < 0.70 then '보통'
    else '높음'
  end;
$$;

alter function public.calc_catch_rate_tier(numeric) owner to postgres;

-- 2) fn_move_city 갱신: 인라인 CASE → calc_catch_rate_tier 호출. 다른 로직 변경 없음.
create or replace function public.fn_move_city(p_user_id uuid, p_to_city_id integer)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current    integer;
  v_living     integer;
  v_province   smallint;
  v_is_island  boolean;
  v_is_site    boolean;
  v_leg_dex    smallint;
  v_pct        numeric;
  v_cd         timestamptz;
  v_fail       smallint;
  v_sr         numeric;
  v_rec        record;
  v_spawn_dex  smallint;
  v_spawn_rate numeric;
  v_sess_id    uuid;
  v_sess_exp   timestamptz;
  v_sess_dex   smallint;
  v_sess_leg   boolean;
  v_rate       numeric;
  v_encounter  json := null;
begin
  -- 1. user_progress 행 잠금 (§11: 이 함수가 잡는 유일한 락)
  select current_city_id into v_current
  from user_progress where user_id = p_user_id for update;
  if not found then raise exception 'NO_PROGRESS'; end if;

  -- 목적지 메타
  select c.living_area_id, la.province_id, pr.is_island_endgame,
         c.is_legendary_site, pr.legendary_dex_no
    into v_living, v_province, v_is_island, v_is_site, v_leg_dex
  from cities c
  join living_areas la on la.id = c.living_area_id
  join provinces pr on pr.id = la.province_id
  where c.id = p_to_city_id;
  if not found then raise exception 'INVALID_INPUT'; end if;

  -- 2. 인접성 (v_city_neighbors = city_connections 대칭 전개)
  if not exists (
    select 1 from v_city_neighbors
    where city_id = v_current and neighbor_id = p_to_city_id
  ) then raise exception 'NOT_ADJACENT'; end if;

  -- 섬 지역 잠금: 육지 도는 검증 없음, 섬은 해금 필요(§20)
  if v_is_island and not exists (
    select 1 from user_province_unlocks
    where user_id = p_user_id and province_id = v_province
  ) then raise exception 'REGION_LOCKED'; end if;

  -- 3. 전설 경로: 출현지 && 도 100% && 쿨타임 경과 → 확률 판정 없이 세션 확정
  if v_is_site and v_leg_dex is not null then
    select pct into v_pct from v_user_province_progress
    where user_id = p_user_id and province_id = v_province;
    if coalesce(v_pct, 0) >= 1.0 then
      select next_available_at into v_cd from legendary_cooldowns
      where user_id = p_user_id and province_id = v_province;
      if v_cd is not null and v_cd > now() then
        raise exception 'LEGENDARY_COOLDOWN';
      end if;
      -- pity는 tier 표시용으로만 읽는다. 실패당 증가는 catch-attempt 소관(§19)
      select coalesce(fail_visits, 0) into v_fail from legendary_pity
      where user_id = p_user_id and province_id = v_province;
      insert into encounter_sessions (user_id, city_id, dex_no, is_legendary, spawn_rate_used)
      values (p_user_id, p_to_city_id, v_leg_dex, true, null)
      returning id, expires_at, dex_no, is_legendary
        into v_sess_id, v_sess_exp, v_sess_dex, v_sess_leg;
      v_rate := calc_legendary_catch_rate(coalesce(v_fail, 0)::smallint);
    end if;
  end if;

  -- 4. 일반 스폰: 도착 생활권 풀(공통 3 + 고유 5) 각 항목 독립 판정, 첫 성공 스폰(§12)
  if v_sess_id is null then
    for v_rec in
      select rsp.dex_no, ps.bst
      from region_spawn_pool rsp
      join pokemon_species ps on ps.dex_no = rsp.dex_no
      where rsp.living_area_id = v_living and rsp.is_legendary = false
      order by rsp.category, rsp.id
    loop
      v_sr := calc_spawn_rate(v_rec.bst);
      if random() < v_sr then
        v_spawn_dex := v_rec.dex_no;
        v_spawn_rate := v_sr;
        v_rate := calc_catch_rate(v_rec.bst);
        exit;
      end if;
    end loop;
    if v_spawn_dex is not null then
      insert into encounter_sessions (user_id, city_id, dex_no, is_legendary, spawn_rate_used)
      values (p_user_id, p_to_city_id, v_spawn_dex, false, v_spawn_rate)
      returning id, expires_at, dex_no, is_legendary
        into v_sess_id, v_sess_exp, v_sess_dex, v_sess_leg;
    end if;
  end if;

  -- 5. 이동 확정
  update user_progress set current_city_id = p_to_city_id, updated_at = now()
  where user_id = p_user_id;

  -- 6. unlock-check 대체(§10.1): 내륙 전부 100%면 섬 지역 idempotent 해금.
  --    이동은 도감 진행률을 바꾸지 않으므로 사실상 재확인이다.
  if check_endgame_unlock(p_user_id) then
    insert into user_province_unlocks (user_id, province_id)
    select p_user_id, id from provinces where is_island_endgame = true
    on conflict do nothing;
  end if;

  -- 조우 응답: 원시 %는 절대 노출하지 않고 4단계 tier만(§13.1).
  if v_sess_id is not null then
    v_encounter := json_build_object(
      'session_id', v_sess_id,
      'dex_no', v_sess_dex,
      'is_legendary', v_sess_leg,
      'catch_rate_tier', calc_catch_rate_tier(v_rate),
      'expires_at', v_sess_exp
    );
  end if;

  return json_build_object(
    'moved', true,
    'current_city_id', p_to_city_id,
    'encounter', v_encounter
  );
end;
$$;

-- 3) catch-attempt 트랜잭션 코어 (DB.md §10 순서 그대로)
create or replace function public.fn_catch_attempt(p_user_id uuid, p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sess       encounter_sessions%rowtype;
  v_province   smallint;
  v_fail       smallint;
  v_rate       numeric;
  v_success    boolean;
  v_attempt_no smallint;
  v_status     text;
begin
  -- 1. encounter_sessions 행 잠금 — 이 함수가 잡는 유일한 락
  --    (§11 순서 규칙은 user_progress와 함께 잡을 때 얘기, 여기선 해당 없음)
  select * into v_sess from encounter_sessions where id = p_session_id for update;
  -- 타 유저 세션은 존재 여부를 흘리지 않는다(§20 user_id 재검증)
  if not found or v_sess.user_id <> p_user_id then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  -- 2. 세션 유효성 · 시도 횟수
  if v_sess.status <> 'pending' or v_sess.expires_at <= now() then
    raise exception 'SESSION_EXPIRED';
  end if;
  if v_sess.attempts_used >= 3 then
    raise exception 'NO_ATTEMPTS_LEFT';
  end if;

  -- 3. 확률 판정: 일반 = calc_catch_rate(bst), 전설 = calc_legendary_catch_rate(pity)
  if v_sess.is_legendary then
    select la.province_id into v_province
    from cities ci join living_areas la on la.id = ci.living_area_id
    where ci.id = v_sess.city_id;
    select coalesce(fail_visits, 0) into v_fail from legendary_pity
    where user_id = p_user_id and province_id = v_province;
    v_rate := calc_legendary_catch_rate(coalesce(v_fail, 0)::smallint);
  else
    select calc_catch_rate(ps.bst) into v_rate
    from pokemon_species ps where ps.dex_no = v_sess.dex_no;
  end if;

  v_success := random() < v_rate;
  v_attempt_no := v_sess.attempts_used + 1;

  insert into catch_attempts (session_id, attempt_no, catch_rate_used, success)
  values (p_session_id, v_attempt_no, v_rate, v_success);

  update encounter_sessions set attempts_used = v_attempt_no where id = p_session_id;

  -- 4. status 확정(caught/fled)·도감·pity·쿨다운은 트리거 몫 — 반영된 status만 재조회
  select status into v_status from encounter_sessions where id = p_session_id;

  -- 원시 rate는 절대 미포함(§13.1) — 감사 기록은 catch_attempts.catch_rate_used에 이미 있음
  return json_build_object(
    'success', v_success,
    'attempt_no', v_attempt_no,
    'attempts_left', 3 - v_attempt_no,
    'status', v_status,
    'catch_rate_tier', calc_catch_rate_tier(v_rate)
  );
end;
$$;

alter function public.fn_catch_attempt(uuid, uuid) owner to postgres;

-- 유저가 직접 못 부르게 — service_role(EF)만 실행(§20)
revoke all on function public.fn_catch_attempt(uuid, uuid) from public;
revoke all on function public.fn_catch_attempt(uuid, uuid) from anon;
revoke all on function public.fn_catch_attempt(uuid, uuid) from authenticated;
grant execute on function public.fn_catch_attempt(uuid, uuid) to service_role;

-- 4) 격리 탭 진입 시 세션 tier 조회 (DB.md §13.1 "격리 탭 진입 시 세션 조회 응답")
-- SECURITY INVOKER: encounter_sessions/legendary_pity의 select_own RLS가 그대로 적용돼
-- 본인 세션이 아니면 null — rate가 아닌 tier text만 반환하므로 authenticated 허용 가능.
create or replace function public.calc_session_catch_tier(p_session_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select calc_catch_rate_tier(
    case when es.is_legendary
      then calc_legendary_catch_rate(coalesce(lp.fail_visits, 0)::smallint)
      else calc_catch_rate(ps.bst)
    end
  )
  from encounter_sessions es
  join pokemon_species ps on ps.dex_no = es.dex_no
  join cities ci on ci.id = es.city_id
  join living_areas la on la.id = ci.living_area_id
  left join legendary_pity lp
    on lp.user_id = es.user_id and lp.province_id = la.province_id
  where es.id = p_session_id;
$$;

alter function public.calc_session_catch_tier(uuid) owner to postgres;

revoke all on function public.calc_session_catch_tier(uuid) from public;
revoke all on function public.calc_session_catch_tier(uuid) from anon;
grant execute on function public.calc_session_catch_tier(uuid) to authenticated;
grant execute on function public.calc_session_catch_tier(uuid) to service_role;
