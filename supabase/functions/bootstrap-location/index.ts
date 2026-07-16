import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface BootstrapResult {
  city_id: number
  city_name: string
  fallback: boolean
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function fail(code: string, status: number): Response {
  return json({ data: null, error: { code } }, status)
}

// 위/경도는 신뢰 경계이므로 유한 숫자 + 지리 범위까지 검증, 벗어나면 폴백 처리를 위해 null.
function validCoord(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value < -max || value > max) return null
  return value
}

function parseResult(data: unknown): BootstrapResult | null {
  const row = Array.isArray(data) ? data[0] : data
  if (
    row &&
    typeof row === 'object' &&
    typeof (row as Record<string, unknown>).city_id === 'number' &&
    typeof (row as Record<string, unknown>).city_name === 'string' &&
    typeof (row as Record<string, unknown>).fallback === 'boolean'
  ) {
    return row as BootstrapResult
  }
  return null
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return fail('METHOD_NOT_ALLOWED', 405)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return fail('SERVER_MISCONFIGURED', 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return fail('UNAUTHORIZED', 401)
  }

  // 요청자 신원은 JWT에서만 확정 — 이 user_id가 곧 생성 대상이라 조작 대상과 항상 일치(CLAUDE.md §20).
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await authClient.auth.getUser()
  if (userErr || !userData.user) {
    return fail('UNAUTHORIZED', 401)
  }
  const userId = userData.user.id

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return fail('INVALID_BODY', 400)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return fail('INVALID_BODY', 400)
  }
  const body = parsed as { nickname?: unknown; lat?: unknown; lng?: unknown; city_id?: unknown }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  if (nickname.length < 2 || nickname.length > 20) {
    return fail('INVALID_NICKNAME', 400)
  }

  const lat = validCoord(body.lat, 90)
  const lng = validCoord(body.lng, 180)
  const hasCoords = lat !== null && lng !== null

  // GPS 실패 시 클라이언트가 수동 선택한 시. 유효성(실존/육지)은 DB 함수가 최종 판정한다.
  const cityId =
    typeof body.city_id === 'number' && Number.isInteger(body.city_id) && body.city_id > 0
      ? body.city_id
      : null

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin.rpc('bootstrap_user', {
    p_user_id: userId,
    p_nickname: nickname,
    p_lat: hasCoords ? lat : null,
    p_lng: hasCoords ? lng : null,
    p_city_id: cityId,
  })

  if (error) {
    if (error.message.includes('NICKNAME_TAKEN')) {
      return fail('NICKNAME_TAKEN', 409)
    }
    if (error.message.includes('INVALID_CITY')) {
      return fail('INVALID_CITY', 400)
    }
    console.error(JSON.stringify({ code: 'BOOTSTRAP_FAILED', pg_message: error.message }))
    return fail('BOOTSTRAP_FAILED', 500)
  }

  const result = parseResult(data)
  if (!result) {
    console.error(JSON.stringify({ code: 'BOOTSTRAP_EMPTY_RESULT' }))
    return fail('BOOTSTRAP_FAILED', 500)
  }

  return json({
    data: { city_id: result.city_id, city_name: result.city_name, fallback: result.fallback },
    error: null,
  }, 200)
})
