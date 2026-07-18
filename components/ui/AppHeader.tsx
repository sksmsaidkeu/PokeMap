'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from './Modal'
import { BallIcon } from './BallIcon'
import { EditNicknameModal } from './EditNicknameModal'
import { TIER_ORDER, TIERS, type UserTier } from '@/lib/game/tier'

export type { UserTier }

// 등급 볼 배지 — 미니멀 벡터 볼(등급색). 지도 마커와 동일 스타일.
function TierBall({ tier, size }: { tier: UserTier; size: number }) {
  return <BallIcon topColor={TIERS[tier].topColor} size={size} label={TIERS[tier].label} />
}

export type AppHeaderProps = {
  trainerName: string
  tier: UserTier
  totalSpecies: number
}

export function AppHeader({ trainerName, tier, totalSpecies }: AppHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [editNicknameOpen, setEditNicknameOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [tierInfoOpen, setTierInfoOpen] = useState(false)

  const menuRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)

  const { label } = TIERS[tier]

  // 메뉴 열림 시: 첫 항목에 포커스 + 바깥 클릭(pointerdown)으로 닫기.
  useEffect(() => {
    if (!menuOpen) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || settingsBtnRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    if (items.length === 0) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setMenuOpen(false)
      settingsBtnRef.current?.focus()
      return
    }
    const idx = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(idx + 1) % items.length].focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(idx - 1 + items.length) % items.length].focus()
    }
  }

  function closeConfirm() {
    setConfirmOpen(false)
    setSignOutError(null)
  }

  async function handleLogout() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      await createClient().auth.signOut()
      router.replace('/login')
    } catch {
      setSigningOut(false)
      setSignOutError('로그아웃에 실패했어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-end bg-white/80 px-3 py-2">
      <div className="flex items-center gap-2">
        {/* 플레이어 정보: 이름은 클릭 없는 인라인 표시(3차 검증), 등급 배지만 버튼화(4차 검증) —
            눌러서 각 등급 도달에 필요한 포획 수를 확인 */}
        <div className="flex items-center gap-2 rounded-full border-2 border-black bg-white px-2 py-1">
          <button
            type="button"
            aria-label="등급표 보기"
            aria-haspopup="dialog"
            onClick={() => setTierInfoOpen(true)}
            className="flex flex-col items-center"
          >
            <TierBall tier={tier} size={24} />
            <span className="text-[10px] font-bold text-black">{label}</span>
          </button>
          <span className="text-sm font-bold text-black">{trainerName}</span>
        </div>

        <button
          type="button"
          aria-label="도감"
          onClick={() => router.push('/pokedex')}
          className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white"
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5 text-black"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </button>

        <div className="relative">
          <button
            ref={settingsBtnRef}
            type="button"
            aria-label="설정"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5 text-black"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              role="menu"
              onKeyDown={handleMenuKeyDown}
              className="absolute right-0 mt-1 w-32 rounded-xl border-2 border-black bg-white p-1"
            >
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setEditNicknameOpen(true)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-black hover:bg-[#F0F0F0]"
              >
                닉네임 변경
              </button>
              <button
                role="menuitem"
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setConfirmOpen(true)
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm font-bold text-black hover:bg-[#F0F0F0]"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal open={confirmOpen} onClose={closeConfirm} ariaLabel="로그아웃 확인">
        <p className="text-center text-sm font-bold text-black">
          정말 로그아웃 하실건가요 트레이너님?
        </p>
        {signOutError && (
          <p role="alert" className="mt-2 text-center text-xs font-bold text-retro-red">
            {signOutError}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={signingOut}
            onClick={handleLogout}
            className="flex-1 rounded-xl bg-retro-red px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            확인
          </button>
          <button
            type="button"
            onClick={closeConfirm}
            className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
          >
            취소
          </button>
        </div>
      </Modal>

      <Modal open={tierInfoOpen} onClose={() => setTierInfoOpen(false)} ariaLabel="등급별 도달 포획 수">
        <p className="mb-3 text-center text-sm font-extrabold text-black">등급별 도달 포획 수</p>
        <ul className="space-y-2">
          {TIER_ORDER.map((t) => {
            const info = TIERS[t]
            // ceil: calc_user_tier의 "pct >= 임계값" 판정을 만족하는 최소 포획 수
            const needed = Math.ceil(info.pct * totalSpecies)
            const isCurrent = t === tier
            return (
              <li
                key={t}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
                  isCurrent ? 'border-black bg-[#F0F0F0]' : 'border-transparent'
                }`}
              >
                <span className="flex shrink-0 items-center"><TierBall tier={t} size={20} /></span>
                <span className="flex-1 text-sm font-bold text-black">{info.label}</span>
                <span className="text-sm text-black/70">
                  {needed === 0 ? '기본' : `${needed}마리 이상`}
                </span>
                {isCurrent && <span className="text-xs font-bold text-black">현재</span>}
              </li>
            )
          })}
        </ul>
        <button
          type="button"
          onClick={() => setTierInfoOpen(false)}
          className="mt-3 w-full rounded-xl border-2 border-black bg-white py-2 font-bold"
        >
          확인
        </button>
      </Modal>

      <EditNicknameModal
        open={editNicknameOpen}
        onClose={() => setEditNicknameOpen(false)}
        currentNickname={trainerName}
      />
    </header>
  )
}
