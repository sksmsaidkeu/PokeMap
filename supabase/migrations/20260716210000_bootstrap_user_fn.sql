-- GPS 온보딩: profiles + user_progress를 한 트랜잭션으로 원자 생성한다.
-- supabase-js에 단일 트랜잭션 경로가 없어 DB 함수로 감싼다(DB.md §9, bootstrap-location).
-- SECURITY DEFINER로 실행돼 RLS(no_direct_write)를 우회한다 — 요청자 검증은 Edge Function이 JWT로 수행한다.
CREATE OR REPLACE FUNCTION "public"."bootstrap_user"(
  "p_user_id" "uuid",
  "p_nickname" "text",
  "p_lat" double precision,
  "p_lng" double precision
)
RETURNS TABLE("city_id" integer, "city_name" "text", "fallback" boolean)
LANGUAGE "plpgsql"
SECURITY DEFINER
SET "search_path" = "public", "pg_temp"
AS $$
declare
  v_city_id integer;
  v_city_name text;
  v_fallback boolean := true;
begin
  -- centroid는 point(lng, lat) 순서. 잠긴 섬(§16)에서 시작하지 않도록 육지 도만 후보.
  if p_lat is not null and p_lng is not null then
    select c.id, c.name
      into v_city_id, v_city_name
      from cities c
      join living_areas la on la.id = c.living_area_id
      join provinces pr on pr.id = la.province_id
     where pr.is_island_endgame = false
     order by c.centroid <-> point(p_lng, p_lat)
     limit 1;
    if found then
      v_fallback := false;
    end if;
  end if;

  -- 좌표 없음/무효 또는 매칭 실패 시 서울특별시(cities.id = 1)로 폴백(PRD §5).
  if v_city_id is null then
    select c.id, c.name into v_city_id, v_city_name from cities c where c.id = 1;
    v_fallback := true;
  end if;

  if v_city_id is null then
    raise exception 'NO_START_CITY';
  end if;

  -- 멱등: 같은 user_id 재시도면 기존 프로필 유지, 다른 유저가 닉네임을 선점했으면 거부.
  begin
    insert into profiles (id, nickname) values (p_user_id, p_nickname);
  exception when unique_violation then
    if not exists (select 1 from profiles where id = p_user_id) then
      raise exception 'NICKNAME_TAKEN';
    end if;
  end;

  insert into user_progress (user_id, current_city_id)
  values (p_user_id, v_city_id)
  on conflict (user_id) do update set current_city_id = excluded.current_city_id;

  return query select v_city_id, v_city_name, v_fallback;
end;
$$;

ALTER FUNCTION "public"."bootstrap_user"("uuid", "text", double precision, double precision) OWNER TO "postgres";

-- 기본 권한(§baseline ALTER DEFAULT PRIVILEGES)은 anon/authenticated에도 EXECUTE를 주므로 회수.
-- 임의 p_user_id로 타 유저 프로필 생성을 막기 위해 service_role만 실행 가능(CLAUDE.md §20).
REVOKE ALL ON FUNCTION "public"."bootstrap_user"("uuid", "text", double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION "public"."bootstrap_user"("uuid", "text", double precision, double precision) FROM "anon";
REVOKE ALL ON FUNCTION "public"."bootstrap_user"("uuid", "text", double precision, double precision) FROM "authenticated";
GRANT EXECUTE ON FUNCTION "public"."bootstrap_user"("uuid", "text", double precision, double precision) TO "service_role";
