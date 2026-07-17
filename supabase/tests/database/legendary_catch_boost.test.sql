-- calc_legendary_catch_rate 경계값 테스트 (DB.md §6.3.1, PRD.md §19).
-- 도내 금프레임(catch_count>=50) 보정: 마리당 +0.5%p, 상한 +10%p, 기존 pity(3%+실패당1%p)와
-- 가산 후 단일 clamp. province_id=15(경상북도)는 시드 데이터 기준 region_spawn_pool distinct
-- dex_no가 31개라 상한(20마리) 테스트가 가능해 선택함.
begin;
select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000aa', 'legendary-boost-test@local');
insert into profiles (id, nickname) values ('00000000-0000-0000-0000-0000000000aa', 'legendary-boost-test');

select is(
  calc_legendary_catch_rate(0::smallint, '00000000-0000-0000-0000-0000000000aa', 15::smallint),
  0.030::numeric,
  '금프레임 0마리 = 기본 3%'
);

with dex as (
  select distinct rsp.dex_no
  from region_spawn_pool rsp join living_areas la on la.id = rsp.living_area_id
  where la.province_id = 15
  order by rsp.dex_no
)
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
select '00000000-0000-0000-0000-0000000000aa', dex_no, 50, now(), 1 from dex limit 1;

select is(
  calc_legendary_catch_rate(0::smallint, '00000000-0000-0000-0000-0000000000aa', 15::smallint),
  0.035::numeric,
  '금프레임 1마리 = 3% + 0.5%p'
);

with dex as (
  select distinct rsp.dex_no
  from region_spawn_pool rsp join living_areas la on la.id = rsp.living_area_id
  where la.province_id = 15
  order by rsp.dex_no
)
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
select '00000000-0000-0000-0000-0000000000aa', dex_no, 50, now(), 1 from dex offset 1 limit 19;

select is(
  calc_legendary_catch_rate(0::smallint, '00000000-0000-0000-0000-0000000000aa', 15::smallint),
  0.130::numeric,
  '금프레임 20마리 = 상한 +10%p 도달(3%+10%)'
);

with dex as (
  select distinct rsp.dex_no
  from region_spawn_pool rsp join living_areas la on la.id = rsp.living_area_id
  where la.province_id = 15
  order by rsp.dex_no
)
insert into user_pokedex (user_id, dex_no, catch_count, first_caught_at, first_caught_city_id)
select '00000000-0000-0000-0000-0000000000aa', dex_no, 50, now(), 1 from dex offset 20 limit 1;

select is(
  calc_legendary_catch_rate(0::smallint, '00000000-0000-0000-0000-0000000000aa', 15::smallint),
  0.130::numeric,
  '금프레임 21마리도 상한 +10%p에서 clamp 유지'
);

select is(
  calc_legendary_catch_rate(5::smallint, '00000000-0000-0000-0000-0000000000aa', 15::smallint),
  0.180::numeric,
  '실패 5회(pity +5%p) + 금프레임 상한(+10%p) 가산 = 3%+5%+10%'
);

select * from finish();
rollback;
