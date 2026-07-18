'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export type ModalProps = {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({ open, onClose, children, ariaLabel }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // open 전환 시에만 포커스 이동 — onClose 재생성마다 재실행되면 포커스가 계속 패널로 튕겨나간다.
  // 열기 직전 활성 요소(트리거)를 저장해 닫힐 때 복원한다(포커스 유실 방지).
  useEffect(() => {
    if (!open) return
    const trigger = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    return () => trigger?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      // 포커스 트랩: 패널 안 포커스 가능한 요소들 사이에서만 순환, 배경으로 탈출 방지.
      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            tabIndex={-1}
            className="w-full max-w-xs rounded-2xl border-2 border-black bg-white p-5 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
