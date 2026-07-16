-- session-sweep 코어 (DB.md §9, §17)
-- 저장공간 정리 전용 — 만료 판정은 이미 조회 시점 now() 비교로 끝나므로(§17)
-- 여기서 pity/쿨다운을 건드리지 않는다(trg_session_flee는 catch_attempts INSERT
-- 트리거라 이 UPDATE로는 발화하지 않음). 호출자는 pg_cron과 수동 운영용 EF뿐.
create or replace function public.fn_session_sweep()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_swept integer;
  v_purged integer;
begin
  update encounter_sessions
  set status = 'fled'
  where status = 'pending' and expires_at < now();
  get diagnostics v_swept = row_count;

  delete from legendary_cooldowns
  where next_available_at < now();
  get diagnostics v_purged = row_count;

  return json_build_object('swept_sessions', v_swept, 'purged_cooldowns', v_purged);
end;
$$;

alter function public.fn_session_sweep() owner to postgres;

-- 유저가 직접 못 부르게 — service_role(EF)만 실행(§20)
revoke all on function public.fn_session_sweep() from public;
revoke all on function public.fn_session_sweep() from anon;
revoke all on function public.fn_session_sweep() from authenticated;
grant execute on function public.fn_session_sweep() to service_role;

-- 5분 주기 cron 등록 — 재실행해도 잡이 중복되지 않게 기존 잡 제거 후 등록
create extension if not exists pg_cron;

do $do$
begin
  if exists (select 1 from cron.job where jobname = 'session-sweep') then
    perform cron.unschedule('session-sweep');
  end if;
end;
$do$;

select cron.schedule('session-sweep', '*/5 * * * *', $job$select public.fn_session_sweep()$job$);
