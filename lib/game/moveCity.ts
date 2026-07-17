import { callEdgeFunction, type EdgeFunctionError, type EdgeFunctionResult } from './callEdgeFunction'

// move-city Edge Function 조우 페이로드 — 원시 확률(%)은 절대 내려오지 않고 tier만(§13.1, DB.md §13).
export type MoveCityEncounter = {
  session_id: string
  dex_no: number
  is_legendary: boolean
  catch_rate_tier: string
  expires_at: string
}

export type MoveCitySuccess = {
  moved: true
  current_city_id: number
  encounter: MoveCityEncounter | null
}

export type MoveCityErrorCode =
  | 'NOT_ADJACENT'
  | 'REGION_LOCKED'
  | 'LEGENDARY_COOLDOWN'
  | 'INVALID_INPUT'

export type MoveCityResult = EdgeFunctionResult<MoveCitySuccess, MoveCityErrorCode>
export type MoveCityError = EdgeFunctionError<MoveCityErrorCode>

export async function moveCity(toCityId: number): Promise<MoveCityResult> {
  if (!Number.isInteger(toCityId) || toCityId <= 0) {
    return { data: null, error: { code: 'INVALID_INPUT', message: '유효하지 않은 도시 ID' } }
  }
  return callEdgeFunction('move-city', { to_city_id: toCityId }, '이동 실패')
}
