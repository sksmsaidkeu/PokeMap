'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Modal } from './Modal'

export type UserTier = 'monster' | 'super' | 'hyper' | 'master'

// 스프라이트 에셋 확보 전까지 볼 고유색 원형으로 대체 — 에셋 도착 시 badgeClass 자리를 <Image>로 교체.
// 표시 전용 배지: 볼 종류 선택 UI 아님(PRD §17, CLAUDE.md §22)
const TIERS: Record<UserTier, { label: string; badgeClass: string }> = {
  monster: { label: '몬스터볼', badgeClass: 'bg-red-500' },
  super: { label: '슈퍼볼', badgeClass: 'bg-blue-600' },
  hyper: { label: '하이퍼볼', badgeClass: 'bg-yellow-400' },
  master: { label: '마스터볼', badgeClass: 'bg-purple-600' },
}

export type AppHeaderProps = {
  trainerName: string
  tier: UserTier
}

export function AppHeader({ trainerName, tier }: AppHeaderProps) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const { label, badgeClass } = TIERS[tier]

  async function handleLogout() {
    setSigningOut(true)
    try {
      await createClient().auth.signOut()
      router.replace('/login')
    } catch {
      setSigningOut(false)
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-white/80 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-col items-center">
          <span
            aria-hidden
            className={`h-6 w-6 rounded-full border-2 border-black ${badgeClass}`}
          />
          <span className="text-[10px] font-bold text-black">{label}</span>
        </div>
        <span className="text-sm font-bold text-black">{trainerName}</span>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="설정"
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
            role="menu"
            className="absolute right-0 mt-1 w-32 rounded-xl border-2 border-black bg-white p-1"
          >
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

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <p className="text-center text-sm font-bold text-black">
          정말 로그아웃 하실건가요 트레이너님?
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={signingOut}
            onClick={handleLogout}
            className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            확인
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
          >
            취소
          </button>
        </div>
      </Modal>
    </header>
  )
}
