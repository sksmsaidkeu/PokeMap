'use client'

// Catch & Encounter 격리 탭 — DESIGN.md §2.2 세로 3단 레이아웃.
// Result는 별도 라우트가 아닌 같은 탭 안의 오버레이(PRD §8.3~8.4, CLAUDE.md §5).
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { catchAttempt } from '@/lib/game/catchAttempt'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/Modal'

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
  // 신규/재포획 구분용 — 조회 실패 시 null(기본 성공 문구, 치명 아님)
  const [catchCount, setCatchCount] = useState<number | null>(null)
  // 서버 시각과의 하이드레이션 불일치 방지: 마운트 후에만 카운트다운 표시
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    const tick = () => setRemainingMs(Date.parse(expiresAt) - Date.now())
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])

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

  const goMap = () => router.push('/map')

  return (
    <main className="relative flex min-h-screen flex-col items-center overflow-hidden px-4 py-6">
      {/* 배경 레이어 — 전설 연출(번개/균열)은 motion 담당이 이 레이어 위에 추가 */}
      <div
        aria-hidden
        className={`absolute inset-0 -z-10 ${
          isLegendary
            ? 'bg-gradient-to-b from-[#3a4a57] to-[#181f26]' // 전설: 하늘색 톤을 어둡게
            : 'bg-gradient-to-b from-[#cce8f4] to-[#F0F0F0]' // TODO: 하단을 시(City) 대표 색상으로 동적 매칭(DESIGN.md §2.2)
        }`}
      />

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

      {/* 중앙: 포켓몬 이미지 영역 — TODO: 스프라이트 에셋 확보 시 next/image로 교체 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <div className="flex h-48 w-48 flex-col items-center justify-center gap-1 rounded-full border-2 border-black bg-black/20">
          <span className={`text-3xl font-extrabold text-black ${STROKE}`}>
            No.{String(dexNo).padStart(4, '0')}
          </span>
          <span className={`text-xl font-bold text-black ${STROKE}`}>{nameKr}</span>
          <span className="text-xs text-black/70">
            {type1}
            {type2 ? ` / ${type2}` : ''}
          </span>
        </div>
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
          No.{String(dexNo).padStart(4, '0')}
        </span>
        <span className="px-4 text-lg font-extrabold">{nameKr}</span>
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
            <p className="text-lg font-extrabold">{nameKr}은(는) 도망쳤다...</p>
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
    </main>
  )
}
