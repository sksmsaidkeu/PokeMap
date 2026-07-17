import { serialize } from 'cookie'
import type { CookieOptions } from '@supabase/ssr'

// "로그인 기억하기" 마커. 이 쿠키가 없으면 인증 쿠키를 세션 쿠키로 강등해
// 브라우저 종료 시 삭제되게 한다 → 재방문 시 로그아웃(기본값). 체크 시에만 지속.
export const REMEMBER_COOKIE = 'pm-remember'

const YEAR_PLUS = 400 * 24 * 60 * 60 // 브라우저 상한(400일)

// 미기억 상태면 set되는 인증 쿠키의 지속 옵션을 벗겨 세션 쿠키로 만든다.
// 삭제(maxAge 0/미설정)는 그대로 둔다 — 로그아웃/청크 정리가 깨지면 안 됨.
export function demoteIfNotRemembered(options: CookieOptions, remembered: boolean): CookieOptions {
  if (remembered || !options.maxAge) return options
  const { maxAge: _maxAge, expires: _expires, ...session } = options
  return session
}

// 마커 자체는 (체크 시) 지속 쿠키 → 다음 방문에서 서버/클라가 지속 여부를 안다. 클라이언트 전용.
export function rememberMe(on: boolean) {
  document.cookie = serialize(REMEMBER_COOKIE, on ? '1' : '', {
    path: '/',
    sameSite: 'lax',
    maxAge: on ? YEAR_PLUS : 0,
  })
}
