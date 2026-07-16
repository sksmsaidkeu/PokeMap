import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MapContainer, type LatLng, type Neighbor } from '@/components/map/MapContainer'

// PostgREST는 point를 "(lon,lat)" 문자열로 반환 → {lon,lat} 파싱
function parsePoint(raw: unknown): LatLng {
  const m = typeof raw === 'string' ? raw.match(/\(([-\d.]+),\s*([-\d.]+)\)/) : null
  return m ? { lon: Number(m[1]), lat: Number(m[2]) } : { lon: 0, lat: 0 }
}

// 현재 시 대비 이웃 centroid의 위경도 델타 최대축으로 방향 결정
function dirOf(from: LatLng, to: LatLng): Neighbor['dir'] {
  const dLon = to.lon - from.lon
  const dLat = to.lat - from.lat
  if (Math.abs(dLon) >= Math.abs(dLat)) return dLon >= 0 ? 'right' : 'left'
  return dLat >= 0 ? 'up' : 'down'
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

  const [{ data: currentCity }, { data: neighborRows }, { data: unlockRows }] =
    await Promise.all([
      supabase
        .from('cities')
        .select('centroid, living_areas!inner(province_id)')
        .eq('id', currentCityId)
        .single(),
      supabase.from('v_city_neighbors').select('neighbor_id').eq('city_id', currentCityId),
      supabase.from('user_province_unlocks').select('province_id').eq('user_id', user.id),
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

  const neighbors: Neighbor[] = (neighborCities ?? []).map((c) => {
    const provinceId = c.living_areas.province_id
    const isIsland = c.living_areas.provinces.is_island_endgame
    return {
      dir: dirOf(playerCentroid, parsePoint(c.centroid)),
      cityId: c.id,
      // 섬 지역이고 아직 해금 안 됐으면 잠금(육지 도는 항상 이동 가능)
      locked: isIsland && !unlockedProvinces.has(provinceId),
    }
  })

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
      <MapContainer
        playerCentroid={playerCentroid}
        neighbors={neighbors}
        legendarySite={legendarySite}
      />
    </main>
  )
}
