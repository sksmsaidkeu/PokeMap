-- move-city 트랜잭션 코어 (DB.md §10.1)
-- JS 런타임으로는 FOR UPDATE + 조건부 INSERT 원자성을 보장할 수 없어
-- 락/판정을 plpgsql SECURITY DEFINER 함수로 격리한다. Edge Function은 JWT를
-- 검증한 뒤 service_role로 이 함수만 호출하는 얇은 래퍼다(§20).
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
  -- calc_catch_rate_tier 함수가 아직 없어 인라인 CASE. catch-attempt EF 작성 시 추출.
  if v_sess_id is not null then
    v_encounter := json_build_object(
      'session_id', v_sess_id,
      'dex_no', v_sess_dex,
      'is_legendary', v_sess_leg,
      'catch_rate_tier', case
        when v_rate < 0.30 then '매우 낮음'
        when v_rate < 0.50 then '낮음'
        when v_rate < 0.70 then '보통'
        else '높음' end,
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

alter function public.fn_move_city(uuid, integer) owner to postgres;

-- 유저가 직접 못 부르게 — service_role(EF)만 실행(§20)
revoke all on function public.fn_move_city(uuid, integer) from public;
revoke all on function public.fn_move_city(uuid, integer) from anon;
revoke all on function public.fn_move_city(uuid, integer) from authenticated;
grant execute on function public.fn_move_city(uuid, integer) to service_role;
