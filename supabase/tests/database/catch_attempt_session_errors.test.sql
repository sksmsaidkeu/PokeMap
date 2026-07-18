-- fn_catch_attempt: 이미 확정된 세션(caught/fled) vs 실제 만료를 구분한 에러 코드 테스트
-- (E2E 리포트 B4, DB.md §10.2) — 이전엔 둘 다 SESSION_EXPIRED라 재시도 원인이 오도됐다.
begin;
select plan(2);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000bb', 'catch-attempt-errors-test@local');
insert into profiles (id, nickname) values ('00000000-0000-0000-0000-0000000000bb', 'catch-attempt-errors-test');

-- 이미 포획 완료된 세션(status='caught', 아직 만료 전)에 재시도
insert into encounter_sessions (id, user_id, city_id, dex_no, status, expires_at)
select
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000bb',
  (select id from cities limit 1),
  (select dex_no from pokemon_species order by dex_no limit 1),
  'caught',
  now() + interval '2 minutes';

select throws_like(
  $$select fn_catch_attempt('00000000-0000-0000-0000-0000000000bb'::uuid, '00000000-0000-0000-0000-0000000000c1'::uuid)$$,
  'SESSION_ALREADY_RESOLVED',
  '이미 확정된 세션(caught) 재시도는 SESSION_ALREADY_RESOLVED — SESSION_EXPIRED로 오도하지 않는다'
);

-- 아직 pending이지만 실제로 시간이 지나 만료된 세션
insert into encounter_sessions (id, user_id, city_id, dex_no, status, expires_at)
select
  '00000000-0000-0000-0000-0000000000c2',
  '00000000-0000-0000-0000-0000000000bb',
  (select id from cities limit 1),
  (select dex_no from pokemon_species order by dex_no limit 1),
  'pending',
  now() - interval '1 minute';

select throws_like(
  $$select fn_catch_attempt('00000000-0000-0000-0000-0000000000bb'::uuid, '00000000-0000-0000-0000-0000000000c2'::uuid)$$,
  'SESSION_EXPIRED',
  '실제로 만료된 pending 세션은 SESSION_EXPIRED'
);

select * from finish();
rollback;
