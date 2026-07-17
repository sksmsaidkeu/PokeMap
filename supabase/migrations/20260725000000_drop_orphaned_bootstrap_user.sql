-- main 브랜치 merge(PR #5) 때 20260716210000_bootstrap_user_fn.sql이 충돌 없이
-- 같이 들어왔으나, 이 저장소의 bootstrap-location Edge Function은 fn_bootstrap_location만
-- 호출한다(20260724000000_bootstrap_nickname_and_manual_city.sql) — bootstrap_user는
-- 아무도 호출하지 않는 고아 함수라 드랍한다.
drop function if exists bootstrap_user(uuid, text, double precision, double precision, integer);
