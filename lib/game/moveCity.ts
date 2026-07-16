import { createClient } from '@/lib/supabase/client'

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

// NETWORK_ERROR는 계약(4xx)엔 없지만 EF 미배포/오프라인을 자연 처리하기 위한 클라이언트 전용 코드.
export type MoveCityErrorCode =
  | 'NOT_ADJACENT'
  | 'REGION_LOCKED'
  | 'LEGENDARY_COOLDOWN'
  | 'UNAUTHENTICATED'
  | 'INVALID_INPUT'
  | 'NETWORK_ERROR'

export type MoveCityError = { code: MoveCityErrorCode; message: string }

export type MoveCityResult =
  | { data: MoveCitySuccess; error: null }
  | { data: null; error: MoveCityError }

export async function moveCity(toCityId: number): Promise<MoveCityResult> {
  if (!Number.isInteger(toCityId) || toCityId <= 0) {
    return { data: null, error: { code: 'INVALID_INPUT', message: '유효하지 않은 도시 ID' } }
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
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/move-city`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ to_city_id: toCityId }),
      },
    )

    const body = (await res.json().catch(() => null)) as MoveCityResult | null

    if (!res.ok || !body) {
      const err = body?.error
      return {
        data: null,
        error: {
          code: err?.code ?? 'NETWORK_ERROR',
          message: err?.message ?? `이동 실패 (${res.status})`,
        },
      }
    }

    return body
  } catch {
    // EF 미배포/네트워크 단절 — 스텁 조작 없이 자연 실패
    return { data: null, error: { code: 'NETWORK_ERROR', message: '네트워크 오류' } }
  }
}
