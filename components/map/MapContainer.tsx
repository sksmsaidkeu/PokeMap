'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedRegionMap from './AnimatedRegionMap'
import { DEFAULT_ZOOM, type CityLabel } from './RegionMap'
import { moveCity, type MoveCitySuccess, type MoveCityError } from '@/lib/game/moveCity'

export type LatLng = { lon: number; lat: number }
export type Neighbor = {
  dir: 'up' | 'down' | 'left' | 'right'
  cityId: number
  locked: boolean
}

export type { CityLabel }

export type MapContainerProps = {
  playerCentroid: LatLng
  neighbors: Neighbor[]
  legendarySite: LatLng | null
  labels?: CityLabel[]
  provinceId?: number // 지역별 배경색(plan.md #8) — RegionMap에 그대로 전달
  // motion 훅: 이동 성공 시 응답을 넘겨 마커 애니메이션/전환을 구동(미제공 시 기본 네비게이션).
  onMoveResult?: (result: MoveCitySuccess) => void
}

export function MapContainer({
  playerCentroid,
  neighbors,
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

  // 정보 보기 목록 UI는 이번 스코프 밖(도감 도메인 아님, 별도 후속 작업) — 인터페이스만 연결
  // 도감 팀이 목록 UI를 붙일 자리 — pokedex 도메인은 이 팀 담당 밖(CLAUDE.md §3)이라 콘솔 로그로만 훅 지점을 남긴다
  const handleLabelClick = useCallback((cityId: number) => {
    console.log('[map] label clicked', cityId)
  }, [])

  const handleArrowClick = useCallback(
    async (_dir: Neighbor['dir'], cityId: number) => {
      if (locked) return
      // 화이트리스트 검증: 서버로 보내기 전 실제 잠금 해제된 이웃만 허용(§20)
      const target = neighbors.find((n) => n.cityId === cityId)
      if (!target || target.locked) return

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
    [locked, neighbors, onMoveResult, router],
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
      {error && (
        <p role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-sm text-white">
          {error.message}
        </p>
      )}
    </div>
  )
}
