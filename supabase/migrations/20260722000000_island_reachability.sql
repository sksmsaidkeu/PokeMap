-- 최종 히든 지역 도달성 슬라이스 (DB.md §16, PRD §20)
-- 울릉도·독도(울릉권)/옹진군을 알로라지방으로 편입하고, 섬 항로 연결과
-- 생활권 단위 endgame 게이트를 추가한다. 제주도 포함 모든 섬이 지금까지
-- 육지 연결 행이 없어 해금 후에도 도달 불가였던 갭을 함께 해소.

-- 1. 알로라지방(7) 편입 — 도 단위 region_id(경상북도=가라르, 인천=관동)를 생활권 단위로 덮어씀.
--    컬럼은 20260716200000에서 legacy로 드랍됐으나 생활권 단위 지방 편입이 실제로 필요해져 재추가.
alter table living_areas
  add column if not exists region_id_override smallint references pokemon_regions(id);
update living_areas set region_id_override = 7 where id in (36, 37);

-- 2. 독도 시 추가(울릉권 소속). 스폰 풀은 생활권 단위라 울릉권 풀을 공유한다.
insert into cities (id, living_area_id, name, centroid, is_legendary_site)
values (164, 37, '독도', '(131.86425,37.2426)', false)
on conflict do nothing;

-- 3. 항로 연결 — fn_move_city 인접성 검증(§10.1 2단계)이 잠금 게이트보다 먼저라
--    연결 행이 없으면 해금해도 영원히 도달 불가. 실제 여객 항로를 따른다.
insert into city_connections (city_a_id, city_b_id) values
  (99, 162),  -- 완도군 ↔ 제주시
  (125, 127), -- 울릉군 ↔ 포항시
  (125, 164), -- 울릉군 ↔ 독도
  (4, 163)    -- 인천광역시 ↔ 옹진군
on conflict do nothing;

-- 4. 진행률 뷰에서 endgame 생활권 제외 — 포함하면 경상북도/인천 100%가
--    미해금 지역(울릉권/옹진군) 포획을 요구해 해금이 영구 불가능한 순환 의존이 된다.
create or replace view public.v_user_province_progress as
 select p.id as user_id,
        pr.id as province_id,
        count(distinct rsp.dex_no) as total_count,
        count(distinct up.dex_no) as caught_count,
        case
          when count(distinct rsp.dex_no) = 0 then 0::numeric
          else count(distinct up.dex_no)::numeric / count(distinct rsp.dex_no)::numeric
        end as pct
   from public.profiles p
   cross join public.provinces pr
   join public.living_areas la
     on la.province_id = pr.id and la.is_endgame_area = false
   join public.region_spawn_pool rsp
     on rsp.living_area_id = la.id and rsp.is_legendary = false
   left join public.user_pokedex up
     on up.user_id = p.id and up.dex_no = rsp.dex_no
  group by p.id, pr.id;

-- 5. fn_move_city: 잠금 게이트를 check_endgame_unlock 직접 평가로 교체.
--    user_province_unlocks 행 존재 검사로는 생활권 단위 endgame(울릉권/옹진군,
--    소속 도가 육지라 행이 안 생김)을 표현할 수 없다. 게이트 외 본문은
--    최신본(20260719000000)과 동일(전체 재정의는 plpgsql 특성상 불가피).
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
  v_area_end   boolean;
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
  select c.living_area_id, la.province_id, pr.is_island_endgame, la.is_endgame_area,
         c.is_legendary_site, pr.legendary_dex_no
    into v_living, v_province, v_is_island, v_area_end, v_is_site, v_leg_dex
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

  -- 최종 히든 지역 잠금(§16): 도 단위(제주도)든 생활권 단위(울릉권/옹진군)든
  -- 해금 조건이 동일(내륙 전 도 100%)하므로 check_endgame_unlock 하나로 판정
  if v_is_island or v_area_end then
    if not check_endgame_unlock(p_user_id) then
      raise exception 'REGION_LOCKED';
    end if;
  end if;

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
