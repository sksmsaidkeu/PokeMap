# plan.md — 도감(Pokedex) 남은 작업

담당: 도감 파트(`app/pokedex`, `components/pokedex/*`, `lib/game/pokedex-*`).
상세 배경은 `POKEDEX_TASKS.md`, 스펙은 `PRD.md` §8.5/§16, `DESIGN.md` §2.3.
스코프 표기 — 🟢 우리가 바로 가능 / 🔒 메인·팀 협의 또는 다른 브랜치 의존.

## 완료 (guidebook 브랜치)
- [x] 17개 도 순 그룹핑 + 도별 포켓몬 나열
- [x] 진행률 바(70%/100% 기준선), 전설 제외 분모
- [x] Unlocked 컬러 카드 + 상세 팝업 / Locked 실루엣 + 클릭 비활성
- [x] 재포획 `catch_count` 누적 표시
- [x] 실데이터 연동(`getPokedexProvinceGroups`, 비로그인 시 graceful)
- [x] DESIGN.md 게임보이/몬스터볼 스타일(카드 + 상세 3-박스)
- [x] 이름 검색 헤더(뒤로가기/검색/돋보기)
- [x] 완성도 프리뷰 모드(`?preview=full|half|newbie`)

## 🟢 우리 스코프 — 남은 작업 (우선순위 순)

### 1. 포켓몬 스프라이트 이미지 ✅ 완료
- [x] 카드/상세의 컬러 원(placeholder) → `dex_no` 기반 실제 스프라이트로 교체
- [x] Next `<Image>` 경유, Locked는 밝기 0 필터 실루엣 처리
- [x] 로딩 실패/누락 시 기존 컬러 원 폴백
- 채택: 외부 URL 대신 **로컬 번들**(`public/sprites/pokemon/*.png`, PokeAPI 96px 픽셀 스프라이트 399종, 1.2MB) — `next.config` 무변경, 픽셀 아트가 게임보이 톤과 부합

### 2. 전설 카드 표시 방식 ✅ 결정 완료
- [x] 도 그룹 내 인라인 + "전설" 배지 유지로 확정(별도 섹션 안 만듦)

### 3. 반응형 · 접근성 폴리시 (PRD §23) ✅ 완료
- [x] 색맹 대비: 타입 배지에 텍스트 병기(색상만으로 정보 전달 없음)
- [x] 360px 점검 — 가로 스크롤 없음, 2→3→4열 그리드 정상
- [x] 터치 타깃 44px(뒤로/검색/닫기), 팝업 ESC 닫기 + `role=dialog`/`aria-modal` + 초기 포커스

## 🔒 막힘 — 메인·팀 협의 또는 다른 브랜치 의존

### 4. 상세 팝업 실데이터(키/몸무게/특성/도감설명) ✅ 완료
- [x] `pokemon_species`에 `height_dm`/`weight_hg`/`primary_ability`/`flavor_text` 컬럼 + 데이터
- PokeAPI에서 399종 전체 수집(`fetch_pokemon_details.py`), 마이그레이션으로 로컬 검증 후 원격 반영
- 9세대(스칼렛/바이올렛) 31종은 PokeAPI에 한국어 원문이 없어 AI가 영문 기반으로 임시 번역(공식 말투 맞춤) — PokeAPI가 한국어를 채우면 교체 예정

### 5. 비로그인 접근 차단 ✅ 완료
- [x] `/pokedex` 미로그인 접근 시 로그인으로 리다이렉트(PRD §5)
- `login`이 main에 병합되며 블로커 해소 — `page.tsx`에서 `auth.getUser()` 후 미로그인+프리뷰 아님이면 `redirect("/login")`. `?preview=*`는 QA용으로 가드 우회

### 6. 공통 헤더(§7) ✅ 완료
- [x] 등급 배지 + 트레이너명 + 설정/로그아웃을 도감 상단에 노출
- main에 병합된 공통 `AppHeader`(map과 공유) 재사용, `calc_user_tier` RPC + 프로필 닉네임 조회로 렌더

### 7. 실데이터 로그인 연동 마무리
- [ ] 프리뷰 모드 → 실제 로그인 유저 데이터로 검증/전환
- 막힘: `login` 브랜치(auth + bootstrap) 병합 대기. 병합 시 쿠키 세션으로 `user_pokedex` 자동 조회됨
