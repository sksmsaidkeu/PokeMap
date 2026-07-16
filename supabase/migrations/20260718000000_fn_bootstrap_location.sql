-- bootstrap-location 코어 (DB.md §9)
-- 가입 직후 GPS 좌표를 최근접 cities.centroid에 매칭해 user_progress를 생성한다.
-- move-city와 동일 패턴: EF는 JWT 검증만 하는 얇은 래퍼, 매칭/생성은
-- SECURITY DEFINER 함수로 격리하고 EXECUTE는 service_role에만 부여(§20).
create or replace function public.fn_bootstrap_location(
  p_user_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_city integer;
begin
  -- idempotent: 이미 시작 위치가 있으면 기존 값 반환(재호출은 에러가 아니다)
  select current_city_id into v_city
  from user_progress where user_id = p_user_id;
  if found then
    return json_build_object('current_city_id', v_city, 'created', false);
  end if;

  if p_lat is null or p_lng is null then
    -- GPS 권한 거부 폴백: 서버가 서울특별시 소속 시로 확정(CLAUDE.md §6)
    select c.id into v_city
    from cities c
    join living_areas la on la.id = c.living_area_id
    join provinces pr on pr.id = la.province_id
    where pr.name = '서울특별시'
    order by c.id
    limit 1;
  else
    -- point는 (x=경도, y=위도) 순서
    select id into v_city
    from cities
    order by centroid <-> point(p_lng, p_lat)
    limit 1;
  end if;
  if v_city is null then raise exception 'NO_CITY_DATA'; end if;

  -- user_progress FK가 profiles를 요구하는데 가입 시점엔 profiles 행이 없다.
  -- ponytail: 기본 닉네임 선생성 — 닉네임 설정 화면이 생기면 거기서 갱신
  -- uuid 전체 사용: left(uuid,8)은 profiles_nickname_key UNIQUE 충돌 시 500 dead-end
  insert into profiles (id, nickname)
  values (p_user_id, 'trainer-' || p_user_id::text)
  on conflict (id) do nothing;

  -- 동시 가입 더블클릭 레이스: 먼저 넣은 쪽이 이기고 나머지는 기존 값을 읽는다
  insert into user_progress (user_id, current_city_id)
  values (p_user_id, v_city)
  on conflict (user_id) do nothing;

  select current_city_id into v_city
  from user_progress where user_id = p_user_id;

  return json_build_object('current_city_id', v_city, 'created', true);
end;
$$;

alter function public.fn_bootstrap_location(uuid, double precision, double precision) owner to postgres;

-- 유저가 직접 못 부르게 — service_role(EF)만 실행(§20)
revoke all on function public.fn_bootstrap_location(uuid, double precision, double precision) from public;
revoke all on function public.fn_bootstrap_location(uuid, double precision, double precision) from anon;
revoke all on function public.fn_bootstrap_location(uuid, double precision, double precision) from authenticated;
grant execute on function public.fn_bootstrap_location(uuid, double precision, double precision) to service_role;
