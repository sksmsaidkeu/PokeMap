-- unlock-check 확정(DB.md §9·§10.1): 독립 EF 없이 흡수.
-- 섬 해금 조건(내륙 전체 100%)이 실제로 바뀌는 유일한 시점은 포획 성공인데
-- 평가가 fn_move_city 6단계에만 있어 내륙 마지막 포획 직후 섬 이동이 한 번
-- 거부되는 1이동 지연이 있었다 → 포획 성공 경로에 동일 블록 추가.
-- 아래는 20260719000000_fn_catch_attempt의 본문 그대로 + 5단계 블록만 추가.
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

  -- 5. unlock-check(§10.1): 해금 조건이 바뀌는 유일한 지점이 포획 성공이므로 여기서 평가.
  --    trg_pokedex_upsert(AFTER INSERT on catch_attempts)가 이미 도감을 갱신한 뒤다.
  if v_success and check_endgame_unlock(p_user_id) then
    insert into user_province_unlocks (user_id, province_id)
    select p_user_id, id from provinces where is_island_endgame = true
    on conflict do nothing;
  end if;

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

-- CREATE OR REPLACE는 기존 권한을 유지하지만 원본 마이그레이션과 동일 패턴으로 재고정(§20)
alter function public.fn_catch_attempt(uuid, uuid) owner to postgres;

revoke all on function public.fn_catch_attempt(uuid, uuid) from public;
revoke all on function public.fn_catch_attempt(uuid, uuid) from anon;
revoke all on function public.fn_catch_attempt(uuid, uuid) from authenticated;
grant execute on function public.fn_catch_attempt(uuid, uuid) to service_role;
