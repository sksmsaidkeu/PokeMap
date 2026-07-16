-- 육지 도 이동 제한 해체(PRD.md §11/§18, DB.md §14) 이전 설계의 잔재 제거.
-- check_province_unlock(도당 70% 진행 시 해금)은 현재 스펙과 충돌 — 육지 도는 해금 조건이 없다.
DROP FUNCTION IF EXISTS "public"."check_province_unlock"("p_user_id" "uuid", "p_province_id" smallint);

ALTER TABLE "public"."living_areas" DROP CONSTRAINT IF EXISTS "living_areas_region_id_override_fkey";
ALTER TABLE "public"."living_areas" DROP COLUMN IF EXISTS "region_id_override";
ALTER TABLE "public"."living_areas" DROP COLUMN IF EXISTS "is_endgame_area";

-- profiles도 유저 데이터 테이블 — 클라이언트 직접 쓰기 금지(CLAUDE.md §12, §20).
-- 프로필 생성/수정은 이후 bootstrap-location Edge Function(service_role)에서 처리.
DROP POLICY IF EXISTS "insert_own" ON "public"."profiles";
DROP POLICY IF EXISTS "update_own" ON "public"."profiles";
CREATE POLICY "no_direct_write" ON "public"."profiles" USING (false) WITH CHECK (false);
