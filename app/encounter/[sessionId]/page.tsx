// 격리 탭: 조우/포획/결과 통합 (CLAUDE.md §5, §11)
// URL 직접 접근 차단 = 서버에서 세션 상태 머신 재검증 후 불일치 시 redirect('/map').
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import EncounterClient from '@/components/encounter/EncounterClient'
import { tierFromLabel } from '@/lib/game/tier'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params
  if (!UUID_RE.test(sessionId)) redirect('/map')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/map')

  const { data: session } = await supabase
    .from('encounter_sessions')
    .select(
      'id, user_id, is_legendary, attempts_used, status, expires_at, pokemon_species(dex_no, name_kr, type1, type2)',
    )
    .eq('id', sessionId)
    .single()

  // RLS(select_own)로 이미 본인 것만 조회되지만 §20 관례대로 user_id도 재확인
  if (!session || session.user_id !== user.id) redirect('/map')
  if (session.status !== 'pending' || Date.parse(session.expires_at) <= Date.now()) {
    redirect('/map')
  }

  // 포획 가능성은 원시 %가 아닌 tier text만 서버에서 받아 내려보낸다(§13.1, CLAUDE.md §22)
  // 상단 리본에 표시할 트레이너 이름/등급도 함께 조회(map/pokedex 헤더와 동일 패턴)
  const [{ data: tier }, { data: profile }, { data: tierLabel }] = await Promise.all([
    supabase.rpc('calc_session_catch_tier', { p_session_id: sessionId }),
    supabase.from('profiles').select('nickname').eq('id', user.id).maybeSingle(),
    supabase.rpc('calc_user_tier', { p_user_id: user.id }),
  ])
  if (!tier) redirect('/map')

  const species = session.pokemon_species

  return (
    <EncounterClient
      sessionId={session.id}
      dexNo={species.dex_no}
      nameKr={species.name_kr}
      type1={species.type1}
      type2={species.type2}
      isLegendary={session.is_legendary}
      catchRateTier={tier}
      attemptsUsed={session.attempts_used}
      expiresAt={session.expires_at}
      trainerName={profile?.nickname ?? user.email?.split('@')[0] ?? '트레이너'}
      tier={tierFromLabel(tierLabel)}
    />
  )
}
