'use client'

import { useEffect, useRef, useState } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import RegionMap, { type RegionMapProps } from './RegionMap'

const GLIDE_MS = 400 // 300~500ms 권장 글라이드

// RegionMap 내부(스냅 렌더)는 건드리지 않고, playerCentroid만 Framer Motion으로 보간해 흘려보낸다.
// 조우 있는 이동은 MapContainer가 즉시 라우팅하므로 이 tween이 끝까지 재생될 일이 없다 —
// 언마운트 시 controls.stop()으로 자연 소멸시키면 충분(별도 대기/취소 로직 불필요).
export default function AnimatedRegionMap(props: RegionMapProps) {
  const { playerCentroid } = props
  const [display, setDisplay] = useState(playerCentroid)
  const displayRef = useRef(playerCentroid)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const from = displayRef.current
    const to = playerCentroid
    if (from.lon === to.lon && from.lat === to.lat) return

    // prefers-reduced-motion: standalone animate()는 MotionConfig 영향 밖이라 직접 분기 필요
    if (reducedMotion) {
      displayRef.current = to
      setDisplay(to)
      return
    }

    const controls = animate(0, 1, {
      duration: GLIDE_MS / 1000,
      ease: 'easeOut',
      onUpdate: (t) => {
        const next = {
          lon: from.lon + (to.lon - from.lon) * t,
          lat: from.lat + (to.lat - from.lat) * t,
        }
        displayRef.current = next
        setDisplay(next)
      },
    })

    return () => controls.stop()
  }, [playerCentroid.lon, playerCentroid.lat, reducedMotion])

  return <RegionMap {...props} playerCentroid={display} />
}
