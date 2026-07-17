import { createClient } from '@/lib/supabase/client'
import type { Database } from '@/lib/supabase/types'

// v_region_pokedex_status(SECURITY INVOKER 뷰, DB.md §18)를 지도 전용으로 감싼 얇은 wrapper.
// 확률/쓰기 없는 순수 조회라 Edge Function이 아니라 anon key로 뷰를 직접 SELECT한다.
export type RegionSpawnStatusEntry = Pick<
  Database['public']['Views']['v_region_pokedex_status']['Row'],
  'dex_no' | 'category' | 'is_legendary' | 'caught' | 'catch_count'
>

export type RegionSpawnStatusErrorCode = 'INVALID_INPUT' | 'FETCH_FAILED'

export type RegionSpawnStatusResult =
  | { data: RegionSpawnStatusEntry[]; error: null }
  | { data: null; error: { code: RegionSpawnStatusErrorCode; message: string } }

export async function getRegionSpawnStatus(cityId: number): Promise<RegionSpawnStatusResult> {
  if (!Number.isInteger(cityId) || cityId <= 0) {
    return { data: null, error: { code: 'INVALID_INPUT', message: '유효하지 않은 도시 ID' } }
  }

  const supabase = createClient()
  // 뷰 하나를 city_id로 필터링하는 1쿼리 — living_area_id를 먼저 조회하는 왕복 없음(§21 N+1 금지).
  const { data, error } = await supabase
    .from('v_region_pokedex_status')
    .select('dex_no,category,is_legendary,caught,catch_count')
    .eq('city_id', cityId)

  if (error) {
    return { data: null, error: { code: 'FETCH_FAILED', message: error.message } }
  }

  return { data: (data ?? []) as RegionSpawnStatusEntry[], error: null }
}
