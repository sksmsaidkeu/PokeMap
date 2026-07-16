// move-city: 인접 시 이동 판정 (DB.md §9~12, §10.1)
// 책임은 하나 — JWT에서 user_id를 검증(§20)한 뒤 service_role로 fn_move_city를
// 호출하고 그 결과/에러를 { data, error } + error.code(HTTP 4xx)로 매핑한다.
// 스폰/전설/락 판정은 전부 DB 함수 안에서만 일어난다(클라이언트/EF는 확률 미계산).
import { createClient } from 'jsr:@supabase/supabase-js@2'

// RAISE EXCEPTION 코드 문자열 → HTTP 상태
const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  NOT_ADJACENT: 400,
  REGION_LOCKED: 403,
  LEGENDARY_COOLDOWN: 409,
  NO_PROGRESS: 409,
  UNAUTHENTICATED: 401,
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function reply(status: number, data: unknown, error: { code: string; message: string } | null) {
  return new Response(JSON.stringify({ data, error }), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, null, { code: 'INVALID_INPUT', message: 'POST only' })

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!/^Bearer\s+.+/i.test(authHeader)) {
    return reply(401, null, { code: 'UNAUTHENTICATED', message: 'missing bearer token' })
  }

  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // JWT 검증 → user_id (service_role은 RLS를 우회하므로 이 검증이 유일한 방어선, §20)
  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  if (userErr || !userData.user) {
    return reply(401, null, { code: 'UNAUTHENTICATED', message: 'invalid token' })
  }
  const userId = userData.user.id

  // 입력 검증: to_city_id는 양의 정수만(§20 범위 검증)
  let body: { to_city_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'malformed json' })
  }
  const toCityId = body.to_city_id
  if (typeof toCityId !== 'number' || !Number.isInteger(toCityId) || toCityId <= 0) {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'to_city_id must be a positive integer' })
  }

  // 원자적 이동 실행 (락/판정은 DB 함수 내부)
  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.rpc('fn_move_city', {
    p_user_id: userId,
    p_to_city_id: toCityId,
  })

  if (error) {
    const code = (error.message ?? '').trim()
    const status = CODE_STATUS[code]
    if (status) return reply(status, null, { code, message: code })
    // 예상 밖 오류는 코드를 흘리지 않는다
    console.error('fn_move_city failed', { code: 'INTERNAL', raw: error.message })
    return reply(500, null, { code: 'INTERNAL', message: 'internal error' })
  }

  return reply(200, data, null)
})
