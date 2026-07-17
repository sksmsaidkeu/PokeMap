'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedRegionMap from './AnimatedRegionMap'
import { DEFAULT_ZOOM, type CityLabel } from './RegionMap'
import { RegionPokemonPanel } from './RegionPokemonPanel'
import { moveCity, type MoveCitySuccess, type MoveCityError } from '@/lib/game/moveCity'

export type LatLng = { lon: number; lat: number }
export type Neighbor = {
  dir: 'up' | 'down' | 'left' | 'right'
  cityId: number
  locked: boolean
}
// 같은 광역시 내 구역(동일 living_area_id) 이동 후보 — 4방향 화살표 슬롯을 소모하지 않는
// 별도 리스트(migration 20260727000000: 광역시 구역 분할). 화살표와 배정 로직이 완전히 분리돼
// 기존 외부(타 시/도) 인접 화살표 배정에 영향 없다.
export type Zone = {
  cityId: number
  name: string
  locked: boolean
}

export type { CityLabel }

export type MapContainerProps = {
  playerCentroid: LatLng
  neighbors: Neighbor[]
  zones?: Zone[]
  legendarySite: LatLng | null
  labels?: CityLabel[]
  provinceId?: number // 지역별 배경색(plan.md #8) — RegionMap에 그대로 전달
  // motion 훅: 이동 성공 시 응답을 넘겨 마커 애니메이션/전환을 구동(미제공 시 기본 네비게이션).
  onMoveResult?: (result: MoveCitySuccess) => void
}

export function MapContainer({
  playerCentroid,
  neighbors,
  zones = [],
  legendarySite,
  labels,
  provinceId,
  onMoveResult,
}: MapContainerProps) {
  const router = useRouter()
  // 줌 조작 UI는 이번 스코프에 없음 — 값을 보유만 해두고 향후 버튼/휠 연결 시 setZoom만 노출하면 됨(plan.md #1)
  const [zoom] = useState(DEFAULT_ZOOM)
  const [moving, setMoving] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const [error, setError] = useState<MoveCityError | null>(null)
  const locked = moving || refreshing
  const [infoCityId, setInfoCityId] = useState<number | null>(null)

  // "정보 보기"(이름 클릭)는 이동과 무관한 단순 조회 팝업 — RegionPokemonPanel이 city_id로 직접 조회
  const handleLabelClick = useCallback((cityId: number) => {
    setInfoCityId(cityId)
  }, [])

  // 화살표(외부 인접 시)와 구역 전환(같은 광역시 내부)이 공유하는 이동 실행부 —
  // 호출부에서 각자의 화이트리스트(neighbors/zones)로 cityId를 먼저 검증한 뒤 넘긴다(§20).
  const runMove = useCallback(
    async (cityId: number) => {
      setMoving(true)
      setError(null)

      const { data, error: moveError } = await moveCity(cityId)
      if (moveError) {
        setError(moveError)
        setMoving(false)
        return
      }

      // 낙관적 업데이트 금지: 응답을 받은 뒤에만 갱신한다(§2)
      onMoveResult?.(data)

      if (data.encounter) {
        // 격리 탭 진입 — motion이 onMoveResult로 전환을 가로채지 않은 경우의 기본 동작
        router.push(`/encounter/${data.encounter.session_id}`)
        return
      }

      // 조우 없음: 서버 상태(새 centroid/이웃) 재검증으로만 재중심(§11).
      // router.refresh()는 void를 반환해 완료를 await할 수 없으므로,
      // startTransition의 refreshing으로 RSC 재요청이 실제로 끝날 때까지 입력을 막는다.
      setMoving(false)
      startRefresh(() => router.refresh())
    },
    [onMoveResult, router],
  )

  const handleArrowClick = useCallback(
    (_dir: Neighbor['dir'], cityId: number) => {
      if (locked) return
      // 화이트리스트 검증: 서버로 보내기 전 실제 잠금 해제된 이웃만 허용(§20)
      const target = neighbors.find((n) => n.cityId === cityId)
      if (!target || target.locked) return
      runMove(cityId)
    },
    [locked, neighbors, runMove],
  )

  // 방향키 단축키: 텍스트 입력 포커스 중엔 가로채지 않고, 화이트리스트 검증은
  // handleArrowClick(locked/target.locked 가드)에 위임한다(§20, 중복 가드 금지).
  useEffect(() => {
    const dirByKey: Record<string, Neighbor['dir']> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = dirByKey[e.key]
      if (!dir) return
      const active = document.activeElement
      if (
        active instanceof HTMLElement &&
        (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)
      ) {
        return
      }
      const target = neighbors.find((n) => n.dir === dir)
      if (!target) return
      e.preventDefault()
      handleArrowClick(dir, target.cityId)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [neighbors, handleArrowClick])

  const handleZoneClick = useCallback(
    (cityId: number) => {
      if (locked) return
      const target = zones.find((z) => z.cityId === cityId)
      if (!target || target.locked) return
      runMove(cityId)
    },
    [locked, zones, runMove],
  )

  // min-h-0: flex-1 자식은 기본 min-height:auto라 SVG의 viewBox 종횡비만큼 부풀어
  // 뷰포트 밖으로 넘칠 수 있다 — 0으로 리셋해 실제 배정된 flex 공간에 맞게 줄어들게 함.
  return (
    <div className="relative min-h-0 flex-1">
      <AnimatedRegionMap
        playerCentroid={playerCentroid}
        neighbors={neighbors}
        legendarySite={legendarySite}
        moving={locked}
        zoom={zoom}
        labels={labels}
        provinceId={provinceId}
        onArrowClick={handleArrowClick}
        onLabelClick={handleLabelClick}
      />
      {/* 광역시 구역 전환: 4방향 화살표와 별개 슬롯 — 같은 living_area_id를 공유하는 시가
          있을 때만 노출(그 외 도시는 zones가 항상 빈 배열). */}
      {zones.length > 0 && (
        <div
          role="group"
          aria-label="구역 이동"
          className="absolute bottom-4 right-2 flex flex-col gap-1 rounded-xl border-2 border-black bg-white p-1"
        >
          {zones.map((z) => (
            <button
              key={z.cityId}
              type="button"
              disabled={locked || z.locked}
              aria-label={`${z.name}로 이동${z.locked ? ' (잠김)' : ''}`}
              onClick={() => handleZoneClick(z.cityId)}
              className="rounded-lg px-2 py-1 text-left text-xs font-bold text-black hover:bg-[#F0F0F0] disabled:opacity-40"
            >
              {z.locked ? '🔒 ' : ''}
              {z.name}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-sm text-white">
          {error.message}
        </p>
      )}
      <RegionPokemonPanel cityId={infoCityId} onClose={() => setInfoCityId(null)} />
    </div>
  )
}
