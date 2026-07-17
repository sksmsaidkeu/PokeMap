// bootstrap-location: 가입 직후 시작 위치 확정 (DB.md §9)
// 책임은 하나 — JWT에서 user_id를 검증(§20)한 뒤 service_role로
// fn_bootstrap_location을 호출하고 결과를 { data, error } + error.code로 매핑한다.
// 좌표가 null이면(GPS 거부) DB 함수가 서울특별시 폴백을 처리한다(CLAUDE.md §6).
import { CORS, adminClient, methodNotAllowed, reply, verifyUser } from '../_shared/http.ts'

// RAISE EXCEPTION 코드 문자열 → HTTP 상태
const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  NO_CITY_DATA: 500,
  UNAUTHENTICATED: 401,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return methodNotAllowed()

  const { userId, errorResponse } = await verifyUser(req)
  if (errorResponse) return errorResponse

  // 입력 검증: 둘 다 null(폴백)이거나 둘 다 한국 근방 범위 안의 숫자(§20)
  let body: { lat?: unknown; lng?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'malformed json' })
  }
  const rawLat = body.lat ?? null
  const rawLng = body.lng ?? null
  let lat: number | null
  let lng: number | null
  if (rawLat === null && rawLng === null) {
    lat = null
    lng = null
  } else if (
    typeof rawLat === 'number' && Number.isFinite(rawLat) && rawLat >= 33 && rawLat <= 39 &&
    typeof rawLng === 'number' && Number.isFinite(rawLng) && rawLng >= 124 && rawLng <= 132
  ) {
    lat = rawLat
    lng = rawLng
  } else {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'lat/lng must both be null or within Korea bounds' })
  }

  // 최근접 매칭 + user_progress 생성 (idempotent, DB 함수 내부)
  const admin = adminClient()
  const { data, error } = await admin.rpc('fn_bootstrap_location', {
    p_user_id: userId,
    p_lat: lat,
    p_lng: lng,
  })

  if (error) {
    const code = (error.message ?? '').trim()
    const status = CODE_STATUS[code]
    if (status) return reply(status, null, { code, message: code })
    // 예상 밖 오류는 코드를 흘리지 않는다
    console.error('fn_bootstrap_location failed', { code: 'INTERNAL', raw: error.message })
    return reply(500, null, { code: 'INTERNAL', message: 'internal error' })
  }

  return reply(200, data, null)
})
