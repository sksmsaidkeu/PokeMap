import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'
import { REMEMBER_COOKIE, demoteIfNotRemembered } from './remember'

export async function createClient() {
  const cookieStore = await cookies()
  // 토큰 갱신 시 재기록되는 인증 쿠키도 미기억 상태면 세션 쿠키로 유지해야 한다(클라와 동일 규칙).
  const remembered = cookieStore.get(REMEMBER_COOKIE)?.value === '1'

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
          // 서버 컴포넌트에선 쿠키 쓰기가 금지됨 — 갱신은 다음 요청(클라/Route Handler)에서 반영되므로 무시.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, demoteIfNotRemembered(options, remembered)),
            )
          } catch {
            // no-op
          }
        },
      },
    },
  )
}
