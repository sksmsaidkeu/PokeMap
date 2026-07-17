// bootstrap-location: 가입 직후 시작 위치 확정 (DB.md §9)
// 책임은 하나 — JWT에서 user_id를 검증(§20)한 뒤 service_role로
// fn_bootstrap_location을 호출하고 결과를 { data, error } + error.code로 매핑한다.
// 닉네임은 클라이언트가 입력한 실제 값, 좌표가 둘 다 null이고 city_id도 없으면
// DB 함수가 서울특별시 폴백을 처리한다(CLAUDE.md §6). city_id는 GPS 실패 시 수동 선택.
import { CORS, adminClient, methodNotAllowed, reply, verifyUser } from '../_shared/http.ts'

// RAISE EXCEPTION 코드 문자열 → HTTP 상태
const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  INVALID_NICKNAME: 400,
  INVALID_CITY: 400,
  NICKNAME_TAKEN: 409,
  NO_CITY_DATA: 500,
  UNAUTHENTICATED: 401,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return methodNotAllowed()

  const { userId, errorResponse } = await verifyUser(req)
  if (errorResponse) return errorResponse

  let body: { nickname?: unknown; lat?: unknown; lng?: unknown; city_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'malformed json' })
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  if (nickname.length < 2 || nickname.length > 20) {
    return reply(400, null, { code: 'INVALID_NICKNAME', message: '트레이너 이름은 2~20자로 입력해 주세요' })
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

  // GPS 실패 시 클라이언트가 수동 선택한 시 — 실존/육지/미잠금 여부는 DB 함수가 최종 판정한다.
  const cityId =
    typeof body.city_id === 'number' && Number.isInteger(body.city_id) && body.city_id > 0
      ? body.city_id
      : null

  const admin = adminClient()
  const { data, error } = await admin.rpc('fn_bootstrap_location', {
    p_user_id: userId,
    p_nickname: nickname,
    p_lat: lat,
    p_lng: lng,
    p_city_id: cityId,
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
