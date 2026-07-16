export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-4 p-6">
        <h1 className="text-2xl font-bold">PokeMap 로그인</h1>
        <p className="text-sm text-gray-500">
          가입 시 GPS로 시작 위치가 정해집니다(PRD §5).
        </p>
        {/* TODO: Supabase Auth 폼 연동 */}
      </div>
    </main>
  )
}
