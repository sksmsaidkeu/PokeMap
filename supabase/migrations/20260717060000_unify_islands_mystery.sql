-- 최종 히든 섬 통합 + 개명: 흩어져 있던 3개 엔드게임 지역
--   제주도(도 17) / 울릉권(생활권 37, 경북) / 옹진군(생활권 36, 인천)
-- 을 하나의 도 "미지의 섬"(province 17)으로 통합한다.
--
-- 안전성(map 팀 로직 불변 검증):
-- - check_endgame_unlock은 is_island_endgame=false 도만 100% 요구 → province 17(true)은 요구에서 제외.
-- - 울릉권/옹진군은 원래 is_endgame_area=true로 경북/인천 진행률에서 제외됐으므로, 도를 옮겨도 해금 수학 불변.
-- - fn_move_city/지도 잠금은 province.is_island_endgame=true로 옮겨진 섬 도시들을 그대로 게이트.
-- - 이동은 city_connections(도시 단위)로 판정하므로 도 소속 변경과 무관.
update provinces set name = '미지의 섬' where id = 17;

-- 도 이동 + endgame 플래그 정리(이제 도 전체가 is_island_endgame이라 생활권 플래그 불필요).
-- 진행률 뷰(is_endgame_area=false만 집계)에 포함되어 도감 카드 집합과 분모가 일치하게 된다.
update living_areas set province_id = 17, is_endgame_area = false where id in (36, 37);
