-- fn_catch_attempt: 이미 확정된 세션(caught/fled)과 실제 만료를 분리한 에러 코드로 반환
-- 기존엔 둘 다 SESSION_EXPIRED라 이미 포획된 세션 재시도가 "만료됨"으로 오도됨(E2E 리포트 B4)
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

  if v_sess.status <> 'pending' then
    raise exception 'SESSION_ALREADY_RESOLVED';
  end if;
  if v_sess.expires_at <= now() then
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

  -- unlock-check(§10.1): 해금 조건이 바뀌는 유일한 지점이 포획 성공이므로 여기서 평가.
  -- 20260728000000에서 이 블록이 누락돼 섬 지역 해금이 다음 move-city까지 지연되는
  -- 회귀가 있었다 — fn_catch_attempt를 다시 손대는 김에 복원.
  if v_success and check_endgame_unlock(p_user_id) then
    insert into user_province_unlocks (user_id, province_id)
    select p_user_id, id from provinces where is_island_endgame = true
    on conflict do nothing;
  end if;

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
