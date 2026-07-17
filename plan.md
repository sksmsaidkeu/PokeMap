# plan.md — 도감(Pokedex) 남은 작업 + 전체 개선안

담당: 도감 파트(`app/pokedex`, `components/pokedex/*`, `lib/game/pokedex-*`).
상세 배경은 `POKEDEX_TASKS.md`, 스펙은 `PRD.md` §8.5/§16, `DESIGN.md` §2.3.
스코프 표기 — 🟢 우리가 바로 가능 / 🔒 메인·팀 협의 또는 다른 브랜치 의존.

## 완료 (guidebook 브랜치)
- [x] 17개 도 순 그룹핑 + 도별 포켓몬 나열, 진행률 바(70%/100% 기준선, 전설 제외 분모)
- [x] Unlocked 컬러 카드 + 상세 팝업 / Locked 실루엣 + 클릭 비활성, 재포획 `catch_count` 누적 표시
- [x] 실데이터 연동(`getPokedexProvinceGroups`, 비로그인 시 graceful)
- [x] DESIGN.md 게임보이/몬스터볼 스타일(카드 + 상세 3-박스), 이름 검색 헤더, 완성도 프리뷰 모드
- [x] 포켓몬 스프라이트 이미지(로컬 번들 `public/sprites/pokemon/*.png`, Locked 실루엣, 폴백 처리)
- [x] 전설 카드 도 그룹 내 인라인 + 배지로 확정
- [x] 반응형·접근성 폴리시(PRD §23) — 색맹 대비, 360px 점검, 터치 타깃 44px, 팝업 a11y

## 완료 (main 브랜치 병합)
### 1. 상세 팝업 실데이터(키/몸무게/특성/도감설명) ✅ 완료
- [x] `pokemon_species`에 `height_dm`/`weight_hg`/`primary_ability`/`flavor_text` 컬럼 + 데이터
- PokeAPI에서 399종 전체 수집(`fetch_pokemon_details.py`), 마이그레이션으로 로컬 검증 후 원격 반영
- 9세대(스칼렛/바이올렛) 31종은 PokeAPI에 한국어 원문이 없어 AI가 영문 기반으로 임시 번역(공식 말투 맞춤) — PokeAPI가 한국어를 채우면 교체 예정

### 2. 비로그인 접근 차단 ✅ 완료
- [x] `/pokedex` 미로그인 접근 시 로그인으로 리다이렉트(PRD §5)
- `login`이 main에 병합되며 블로커 해소 — `page.tsx`에서 `auth.getUser()` 후 미로그인+프리뷰 아님이면 `redirect("/login")`. `?preview=*`는 QA용으로 가드 우회

### 3. 공통 헤더(§7) ✅ 완료
- [x] 등급 배지 + 트레이너명 + 설정/로그아웃을 도감 상단에 노출
- main에 병합된 공통 `AppHeader`(map과 공유) 재사용, `calc_user_tier` RPC + 프로필 닉네임 조회로 렌더

### 4. 실데이터 로그인 연동 마무리 ✅ 완료
- [x] 프리뷰 모드 → 실제 로그인 유저 데이터로 검증/전환
- 실제 테스트 계정으로 가입→이동→조우→포획 전 루프를 원격 프로젝트에 직접 실행해 검증(회원가입 → `bootstrap-location` → `move-city` → `catch-attempt`). `user_pokedex`/`v_user_province_progress`가 정확히 갱신되고 도감 상세 데이터(§4)까지 정상 반영됨을 확인 후 테스트 계정 삭제로 정리
- 검증 중 원격 DB가 로컬 마이그레이션보다 3개 뒤처져 있던 걸 발견(`island_reachability`/`review_fixes`/`bootstrap_nickname_and_manual_city` 미적용) — 회원가입 시 닉네임이 무시되던 실제 버그였고, 이번에 원격에 적용해 해소

## 개선안 — 신규 요청 (2026-07-17, 팀장 검토+사용자 확정 완료)

실행 순서(리스크 낮은 순): 4 → 3 → 2 → 7 → 1 → 5(인터페이스만) → 6 → 8(지역배경)

### 1. 지도 확대 레벨 세분화 🟢 — 시각 배율만
- [ ] `ZOOM` 고정상수(0.28) → 조절 가능한 값으로, 화면 배율만 확장(clamp 상하한)
- ~~확정: 이동 가능 목적지(시/군/구 단위, `city_connections`)는 그대로 — 이동 단위 세분화(스키마 변경)는 이번 스코프 아님~~
- **번복(2026-07-17, 사용자 확정)**: 광역시/특별시 7곳(서울/부산/대구/인천/광주/대전/울산, 세종 제외) 한정으로 이동 단위 세분화 진행 — `feat/map-encounter-improvements` 브랜치에서 마이그레이션 `20260727000000_metro_subzones.sql`로 구현(DB.md §4.5 참고). 시 전체를 4구역으로 나누되 동일 `living_area_id` 공유 → 스폰 풀은 그대로, `fn_move_city`/`fn_bootstrap_location` 코드 변경 없음
- 변경 파일: `components/map/RegionMap.tsx`(zoom prop화), `MapContainer.tsx`(zoom state), `AnimatedRegionMap.tsx`(passthrough)

### 2. 이동 UI 크기 축소 🟢
- [ ] 화살표 size/gap(viewBox 비율 상수)을 좁은 화면에서 축소 — 시각 크기만 줄이고 히트영역(44px 접근성 기준)은 최소치 유지
- 변경 파일: `components/map/RegionMap.tsx`

### 3. 조우 화면 포켓몬 이미지 로딩 🟢
- [ ] `EncounterClient.tsx`의 기존 placeholder → `public/sprites/pokemon/{dexNo}.png` 표시(PokemonSprite.tsx는 pokedex 소유라 import 금지, 독립 구현)
- [ ] onError 시 기존 placeholder 폴백

### 4. 포획 시도/성공/실패 이펙트 🟢 — 최우선 착수
- [ ] Framer Motion(프로젝트 통일 방식)으로 시도중(결과 암시 없는 중립 반복 모션)/성공(반짝임)/실패(페이드아웃) 이펙트, `prefers-reduced-motion` 가드 필수
- 서버 응답 확정 후에만 상태 반영(§2 유지), 전설 조우는 강도 분리

### 5. 지도 지역명 표시 + 지역 클릭 시 포획/미포획 목록 🔒 — 이번엔 인터페이스까지만
- [ ] 라벨(`labels` prop) + `onLabelClick(cityId)` emit까지 map-renderer 담당
- [ ] data-layer-engineer가 `SECURITY INVOKER` view/RPC(`region_spawn_pool`+`user_pokedex` 조인) 설계 초안 + DB.md 갱신 제안
- 확정: 실제 목록 UI/데이터 렌더 연동은 이번 스코프 밖(도감 팀 소유) — map은 트리거만

### 6. 트레이너 이름 설정 기능 🟢 — 완료(신규 EF로 정정)
- [x] `profiles` RLS가 실제로는 `update_own`이 아니라 `no_direct_write`(USING false)로 이미 전면 차단돼있음이 게이트 검토에서 드러남(client 직접 UPDATE는 조용히 0행 실패) — 신규 EF `rename-trainer`(service_role, JWT user_id 재검증)로 전환
- 변경 파일: `AppHeader.tsx`(설정메뉴 항목), 신규 `EditNicknameModal.tsx`, 신규 `lib/game/renameTrainer.ts`(`callEdgeFunction` 공용 헬퍼 사용), 신규 `supabase/functions/rename-trainer/index.ts`, `DB.md`(§9 EF 목록)

### 7. 지도 지역별 점선 경계 재정비 🟢
- [ ] `stroke-dasharray` 자체가 미구현 상태였음(버그 아닌 신규 구현) — 런타임에서 인접 폴리곤 좌표 비교로 공유선 계산 후 적용, `files/*.json` 원본은 수정 금지
- 변경 파일: `components/map/RegionMap.tsx`

### 8. 타입별/지역별 배경이미지 생성 🟢 — 팔레트 소규모 확장 승인됨
- [x] 타입별 배경(18종) — 이미 완료(`typeColors.ts`, `EncounterClient.tsx` 적용중)
- [x] 지역(도)별 배경(17종) — 이미지 대신 CSS 색상표(단색, 폴리곤 자체는 이미 색이 있어 그라디언트 대신 배경 단색으로 충분), 기존 팔레트(하늘색 계열) 명도 변주로 확장, `DESIGN.md` 선갱신 후 `RegionMap.tsx` 고정배경(`#eaf1f5`) → `provinceId` 기반 교체
- 변경 파일: 신규 `components/map/provinceColors.ts`, `RegionMap.tsx`, `DESIGN.md`
