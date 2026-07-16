# PokeMap

대한민국 8도 지도를 8개 포켓몬 지방에 매칭한 GPS 기반 지역 확장형 포켓몬 RPG. 회원가입 시 GPS로 시작 위치가 정해지고, 상/하/좌/우 인접한 시로 이동하며 강제 랜덤 인카운터로 포켓몬과 조우, 최대 3회 포획 시도로 도감을 채운다.

전체 제품 스펙은 [`PRD.md`](./PRD.md), DB 설계는 [`DB.md`](./DB.md), 개발 규칙은 [`CLAUDE.md`](./CLAUDE.md) 참고.

## 역할 분담

| 이름 | 역할 |
|---|---|
| 박진수 | PM |
| 권도현 | 도감 페이지 제작 |
| 윤현준 | 메인(지도) 페이지 제작 |

## 스크린샷

> 준비 중 — MVP 배포 후 Map / Encounter / Pokedex 화면 캡처 추가 예정.

## 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Next.js (App Router), TypeScript |
| 스타일 | Tailwind CSS |
| 백엔드 | Supabase (PostgreSQL, Auth, Edge Functions) |
| 지도 데이터 | 자체 GeoJSON(`files/korea_map_data.json`, 경량본 `.min.json`) |
| 배포 | Vercel(프론트) + Supabase(백엔드) |

## 아키텍처

```
Browser (Next.js App Router)
   │  anon key만 사용
   ▼
Supabase Postgres (RLS 전면 적용)
   │  service_role key (Edge Function 내부에서만)
   ▼
Edge Functions: bootstrap-location / move-city / catch-attempt / unlock-check / session-sweep
```

스폰·포획·해금·전설 확률은 전부 서버(Edge Function + DB 함수)에서 판정한다. 클라이언트는 결과를 요청하고 표시할 뿐, 확률을 계산하지 않는다 — 근거는 `CLAUDE.md` §1, `DB.md` §12~15.

## 폴더 구조

```
app/            # Next.js 라우트 (login, map, encounter[격리 탭 — 조우/포획/결과 통합], pokedex)
components/     # map / encounter / pokedex / ui
lib/            # supabase 클라이언트, 게임 계산 미러 함수
supabase/       # migrations, edge functions
files/          # 원본 GeoJSON (읽기 전용)
*.csv, *.md     # 데이터 원본 및 기획 문서 (PokeMap_MainSystem.md, PokeMap_UISystem.md, MapMatching.md, pokemonRare.md 등)
```

전체 구조와 각 폴더의 책임은 `CLAUDE.md` §5 참고.

## 설치

```bash
git clone <repo-url>
cd PokeMap
npm install
```

Supabase CLI가 없다면 설치:

```bash
npm install -g supabase
```

## 환경 변수

`.env.example`을 복사해 `.env.local` 생성 후 값 채우기:

```bash
cp .env.example .env.local
```

| 변수 | 필수 | 설명 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | 클라이언트용 익명 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅(Edge Function만) | RLS 우회 쓰기 키. **절대 클라이언트에 노출 금지** |

## 실행

```bash
supabase start        # 로컬 Supabase 스택 기동
npm run dev            # http://localhost:3000
```

> 최초 가입 플로우는 브라우저 Geolocation 권한을 요청한다. 로컬 개발 중 권한을 거부하거나 위치 정보를 못 가져오면 서버가 서울특별시로 폴백한다(`PRD.md` §5).

## Build

```bash
npm run build
npm run start
```

## Supabase 연결

1. `supabase link --project-ref <project-ref>`로 원격 프로젝트 연결
2. 로컬에서 검증한 마이그레이션만 반영: `supabase db push`
3. Edge Function 배포: `supabase functions deploy bootstrap-location move-city catch-attempt unlock-check session-sweep`
4. 시드 데이터(`korea_living_areas.csv`, `pokemon.csv`)는 `build_pokemon_db.py` 산출물을 그대로 마이그레이션 시드 SQL로 변환해 반영 — 코드에 하드코딩하지 않는다.

## Deploy

- 프론트: Vercel에 저장소 연결, `main` 브랜치 push 시 자동 배포.
- 백엔드: Supabase 마이그레이션/Edge Function은 CI에서 `supabase db push` + `supabase functions deploy`로 배포(수동 배포 지양).

## 개발 규칙

전체 컨벤션(코딩 스타일, API/RLS/Edge Function 규칙, 보안, 성능, 절대 금지사항)은 [`CLAUDE.md`](./CLAUDE.md)에 정리되어 있다. PR을 올리기 전 반드시 읽을 것.

## 브랜치 전략

```
main   ← 배포 브랜치, 직접 push 금지
dev    ← 통합 브랜치, 직접 push 금지
feat/* fix/* chore/* migration/*   ← 작업 브랜치, dev로 PR
```

상세 규칙은 `CLAUDE.md` §16 참고.

## 기여 방법

1. 이슈 확인 또는 새로 등록 (버그/기능 제안)
2. `feat/짧은-설명` 또는 `fix/짧은-설명` 브랜치 생성
3. 로컬에서 `npm run lint && npm run build` 통과 확인
4. `CLAUDE.md`의 QA/코드 리뷰 체크리스트(§18~19) 기준 셀프 점검
5. `dev` 브랜치로 PR 생성, Conventional Commits(`CLAUDE.md` §17) 형식 준수
6. 스키마 변경이 포함된 경우 `DB.md` 갱신을 PR에 함께 포함
