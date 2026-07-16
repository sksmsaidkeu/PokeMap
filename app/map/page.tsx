import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function MapPage() {
  // 미로그인 접근 차단 — LoginPage(로그인 시 /map) 의 반대 가드.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <main className="flex min-h-screen flex-col">
      <h1 className="p-4 text-xl font-bold">지도</h1>
      {/* TODO: components/map — 도/생활권/시군 레이어 렌더링 */}
    </main>
  )
}
