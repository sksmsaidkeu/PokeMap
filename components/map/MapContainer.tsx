'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import AnimatedRegionMap from './AnimatedRegionMap'
import { moveCity, type MoveCitySuccess, type MoveCityError } from '@/lib/game/moveCity'

export type LatLng = { lon: number; lat: number }
export type Neighbor = {
  dir: 'up' | 'down' | 'left' | 'right'
  cityId: number
  locked: boolean
}

export type MapContainerProps = {
  playerCentroid: LatLng
  neighbors: Neighbor[]
  legendarySite: LatLng | null
  // motion 훅: 이동 성공 시 응답을 넘겨 마커 애니메이션/전환을 구동(미제공 시 기본 네비게이션).
  onMoveResult?: (result: MoveCitySuccess) => void
}

export function MapContainer({
  playerCentroid,
  neighbors,
  legendarySite,
  onMoveResult,
}: MapContainerProps) {
  const router = useRouter()
  const [moving, setMoving] = useState(false)
  const [refreshing, startRefresh] = useTransition()
  const [error, setError] = useState<MoveCityError | null>(null)
  const locked = moving || refreshing

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

  return (
    <div className="relative flex-1">
      <AnimatedRegionMap
        playerCentroid={playerCentroid}
        neighbors={neighbors}
        legendarySite={legendarySite}
        moving={locked}
        onArrowClick={handleArrowClick}
      />
      {error && (
        <p role="alert" className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-red-600 px-3 py-1 text-sm text-white">
          {error.message}
        </p>
      )}
    </div>
  )
}
