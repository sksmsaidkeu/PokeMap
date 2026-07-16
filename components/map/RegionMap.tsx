'use client'

import { useMemo } from 'react'
import rawMap from '@/files/korea_map_data.min.json'
import {
  createProjection,
  geoPath,
  type Bounds,
  type Geometry,
  type Point,
} from './projection'

type LonLat = { lon: number; lat: number }
type Dir = 'up' | 'down' | 'left' | 'right'
type NeighborArrow = { dir: Dir; cityId: number; locked: boolean } // locked=섬 미해금

export interface RegionMapProps {
  playerCentroid: LonLat
  neighbors: NeighborArrow[] // 없는 방향은 생략
  legendarySite?: LonLat | null // 도 100% 완공 시 전설 출현지
  onArrowClick: (dir: Dir, cityId: number) => void
}

interface RawRegion { color: string; geometry: Geometry }
interface RawHidden { color: string; real_geometry: Geometry }
interface RawMap { main_map_bounds: Bounds; regions: RawRegion[]; hidden_areas: RawHidden[] }

const map = rawMap as unknown as RawMap

// 폴리곤 33 + 섬 6은 정적 자산 → 모듈 로드시 딱 한 번 path 생성해 렌더마다 재사용.
const PROJ = createProjection(map.main_map_bounds, 1000)
const SHAPES: { color: string; d: string }[] = [
  ...map.regions.map((r) => ({ color: r.color, d: geoPath(r.geometry, PROJ.project) })),
  ...map.hidden_areas.map((h) => ({ color: h.color, d: geoPath(h.real_geometry, PROJ.project) })),
]

const ZOOM = 0.28 // 플레이어+인접 시가 보이는 수준(PRD §8.2)

export default function RegionMap({
  playerCentroid,
  neighbors,
  legendarySite,
  onArrowClick,
}: RegionMapProps) {
  const view = useMemo(() => {
    const c = PROJ.project(playerCentroid.lon, playerCentroid.lat)
    const vw = PROJ.width * ZOOM
    const vh = PROJ.height * ZOOM
    return {
      c,
      viewBox: `${c.x - vw / 2} ${c.y - vh / 2} ${vw} ${vh}`,
      gap: vh * 0.16, // 마커에서 화살표까지 거리
      size: vh * 0.05, // 화살표 크기
      markerR: vh * 0.022,
      stroke: vw * 0.0012,
    }
  }, [playerCentroid])

  const legendary: Point | null = legendarySite
    ? PROJ.project(legendarySite.lon, legendarySite.lat)
    : null

  return (
    <svg
      viewBox={view.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', background: '#eaf1f5' }}
      role="img"
      aria-label="지역 지도"
    >
      {/* 폴리곤: 클릭 불가(오직 화살표로만 이동) */}
      <g fillRule="evenodd" stroke="#ffffff" strokeWidth={view.stroke} pointerEvents="none">
        {SHAPES.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} />
        ))}
      </g>

      {legendary && <LegendaryMark p={legendary} r={view.markerR * 1.6} />}

      {/* 플레이어 마커 */}
      <circle cx={view.c.x} cy={view.c.y} r={view.markerR} fill="#111827" stroke="#ffffff" strokeWidth={view.stroke * 2} />

      {neighbors.map((n) => (
        <Arrow
          key={n.dir}
          dir={n.dir}
          center={arrowCenter(view.c, n.dir, view.gap)}
          size={view.size}
          locked={n.locked}
          onClick={n.locked ? undefined : () => onArrowClick(n.dir, n.cityId)}
        />
      ))}
    </svg>
  )
}

function arrowCenter(c: Point, dir: Dir, gap: number): Point {
  switch (dir) {
    case 'up': return { x: c.x, y: c.y - gap }
    case 'down': return { x: c.x, y: c.y + gap }
    case 'left': return { x: c.x - gap, y: c.y }
    case 'right': return { x: c.x + gap, y: c.y }
  }
}

function arrowPoints(c: Point, dir: Dir, s: number): string {
  const p = (x: number, y: number) => `${x} ${y}`
  switch (dir) {
    case 'up': return [p(c.x, c.y - s), p(c.x - s * 0.8, c.y + s * 0.6), p(c.x + s * 0.8, c.y + s * 0.6)].join(' ')
    case 'down': return [p(c.x, c.y + s), p(c.x - s * 0.8, c.y - s * 0.6), p(c.x + s * 0.8, c.y - s * 0.6)].join(' ')
    case 'left': return [p(c.x - s, c.y), p(c.x + s * 0.6, c.y - s * 0.8), p(c.x + s * 0.6, c.y + s * 0.8)].join(' ')
    case 'right': return [p(c.x + s, c.y), p(c.x - s * 0.6, c.y - s * 0.8), p(c.x - s * 0.6, c.y + s * 0.8)].join(' ')
  }
}

const DIR_LABEL: Record<Dir, string> = { up: '위', down: '아래', left: '왼', right: '오른' }

function Arrow({
  dir,
  center,
  size,
  locked,
  onClick,
}: {
  dir: Dir
  center: Point
  size: number
  locked: boolean
  onClick?: () => void
}) {
  return (
    <g
      role="button"
      aria-label={`${DIR_LABEL[dir]}쪽으로 이동${locked ? ' (잠김)' : ''}`}
      aria-disabled={locked}
      tabIndex={locked ? -1 : 0}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
    >
      {/* 히트 영역 확대 */}
      <circle cx={center.x} cy={center.y} r={size * 1.8} fill="transparent" />
      <polygon
        points={arrowPoints(center, dir, size)}
        fill={locked ? '#9ca3af' : '#111827'}
        stroke="#ffffff"
        strokeWidth={size * 0.12}
      />
      {locked && (
        <text
          x={center.x}
          y={center.y + size * 0.35}
          fontSize={size}
          textAnchor="middle"
          pointerEvents="none"
        >
          🔒
        </text>
      )}
    </g>
  )
}

function LegendaryMark({ p, r }: { p: Point; r: number }) {
  // 5각 별
  const pts: string[] = []
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${(p.x + rr * Math.cos(a)).toFixed(1)} ${(p.y + rr * Math.sin(a)).toFixed(1)}`)
  }
  return (
    <polygon
      points={pts.join(' ')}
      fill="#facc15"
      stroke="#b45309"
      strokeWidth={r * 0.12}
      aria-label="전설 출현지"
      pointerEvents="none"
    />
  )
}
