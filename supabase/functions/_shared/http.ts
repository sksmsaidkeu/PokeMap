// 4개 Edge Function이 동일하게 쓰던 CORS/응답 포맷/JWT 검증을 한 곳으로 모음.
// (코드 리뷰 대응: 이전엔 파일마다 복붙되어 있어 정책 변경 시 하나씩 놓치기 쉬웠음)
import { createClient } from 'jsr:@supabase/supabase-js@2'

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export function reply(status: number, data: unknown, error: { code: string; message: string } | null) {
  return new Response(JSON.stringify({ data, error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// 405 전용 코드 — INVALID_INPUT은 각 함수 CODE_STATUS 테이블에서 항상 400이라
// 같은 코드를 405로도 쓰면 코드→상태 계약이 이 경로에서만 깨진다.
export function methodNotAllowed() {
  return reply(405, null, { code: 'METHOD_NOT_ALLOWED', message: 'POST only' })
}

// JWT에서 user_id를 검증(§20) — service_role은 RLS를 우회하므로 이 검증이 유일한 방어선.
export async function verifyUser(
  req: Request,
): Promise<{ userId: string; errorResponse: null } | { userId: null; errorResponse: Response }> {
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+.+/i.test(authHeader)) {
    return { userId: null, errorResponse: reply(401, null, { code: 'UNAUTHENTICATED', message: 'missing bearer token' }) }
  }

  const authClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  if (userErr || !userData.user) {
    return { userId: null, errorResponse: reply(401, null, { code: 'UNAUTHENTICATED', message: 'invalid token' }) }
  }
  return { userId: userData.user.id, errorResponse: null }
}

export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
}

// 시크릿 문자열 비교용 constant-time 비교 — 길이/문자 불일치 위치로 인한 타이밍 차이를 없앤다.
export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a)
  const bufB = new TextEncoder().encode(b)
  if (bufA.length !== bufB.length) return false
  let diff = 0
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i]
  return diff === 0
}
