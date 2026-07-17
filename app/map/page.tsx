import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MapContainer, type LatLng, type Neighbor, type CityLabel, type Zone } from '@/components/map/MapContainer'
import { AppHeader } from '@/components/ui/AppHeader'
import { tierFromLabel } from '@/lib/game/tier'

// PostgREST는 point를 "(lon,lat)" 문자열로 반환 → {lon,lat} 파싱
// 실패 시 (0,0) 폴백이 바다를 조용히 렌더하는 것보다 즉시 실패가 낫다
function parsePoint(raw: unknown): LatLng {
  const m = typeof raw === 'string' ? raw.match(/\(([-\d.]+),\s*([-\d.]+)\)/) : null
  if (!m) throw new Error(`parsePoint: invalid centroid value: ${String(raw)}`)
  return { lon: Number(m[1]), lat: Number(m[2]) }
}

// 광역시 구역 분할(migration 20260727000000)로 living_area_id 1~7만 구역A/B/C/D 4개 시가
// 한 living_area_id를 공유하게 됐다. 다른 생활권도 원래 여러 시/군/구가 living_area_id 하나를
// 공유하는 게 일반적이라(예: 10개 시 묶음, region_spawn_pool 배정 단위) living_area_id 동일성만
// 으로 분리하면 이 migration과 무관한 모든 도시의 화살표 배정까지 바뀐다 — 정확히 이 7개
// 광역시만 대상으로 한정해 그 외 도시는 기존 동작(전체 이웃이 assignDirs 대상)을 그대로 유지.
const METRO_LIVING_AREA_IDS = new Set([1, 2, 3, 4, 5, 6, 7])

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
        .select('name, centroid, living_area_id, living_areas!inner(province_id)')
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

  // 이웃 시들의 centroid + 소속 생활권/도(섬 엔드게임 여부)를 단일 쿼리로 조인(N+1 금지, §21)
  const { data: neighborCities } = neighborIds.length
    ? await supabase
        .from('cities')
        .select(
          'id, name, centroid, living_area_id, living_areas!inner(province_id, is_endgame_area, provinces!inner(is_island_endgame))',
        )
        .in('id', neighborIds)
    : { data: [] }

  // 해금 행은 check_endgame_unlock 충족 시 일괄 삽입되므로 행 존재 자체가 "내륙 100%" 신호(DB.md §16)
  const endgameUnlocked = unlockedProvinces.size > 0

  const neighborsWithLock = (neighborCities ?? []).map((c) => ({
    cityId: c.id,
    name: c.name,
    livingAreaId: c.living_area_id,
    centroid: parsePoint(c.centroid),
    // 최종 히든 지역(도 단위 제주 / 생활권 단위 울릉권·옹진군)만 잠금, 육지 도는 항상 이동 가능
    locked:
      (c.living_areas.provinces.is_island_endgame || c.living_areas.is_endgame_area) &&
      !endgameUnlocked,
  }))

  // 광역시 구역(living_area_id 1~7)에서만 같은 구역 이웃(구역B/C/D)을 4방향 화살표 풀에서
  // 제외한다 — 4슬롯 그리디 매칭에 섞이면 기존 외부(타 시/도) 인접 화살표를 뺏어가므로(§8.2는
  // "4방향 고정"만 규정, 광역시 내부 이동 UI는 별도 취급), 별도 구역 전환 리스트(zones)로 분리.
  // 그 외 생활권은 이 분기를 타지 않아 기존 assignDirs 동작(전체 이웃 대상)이 그대로 유지된다.
  const isMetroZone = METRO_LIVING_AREA_IDS.has(currentCity.living_area_id)
  const externalCandidates = isMetroZone
    ? neighborsWithLock.filter((c) => c.livingAreaId !== currentCity.living_area_id)
    : neighborsWithLock
  const siblingCandidates = isMetroZone
    ? neighborsWithLock.filter((c) => c.livingAreaId === currentCity.living_area_id)
    : []

  const neighbors: Neighbor[] = assignDirs(playerCentroid, externalCandidates)
  const zones: Zone[] = siblingCandidates.map((c) => ({
    cityId: c.cityId,
    name: c.name,
    locked: c.locked,
  }))

  // 라벨: 화면에 실제 표시되는 플레이어 시 + 화살표로 뜬 인접 시(최대 4개) — 개수 작아 밀도 제어 불필요
  const assignedNeighborIds = new Set(neighbors.map((n) => n.cityId))
  const labels: CityLabel[] = [
    { cityId: currentCityId, name: currentCity.name, ...playerCentroid },
    ...(neighborCities ?? [])
      .filter((c) => assignedNeighborIds.has(c.id))
      .map((c) => ({ cityId: c.id, name: c.name, ...parsePoint(c.centroid) })),
  ]

  // 전설 출현지: 현재 도 진행률 100%일 때만, 그 도의 is_legendary_site 시 노출(§15)
  const [{ data: provProgress }, { data: legendaryCity }, { data: tierLabel }, { count: totalSpecies }] =
    await Promise.all([
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
      supabase.rpc('calc_user_tier', { p_user_id: user.id }),
      // 헤더의 등급표 팝업(등급별 필요 포획 수 계산용)
      supabase.from('pokemon_species').select('dex_no', { count: 'exact', head: true }),
    ])

  const complete = provProgress?.pct != null && provProgress.pct >= 1
  const legendarySite =
    complete && legendaryCity ? parsePoint(legendaryCity.centroid) : null

  const tier = tierFromLabel(tierLabel)

  return (
    // h-screen(고정) — min-h-screen(하한선)이면 지도 SVG의 viewBox 종횡비가
    // flex-1 자식의 min-h-0과 맞물려도 컨테이너 자체가 내용에 맞춰 늘어나 버린다.
    <main className="flex h-screen flex-col">
      <AppHeader
        trainerName={profile?.nickname ?? user.email?.split('@')[0] ?? '트레이너'}
        tier={tier}
        totalSpecies={totalSpecies ?? 0}
      />
      <MapContainer
        playerCentroid={playerCentroid}
        neighbors={neighbors}
        zones={zones}
        legendarySite={legendarySite}
        tier={tier}
        labels={labels}
        provinceId={currentProvinceId}
      />
    </main>
  )
}
