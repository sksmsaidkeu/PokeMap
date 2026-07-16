import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MapContainer, type LatLng, type Neighbor } from '@/components/map/MapContainer'
import { AppHeader } from '@/components/ui/AppHeader'

// PostgREST는 point를 "(lon,lat)" 문자열로 반환 → {lon,lat} 파싱
// 실패 시 (0,0) 폴백이 바다를 조용히 렌더하는 것보다 즉시 실패가 낫다
function parsePoint(raw: unknown): LatLng {
  const m = typeof raw === 'string' ? raw.match(/\(([-\d.]+),\s*([-\d.]+)\)/) : null
  if (!m) throw new Error(`parsePoint: invalid centroid value: ${String(raw)}`)
  return { lon: Number(m[1]), lat: Number(m[2]) }
}

const DIR_ANGLE: Record<Neighbor['dir'], number> = {
  right: 0,
  up: Math.PI / 2,
  left: Math.PI,
  down: -Math.PI / 2,
}

// 같은 방향에 이웃이 몰려도 각 이웃을 상/하/좌/우 중 하나에 유일 배정 —
// 각도가 가장 가까운 (이웃, 방향) 쌍부터 그리디 매칭.
// 화살표 UI는 4방향 고정(PRD §8.2)이라 4개 초과 이웃은 각도 근접 상위 4개만 노출.
function assignDirs(
  from: LatLng,
  candidates: { cityId: number; centroid: LatLng; locked: boolean }[],
): Neighbor[] {
  const pairs: { idx: number; dir: Neighbor['dir']; dist: number }[] = []
  candidates.forEach((c, idx) => {
    const angle = Math.atan2(c.centroid.lat - from.lat, c.centroid.lon - from.lon)
    for (const dir of Object.keys(DIR_ANGLE) as Neighbor['dir'][]) {
      const d = angle - DIR_ANGLE[dir]
      pairs.push({ idx, dir, dist: Math.abs(Math.atan2(Math.sin(d), Math.cos(d))) })
    }
  })
  pairs.sort((a, b) => a.dist - b.dist)
  const usedIdx = new Set<number>()
  const usedDir = new Set<Neighbor['dir']>()
  const out: Neighbor[] = []
  for (const p of pairs) {
    if (usedIdx.has(p.idx) || usedDir.has(p.dir)) continue
    usedIdx.add(p.idx)
    usedDir.add(p.dir)
    const c = candidates[p.idx]
    out.push({ dir: p.dir, cityId: c.cityId, locked: c.locked })
  }
  return out
}

export default async function MapPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: progress } = await supabase
    .from('user_progress')
    .select('current_city_id')
    .eq('user_id', user.id)
    .single()
  if (!progress) redirect('/login') // bootstrap-location 미완료 — 시작 위치 없음

  const currentCityId = progress.current_city_id

  const [{ data: currentCity }, { data: neighborRows }, { data: unlockRows }, { data: profile }] =
    await Promise.all([
      supabase
        .from('cities')
        .select('centroid, living_areas!inner(province_id)')
        .eq('id', currentCityId)
        .single(),
      supabase.from('v_city_neighbors').select('neighbor_id').eq('city_id', currentCityId),
      supabase.from('user_province_unlocks').select('province_id').eq('user_id', user.id),
      supabase.from('profiles').select('nickname').eq('id', user.id).maybeSingle(),
    ])

  if (!currentCity) redirect('/login')

  const playerCentroid = parsePoint(currentCity.centroid)
  const currentProvinceId = currentCity.living_areas.province_id
  const unlockedProvinces = new Set((unlockRows ?? []).map((r) => r.province_id))

  const neighborIds = (neighborRows ?? [])
    .map((r) => r.neighbor_id)
    .filter((id): id is number => id != null)

  // 이웃 시들의 centroid + 소속 도(섬 엔드게임 여부)를 단일 쿼리로 조인(N+1 금지, §21)
  const { data: neighborCities } = neighborIds.length
    ? await supabase
        .from('cities')
        .select('id, centroid, living_areas!inner(province_id, provinces!inner(is_island_endgame))')
        .in('id', neighborIds)
    : { data: [] }

  const neighbors: Neighbor[] = assignDirs(
    playerCentroid,
    (neighborCities ?? []).map((c) => ({
      cityId: c.id,
      centroid: parsePoint(c.centroid),
      // 섬 지역이고 아직 해금 안 됐으면 잠금(육지 도는 항상 이동 가능)
      locked:
        c.living_areas.provinces.is_island_endgame &&
        !unlockedProvinces.has(c.living_areas.province_id),
    })),
  )

  // 전설 출현지: 현재 도 진행률 100%일 때만, 그 도의 is_legendary_site 시 노출(§15)
  const [{ data: provProgress }, { data: legendaryCity }] = await Promise.all([
    supabase
      .from('v_user_province_progress')
      .select('pct')
      .eq('user_id', user.id)
      .eq('province_id', currentProvinceId)
      .maybeSingle(),
    supabase
      .from('cities')
      .select('centroid, living_areas!inner(province_id)')
      .eq('is_legendary_site', true)
      .eq('living_areas.province_id', currentProvinceId)
      .maybeSingle(),
  ])

  const complete = provProgress?.pct != null && provProgress.pct >= 1
  const legendarySite =
    complete && legendaryCity ? parsePoint(legendaryCity.centroid) : null

  return (
    <main className="flex min-h-screen flex-col">
      <AppHeader
        trainerName={profile?.nickname ?? user.email?.split('@')[0] ?? '트레이너'}
        // TODO: calc_user_tier 연동
        tier="monster"
      />
      <MapContainer
        playerCentroid={playerCentroid}
        neighbors={neighbors}
        legendarySite={legendarySite}
      />
    </main>
  )
}
