-- 전설 포획확률 도내 금프레임 보정 (DB.md §6.3.1)
-- 기존 pity(기본 3% + 실패당 영구 +1%p)와는 별개의 가산 항목: 그 도의 스폰 풀
-- 소속 포켓몬 중 catch_count>=50(금프레임) 달성 마리 수 * 0.5%p, 상한 +10%p.
-- 확률 계산은 이 DB 함수 안에서만 일어난다(§22) - 파라미터 추가로 시그니처가
-- 바뀌므로 기존 1-인자 함수를 대체(dependent 함수 3곳도 함께 재정의).

drop function if exists public.calc_legendary_catch_rate(smallint);

create or replace function public.calc_legendary_catch_rate(
  fail_visits smallint,
  p_user_id uuid,
  p_province_id smallint
) returns numeric as $$
  select least(1.0, greatest(0,
    0.03 + fail_visits * 0.01
    + least(0.10, (
        select count(distinct rsp.dex_no)
        from region_spawn_pool rsp
        join living_areas la on la.id = rsp.living_area_id
        join user_pokedex up on up.user_id = p_user_id and up.dex_no = rsp.dex_no
        where la.province_id = p_province_id and up.catch_count >= 50
      ) * 0.005)
  ));
$$ language sql stable;

alter function public.calc_legendary_catch_rate(smallint, uuid, smallint) owner to postgres;

-- fn_move_city: 전설 경로 확률 계산 호출부만 변경, 나머지 로직 동일
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
  select current_city_id into v_current
  from user_progress where user_id = p_user_id for update;
  if not found then raise exception 'NO_PROGRESS'; end if;

  select c.living_area_id, la.province_id, pr.is_island_endgame,
         c.is_legendary_site, pr.legendary_dex_no
    into v_living, v_province, v_is_island, v_is_site, v_leg_dex
  from cities c
  join living_areas la on la.id = c.living_area_id
  join provinces pr on pr.id = la.province_id
  where c.id = p_to_city_id;
  if not found then raise exception 'INVALID_INPUT'; end if;

  if not exists (
    select 1 from v_city_neighbors
    where city_id = v_current and neighbor_id = p_to_city_id
  ) then raise exception 'NOT_ADJACENT'; end if;

  if v_is_island and not exists (
    select 1 from user_province_unlocks
    where user_id = p_user_id and province_id = v_province
  ) then raise exception 'REGION_LOCKED'; end if;

  if v_is_site and v_leg_dex is not null then
    select pct into v_pct from v_user_province_progress
    where user_id = p_user_id and province_id = v_province;
    if coalesce(v_pct, 0) >= 1.0 then
      select next_available_at into v_cd from legendary_cooldowns
      where user_id = p_user_id and province_id = v_province;
      if v_cd is not null and v_cd > now() then
        raise exception 'LEGENDARY_COOLDOWN';
      end if;
      select coalesce(fail_visits, 0) into v_fail from legendary_pity
      where user_id = p_user_id and province_id = v_province;
      insert into encounter_sessions (user_id, city_id, dex_no, is_legendary, spawn_rate_used)
      values (p_user_id, p_to_city_id, v_leg_dex, true, null)
      returning id, expires_at, dex_no, is_legendary
        into v_sess_id, v_sess_exp, v_sess_dex, v_sess_leg;
      v_rate := calc_legendary_catch_rate(coalesce(v_fail, 0)::smallint, p_user_id, v_province);
    end if;
  end if;

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

  update user_progress set current_city_id = p_to_city_id, updated_at = now()
  where user_id = p_user_id;

  if check_endgame_unlock(p_user_id) then
    insert into user_province_unlocks (user_id, province_id)
    select p_user_id, id from provinces where is_island_endgame = true
    on conflict do nothing;
  end if;

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

alter function public.fn_move_city(uuid, integer) owner to postgres;
revoke all on function public.fn_move_city(uuid, integer) from public;
revoke all on function public.fn_move_city(uuid, integer) from anon;
revoke all on function public.fn_move_city(uuid, integer) from authenticated;
grant execute on function public.fn_move_city(uuid, integer) to service_role;

-- fn_catch_attempt: 전설 확률 판정 호출부만 변경, 나머지 로직 동일
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
  select * into v_sess from encounter_sessions where id = p_session_id for update;
  if not found or v_sess.user_id <> p_user_id then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_sess.status <> 'pending' or v_sess.expires_at <= now() then
    raise exception 'SESSION_EXPIRED';
  end if;
  if v_sess.attempts_used >= 3 then
    raise exception 'NO_ATTEMPTS_LEFT';
  end if;

  if v_sess.is_legendary then
    select la.province_id into v_province
    from cities ci join living_areas la on la.id = ci.living_area_id
    where ci.id = v_sess.city_id;
    select coalesce(fail_visits, 0) into v_fail from legendary_pity
    where user_id = p_user_id and province_id = v_province;
    v_rate := calc_legendary_catch_rate(coalesce(v_fail, 0)::smallint, p_user_id, v_province);
  else
    select calc_catch_rate(ps.bst) into v_rate
    from pokemon_species ps where ps.dex_no = v_sess.dex_no;
  end if;

  v_success := random() < v_rate;
  v_attempt_no := v_sess.attempts_used + 1;

  insert into catch_attempts (session_id, attempt_no, catch_rate_used, success)
  values (p_session_id, v_attempt_no, v_rate, v_success);

  update encounter_sessions set attempts_used = v_attempt_no where id = p_session_id;

  select status into v_status from encounter_sessions where id = p_session_id;

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
revoke all on function public.fn_catch_attempt(uuid, uuid) from public;
revoke all on function public.fn_catch_attempt(uuid, uuid) from anon;
revoke all on function public.fn_catch_attempt(uuid, uuid) from authenticated;
grant execute on function public.fn_catch_attempt(uuid, uuid) to service_role;

-- calc_session_catch_tier: 격리 탭 재조회용 tier 계산, 전설 분기만 변경
create or replace function public.calc_session_catch_tier(p_session_id uuid)
returns text
language sql
stable
set search_path = public
as $$
  select calc_catch_rate_tier(
    case when es.is_legendary
      then calc_legendary_catch_rate(coalesce(lp.fail_visits, 0)::smallint, es.user_id, la.province_id)
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
