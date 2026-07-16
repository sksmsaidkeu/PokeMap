# CLAUDE.md — PokeMap 개발 헌법

이 문서는 PokeMap 저장소에서 작업하는 모든 사람(인간/AI SubAgent)이 따라야 하는 규칙이다. 제품 스펙은 `PRD.md`, DB 스펙은 `DB.md` 참고.

## 1. 프로젝트 철학

- 이 게임의 재미는 "지리적 정확성 + 확률 시스템의 신뢰성"에서 나온다. 스폰/포획/해금 확률은 항상 서버(Edge Function)에서만 판정한다 — 클라이언트는 절대 확률을 계산하거나 결과를 결정하지 않는다.
- 게임 규칙의 원본은 `PokeMap_MainSystem.md`(핵심 시스템)와 `PokeMap_UISystem.md`(화면/등급)다. 데이터(지역 매칭, 스폰 풀 배정 규칙)는 `build_pokemon_db.py`(도→포켓몬지방 매칭, 공통/고유/전설 슬롯 배정, 이스터에그)와 `db/pokemon_db.csv`(전체 포켓몬 마스터), `korea_living_areas.csv`가 원본이며 이 스크립트의 산출물이 `pokemon.csv`다. 코드에 하드코딩하지 않고 DB 시드로만 반영한다.

## 2. 개발 원칙

- YAGNI: PRD §27 "향후 확장 계획"에 있는 것은 지금 만들지 않는다.
- 서버가 유일한 진실 소스(SSOT). `encounter_sessions.status`, `user_progress.current_city_id` 등은 클라이언트 상태로 복제해도 항상 서버 재검증을 거친다.
- 낙관적 업데이트 금지: 이동/포획처럼 서버 확률 판정이 낀 동작은 응답을 받은 뒤에만 UI를 갱신한다.

## 3. AI(SubAgent) 협업 규칙

- `convention-reviewer`가 팀장이다 — 나머지 SubAgent(map-renderer, data-layer-engineer, design-system-engineer, motion-interaction-director, a11y-responsive-qa)의 작업은 반드시 `convention-reviewer` 검토를 마지막 관문으로 통과해야 병합 가능하다. 위반 발견 시 반려하고 수정 방향을 지시할 권한을 가진다.
- **도메인 경계 — pokedex(도감) 절대 금지**: `app/pokedex/**`, `components/pokedex/**`, 도감 목록/상세 화면(PRD §8.4, DESIGN.md §2.3)은 다른 팀원 전담 영역이다. 위 6개 SubAgent는 이 경로를 읽지도 수정하지도 않는다 — 관련 요청이 오면 작업하지 말고 담당 밖임을 알린다.
- 스키마 변경은 반드시 `DB.md`를 먼저 갱신하고 마이그레이션을 작성한다 — 코드가 먼저, 문서가 나중이 되지 않게 한다.
- 확률/밸런스 상수(`calc_spawn_rate` 5~30%, `calc_catch_rate` 10~90%, 최종 히든 지역 100%, 전설 3%+실패당 영구 +1%p 등)는 `DB.md`/`PRD.md`에 정의된 값을 그대로 사용한다 — 임의로 조정하지 않는다. 밸런스 변경이 필요하면 두 문서를 먼저 갱신.
- SubAgent가 여러 파일에 걸친 변경을 제안할 때는 영향받는 Edge Function과 RLS 정책을 함께 점검한다(스폰/포획 로직은 항상 서버 전용이므로).

## 4. 코딩 컨벤션

- 언어: TypeScript strict mode. `any` 금지, 불가피하면 `unknown` + 타입가드.
- 네이밍: 컴포넌트 PascalCase, 훅/함수 camelCase, DB 테이블/컬럼 snake_case(Supabase 컨벤션 유지).
- 포맷: Prettier 기본값 + ESLint(`next/core-web-vitals`). 커밋 전 자동 실행(Git 전략 §12 참고).
- 주석은 "왜"만 남긴다. 코드가 "무엇을"을 설명하면 주석 삭제.

예시:
```ts
// 나쁨: 이름/타입이 이미 말해주는 것을 반복
// 전설 쿨타임이 남았는지 확인한다
const locked = cooldown.nextAvailableAt > Date.now()

// 좋음: "왜"만 남김 — 3회 실패 후 1시간 잠금이라는 숨은 규칙
// 전설은 3회 실패마다 1시간 쿨타임 + 다음 시도 확률 영구 +1%p (PRD §19)
const locked = cooldown.nextAvailableAt > Date.now()
```

## 5. 폴더 구조

```
app/
  (auth)/login/
  map/
  encounter/[sessionId]/   # Catch & Encounter 격리 탭 — 단일 라우트, URL 직접 접근 시 서버에서 세션 유효성 재검증 후 리다이렉트(§11)
  pokedex/
  api/                 # 필요한 경우만, 기본은 Edge Function 직접 호출
components/
  map/                 # 지도 렌더링, 도/생활권/시군 레이어
  encounter/           # 일반/전설 조우 연출 분리 컴포넌트
  pokedex/
  ui/                  # 버튼/모달 등 범용 프리미티브
lib/
  supabase/            # 클라이언트 초기화(server.ts / client.ts 분리)
  game/                # 순수 함수: 확률 계산 미러(테스트/프리뷰용, 실제 판정은 서버)
supabase/
  migrations/
  functions/
    bootstrap-location/
    move-city/
    catch-attempt/
    unlock-check/
    session-sweep/
files/                 # GeoJSON 원본 (수정 금지, 읽기 전용 자산)
```

`encounter`/`catch`/`result`를 별도 페이지로 나누지 않는 이유: 원본 기획(`PokeMap_UISystem.md`)이 이 셋을 "격리된 단일 탭" 하나로 정의한다 — Result는 별도 라우트가 아니라 같은 탭 안의 마지막 상태(오버레이 팝업)다(`PRD.md` §8.3~8.4).

## 6. 환경 변수

| 변수 | 위치 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | 클라이언트/서버 | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 클라이언트/서버 | RLS 적용된 익명 키, 클라이언트 번들 포함 가능 |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function 전용 | RLS 우회 쓰기 키, `NEXT_PUBLIC_*` 접두어 절대 금지 |

- 새 환경변수 추가 시 `.env.example`에 키만(값 없이) 추가, 실제 값은 절대 커밋하지 않는다.
- `NEXT_PUBLIC_` 접두어는 브라우저에 노출된다는 뜻 — 비밀값에는 붙이지 않는다(§20 보안 규칙과 직결).
- GPS 온보딩(`PRD.md` §5)은 브라우저 `navigator.geolocation` API만 사용 — 별도 환경변수/서드파티 키 불필요. 권한 거부 시 서버 폴백(서울특별시)으로 처리, 클라이언트에서 임의 기본값을 만들지 않는다.

## 7. 의존성 정책

- 새 패키지 추가 전 §17(성능)·YAGNI(§2) 기준으로 "정말 필요한가" 먼저 확인 — 지도 렌더링/애니메이션처럼 표준 라이브러리로 커버 가능한 영역에 무거운 프레임워크 도입 금지.
- 상태관리 라이브러리(Redux, Zustand 등) 도입 금지 — §9 React 규칙에서 이미 불필요하다고 명시.
- 신규 의존성은 PR에 "왜 필요한지 + 대안으로 뭘 검토했는지" 한 줄 명시.

## 8. API 작성 규칙

- 게임 로직(스폰/포획/해금)은 Next.js API Route가 아니라 Supabase Edge Function으로 작성한다 — DB 트랜잭션/행 잠금(`DB.md` §10~11)이 필요하기 때문에 DB에 가까운 런타임을 쓴다.
- Next.js `app/api/*`는 Edge Function을 감싸는 얇은 프록시가 필요할 때만 추가(예: 인증 헤더 가공). 로직 중복 금지.
- 모든 API 응답은 `{ data, error }` 형태로 통일. 에러는 HTTP 상태 코드 + `error.code`(예: `SESSION_EXPIRED`, `REGION_LOCKED`) 문자열로 클라이언트가 분기 가능하게 한다.

## 9. TypeScript 규칙

- Supabase 스키마 타입은 `supabase gen types typescript`로 생성, 수동 작성 금지.
- 도메인 타입(`EncounterSession`, `PokedexEntry` 등)은 생성된 DB 타입을 `Pick`/`Omit`으로 조합, 중복 정의 금지.
- 널 가능 필드는 옵셔널(`?`)이 아니라 명시적 `| null`로 표기(Supabase 관례 일치).

```ts
// 나쁨: 수동 재정의, DB 타입과 어긋날 위험
type PokedexEntry = { userId: string; dexNo: number; caughtAt?: string }

// 좋음: 생성된 Database 타입에서 파생
type PokedexEntry = Pick<
  Database['public']['Tables']['user_pokedex']['Row'],
  'user_id' | 'dex_no' | 'first_caught_at' | 'catch_count'
>
```

## 10. React 규칙

- 서버 컴포넌트 기본, `use client`는 상호작용(지도 클릭, 애니메이션, 폼)이 있는 리프 컴포넌트에만.
- 전역 상태 라이브러리 도입 금지 — 현재 위치/도감 진행은 서버 상태(React Query 또는 `fetch` + 서버 컴포넌트 재검증)로 충분.
- 애니메이션은 CSS transition/Framer Motion 중 하나만 선택해 통일(혼용 금지).

## 11. Next.js App Router 규칙

- 라우트 세그먼트는 PRD §8 페이지 명세와 1:1 대응(`app/map`, `app/encounter/[sessionId]` 등).
- `encounter` 라우트(격리 탭) 진입 시 서버 컴포넌트에서 `encounter_sessions.status`를 조회해 상태 머신(PRD §10)과 불일치하면 `redirect('/map')` — 이 검증이 곧 "URL 직접 접근 차단"의 실제 구현이다.
- 데이터 갱신 후에는 `revalidatePath`로 캐시 무효화, 클라이언트 수동 리페치에 의존하지 않는다.

## 12. Supabase 사용 규칙

- RLS는 항상 활성화(`DB.md` §8). 마스터 테이블 외 모든 유저 데이터 테이블은 클라이언트 직접 쓰기 금지, Edge Function(`service_role`)만 쓰기 가능.
- 클라이언트 Supabase 인스턴스는 `anon` key만 사용. `service_role` key는 Edge Function 환경변수에만 존재, 절대 클라이언트 번들에 포함하지 않는다.
- 로컬 개발은 `supabase start`로 로컬 스택 사용, 마이그레이션 검증 후에만 원격에 반영.

## 13. Edge Function 작성 규칙

- 함수당 책임 하나(`bootstrap-location`, `move-city`, `catch-attempt`, `unlock-check`, `session-sweep` — `DB.md` §9). 새 로직을 기존 함수에 욱여넣지 않는다.
- 트랜잭션 경계와 잠금 순서는 `DB.md` §10~11을 그대로 구현(`user_progress` → `encounter_sessions` 순서 고정, 역순 금지).
- 입력 검증은 함수 진입점에서 즉시(인접성, 세션 만료, 지방 해금 여부) — 검증 실패는 조기 반환.

## 14. 테스트 전략

- 확률 함수(`calc_spawn_rate`, `calc_catch_rate`)는 순수 함수로 분리해 경계값(BST 200/720, clamp 상하한) 단위 테스트 필수.
- Edge Function은 인접성 검증/쿨다운/세션 만료 같은 분기별로 최소 1개 테스트 — 실제 DB 대신 로컬 Supabase 스택(§12) 사용, 모킹 금지(DB 트랜잭션/락 동작 자체가 검증 대상이므로).
- E2E는 플레이 루프 1개(로그인→이동→조우→포획→결과) 스모크 테스트만 유지, 페이지마다 전수 E2E는 만들지 않는다.

## 15. 로깅 컨벤션

- Edge Function 에러는 `error.code`(예: `SESSION_EXPIRED`, `REGION_LOCKED`, `NOT_ADJACENT`)를 구조화 로그로 남긴다 — 자유 텍스트 메시지만 로깅 금지(집계/알림 불가).
- 확률 판정 결과(스폰 성공 여부, 포획 성공 여부)는 감사 목적으로 이미 DB(`encounter_sessions.spawn_rate_used`, `catch_attempts.catch_rate_used`)에 남으므로 별도 로그 시스템에 중복 적재하지 않는다.

## 16. Git 전략

- 브랜치: `main`(배포) ← `dev`(통합) ← `feat/*`, `fix/*`, `chore/*`.
- 스키마 변경 브랜치명은 `migration/*` 접두어로 구분(리뷰 시 마이그레이션 diff를 우선 확인하도록).
- `main`/`dev` 직접 push 금지, PR 필수.

## 17. Commit 규칙

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- 제목 50자 이내, 본문은 "왜"만(무엇을 했는지는 diff가 말해줌).
- DB 마이그레이션 포함 커밋은 `migration:` 스코프 명시, 예: `feat(migration): add legendary_pity table`.

## 18. QA 체크리스트

- [ ] 인접하지 않은 시로 이동 요청 시 400 반환하는가
- [ ] 미해금 섬 지역(§20)에 속한 시로 이동이 거부되는가(그 외 육지 도는 이동 제한 없음)
- [ ] 만료된 세션(2분)에 대한 포획 시도가 409를 반환하는가
- [ ] 조우당 포획 시도가 3회를 초과하지 않는가, 3회 소진 시 자동 도망 처리되는가
- [ ] 도 포획률 100% 달성 시 전설 출현지가 지도에 노출되는가
- [ ] 전설 포획 실패 시 1시간 쿨타임과 +1%p 영구 확률 상승이 함께 적용되는가
- [ ] 전설이 일반 스폰 판정(`calc_spawn_rate`) 대상에 섞이지 않는가(오직 지정 시 직접 이동으로만 조우)
- [ ] 섬 지역(제주도 등)이 내륙 전체 100% 완료 전에는 이동 후보에 뜨지 않는가
- [ ] 세션 만료 직전 동시 요청 시 하나만 처리되는가(§13, `DB.md` §11 락 전략)

## 19. 코드 리뷰 체크리스트

- [ ] 확률/밸런스 상수가 `DB.md`/`PRD.md` 정의와 일치하는가
- [ ] 클라이언트 코드에 `service_role` key나 확률 계산 로직이 없는가
- [ ] 새 유저 데이터 테이블에 RLS + `select_own` 정책이 있는가
- [ ] Edge Function 잠금 순서가 §13 규칙을 지키는가
- [ ] 불필요한 전역 상태/추상화가 추가되지 않았는가
- [ ] 신규 의존성이 §7 기준(정말 필요한가)을 통과했는가

## 20. 보안 규칙

- 모든 유저 데이터 테이블 RLS 필수, 클라이언트 쓰기 정책은 절대 추가하지 않는다(`DB.md` §8).
- Edge Function은 요청자 JWT의 `user_id`와 조작 대상 row의 `user_id`가 일치하는지 항상 재검증(RLS를 우회하는 `service_role`을 쓰기 때문에 이 검증이 유일한 방어선).
- 입력값(도시 ID, 포획 시도 회차 등)은 화이트리스트/enum/범위 검증 후 사용, 원시 문자열로 쿼리 조립 금지.

## 21. 성능 최적화 규칙

- 지도는 `korea_map_data.min.json` 사용, 상세 GeoJSON은 번들에 포함하지 않는다.
- 인접성/스폰 풀 조회는 매 요청 DB 왕복 대신 Edge Function 내에서 필요한 테이블만 단일 쿼리로 조인(N+1 금지).
- 이미지/스프라이트는 Next.js `<Image>` 최적화 경유.

## 22. 절대 금지사항

- 클라이언트에서 스폰/포획/해금 확률 계산 또는 결과 확정 금지.
- `service_role` key를 클라이언트 코드/환경변수(`NEXT_PUBLIC_*`)에 노출 금지.
- RLS 비활성화 또는 `USING (true)`를 유저 데이터 테이블에 적용 금지.
- PRD/DB 문서 갱신 없이 밸런스 상수(확률 계수, 해금 기준, 전설 확률/쿨타임) 임의 변경 금지.
- 포켓볼 종류 선택 UI 추가 금지 — 몬스터볼~마스터볼은 유저 등급 배지(PRD §17)이지 선택 가능한 아이템이 아니다.
- `files/*.json` 원본 GeoJSON 수동 편집 금지(재생성 스크립트로만 갱신).
- 상태관리 라이브러리(Redux/Zustand 등) 도입 금지(§10).
