'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import TitleScreen from '@/components/title/TitleScreen'
import FallingBackground from './FallingBackground'
import LoginForm from './LoginForm'

const HOLD_MS = 3000
const FADE_SEC = 2.5

// 로그인 카드는 처음부터 완전히 그려진 채로 시작화면 아래 깔려 있고, 시작화면만 점점
// 투명해지며 사라져 그 아래를 드러낸다(디졸브). CSS `transition` 클래스 토글 방식은
// (원인 미상으로) 일부 환경에서 트랜지션 없이 그대로 스냅되는 문제가 있어, 이 프로젝트에서
// 이미 검증된 framer-motion(EncounterClient와 동일 라이브러리)의 JS 기반 애니메이션으로 교체.
export default function LoginScreen() {
  const [introVisible, setIntroVisible] = useState(true)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const t = setTimeout(() => setIntroVisible(false), HOLD_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* 로그인 카드: 시작화면이 걷히는 동안 포커스/클릭이 닿지 않게 inert 처리 */}
      <div
        inert={introVisible || undefined}
        className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#cce8f4] to-[#e9f6fb] p-4"
      >
        <FallingBackground />
        <div className="relative z-10 w-full max-w-sm rounded-3xl border-4 border-black bg-white p-6 shadow-[0_8px_0_0_rgba(0,0,0,0.15)]">
          <header className="mb-6 flex flex-col items-center gap-2 text-center">
            <span className="pokeball" style={{ width: 48, height: 48 }} aria-hidden />
            <h1 className="text-2xl font-black tracking-tight">PokeMap</h1>
            <p className="text-sm text-gray-600">우리 동네 포켓몬을 찾아 떠나는 모험</p>
          </header>
          <LoginForm />
        </div>
      </div>

      {/* 시작화면: 로그인 카드 위에 덮여 있다가 점점 투명해지며 사라짐 */}
      <motion.div
        aria-hidden={!introVisible}
        initial={false}
        animate={{ opacity: introVisible ? 1 : 0 }}
        transition={{ duration: reducedMotion ? 0 : FADE_SEC, ease: 'easeInOut' }}
        style={{ pointerEvents: introVisible ? 'auto' : 'none', willChange: 'opacity' }}
        className="absolute inset-0 z-20"
      >
        <TitleScreen />
      </motion.div>
    </main>
  )
}
