import { createClient } from '@/lib/supabase/client'

// catch-attempt Edge Function 응답 — 원시 확률(%)은 절대 내려오지 않고 tier만(§13.1, DB.md §13).
// status는 트리거(fn_pokedex_upsert/fn_session_flee) 반영 후 서버가 재조회한 값.
export type CatchAttemptSuccess = {
  success: boolean
  attempt_no: number
  attempts_left: number
  status: 'pending' | 'caught' | 'fled'
  catch_rate_tier: string
}

// NETWORK_ERROR는 계약(4xx)엔 없지만 EF 미배포/오프라인을 자연 처리하기 위한 클라이언트 전용 코드.
export type CatchAttemptErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'NO_ATTEMPTS_LEFT'
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'

export type CatchAttemptError = { code: CatchAttemptErrorCode; message: string }

export type CatchAttemptResult =
  | { data: CatchAttemptSuccess; error: null }
  | { data: null; error: CatchAttemptError }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function catchAttempt(sessionId: string): Promise<CatchAttemptResult> {
  if (!UUID_RE.test(sessionId)) {
    return { data: null, error: { code: 'INVALID_INPUT', message: '유효하지 않은 세션 ID' } }
  }

  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { data: null, error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다' } }
  }

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/catch-attempt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ session_id: sessionId }),
      },
    )

    const body = (await res.json().catch(() => null)) as CatchAttemptResult | null

    if (!res.ok || !body) {
      const err = body?.error
      return {
        data: null,
        error: {
          code: err?.code ?? 'NETWORK_ERROR',
          message: err?.message ?? `포획 시도 실패 (${res.status})`,
        },
      }
    }

    return body
  } catch {
    // EF 미배포/네트워크 단절 — 스텁 조작 없이 자연 실패
    return { data: null, error: { code: 'NETWORK_ERROR', message: '네트워크 오류' } }
  }
}
