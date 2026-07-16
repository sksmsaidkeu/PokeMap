import TitleScreen from '@/components/title/TitleScreen'

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center">
      <TitleScreen />
      <div className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-[#ede6d6]">PokeMap 로그인</h1>
        <p className="text-sm text-[#ede6d6]/60">
          가입 시 GPS로 시작 위치가 정해집니다(PRD §5).
        </p>
        {/* TODO: Supabase Auth 폼 연동 */}
      </div>
    </main>
  )
}
