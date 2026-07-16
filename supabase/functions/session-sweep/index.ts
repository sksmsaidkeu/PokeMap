// session-sweep: 만료 세션/쿨다운 정리 (DB.md §9, §17)
// 평시엔 pg_cron이 fn_session_sweep()을 직접 호출한다 — 이 EF는 수동 운영용
// 래퍼라 유저 JWT가 아니라 service_role key bearer만 허용한다(유저 호출 불가).
import { createClient } from 'jsr:@supabase/supabase-js@2'

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

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token || token !== serviceKey) {
    return reply(401, null, { code: 'UNAUTHENTICATED', message: 'service role key required' })
  }

  const admin = createClient(url, serviceKey)
  const { data, error } = await admin.rpc('fn_session_sweep')

  if (error) {
    console.error('fn_session_sweep failed', { code: 'INTERNAL', raw: error.message })
    return reply(500, null, { code: 'INTERNAL', message: 'internal error' })
  }

  return reply(200, data, null)
})
