import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import FallingBackground from '@/components/auth/FallingBackground'
import LoginForm from '@/components/auth/LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/map')

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#cce8f4] to-[#e9f6fb] p-4">
      <FallingBackground />
      <div className="relative z-10 w-full max-w-sm rounded-3xl border-4 border-black bg-white p-6 shadow-[0_8px_0_0_rgba(0,0,0,0.15)]">
        <header className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="pokeball" style={{ width: 48, height: 48 }} aria-hidden />
          <h1 className="text-2xl font-black tracking-tight">PokeMap</h1>
          <p className="text-sm text-gray-600">우리 동네 포켓몬을 찾아 떠나는 모험</p>
        </header>
        <LoginForm />
      </div>
    </main>
  )
}
