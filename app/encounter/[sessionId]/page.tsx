// 격리 탭: 조우/포획/결과 통합 (CLAUDE.md §5, §11)
// TODO: encounter_sessions 마이그레이션 이후 실제 상태 조회로 교체
// const { data: session } = await supabase.from('encounter_sessions').select('status').eq('id', sessionId).single()
// if (!session || session.status === 'expired') redirect('/map')

export default async function EncounterPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = await params

  return (
    <main className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-xl font-bold">조우 세션 {sessionId}</h1>
      {/* TODO: components/encounter — 일반/전설 조우 연출, 포획, 결과 오버레이 */}
    </main>
  )
}
