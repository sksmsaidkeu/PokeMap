-- 지역(시/군) 클릭 시 포획/미포획 목록 조회용 뷰 (DB.md §18).
-- region_spawn_pool(select_all)과 user_pokedex(select_own)를 조인한다.
--
-- SECURITY INVOKER 필수, DEFINER 금지: PostgreSQL 15+ 뷰는 기본적으로 소유자(postgres)
-- 권한으로 실행되어 user_pokedex의 select_own RLS를 우회한다(=SECURITY DEFINER와 동일 효과,
-- 타 유저의 포획 기록이 그대로 노출됨). security_invoker=true로 조회자의 auth.uid() 컨텍스트에서
-- RLS가 재적용되게 한다. 조인 조건에도 auth.uid()를 명시해 이중으로 자기 자신 데이터만 보게 한다.
CREATE OR REPLACE VIEW "public"."v_region_pokedex_status"
WITH (security_invoker = true) AS
SELECT
  "ci"."id" AS "city_id",
  "rsp"."living_area_id",
  "rsp"."dex_no",
  "rsp"."category",
  "rsp"."is_legendary",
  ("up"."user_id" IS NOT NULL) AS "caught",
  COALESCE("up"."catch_count", 0) AS "catch_count"
FROM "public"."cities" "ci"
JOIN "public"."region_spawn_pool" "rsp" ON "rsp"."living_area_id" = "ci"."living_area_id"
LEFT JOIN "public"."user_pokedex" "up"
  ON "up"."dex_no" = "rsp"."dex_no" AND "up"."user_id" = auth.uid();

ALTER VIEW "public"."v_region_pokedex_status" OWNER TO "postgres";

GRANT SELECT ON TABLE "public"."v_region_pokedex_status" TO "anon";
GRANT SELECT ON TABLE "public"."v_region_pokedex_status" TO "authenticated";
GRANT SELECT ON TABLE "public"."v_region_pokedex_status" TO "service_role";
