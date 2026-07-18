-- fn_catch_attempt: 이번 포획으로 도가 100% 완공됐는지(전설 출현 조건 충족) 응답에 실어보낸다.
-- PRD §8.4 결과 배너용. 진행률은 v_user_province_progress(전설·endgame 생활권 제외)를
-- 포획 직전/직후로 두 번 스냅샷해 <100% → 100% 전환일 때만 도 이름을 반환한다.
-- 전설 포켓몬은 진행률 분모에서 빠지므로(§18) 전설 포획으론 이 전환이 발생하지 않는다.
create or replace function public.fn_catch_attempt(p_user_id uuid, p_session_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sess       encounter_sessions%rowtype;
  v_province   smallint;
  v_prov_name  text;
  v_leg_dex    smallint;
  v_fail       smallint;
  v_rate       numeric;
  v_success    boolean;
  v_attempt_no smallint;
  v_status     text;
  v_pct_before numeric;
  v_pct_after  numeric;
  v_completed  text;
begin
  select * into v_sess from encounter_sessions where id = p_session_id for update;
  if not found or v_sess.user_id <> p_user_id then
    raise exception 'SESSION_NOT_FOUND';
  end if;

  if v_sess.status <> 'pending' then
    raise exception 'SESSION_ALREADY_RESOLVED';
  end if;
  if v_sess.expires_at <= now() then
    raise exception 'SESSION_EXPIRED';
  end if;
  if v_sess.attempts_used >= 3 then
    raise exception 'NO_ATTEMPTS_LEFT';
  end if;

  -- 세션 도시 → 도(전설 확률 판정 + 도 완성 감지 공용)
  select la.province_id, pr.name, pr.legendary_dex_no
    into v_province, v_prov_name, v_leg_dex
  from cities ci
  join living_areas la on la.id = ci.living_area_id
  join provinces pr on pr.id = la.province_id
  where ci.id = v_sess.city_id;

  if v_sess.is_legendary then
    select coalesce(fail_visits, 0) into v_fail from legendary_pity
    where user_id = p_user_id and province_id = v_province;
    v_rate := calc_legendary_catch_rate(coalesce(v_fail, 0)::smallint, p_user_id, v_province);
  else
    select calc_catch_rate(ps.bst) into v_rate
    from pokemon_species ps where ps.dex_no = v_sess.dex_no;
  end if;

  -- 포획으로 도감이 바뀌기 직전 진행률(§8.4 배너 전환 감지의 기준선)
  select pct into v_pct_before from v_user_province_progress
  where user_id = p_user_id and province_id = v_province;

  v_success := random() < v_rate;
  v_attempt_no := v_sess.attempts_used + 1;

  insert into catch_attempts (session_id, attempt_no, catch_rate_used, success)
  values (p_session_id, v_attempt_no, v_rate, v_success);

  update encounter_sessions set attempts_used = v_attempt_no where id = p_session_id;

  select status into v_status from encounter_sessions where id = p_session_id;

  -- unlock-check(§10.1): 해금 조건이 바뀌는 유일한 지점이 포획 성공이므로 여기서 평가.
  if v_success and check_endgame_unlock(p_user_id) then
    insert into user_province_unlocks (user_id, province_id)
    select p_user_id, id from provinces where is_island_endgame = true
    on conflict do nothing;
  end if;

  -- 도 완성 배너: 이번 포획으로 <100% → 100% 전환 && 그 도에 전설이 존재할 때만 도 이름 반환.
  -- trg_pokedex_upsert(AFTER INSERT)가 이미 user_pokedex를 갱신한 뒤라 여기서 재조회하면 반영됨.
  select pct into v_pct_after from v_user_province_progress
  where user_id = p_user_id and province_id = v_province;
  v_completed := case
    when v_success and v_leg_dex is not null
         and coalesce(v_pct_before, 0) < 1.0 and coalesce(v_pct_after, 0) >= 1.0
    then v_prov_name
    else null
  end;

  return json_build_object(
    'success', v_success,
    'attempt_no', v_attempt_no,
    'attempts_left', 3 - v_attempt_no,
    'status', v_status,
    'catch_rate_tier', calc_catch_rate_tier(v_rate),
    'province_completed', v_completed
  );
end;
$$;

alter function public.fn_catch_attempt(uuid, uuid) owner to postgres;
revoke all on function public.fn_catch_attempt(uuid, uuid) from public;
revoke all on function public.fn_catch_attempt(uuid, uuid) from anon;
revoke all on function public.fn_catch_attempt(uuid, uuid) from authenticated;
grant execute on function public.fn_catch_attempt(uuid, uuid) to service_role;
