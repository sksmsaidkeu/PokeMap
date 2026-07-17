'use client'

import { useId, useMemo, useState } from 'react'
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
  moving?: boolean // 서버 이동 응답 대기 중 — 화살표 dim + 입력 차단(§2 낙관적 업데이트 금지)
  onArrowClick: (dir: Dir, cityId: number) => void
}

interface RawRegion { color: string; geometry: Geometry }
// 독도 등 symbolic 항목은 real_geometry 없이 real_point만 갖는다(원본 데이터 주석 참고)
interface RawHidden { color: string; real_geometry?: Geometry; real_point?: [number, number] }
interface RawMap { main_map_bounds: Bounds; regions: RawRegion[]; hidden_areas: RawHidden[] }

const map = rawMap as unknown as RawMap

// 폴리곤 33 + 섬 6은 정적 자산 → 모듈 로드시 딱 한 번 path 생성해 렌더마다 재사용.
const PROJ = createProjection(map.main_map_bounds, 1000)
const SHAPES: { color: string; d: string }[] = [
  ...map.regions.map((r) => ({ color: r.color, d: geoPath(r.geometry, PROJ.project) })),
  ...map.hidden_areas
    .filter((h): h is RawHidden & { real_geometry: Geometry } => h.real_geometry != null)
    .map((h) => ({ color: h.color, d: geoPath(h.real_geometry, PROJ.project) })),
]
// 폴리곤 없는 symbolic 지역(독도)은 실좌표에 점으로 표시
const SYMBOLIC_DOTS: { color: string; p: Point }[] = map.hidden_areas
  .filter((h) => h.real_geometry == null && h.real_point != null)
  .map((h) => ({ color: h.color, p: PROJ.project(h.real_point![0], h.real_point![1]) }))

const ZOOM = 0.28 // 플레이어+인접 시가 보이는 수준(PRD §8.2)

export default function RegionMap({
  playerCentroid,
  neighbors,
  legendarySite,
  moving = false,
  onArrowClick,
}: RegionMapProps) {
  const view = useMemo(() => {
    const c = PROJ.project(playerCentroid.lon, playerCentroid.lat)
    const vw = PROJ.width * ZOOM
    const vh = PROJ.height * ZOOM
    return {
      c,
      viewBox: `${c.x - vw / 2} ${c.y - vh / 2} ${vw} ${vh}`,
      gap: vh * 0.11, // 마커에서 화살표까지 거리(4차 검증: 더 촘촘하게)
      size: vh * 0.035, // 화살표 크기(4차 검증: 더 작게)
      markerR: vh * 0.022,
      stroke: vw * 0.0022, // 4차 검증: 시군 경계가 끊겨 보이던 것 보정, 더 두껍게
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
      // role="img"은 자식을 presentational로 만들어 화살표 role="button"이 SR에서 사라진다 → group
      role="group"
      aria-label="지역 지도"
      aria-busy={moving}
    >
      {/* 폴리곤 채우기: 클릭 불가(오직 화살표로만 이동). 인접 시군은 각자 독립된 폴리곤이라
          경계 좌표가 완전히 일치하지 않는다 — 채우기와 테두리를 같은 pass에서 그리면 나중에
          그려지는 이웃의 fill이 앞서 그려진 이웃의 테두리 픽셀을 살짝 덮어써 경계가 끊겨
          보인다. fill을 전부 먼저 깔고 테두리는 전부 그 위에 별도 pass로 그려서 방지(4차 검증). */}
      <g fillRule="evenodd" pointerEvents="none">
        {SHAPES.map((s, i) => (
          <path key={i} d={s.d} fill={s.color} />
        ))}
        {SYMBOLIC_DOTS.map((s, i) => (
          <circle key={i} cx={s.p.x} cy={s.p.y} r={view.markerR * 1.4} fill={s.color} />
        ))}
      </g>
      <g fill="none" stroke="#ffffff" strokeWidth={view.stroke} strokeLinejoin="round" pointerEvents="none">
        {SHAPES.map((s, i) => (
          <path key={`border-${i}`} d={s.d} />
        ))}
      </g>

      {legendary && <LegendaryMark p={legendary} r={view.markerR * 1.6} />}

      {/* 플레이어 마커: 몬스터볼 모양(4차 검증) */}
      <PlayerMark c={view.c} r={view.markerR} />

      {neighbors.map((n) => (
        <Arrow
          key={n.cityId}
          dir={n.dir}
          center={arrowCenter(view.c, n.dir, view.gap)}
          size={view.size}
          locked={n.locked}
          moving={moving}
          onClick={n.locked || moving ? undefined : () => onArrowClick(n.dir, n.cityId)}
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
  moving,
  onClick,
}: {
  dir: Dir
  center: Point
  size: number
  locked: boolean
  moving: boolean
  onClick?: () => void
}) {
  // 키보드 포커스에만 링 표시(WCAG 2.4.7) — 마우스 클릭 포커스는 :focus-visible 미매칭
  const [focusRing, setFocusRing] = useState(false)
  return (
    <g
      role="button"
      aria-label={`${DIR_LABEL[dir]}쪽으로 이동${locked ? ' (잠김)' : ''}`}
      aria-disabled={locked}
      // 잠긴 방향도 포커스 가능해야 키보드/SR 사용자가 존재를 인지한다(활성화만 차단)
      tabIndex={0}
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
      onFocus={(e) => setFocusRing(e.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocusRing(false)}
      style={{ cursor: locked ? 'not-allowed' : moving ? 'wait' : 'pointer' }}
      opacity={moving ? 0.4 : 1}
    >
      {/* 히트 영역 확대 */}
      <circle cx={center.x} cy={center.y} r={size * 1.8} fill="transparent" />
      {focusRing && (
        <circle
          cx={center.x}
          cy={center.y}
          r={size * 1.5}
          fill="none"
          stroke="#111827"
          strokeWidth={size * 0.15}
          pointerEvents="none"
        />
      )}
      {/* 원형 버튼 배경(4차 검증: 세련되게) — 헤더의 흰 원+검은 테두리 버튼과 통일된 스타일 */}
      <circle cx={center.x} cy={center.y} r={size * 1.15} fill="#ffffff" stroke="#111827" strokeWidth={size * 0.12} />
      <polygon
        points={arrowPoints(center, dir, size * 0.62)}
        fill={locked ? '#9ca3af' : '#e3350d'}
        strokeLinejoin="round"
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

// 플레이어 위치 마커: 몬스터볼 모양(4차 검증 — 기존 단색 원 대신 포켓몬스러운 시각화)
function PlayerMark({ c, r }: { c: Point; r: number }) {
  const clipId = useId()
  return (
    <g aria-hidden pointerEvents="none">
      <clipPath id={clipId}>
        <circle cx={c.x} cy={c.y} r={r} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect x={c.x - r} y={c.y - r} width={r * 2} height={r} fill="#e3350d" />
        <rect x={c.x - r} y={c.y} width={r * 2} height={r} fill="#f7f7f7" />
      </g>
      <circle cx={c.x} cy={c.y} r={r} fill="none" stroke="#111827" strokeWidth={r * 0.18} />
      <line x1={c.x - r} y1={c.y} x2={c.x + r} y2={c.y} stroke="#111827" strokeWidth={r * 0.16} />
      <circle cx={c.x} cy={c.y} r={r * 0.34} fill="#f7f7f7" stroke="#111827" strokeWidth={r * 0.14} />
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
