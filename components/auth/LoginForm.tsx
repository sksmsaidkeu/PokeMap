'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

type Mode = 'signin' | 'signup'

type BootstrapSuccess = {
  data: { city_id: number; city_name: string; fallback: boolean }
}

// 브라우저 Geolocation만 사용(CLAUDE.md §6). 거부/타임아웃 시 null을 넘기고 폴백은 서버가 결정한다.
function getCoords(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 60000 },
    )
  })
}

function friendlyAuthError(code: string | undefined, message: string): string {
  const c = code ?? ''
  if (c === 'user_already_exists' || /already registered|already been registered/i.test(message)) {
    return '이미 가입된 이메일이에요. 로그인해 주세요.'
  }
  if (c === 'weak_password' || /at least 6|weak password/i.test(message)) {
    return '비밀번호는 6자 이상이어야 해요.'
  }
  if (c === 'invalid_credentials' || /invalid login credentials/i.test(message)) {
    return '이메일 또는 비밀번호가 올바르지 않아요.'
  }
  if (c === 'validation_failed' || /invalid.*email/i.test(message)) {
    return '이메일 형식을 확인해 주세요.'
  }
  return message || '문제가 발생했어요. 잠시 후 다시 시도해 주세요.'
}

export default function LoginForm() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [nicknameError, setNicknameError] = useState<string | null>(null)

  // signUp은 성공 시 즉시 세션을 반환한다(enable_confirmations=false). 계정이 이미 만들어진 뒤
  // NICKNAME_TAKEN 등으로 bootstrap만 실패한 경우, 재제출 시 재가입 없이 bootstrap만 다시 호출한다.
  const [accountCreated, setAccountCreated] = useState(false)

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setNicknameError(null)
  }

  async function runBootstrap(): Promise<boolean> {
    const coords = await getCoords()
    const { data, error } = await supabase.functions.invoke<BootstrapSuccess>(
      'bootstrap-location',
      { body: { nickname: nickname.trim(), lat: coords?.lat ?? null, lng: coords?.lng ?? null } },
    )

    if (error) {
      let code = 'UNKNOWN'
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null)
        code = body?.error?.code ?? 'UNKNOWN'
      }
      if (code === 'NICKNAME_TAKEN') {
        setNicknameError('이미 사용 중인 트레이너 이름이에요.')
      } else if (code === 'INVALID_NICKNAME') {
        setNicknameError('트레이너 이름은 2~20자로 입력해 주세요.')
      } else {
        setFormError('시작 위치를 정하지 못했어요. 잠시 후 다시 시도해 주세요.')
      }
      return false
    }

    // 서버 응답(bootstrap 확정)을 받은 뒤에만 화면을 전환한다(CLAUDE.md §2 낙관적 업데이트 금지).
    void data
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setLoading(true)
    setFormError(null)
    setNicknameError(null)

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) {
        setFormError(friendlyAuthError(error.code, error.message))
        setLoading(false)
        return
      }
      router.replace('/map')
      return
    }

    if (!accountCreated) {
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) {
        setFormError(friendlyAuthError(error.code, error.message))
        setLoading(false)
        return
      }
      setAccountCreated(true)
    }

    const ok = await runBootstrap()
    if (!ok) {
      setLoading(false)
      return
    }
    router.replace('/map')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div role="tablist" aria-label="로그인 또는 회원가입" className="flex rounded-full border-2 border-black bg-white p-1">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signin'}
          onClick={() => switchMode('signin')}
          className={`min-h-11 flex-1 rounded-full text-sm font-bold transition ${
            mode === 'signin' ? 'bg-[#e3350d] text-white' : 'text-black'
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'signup'}
          onClick={() => switchMode('signup')}
          className={`min-h-11 flex-1 rounded-full text-sm font-bold transition ${
            mode === 'signup' ? 'bg-[#e3350d] text-white' : 'text-black'
          }`}
        >
          회원가입
        </button>
      </div>

      <div className="space-y-1">
        <label htmlFor="email" className="block text-sm font-bold">
          이메일
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-11 w-full rounded-xl border-2 border-black px-3 text-base outline-none focus:ring-2 focus:ring-[#e3350d]"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="password" className="block text-sm font-bold">
          비밀번호
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="min-h-11 w-full rounded-xl border-2 border-black px-3 text-base outline-none focus:ring-2 focus:ring-[#e3350d]"
        />
        {mode === 'signup' && (
          <p className="text-xs text-gray-600">6자 이상 입력해 주세요.</p>
        )}
      </div>

      {mode === 'signup' && (
        <div className="space-y-1">
          <label htmlFor="nickname" className="block text-sm font-bold">
            트레이너 이름
          </label>
          <input
            id="nickname"
            name="nickname"
            type="text"
            required
            minLength={2}
            maxLength={20}
            autoComplete="username"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            aria-invalid={nicknameError ? true : undefined}
            aria-describedby={nicknameError ? 'nickname-error' : undefined}
            className="min-h-11 w-full rounded-xl border-2 border-black px-3 text-base outline-none focus:ring-2 focus:ring-[#e3350d]"
          />
          {nicknameError && (
            <p id="nickname-error" role="alert" className="text-sm font-medium text-[#e3350d]">
              {nicknameError}
            </p>
          )}
        </div>
      )}

      {formError && (
        <p role="alert" className="rounded-xl border-2 border-[#e3350d] bg-[#e3350d]/10 px-3 py-2 text-sm font-medium text-[#e3350d]">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="min-h-11 w-full rounded-full border-2 border-black bg-[#e3350d] text-base font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? '잠시만요…' : mode === 'signup' ? '모험 시작하기' : '로그인'}
      </button>

      {mode === 'signup' && (
        <p className="text-center text-xs text-gray-600">
          가입 시 위치 권한을 허용하면 실제 동네에서 모험을 시작해요. 거부해도 가입은 진행됩니다.
        </p>
      )}
    </form>
  )
}
