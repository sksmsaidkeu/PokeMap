'use client'

import { useEffect, useState } from 'react'
import TitleScreen from '@/components/title/TitleScreen'
import FallingBackground from './FallingBackground'
import LoginForm from './LoginForm'

const INTRO_MS = 3000

// 포스터 스타일 TitleScreen을 잠깐 보여준 뒤 카드형 로그인 화면으로 크로스페이드.
// 언마운트 대신 opacity/pointer-events만 토글해 전환이 끊기지 않게 한다.
export default function LoginScreen() {
  const [introDone, setIntroDone] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setIntroDone(true), INTRO_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden={introDone}
        className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
          introDone ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
      >
        <TitleScreen />
      </div>

      <div
        aria-hidden={!introDone}
        className={`relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#cce8f4] to-[#e9f6fb] p-4 transition-opacity duration-700 motion-reduce:transition-none ${
          introDone ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
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
    </main>
  )
}
