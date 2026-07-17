'use client'

// Catch & Encounter 격리 탭 — DESIGN.md §2.2 세로 3단 레이아웃.
// Result는 별도 라우트가 아닌 같은 탭 안의 오버레이(PRD §8.3~8.4, CLAUDE.md §5).
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { catchAttempt } from '@/lib/game/catchAttempt'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'
import { encounterBackground } from '@/components/encounter/typeColors'
import { PokemonSprite } from '@/components/pokedex/PokemonSprite'

export type EncounterClientProps = {
  sessionId: string
  dexNo: number
  nameKr: string
  type1: string
  type2: string | null
  isLegendary: boolean
  catchRateTier: string
  attemptsUsed: number
  expiresAt: string
}

type Phase = 'active' | 'caught' | 'fled'

// 글자 Black + White 테두리 조합(DESIGN.md §1.1)
const STROKE =
  '[text-shadow:-1px_-1px_0_#fff,1px_-1px_0_#fff,-1px_1px_0_#fff,1px_1px_0_#fff]'

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function EncounterClient({
  sessionId,
  dexNo,
  nameKr,
  type1,
  type2,
  isLegendary,
  catchRateTier,
  attemptsUsed,
  expiresAt,
}: EncounterClientProps) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('active')
  const [attemptsLeft, setAttemptsLeft] = useState(3 - attemptsUsed)
  const [pending, setPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [missed, setMissed] = useState(false)
  // 이미지 로딩 실패 시 기존 원형/텍스트 placeholder로 폴백
  const [spriteError, setSpriteError] = useState(false)
  // 신규/재포획 구분용 — 조회 실패 시 null(기본 성공 문구, 치명 아님)
  const [catchCount, setCatchCount] = useState<number | null>(null)
  // 서버 시각과의 하이드레이션 불일치 방지: 마운트 후에만 카운트다운 표시
  const [remainingMs, setRemainingMs] = useState<number | null>(null)
  // Map 복귀는 페이드아웃 완료 후 라우팅 — 화면이 툭 끊기지 않게(PRD §22)
  const [leaving, setLeaving] = useState(false)
  const reduced = useReducedMotion()
  const mainRef = useRef<HTMLElement>(null)
  const spriteRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const grassRef = useRef<HTMLDivElement>(null)
  const shutterRef = useRef<HTMLDivElement>(null)
  const darkenRef = useRef<HTMLDivElement>(null)
  const flashRef = useRef<HTMLDivElement>(null)
  const crackRef = useRef<SVGSVGElement>(null)

  // 진입 연출 — 이 컴포넌트는 서버가 세션을 확정한 뒤에만 마운트되므로 낙관적 연출이 아니다(§2).
  // 전설 분기는 서버가 내려준 isLegendary prop에만 반응(일반 이동에서 오발동 불가, QA §18).
  // reduced-motion: 셔터/균열/번개/지진/흔들림 전부 생략(PRD §22).
  useEffect(() => {
    if (reduced) {
      // 어두워짐은 연출이 아닌 "유지 상태" — reduced에서도 정적 적용해야 같은 화면을 본다(a11y QA)
      if (darkenRef.current) darkenRef.current.style.opacity = '0.45'
      return
    }
    const controls = isLegendary
      ? [
          darkenRef.current &&
            animate(darkenRef.current, { opacity: 0.45 }, { duration: 0.8 }),
          // 섬광 2회/0.9s = 약 2.2회/초 — WCAG 2.3.1(초당 3회) 마진 없음: 키프레임 추가·duration 단축 금지
          flashRef.current &&
            animate(
              flashRef.current,
              { opacity: [0, 1, 0, 0.7, 0] },
              { duration: 0.9, delay: 0.3, ease: 'linear' },
            ),
          crackRef.current &&
            animate(
              crackRef.current,
              { opacity: [0, 1, 1, 0] },
              { duration: 1.1, delay: 0.35 },
            ),
          // 지진은 컨테이너 transform으로만 — 레이아웃 리플로우 없이 흔든다
          mainRef.current &&
            animate(
              mainRef.current,
              { x: [0, -8, 8, -6, 6, -3, 3, 0] },
              { duration: 0.7, delay: 0.3 },
            ),
        ]
      : [
          shutterRef.current &&
            animate(
              shutterRef.current,
              { opacity: [0, 1, 1, 0] },
              { duration: 0.5, times: [0, 0.3, 0.55, 1] },
            ),
          grassRef.current &&
            animate(
              grassRef.current,
              { skewX: [0, -8, 8, -5, 5, 0] },
              { duration: 1, ease: 'easeInOut' },
            ),
        ]
    return () => {
      controls.forEach((c) => c && c.stop())
      // stop()은 중간 opacity를 남긴다 — reduced 토글 시 전면 오버레이가 화면을 가린 채 고정되지 않게 리셋
      for (const el of [flashRef.current, shutterRef.current, crackRef.current]) {
        if (el) el.style.opacity = '0'
      }
    }
  }, [reduced, isLegendary])

  // 시도 중 중립 반복 펄스 — 결과를 암시하지 않는 단순 스케일 반복, 서버 응답 도착(pending false) 즉시 정지
  useEffect(() => {
    if (!pending || reduced || !spriteRef.current) return
    const c = animate(
      spriteRef.current,
      { scale: [1, 1.05, 1] },
      { duration: 0.5, repeat: Infinity, ease: 'easeInOut' },
    )
    return () => {
      c.stop()
      // repeat 도중 정지 시 중간 scale이 남는다 — 다음 상태(성공/실패 펄스) 시작 전에 리셋
      // 수동 style 리셋은 framer 내부 트래킹과 어긋나 다음 애니메이션 시작 시 튐을 유발하므로 animate()로 동기화
      if (spriteRef.current) animate(spriteRef.current, { scale: 1 }, { duration: 0 })
    }
  }, [pending, reduced])

  // 빗나감 흔들림+페이드 — 서버가 miss를 확정(setMissed)한 뒤에만 재생, 재시도 가능하므로 opacity는 복귀
  // 전설은 배경이 이미 어두워진 상태라 진폭을 줄여 입장 연출(지진)과 강도를 분리
  useEffect(() => {
    if (!missed || reduced || !spriteRef.current) return
    const shakeX = isLegendary ? [0, -6, 6, -4, 4, 0] : [0, -10, 10, -7, 7, 0]
    const c = animate(
      spriteRef.current,
      { x: shakeX, opacity: [1, 0.3, 1] },
      { duration: 0.45 },
    )
    return () => c.stop()
  }, [missed, reduced, isLegendary])

  // 도망(최종 실패) 페이드아웃 — 도망 확정 후 Result 오버레이가 곧 덮으므로 복귀 없이 유지
  useEffect(() => {
    if (phase !== 'fled' || reduced || !spriteRef.current) return
    const c = animate(spriteRef.current, { opacity: [1, 0] }, { duration: 0.5, ease: 'easeIn' })
    return () => c.stop()
  }, [phase, reduced])

  // 포획 성공 펄스 — 서버가 caught를 확정한 뒤에만 재생
  useEffect(() => {
    if (phase !== 'caught' || reduced || !spriteRef.current) return
    const c = animate(
      spriteRef.current,
      { scale: [1, 1.18, 1] },
      { duration: 0.6, ease: 'easeOut' },
    )
    return () => c.stop()
  }, [phase, reduced])

  // 포획 성공 반짝임(ring 확장) — 스케일 펄스에 얹는 신규 이펙트, 전설은 배경이 이미 진해 확장폭을 줄여 분리
  useEffect(() => {
    if (phase !== 'caught' || reduced || !ringRef.current) return
    const c = animate(
      ringRef.current,
      { scale: [1, isLegendary ? 1.5 : 1.8], opacity: [0.8, 0] },
      { duration: 0.6, ease: 'easeOut' },
    )
    return () => c.stop()
  }, [phase, reduced, isLegendary])

  // phase가 'active'를 벗어나면(포획/도망 확정) 더 셀 시간이 없다 — 결과가 난 뒤에도
  // 계속 재렌더되며 goMap이 매초 새로 생성돼 Result 모달 포커스를 방해하는 것도 함께 방지.
  useEffect(() => {
    if (phase !== 'active') return
    const tick = () => setRemainingMs(Date.parse(expiresAt) - Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt, phase])

  // 클라이언트 타이머 만료 → 자동 도망 표시. 최종 진실은 서버(SESSION_EXPIRED)와 동일 처리.
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0) {
      setPhase((p) => (p === 'active' ? 'fled' : p))
    }
  }, [remainingMs])

  async function handleThrow() {
    if (pending || phase !== 'active' || attemptsLeft <= 0) return
    setPending(true)
    setErrorMessage(null)
    setMissed(false)

    const { data, error } = await catchAttempt(sessionId)
    setPending(false)

    if (error) {
      // 만료/소진은 서버 판정이 곧 결과 — 클라이언트가 결과를 추정하지 않는다
      if (error.code === 'SESSION_EXPIRED' || error.code === 'NO_ATTEMPTS_LEFT') {
        setPhase('fled')
      } else {
        setErrorMessage(error.message)
      }
      return
    }

    // 서버 응답을 받은 뒤에만 갱신 — 낙관적 업데이트 금지(CLAUDE.md §2)
    setAttemptsLeft(data.attempts_left)
    if (data.status === 'caught') {
      setPhase('caught')
      // RLS select_own으로 본인 행만 조회 가능 — catch_count 1이면 신규(NEW!)
      const { data: row } = await createClient()
        .from('user_pokedex')
        .select('catch_count')
        .eq('dex_no', dexNo)
        .maybeSingle()
      setCatchCount(row?.catch_count ?? null)
    } else if (data.status === 'fled') {
      setPhase('fled')
    } else {
      setMissed(true)
    }
  }

  const goMap = () => setLeaving(true)

  // 실루엣 해제 = 포획 확정 시점과 동일 기준 — 도망(fled)은 끝까지 비공개(PRD §8.5)
  const revealed = phase === 'caught'

  // 스페이스=포획 시도, 엔터=결과 확인/나가기. 이 화면엔 텍스트 입력 필드가 없지만 방어적으로 가드.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') {
        e.preventDefault()
        if (phase === 'active' && !pending && attemptsLeft > 0) handleThrow()
      } else if (e.code === 'Enter') {
        if (phase !== 'active') goMap()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // handleThrow/goMap 재생성은 phase/pending/attemptsLeft 변화와 항상 동기화되므로 안전 —
    // deps에 넣으면 매 렌더 리스너를 재등록해 불필요한 churn만 늘어난다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pending, attemptsLeft])

  return (
    <motion.main
      ref={mainRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      // fade는 reduced-motion에서도 유지(PRD §22) — 완료 후에만 라우팅
      onAnimationComplete={() => {
        if (leaving) router.push('/map')
      }}
      className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-6"
    >
      {/* 배경 레이어 — 전설 연출(번개/균열)은 motion 담당이 이 레이어 위에 추가 */}
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 ${
          isLegendary ? 'bg-gradient-to-b from-[#3a4a57] to-[#181f26]' : '' // 전설: 하늘색 톤을 어둡게
        }`}
        // 일반 조우는 야생 포켓몬 타입(type1/type2) 배색 — 정적 이미지 없이 CSS 그라디언트로만 표현
        style={isLegendary ? undefined : { backgroundImage: encounterBackground(type1, type2) }}
      />
      {isLegendary ? (
        <>
          {/* 하늘 어두워짐: 배경 위·콘텐츠 아래에서 서서히 짙어진 채 유지 */}
          <div
            aria-hidden
            ref={darkenRef}
            className="pointer-events-none absolute inset-0 -z-10 bg-black opacity-0"
          />
          {/* 번개 점멸 */}
          <div
            aria-hidden
            ref={flashRef}
            className="pointer-events-none absolute inset-0 z-30 bg-white opacity-0"
          />
          {/* 화면 균열 */}
          <svg
            aria-hidden
            ref={crackRef}
            className="pointer-events-none absolute inset-0 z-40 h-full w-full opacity-0"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <path
              d="M50 0 L46 18 L53 31 L44 48 L55 64 L47 82 L52 100"
              stroke="#fff"
              strokeWidth="0.7"
              fill="none"
            />
            <path
              d="M46 18 L31 27 M53 31 L69 40 M44 48 L27 59 M55 64 L72 72"
              stroke="#fff"
              strokeWidth="0.4"
              fill="none"
            />
          </svg>
        </>
      ) : (
        <>
          {/* 풀숲 — reduced-motion에서는 정적 장식으로만 남는다 */}
          <div
            aria-hidden
            ref={grassRef}
            className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex items-end justify-around"
            style={{ transformOrigin: 'bottom' }}
          >
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`bg-[#3f7d3a] ${i % 2 ? 'h-8 w-14' : 'h-10 w-16'}`}
                style={{
                  clipPath:
                    'polygon(0 100%, 10% 30%, 25% 70%, 40% 10%, 55% 65%, 70% 25%, 85% 60%, 100% 100%)',
                }}
              />
            ))}
          </div>
          {/* 화면 셔터 점멸 */}
          <div
            aria-hidden
            ref={shutterRef}
            className="pointer-events-none absolute inset-0 z-40 bg-black opacity-0"
          />
        </>
      )}

      {/* 상단: 좌 포획 가능성 태그 / 우 Player UI 리본 */}
      <div className="flex w-full max-w-md items-start justify-between">
        <span
          className={`rounded-full border-2 border-black bg-white px-3 py-1 text-sm font-bold text-black`}
        >
          {isLegendary ? '전설 · ' : ''}포획 가능성: {catchRateTier}
        </span>
        <span
          className="border-2 border-black bg-white px-3 py-1 text-xs font-bold text-black"
          style={{
            clipPath:
              'polygon(0 0, 100% 0, 100% 100%, 12px 100%, 0 50%)',
            paddingLeft: '18px',
          }}
        >
          Player UI
        </span>
      </div>

      {/* 중앙: 포켓몬 이미지 영역 — 도감과 동일한 PokemonSprite(dex_no 기반 정적 에셋) 재사용 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div
          ref={spriteRef}
          className="relative h-48 w-48 rounded-full border-2 border-black bg-black/20"
        >
          <PokemonSprite
            dexNo={dexNo}
            alt={revealed ? nameKr : '???'}
            silhouette={!revealed}
            fallbackClass="bg-zinc-400"
          />
          {/* 포획 성공 반짝임 ring — 평상시 opacity 0, caught 확정 시에만 imperative animate로 노출 */}
          <div
            aria-hidden
            ref={ringRef}
            className="pointer-events-none absolute inset-0 rounded-full border-4 border-yellow-300 opacity-0"
          />
        </div>
        {/* STROKE 흰 테두리 — 전설 어두운 배경(darken 0.45)에서도 대비 확보(WCAG 1.4.3) */}
        <span className={`text-xs text-black/70 ${STROKE}`}>
          {revealed ? (
            <>
              {type1}
              {type2 ? ` / ${type2}` : ''}
            </>
          ) : (
            '???'
          )}
        </span>
        {missed && phase === 'active' && (
          <p role="status" className={`text-sm font-bold text-black ${STROKE}`}>
            빗나갔다! 다시 시도할 수 있다.
          </p>
        )}
        {errorMessage && (
          <p role="alert" className={`text-sm font-bold text-black ${STROKE}`}>
            {errorMessage}
          </p>
        )}
      </div>

      {/* 정보 바: 양끝 뾰족 리본, [도감 번호 | 이름] 2분할 */}
      <div
        className="flex w-full max-w-sm items-center justify-center bg-white py-2 text-black"
        style={{
          clipPath:
            'polygon(0 50%, 16px 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 16px 100%)',
        }}
      >
        <span className="border-r-2 border-black px-4 font-mono font-bold">
          {revealed ? `No.${String(dexNo).padStart(4, '0')}` : '???'}
        </span>
        <span className="px-4 text-lg font-extrabold">{revealed ? nameKr : '???'}</span>
      </div>

      {/* 하단: 타이머 + 남은 시도 + 포획하기 화살표 리본 버튼 */}
      <div className="mt-4 flex w-full max-w-sm flex-col items-center gap-2">
        <p className={`text-sm font-bold text-black ${STROKE}`}>
          <span role="timer">
            남은 시간 {remainingMs === null ? '-:--' : formatRemaining(remainingMs)}
          </span>
          {' · '}남은 기회 {attemptsLeft} / 3
        </p>
        <button
          type="button"
          onClick={handleThrow}
          disabled={pending || phase !== 'active' || attemptsLeft <= 0}
          aria-busy={pending}
          className="w-full bg-white py-3 text-lg font-extrabold text-black disabled:opacity-50"
          style={{
            clipPath: 'polygon(0 50%, 24px 0, 100% 0, 100% 100%, 24px 100%)',
          }}
        >
          ◀ {pending ? '포획 중...' : '포획하기'}
        </button>
      </div>

      {/* Result 오버레이 — 같은 탭 안의 마지막 상태(PRD §8.4) */}
      <Modal open={phase !== 'active'} onClose={goMap}>
        <div className="flex flex-col items-center gap-3 text-center text-black">
          {phase === 'caught' ? (
            <>
              {catchCount === 1 && (
                <span className="rounded-full bg-black px-3 py-0.5 text-sm font-extrabold text-white">
                  NEW!
                </span>
              )}
              <p className="text-lg font-extrabold">도감에 등록되었습니다</p>
              <p className="font-bold">{nameKr}</p>
              {catchCount !== null && catchCount > 1 && (
                <p className="text-sm text-black/70">누적 {catchCount}회째 포획</p>
              )}
              {/* TODO: 도 100% 달성 배너(PRD §8.4) — 판정 데이터가 응답에 없어 이번 슬라이스 스킵 */}
            </>
          ) : (
            <p className="text-lg font-extrabold">{revealed ? nameKr : '???'}은(는) 도망쳤다...</p>
          )}
          <button
            type="button"
            onClick={goMap}
            className="mt-2 w-full rounded-xl border-2 border-black bg-white py-2 font-bold"
          >
            확인
          </button>
        </div>
      </Modal>
    </motion.main>
  )
}
