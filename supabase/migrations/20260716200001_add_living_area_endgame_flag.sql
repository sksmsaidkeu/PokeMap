-- 육지 도는 이동 제한이 없다는 팀 합의(20260716200000)는 유지하되, 도 전체가 아니라
-- 생활권 하나만 최종 히든 지역인 케이스(울릉권/옹진군)를 표현할 컬럼을 다시 추가한다.
-- provinces.is_island_endgame은 "도 전체"가 엔드게임인 제주도만 표현 가능하기 때문.
--
-- 병합 메모: main 브랜치에도 같은 타임스탬프의 파일이 있으나(bootstrap_user 5-인자
-- 오버로드에 대한 REVOKE/GRANT), 그 함수는 이 저장소 스키마에 존재하지 않는다 — 우리는
-- fn_bootstrap_location을 대신 쓰고(§ 20260724000000_bootstrap_nickname_and_manual_city.sql),
-- 그 마이그레이션이 자체적으로 권한을 관리한다. 병합 시 이 충돌은 "ours" 유지로 해결해도
-- 기능 손실이 없다.
alter table living_areas
  add column if not exists is_endgame_area boolean not null default false;
update living_areas set is_endgame_area = true where id = 37;
-- 울릉권(경상북도)
update living_areas set is_endgame_area = true where id = 36;
-- 옹진군(인천광역시);
