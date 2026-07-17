'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from './Modal'
import { renameTrainer } from '@/lib/game/renameTrainer'

export type EditNicknameModalProps = {
  open: boolean
  onClose: () => void
  currentNickname: string
}

export function EditNicknameModal({ open, onClose, currentNickname }: EditNicknameModalProps) {
  const router = useRouter()
  const [nickname, setNickname] = useState(currentNickname)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setNickname(currentNickname)
    setError(null)
    onClose()
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const { error: renameError } = await renameTrainer(nickname)
    setSaving(false)
    if (renameError) {
      setError(renameError.message)
      return
    }
    // 성공 응답을 받은 뒤에만 UI 반영(CLAUDE.md §2 낙관적 업데이트 금지) —
    // AppHeader는 서버 컴포넌트 값을 prop으로 받으므로 refresh로 재조회.
    router.refresh()
    onClose()
  }

  return (
    <Modal open={open} onClose={handleClose}>
      <p className="text-center text-sm font-bold text-black">닉네임 변경</p>
      <input
        type="text"
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        maxLength={20}
        aria-label="트레이너 이름"
        className="mt-3 w-full rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
      />
      {error && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex-1 rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          저장
        </button>
        <button
          type="button"
          onClick={handleClose}
          className="flex-1 rounded-xl border-2 border-black bg-white px-3 py-2 text-sm font-bold text-black"
        >
          취소
        </button>
      </div>
    </Modal>
  )
}
