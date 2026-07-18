-- 도 완성 배너(PRD §8.4)의 판정 근거 검증: fn_catch_attempt가 응답 province_completed에
-- 도 이름을 싣는 조건은 v_user_province_progress.pct가 이번 포획으로 <1.0 → >=1.0 전환될 때다.
-- fn_catch_attempt 자체는 random() 성공 판정이라 결정적으로 테스트할 수 없어(성공 강제 불가),
-- 배너가 의존하는 두 불변식(전설 제외 + 마지막 종에서의 100% 전환)을 뷰 수준에서 검증한다.
-- province_id=15(경상북도): 일반 풀 22종, legendary_dex_no=889(시드 기준).
begin;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000cc', 'province-complete-test@local');
insert into profiles (id, nickname) values ('00000000-0000-0000-0000-0000000000cc', 'province-complete-test');

-- 1. 전설(889)만 포획해도 도 진행률은 0 — 전설은 분모에서 제외(§16 뷰, §18)라 배너 오탐 없음
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
values ('00000000-0000-0000-0000-0000000000cc', 889, 1, now(), 1);

select is(
  (select pct from v_user_province_progress
   where user_id = '00000000-0000-0000-0000-0000000000cc' and province_id = 15),
  0::numeric,
  '전설 포획은 도 진행률에 포함되지 않는다(전설 포획으론 100% 전환 불가)'
);

-- 2. 일반 종을 마지막 1종만 남기고 포획 → 아직 < 100%
with pool as (
  select distinct rsp.dex_no
  from region_spawn_pool rsp join living_areas la on la.id = rsp.living_area_id
  where la.province_id = 15 and la.is_endgame_area = false and rsp.is_legendary = false
)
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
select '00000000-0000-0000-0000-0000000000cc', dex_no, 1, now(), 1
from pool where dex_no <> (select min(dex_no) from pool);

select cmp_ok(
  (select pct from v_user_province_progress
   where user_id = '00000000-0000-0000-0000-0000000000cc' and province_id = 15),
  '<', 1.0::numeric,
  '마지막 1종 남으면 아직 100% 미만(포획 직전 스냅샷)'
);

-- 3. 마지막 종 포획 → 100% 도달(=배너 트리거 전환)
with pool as (
  select distinct rsp.dex_no
  from region_spawn_pool rsp join living_areas la on la.id = rsp.living_area_id
  where la.province_id = 15 and la.is_endgame_area = false and rsp.is_legendary = false
)
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
select '00000000-0000-0000-0000-0000000000cc', (select min(dex_no) from pool), 1, now(), 1;

select cmp_ok(
  (select pct from v_user_province_progress
   where user_id = '00000000-0000-0000-0000-0000000000cc' and province_id = 15),
  '>=', 1.0::numeric,
  '마지막 종 포획 시 100% 도달 — <1.0→>=1.0 전환이 배너를 띄운다'
);

select * from finish();
rollback;
