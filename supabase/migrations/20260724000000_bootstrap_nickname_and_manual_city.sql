-- main 브랜치(로그인/온보딩 스트림)의 온보딩 기능을 Public 스키마 위에 이식:
-- 가입 시 실제 닉네임 입력 + GPS 실패 시 도/시 수동 선택.
-- main은 이 스키마보다 여러 마이그레이션 앞선 시점(§17 이후 island_reachability 등 없음)이라
-- 원본 마이그레이션을 그대로 가져올 수 없어, 기능만 Public 최신 스키마 위에 재구현한다.
-- (기존 함수는 3-인자라 시그니처가 달라 별개 오버로드로 남는다 — 명시적으로 드랍)
drop function if exists fn_bootstrap_location(uuid, double precision, double precision);

create or replace function fn_bootstrap_location(
  p_user_id uuid,
  p_nickname text,
  p_lat double precision,
  p_lng double precision,
  p_city_id integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city integer;
  v_city_name text;
  v_fallback boolean;
begin
  -- idempotent: 이미 시작 위치가 있으면 기존 값 반환 — 재호출로 위치/닉네임이 바뀌면
  -- move-city의 인접성/해금 검증을 우회하는 "무료 순간이동"이 되므로 절대 갱신하지 않는다.
  select current_city_id into v_city
  from user_progress where user_id = p_user_id;
  if found then
    select name into v_city_name from cities where id = v_city;
    return json_build_object('city_id', v_city, 'city_name', v_city_name, 'fallback', false, 'created', false);
  end if;

  -- 1) 수동 선택(GPS 실패 시 도→시 직접 선택). 잠긴 지역(§16 섬 도 전체/엔드게임 생활권) 제외.
  if p_city_id is not null then
    select c.id, c.name into v_city, v_city_name
    from cities c
    join living_areas la on la.id = c.living_area_id
    join provinces pr on pr.id = la.province_id
    where c.id = p_city_id
      and pr.is_island_endgame = false
      and la.is_endgame_area = false;
    if not found then raise exception 'INVALID_CITY'; end if;
    v_fallback := false;

  -- 2) GPS 좌표 최근접(point는 (lng, lat) 순서). 잠긴 지역은 후보에서 제외.
  elsif p_lat is not null and p_lng is not null then
    select c.id, c.name into v_city, v_city_name
    from cities c
    join living_areas la on la.id = c.living_area_id
    join provinces pr on pr.id = la.province_id
    where pr.is_island_endgame = false
      and la.is_endgame_area = false
    order by c.centroid <-> point(p_lng, p_lat)
    limit 1;
    v_fallback := v_city is null;
  end if;

  -- 3) 좌표/수동 선택 없음 또는 매칭 실패 시 서울특별시로 폴백(PRD §5).
  if v_city is null then
    select c.id, c.name into v_city, v_city_name
    from cities c
    join living_areas la on la.id = c.living_area_id
    join provinces pr on pr.id = la.province_id
    where pr.name = '서울특별시'
    order by c.id
    limit 1;
    v_fallback := true;
  end if;
  if v_city is null then raise exception 'NO_CITY_DATA'; end if;

  -- 멱등: 같은 user_id 재시도면 기존 프로필 유지, 다른 유저가 닉네임을 선점했으면 거부.
  begin
    insert into profiles (id, nickname) values (p_user_id, p_nickname);
  exception when unique_violation then
    if not exists (select 1 from profiles where id = p_user_id) then
      raise exception 'NICKNAME_TAKEN';
    end if;
  end;

  insert into user_progress (user_id, current_city_id)
  values (p_user_id, v_city)
  on conflict (user_id) do nothing;

  return json_build_object('city_id', v_city, 'city_name', v_city_name, 'fallback', v_fallback, 'created', true);
end;
$$;

alter function fn_bootstrap_location(uuid, text, double precision, double precision, integer) owner to postgres;

revoke all on function fn_bootstrap_location(uuid, text, double precision, double precision, integer) from public;
revoke all on function fn_bootstrap_location(uuid, text, double precision, double precision, integer) from anon;
revoke all on function fn_bootstrap_location(uuid, text, double precision, double precision, integer) from authenticated;
grant execute on function fn_bootstrap_location(uuid, text, double precision, double precision, integer) to service_role;
