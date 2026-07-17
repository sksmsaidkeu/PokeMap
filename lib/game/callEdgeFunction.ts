import { createClient } from '@/lib/supabase/client'

// moveCity/catchAttempt가 거의 동일하게 반복하던 "세션 조회 → fetch → 방어적 JSON 파싱
// → 실패를 NETWORK_ERROR로 매핑" 흐름을 한 곳으로 모음(코드 리뷰 대응).
export type EdgeFunctionError<TErrorCode extends string> = {
  code: TErrorCode | 'UNAUTHENTICATED' | 'NETWORK_ERROR'
  message: string
}

export type EdgeFunctionResult<TSuccess, TErrorCode extends string> =
  | { data: TSuccess; error: null }
  | { data: null; error: EdgeFunctionError<TErrorCode> }

export async function callEdgeFunction<TSuccess, TErrorCode extends string>(
  path: string,
  body: unknown,
  fallbackMessage: string,
): Promise<EdgeFunctionResult<TSuccess, TErrorCode>> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session) {
    return { data: null, error: { code: 'UNAUTHENTICATED', message: '로그인이 필요합니다' } }
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    })

    const parsed = (await res.json().catch(() => null)) as EdgeFunctionResult<TSuccess, TErrorCode> | null

    if (!res.ok || !parsed) {
      const err = parsed?.error
      return {
        data: null,
        error: {
          code: err?.code ?? 'NETWORK_ERROR',
          message: err?.message ?? `${fallbackMessage} (${res.status})`,
        },
      }
    }

    return parsed
  } catch {
    // EF 미배포/네트워크 단절 — 스텁 조작 없이 자연 실패
    return { data: null, error: { code: 'NETWORK_ERROR', message: '네트워크 오류' } }
  }
}
