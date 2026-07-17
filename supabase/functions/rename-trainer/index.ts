// rename-trainer: 트레이너 이름(닉네임) 변경 (DB.md §9)
// 책임은 하나 — JWT에서 user_id를 검증(§20)한 뒤 service_role로 본인 profiles row만
// 갱신한다. profiles는 no_direct_write RLS라 클라이언트 직접 UPDATE가 0행 성공(사일런트
// 실패)하므로, 이 EF가 유일한 쓰기 경로다. 길이 규칙은 bootstrap-location과 동일(2~20자).
import { CORS, adminClient, methodNotAllowed, reply, verifyUser } from '../_shared/http.ts'

const CODE_STATUS: Record<string, number> = {
  INVALID_INPUT: 400,
  INVALID_NICKNAME: 400,
  NICKNAME_TAKEN: 409,
  UNAUTHENTICATED: 401,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return methodNotAllowed()

  const { userId, errorResponse } = await verifyUser(req)
  if (errorResponse) return errorResponse

  let body: { nickname?: unknown }
  try {
    body = await req.json()
  } catch {
    return reply(400, null, { code: 'INVALID_INPUT', message: 'malformed json' })
  }

  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  if (nickname.length < 2 || nickname.length > 20) {
    return reply(400, null, { code: 'INVALID_NICKNAME', message: '트레이너 이름은 2~20자로 입력해 주세요' })
  }

  const admin = adminClient()
  // 요청자 본인 row만 대상(§20) — service_role이 RLS를 우회하므로 .eq('id', userId)가 유일한 방어선.
  const { data, error } = await admin
    .from('profiles')
    .update({ nickname })
    .eq('id', userId)
    .select('nickname')
    .single()

  if (error) {
    // profiles_nickname_key UNIQUE 위반 → 다른 트레이너가 이미 쓰는 이름
    if (error.code === '23505') {
      return reply(409, null, { code: 'NICKNAME_TAKEN', message: '이미 사용 중인 이름이에요' })
    }
    console.error('rename-trainer failed', { code: 'INTERNAL', raw: error.message })
    return reply(500, null, { code: 'INTERNAL', message: 'internal error' })
  }

  return reply(200, data, null)
})
