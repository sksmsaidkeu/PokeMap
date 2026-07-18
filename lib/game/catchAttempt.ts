import { callEdgeFunction, type EdgeFunctionError, type EdgeFunctionResult } from './callEdgeFunction'

// catch-attempt Edge Function 응답 — 원시 확률(%)은 절대 내려오지 않고 tier만(§13.1, DB.md §13).
// status는 트리거(fn_pokedex_upsert/fn_session_flee) 반영 후 서버가 재조회한 값.
export type CatchAttemptSuccess = {
  success: boolean
  attempt_no: number
  attempts_left: number
  status: 'pending' | 'caught' | 'fled'
  catch_rate_tier: string
}

export type CatchAttemptErrorCode =
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_ALREADY_RESOLVED'
  | 'NO_ATTEMPTS_LEFT'
  | 'INVALID_INPUT'

export type CatchAttemptResult = EdgeFunctionResult<CatchAttemptSuccess, CatchAttemptErrorCode>
export type CatchAttemptError = EdgeFunctionError<CatchAttemptErrorCode>

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function catchAttempt(sessionId: string): Promise<CatchAttemptResult> {
  if (!UUID_RE.test(sessionId)) {
    return { data: null, error: { code: 'INVALID_INPUT', message: '유효하지 않은 세션 ID' } }
  }
  return callEdgeFunction('catch-attempt', { session_id: sessionId }, '포획 시도 실패')
}
