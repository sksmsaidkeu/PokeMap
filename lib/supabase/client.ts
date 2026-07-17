import { createBrowserClient, type CookieOptions } from '@supabase/ssr'
import { parse, serialize } from 'cookie'
import type { Database } from './types'
import { REMEMBER_COOKIE, demoteIfNotRemembered } from './remember'

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // 기본 document.cookie 처리와 동일하되, "기억하기" 미체크 시 인증 쿠키를 세션 쿠키로 강등한다.
      cookies: {
        getAll() {
          if (typeof document === 'undefined') return [] // SSR/프리렌더: 쿠키 없음
          const parsed = parse(document.cookie)
          return Object.entries(parsed).map(([name, value]) => ({ name, value: value ?? '' }))
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          if (typeof document === 'undefined') return
          const remembered = parse(document.cookie)[REMEMBER_COOKIE] === '1'
          for (const { name, value, options } of cookiesToSet) {
            document.cookie = serialize(name, value, demoteIfNotRemembered(options, remembered))
          }
        },
      },
    },
  )
}
