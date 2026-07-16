'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// EF 응답 규약(§8): { data, error } + error.code
type BootstrapResponse = {
  data: { current_city_id: number; created: boolean } | null
  error: { code: string; message: string } | null
}

// GPS 실패(권한 거부/타임아웃)는 null 좌표로 넘겨 서버 폴백(서울특별시)에 맡긴다(§6)
function getPosition(): Promise<{ lat: number | null; lng: number | null }> {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      resolve({ lat: null, lng: null })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { timeout: 10_000 },
    )
  })
}

export default function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setPending(true)
    const supabase = createClient()
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setErrorMsg('로그인에 실패했습니다. 이메일/비밀번호를 확인하세요.')
          return
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
        if (error) {
          setErrorMsg(`가입에 실패했습니다: ${error.message}`)
          return
        }
        if (!data.session) {
          // 이메일 확인이 켜진 프로젝트: 세션 없이는 EF 호출 불가 — 인증 후 로그인 유도
          setErrorMsg('확인 메일을 보냈습니다. 메일 인증 후 로그인하세요.')
          setMode('login')
          return
        }
      }

      // 서버가 시작 위치를 확정한 뒤에만 이동한다 — 낙관적 라우팅 금지(§2).
      // 로그인 경로에서도 호출하는 이유: 이메일 확인이 켜진 프로젝트에선 가입 직후
      // 세션이 없어 로그인이 사실상 첫 부트스트랩 경로다. fn이 idempotent라
      // 기존 유저는 좌표와 무관하게 기존 값을 돌려받는다(GPS 권한은 브라우저가
      // 기억하므로 추가 프롬프트는 최초 1회뿐).
      const coords = await getPosition()
      const { data: fnData, error: fnError } = await supabase.functions.invoke<BootstrapResponse>(
        'bootstrap-location',
        { body: coords },
      )
      if (fnError || !fnData || fnData.error) {
        setErrorMsg('시작 위치 설정에 실패했습니다. 다시 시도하세요.')
        if (mode === 'signup') setMode('login')
        return
      }
      router.push('/map')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="email"
        required
        autoComplete="email"
        placeholder="이메일"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-[#ede6d6] placeholder:text-[#ede6d6]/40"
      />
      <input
        type="password"
        required
        minLength={6}
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder="비밀번호 (6자 이상)"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-[#ede6d6] placeholder:text-[#ede6d6]/40"
      />
      {errorMsg && <p className="text-sm text-red-400">{errorMsg}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[#ede6d6] px-3 py-2 text-sm font-bold text-black disabled:opacity-50"
      >
        {pending ? '처리 중…' : mode === 'login' ? '로그인' : '가입하기'}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setErrorMsg(null)
        }}
        className="w-full text-sm text-[#ede6d6]/60 underline"
      >
        {mode === 'login' ? '계정이 없나요? 가입하기' : '이미 계정이 있나요? 로그인'}
      </button>
    </form>
  )
}
