# 도감(Pokedex) 작업 정리

담당 범위: `app/pokedex`, `components/pokedex/*`. 원본 스펙은 `PRD.md` §8.5/§16, DB 스펙은 `DB.md` 참고. 이 파트는 **읽기 전용**이다 — 포획 시 `user_pokedex` 갱신은 `catch-attempt` Edge Function + `trg_pokedex_upsert` 트리거가 자동 처리하므로 직접 쓰는 로직은 없다.

## 1. 데이터 소스 (이미 존재, 조회만 하면 됨)

| 용도 | 소스 |
|---|---|
| 유저가 잡은 포켓몬 목록 | `user_pokedex` (user_id, dex_no, first_caught_at, first_caught_city_id, catch_count) — RLS `select_own`이라 본인 것만 조회됨 |
| 포켓몬 마스터 정보 | `pokemon_species` (name_kr, type1/type2, bst, flavor_text) |
| 도별 배정 포켓몬 전체 목록 | `region_spawn_pool` → `living_areas` → `provinces` 조인 |
| 도별 진행률(%) | `v_user_province_progress` 뷰 (전설 제외, 일반종 기준) |
| 도 순서/이름 | `provinces` (17개) |

## 2. 라우트/컴포넌트 구조

- `app/pokedex/page.tsx` — 서버 컴포넌트, 비로그인 접근 불가(상위 라우팅 가드가 처리, 페이지 자체엔 별도 인증 로직 불필요)
- `components/pokedex/` 아래 분리:
  - 도별 그룹 섹션(프로그레스바 포함)
  - 포켓몬 카드(Locked/Unlocked 상태)
  - 상세 팝업(클릭 인터랙션 있는 리프 컴포넌트만 `use client`, CLAUDE.md §10)

## 3. 화면 요구사항 체크리스트

- [ ] 정렬 단위는 8개 지방이 아니라 **17개 도** — 지방(`pokemon_regions`)은 표시 분류일 뿐 그룹핑 기준 아님
- [ ] 각 도 그룹 안에 그 도 배정 포켓몬(공통+고유, 전설 제외) 나열
- [ ] 도별 완성률 프로그레스바 — 70%/100% 기준선 함께 표시
- [ ] Unlocked(포획됨): 컬러 일러스트, 클릭 시 상세 팝업(종족값/타입/도감 설명)
- [ ] Locked(미포획): 명도 0% 검은 실루엣, 클릭/탭 인터랙션 완전 비활성화(팝업 자체가 안 떠야 함)
- [ ] 재포획 시 최초 포획 시각/장소는 유지, `catch_count`만 누적 표시
- [ ] 비로그인 접근 차단 확인

## 4. 알려진 데이터 갭 / 결정 필요 사항

- [ ] `flavor_text`가 현재 전부 NULL(`pokemon.csv`에 없는 컬럼, DB.md §4.7). 실제 텍스트 수집 전까지 빈 값 처리 방식 결정 필요(예: "설명 준비 중").
- [ ] 전설 포켓몬은 도감엔 나오지만 진행률(%) 계산에서는 제외됨(`v_user_province_progress`가 `is_legendary=false`만 집계) — UI에서 전설 카드를 별도 섹션으로 뺄지 여부는 PRD 미명시, 디자인 결정 필요.

## 5. 담당 범위 아님 (참고만)

- 확률 계산/포획 판정 → `catch-attempt` Edge Function
- 도 해금 로직 → `unlock-check` (도감은 결과만 `v_user_province_progress`로 읽어서 표시)
