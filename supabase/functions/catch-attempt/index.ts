// catch-attempt: 포획 시도 판정 (DB.md §9~10, §13.1)
// move-city와 동일 구조 — JWT에서 user_id를 검증(§20)한 뒤 service_role로
// fn_catch_attempt를 호출하고 결과/에러를 { data, error } + error.code로 매핑한다.
// 확률 판정·트리거(도감/pity/쿨다운)는 전부 DB 안에서만 일어난다.
import { CORS, adminClient, methodNotAllowed, reply, verifyUser } from '../_shared/http.ts'

// RAISE EXCEPTION 코드 문자열 → HTTP 상태
const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  SESSION_NOT_FOUND: 404,
  SESSION_EXPIRED: 409,
  NO_ATTEMPTS_LEFT: 409,
  UNAUTHENTICATED: 401,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return methodNotAllowed()

  const { userId, errorResponse } = await verifyUser(req)
  if (errorResponse) return errorResponse

  // 입력 검증: session_id는 uuid 형식만(§20 화이트리스트 검증)
  let body: { session_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'malformed json' })
  }
  const sessionId = body.session_id
  if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId)) {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'session_id must be a uuid' })
  }

  // 원자적 포획 시도 (락/판정/트리거는 DB 함수 내부)
  const admin = adminClient()
  const { data, error } = await admin.rpc('fn_catch_attempt', {
    p_user_id: userId,
    p_session_id: sessionId,
  })

  if (error) {
    const code = (error.message ?? '').trim()
    const status = CODE_STATUS[code]
    if (status) return reply(status, null, { code, message: code })
    // 예상 밖 오류는 코드를 흘리지 않는다
    console.error('fn_catch_attempt failed', { code: 'INTERNAL', raw: error.message })
    return reply(500, null, { code: 'INTERNAL', message: 'internal error' })
  }

  return reply(200, data, null)
})
