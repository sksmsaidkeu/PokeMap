'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { rememberMe } from '@/lib/supabase/remember'

type Mode = 'signin' | 'signup'

type BootstrapSuccess = {
  data: { city_id: number; city_name: string; fallback: boolean }
}

type Province = { id: number; name: string }
type City = { id: number; name: string }

type BootstrapOutcome = 'ok' | 'nickname_taken' | 'invalid_nickname' | 'invalid_city' | 'error'

// 서울/부산/대구/인천/광주/대전/울산 — 구역 분할된 광역시(provinces.id, DB.md §4.5)
const METRO_PROVINCE_IDS = [1, 2, 3, 4, 5, 6, 7]

// 브라우저 Geolocation만 사용(CLAUDE.md §6). 거부/타임아웃/미지원 시 null → 수동 선택으로 유도.
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

  // 기본 미체크 → 인증 쿠키가 세션 쿠키가 되어 브라우저 종료 시 로그아웃. 체크 시에만 로그인 유지.
  const [remember, setRemember] = useState(false)

  // signUp은 성공 시 즉시 세션을 반환한다(enable_confirmations=false). 계정 생성은 위치가 확정된
  // 시점(GPS 성공 또는 수동 선택 완료)에만 한다 — 위치 없이 먼저 만들면, GPS 실패 후 사용자가
  // 이탈했을 때 profiles/user_progress 없는 고아 auth 계정이 남는다. 계정 생성 후 bootstrap만
  // 실패하면(일시적 오류) 재시도 시 재가입 없이 bootstrap만 다시 호출하도록 이 플래그로 가드.
  const [accountCreated, setAccountCreated] = useState(false)

  // GPS 실패 시 수동 위치 선택(도→시). 잠긴 섬(§16)은 시작지 후보에서 제외한다.
  const [showManual, setShowManual] = useState(false)
  const [provinces, setProvinces] = useState<Province[]>([])
  const [cities, setCities] = useState<City[]>([])
  const [provinceId, setProvinceId] = useState<number | ''>('')
  const [cityId, setCityId] = useState<number | ''>('')

  function switchMode(next: Mode) {
    setMode(next)
    setFormError(null)
    setNicknameError(null)
    setShowManual(false)
  }

  async function loadProvinces(): Promise<boolean> {
    const { data, error } = await supabase
      .from('provinces')
      .select('id, name')
      .eq('is_island_endgame', false)
      .order('id')
    if (error || !data) return false
    setProvinces(data)
    return true
  }

  async function handleProvinceChange(next: number | '') {
    setProvinceId(next)
    setCityId('')
    setCities([])
    if (next === '') return
    // 도 → 생활권 → 시. 잠긴 섬/엔드게임 생활권은 애초에 목록에 없으므로 그 도의 시는 노출되지 않는다.
    const { data: areas, error: areaErr } = await supabase
      .from('living_areas')
      .select('id')
      .eq('province_id', next)
      .eq('is_endgame_area', false)
      .returns<{ id: number }[]>()
    if (areaErr) {
      setFormError('지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    const areaIds = (areas ?? []).map((a) => a.id)
    if (areaIds.length === 0) return
    let cityQuery = supabase.from('cities').select('id, name').in('living_area_id', areaIds).order('name')
    // 광역시 구역 분할(DB.md §4.5) 후에도 온보딩은 기존과 같은 굵기로 유지 —
    // 구역B/C/D는 지도 진입 후 이동으로만 도달, 시작지 선택지는 구역A(is_legendary_site)만 노출.
    if (METRO_PROVINCE_IDS.includes(next)) {
      cityQuery = cityQuery.eq('is_legendary_site', true)
    }
    const { data: cityRows, error: cityErr } = await cityQuery
    if (cityErr) {
      setFormError('지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }
    setCities(cityRows ?? [])
  }

  async function invokeBootstrap(coords: { lat: number; lng: number } | null, chosenCityId: number | null): Promise<BootstrapOutcome> {
    const { error } = await supabase.functions.invoke<BootstrapSuccess>('bootstrap-location', {
      body: {
        nickname: nickname.trim(),
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
        city_id: chosenCityId,
      },
    })
    if (!error) return 'ok'

    let code = 'UNKNOWN'
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null)
      code = body?.error?.code ?? 'UNKNOWN'
    }
    if (code === 'NICKNAME_TAKEN') return 'nickname_taken'
    if (code === 'INVALID_NICKNAME') return 'invalid_nickname'
    if (code === 'INVALID_CITY') return 'invalid_city'
    return 'error'
  }

  // bootstrap 응답(위치 확정)을 받은 뒤에만 화면을 전환한다(CLAUDE.md §2 낙관적 업데이트 금지).
  function applyOutcome(outcome: BootstrapOutcome) {
    if (outcome === 'ok') {
      router.replace('/map')
      return
    }
    setLoading(false)
    if (outcome === 'nickname_taken') setNicknameError('이미 사용 중인 트레이너 이름이에요.')
    else if (outcome === 'invalid_nickname') setNicknameError('트레이너 이름은 2~20자로 입력해 주세요.')
    else if (outcome === 'invalid_city') setFormError('선택한 지역이 올바르지 않아요. 다시 선택해 주세요.')
    else setFormError('시작 위치를 정하지 못했어요. 잠시 후 다시 시도해 주세요.')
  }

  // 위치가 확정된 시점에만 호출: 계정을 (없으면) 만들고 bootstrap으로 시작 위치를 확정한다.
  // 계정 생성을 여기까지 미뤄야 GPS 실패 후 이탈 시 고아 계정이 남지 않는다.
  async function completeSignup(coords: { lat: number; lng: number } | null, chosenCityId: number | null) {
    if (!accountCreated) {
      // 가입엔 기억하기 옵션이 없다 — 기본(세션 쿠키)로 시작, 재방문 시 로그아웃.
      rememberMe(false)
      const { error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) {
        setFormError(friendlyAuthError(error.code, error.message))
        setLoading(false)
        return
      }
      setAccountCreated(true)
    }
    applyOutcome(await invokeBootstrap(coords, chosenCityId))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (loading) return
    setFormError(null)
    setNicknameError(null)

    if (mode === 'signin') {
      setLoading(true)
      // signIn이 세션 쿠키를 쓰기 전에 마커를 확정해야 쿠키 지속 여부가 올바로 적용된다.
      rememberMe(remember)
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) {
        setFormError(friendlyAuthError(error.code, error.message))
        setLoading(false)
        return
      }
      router.replace('/map')
      return
    }

    // 회원가입: 계정 생성 전에 플레이어 이름을 먼저 검증한다(빈 계정 생성 방지).
    const trimmed = nickname.trim()
    if (trimmed.length === 0) {
      setFormError('플레이어 이름을 입력해주세요')
      return
    }
    if (trimmed.length < 2 || trimmed.length > 20) {
      setFormError('플레이어 이름은 2~20자로 입력해 주세요')
      return
    }

    setLoading(true)
    const coords = await getCoords()
    if (!coords) {
      // GPS 불가/실패 → 계정을 만들지 않고 수동 지역 선택으로 유도(이탈해도 고아 계정 없음).
      const ok = await loadProvinces()
      setShowManual(true)
      setLoading(false)
      if (!ok) setFormError('지역 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.')
      return
    }

    await completeSignup(coords, null)
  }

  async function handleManualConfirm() {
    if (loading) return
    setFormError(null)
    setNicknameError(null)
    if (cityId === '') {
      setFormError('시작할 지역을 선택해 주세요')
      return
    }
    setLoading(true)
    await completeSignup(null, Number(cityId))
  }

  const inputClass =
    'min-h-11 w-full rounded-xl border-2 border-black px-3 text-base outline-none focus:ring-2 focus:ring-[#e3350d]'

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
          // 이메일을 바꾸면 이전에 만든 계정 가정이 무효 — 다음 제출 때 새 이메일로 재가입하도록 리셋.
          onChange={(e) => {
            setEmail(e.target.value)
            if (accountCreated) setAccountCreated(false)
          }}
          className={inputClass}
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
          className={inputClass}
        />
        {mode === 'signup' && !showManual && (
          <p className="text-xs text-gray-600">6자 이상 입력해 주세요.</p>
        )}
      </div>

      {mode === 'signin' && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-4 w-4 accent-[#e3350d]"
          />
          로그인 기억하기
        </label>
      )}

      {mode === 'signup' && (
        <div className="space-y-1">
          <label htmlFor="nickname" className="block text-sm font-bold">
            플레이어 이름
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
            className={inputClass}
          />
          {nicknameError && (
            <p id="nickname-error" role="alert" className="text-sm font-medium text-[#e3350d]">
              {nicknameError}
            </p>
          )}
        </div>
      )}

      {/* GPS 실패 시: 시작할 지역을 직접 선택 */}
      {showManual && (
        <div className="space-y-3 rounded-xl border-2 border-black bg-white/70 p-3">
          <p className="text-sm font-medium">
            위치 권한을 사용할 수 없어요. 모험을 시작할 지역을 직접 선택해 주세요.
          </p>
          <div className="space-y-1">
            <label htmlFor="province" className="block text-sm font-bold">
              도/광역시
            </label>
            <select
              id="province"
              value={provinceId}
              onChange={(e) => handleProvinceChange(e.target.value === '' ? '' : Number(e.target.value))}
              className={inputClass}
            >
              <option value="">선택하세요</option>
              {provinces.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label htmlFor="city" className="block text-sm font-bold">
              시/군/구
            </label>
            <select
              id="city"
              value={cityId}
              onChange={(e) => setCityId(e.target.value === '' ? '' : Number(e.target.value))}
              disabled={provinceId === '' || cities.length === 0}
              className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <option value="">선택하세요</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {formError && (
        <p role="alert" className="rounded-xl border-2 border-[#e3350d] bg-[#e3350d]/10 px-3 py-2 text-sm font-medium text-[#e3350d]">
          {formError}
        </p>
      )}

      {showManual ? (
        <button
          type="button"
          onClick={handleManualConfirm}
          disabled={loading}
          className="min-h-11 w-full rounded-full border-2 border-black bg-[#e3350d] text-base font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '잠시만요…' : '이 지역에서 시작하기'}
        </button>
      ) : (
        <button
          type="submit"
          disabled={loading}
          className="min-h-11 w-full rounded-full border-2 border-black bg-[#e3350d] text-base font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '잠시만요…' : mode === 'signup' ? '모험 시작하기' : '로그인'}
        </button>
      )}

      {mode === 'signup' && !showManual && (
        <p className="text-center text-xs text-gray-600">
          가입 시 위치 권한을 허용하면 실제 동네에서 모험을 시작해요. 권한이 없으면 지역을 직접 고를 수 있어요.
        </p>
      )}
    </form>
  )
}
