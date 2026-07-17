import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import LoginScreen from '@/components/auth/LoginScreen'

export default async function LoginPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    // 계정은 생성됐지만 bootstrap-location이 실패한 채 끊긴 세션(예: 닉네임 중복 재시도 중 이탈)이면
    // user_progress가 없다 — 그 상태로 /map에 보내면 /map이 다시 /login으로 돌려보내 무한 리다이렉트가 된다.
    const { data: progress } = await supabase
      .from('user_progress')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (progress) redirect('/map')
  }

  return <LoginScreen />
}
