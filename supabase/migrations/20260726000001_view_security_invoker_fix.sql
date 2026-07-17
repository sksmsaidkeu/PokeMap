-- 보안 갭 수정: v_user_province_progress / v_user_tier에 security_invoker 누락 (DB.md §7, §18)
--
-- PostgreSQL 15+ 뷰는 기본적으로 소유자(postgres) 권한으로 실행된다. 두 뷰 모두
-- anon/authenticated에 GRANT ALL이 걸려 있고, app/map/page.tsx 및 lib/game/pokedex-data.ts가
-- anon key + 유저 세션으로 이 뷰를 직접 SELECT한다(service_role이 아님) — security_invoker
-- 없이는 profiles/user_pokedex의 select_own RLS가 무시되어 타 유저 진행률이 노출된다.
--
-- 뷰 정의 SQL 자체는 변경하지 않는다(v_region_pokedex_status처럼 조인 조건에 auth.uid()를
-- 추가하지 않음) — v_user_province_progress는 profiles를 CROSS JOIN하는 최상위 테이블로
-- 삼으므로 security_invoker=true만으로 profiles.select_own RLS가 재적용되어 충분하다.
-- auth.uid()를 조인 조건에 하드코딩하면 check_endgame_unlock(SECURITY DEFINER, 소유자
-- postgres가 RLS를 우회하는 컨텍스트라 auth.uid()가 NULL)이 항상 0행을 보게 되어
-- 해금 판정 자체가 깨진다.
alter view public.v_user_province_progress set (security_invoker = true);
alter view public.v_user_tier set (security_invoker = true);
