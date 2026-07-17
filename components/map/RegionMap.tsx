'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import rawMap from '@/files/korea_map_data.min.json'
import {
  createProjection,
  geoPath,
  ringsOf,
  type Bounds,
  type Geometry,
  type Point,
} from './projection'
import { regionBackground } from './provinceColors'

type LonLat = { lon: number; lat: number }
type Dir = 'up' | 'down' | 'left' | 'right'
type NeighborArrow = { dir: Dir; cityId: number; locked: boolean } // locked=섬 미해금

export interface CityLabel {
  cityId: number
  name: string
  lon: number
  lat: number
}

export interface RegionMapProps {
  playerCentroid: LonLat
  neighbors: NeighborArrow[] // 없는 방향은 생략
  legendarySite?: LonLat | null // 도 100% 완공 시 전설 출현지
  moving?: boolean // 서버 이동 응답 대기 중 — 화살표 dim + 입력 차단(§2 낙관적 업데이트 금지)
  zoom?: number // viewBox 배율(plan.md #1) — 미지정 시 DEFAULT_ZOOM, MIN_ZOOM~MAX_ZOOM으로 clamp
  labels?: CityLabel[] // 화면에 실제 표시되는 플레이어 시 + 인접 시 이름(개수 작음, 밀도 제어 불필요)
  provinceId?: number // 지역별 배경색(plan.md #8, DESIGN.md §1.1.1) — 미지정 시 기존 기본값 폴백
  onArrowClick: (dir: Dir, cityId: number) => void
  onLabelClick?: (cityId: number) => void // "이동"(화살표)과 구분되는 "정보 보기" — 실제 동작은 이 스코프 밖
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

// min.json은 생활권(색) 단위로 병합된 폴리곤이라 시/군/구 경계가 별도 필드로 없다 —
// 대신 원본 GeoJSON에는 병합 전 개별 시/군/구 링이 그대로 남아있어(dissolve 안 됨),
// 한 생활권 안에서 두 번 등장하는 변(edge)이 곧 인접 시/군/구가 맞닿는 접합선이다.
// plan.md #7: 그 접합선만 점선으로, 다른 색과 맞닿는 진짜 외곽선/해안선은 실선 유지.
const EDGE_PRECISION = 5 // 원본 좌표에 1e-6~1e-7도 수준 부동소수 노이즈가 있어(~1m 허용) 반올림 후 비교해야 매칭됨

function edgeKey(a: number[], b: number[]): string {
  const ka = `${a[0].toFixed(EDGE_PRECISION)},${a[1].toFixed(EDGE_PRECISION)}`
  const kb = `${b[0].toFixed(EDGE_PRECISION)},${b[1].toFixed(EDGE_PRECISION)}`
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`
}

function segPath(a: Point, b: Point): string {
  return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`
}

function classifyEdges(geometry: Geometry): { solid: string[]; dashed: string[] } {
  const counts = new Map<string, number>()
  const segs: { key: string; a: Point; b: Point }[] = []
  for (const ring of ringsOf(geometry)) {
    for (let i = 0; i < ring.length - 1; i++) {
      const key = edgeKey(ring[i], ring[i + 1])
      counts.set(key, (counts.get(key) ?? 0) + 1)
      segs.push({ key, a: PROJ.project(ring[i][0], ring[i][1]), b: PROJ.project(ring[i + 1][0], ring[i + 1][1]) })
    }
  }
  const solid: string[] = []
  const dashed: string[] = []
  for (const { key, a, b } of segs) {
    ;((counts.get(key) ?? 0) > 1 ? dashed : solid).push(segPath(a, b))
  }
  return { solid, dashed }
}

// 폴리곤과 동일하게 모듈 로드시 1회만 계산해 캐싱(렌더마다 재계산 금지).
const EDGE_OVERLAY: { solidD: string; dashedD: string } = (() => {
  const geoms: Geometry[] = [
    ...map.regions.map((r) => r.geometry),
    ...map.hidden_areas
      .filter((h): h is RawHidden & { real_geometry: Geometry } => h.real_geometry != null)
      .map((h) => h.real_geometry),
  ]
  const solid: string[] = []
  const dashed: string[] = []
  for (const g of geoms) {
    const c = classifyEdges(g)
    solid.push(...c.solid)
    dashed.push(...c.dashed)
  }
  return { solidD: solid.join(''), dashedD: dashed.join('') }
})()

// non-scaling-stroke로 viewBox 줌과 무관한 화면 픽셀 두께 고정 — 기존 view.stroke(viewBox 비례)는
// ZOOM=0.28에서 서브픽셀에 가까워 얇은 접합선이 사라지던 원인이라 경계선에는 더 이상 쓰지 않는다.
const BOUNDARY_STROKE_PX = 1.2
const INNER_DASH = '4 3'

// ZOOM = viewBox가 차지하는 전체 지도 대비 비율 — 작을수록 화면에 더 크게(세부적으로) 보임(확대).
// plan.md #1: 시각 배율만 확장, city_connections 인접 관계는 그대로.
export const MIN_ZOOM = 0.14 // 과확대 시 이웃 시가 viewBox 밖으로 잘리는 하한
export const MAX_ZOOM = 0.28 // 기존 기본값 — 이보다 축소하면 §8.2 "플레이어+인접 시" 범위를 벗어남
export const DEFAULT_ZOOM = 0.2 // 기존 0.28보다 확대된 기본값(1.4배)
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

// 좁은 화면(plan.md #2): 화살표 시각 크기만 축소, 히트 영역은 baseline 유지
const NARROW_QUERY = '(max-width: 639px)'
const SHORT_QUERY = '(max-height: 559px)' // ponytail: 컨테이너 실측 대신 뷰포트 높이로 근사(지도는 전체화면 사용 전제)
const COMPACT_SIZE_SCALE = 0.65
const COMPACT_GAP_SCALE = 0.8

function useCompactArrows(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia(NARROW_QUERY).matches || window.matchMedia(SHORT_QUERY).matches
  )

  useEffect(() => {
    const mqWidth = window.matchMedia(NARROW_QUERY)
    const mqHeight = window.matchMedia(SHORT_QUERY)
    const update = () => setCompact(mqWidth.matches || mqHeight.matches)
    update()
    mqWidth.addEventListener('change', update)
    mqHeight.addEventListener('change', update)
    return () => {
      mqWidth.removeEventListener('change', update)
      mqHeight.removeEventListener('change', update)
    }
  }, [])

  return compact
}

export default function RegionMap({
  playerCentroid,
  neighbors,
  legendarySite,
  moving = false,
  zoom = DEFAULT_ZOOM,
  labels,
  provinceId,
  onArrowClick,
  onLabelClick,
}: RegionMapProps) {
  const compact = useCompactArrows()

  const view = useMemo(() => {
    const z = clampZoom(zoom)
    const c = PROJ.project(playerCentroid.lon, playerCentroid.lat)
    const vw = PROJ.width * z
    const vh = PROJ.height * z
    const baseSize = vh * 0.05
    return {
      c,
      viewBox: `${c.x - vw / 2} ${c.y - vh / 2} ${vw} ${vh}`,
      gap: vh * 0.11 * (compact ? COMPACT_GAP_SCALE : 1), // 마커에서 화살표까지 거리(4차 검증: 더 촘촘하게)
      size: vh * 0.035 * (compact ? COMPACT_SIZE_SCALE : 1), // 화살표 크기(4차 검증: 더 작게)
      hitR: baseSize * 1.8, // 클릭 히트 영역 — 44px 접근성 기준 유지 위해 compact에도 축소 안 함
      markerR: vh * 0.022,
      stroke: vw * 0.0022, // 4차 검증: 시군 경계가 끊겨 보이던 것 보정, 더 두껍게
    }
  }, [playerCentroid, compact, zoom])

  const legendary: Point | null = legendarySite
    ? PROJ.project(legendarySite.lon, legendarySite.lat)
    : null

  return (
    <svg
      viewBox={view.viewBox}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', display: 'block', background: regionBackground(provinceId) }}
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
      </g>
      {/* 생활권 외곽선(다른 색과 접함) + 해안선 — 실선 유지 */}
      <path
        d={EDGE_OVERLAY.solidD}
        fill="none"
        stroke="#ffffff"
        strokeWidth={BOUNDARY_STROKE_PX}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {/* 같은 색 생활권 내부, 인접 시/군/구 접합선 — 점선(plan.md #7) */}
      <path
        d={EDGE_OVERLAY.dashedD}
        fill="none"
        stroke="#ffffff"
        strokeWidth={BOUNDARY_STROKE_PX}
        strokeDasharray={INNER_DASH}
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      <g stroke="#ffffff" strokeWidth={view.stroke} pointerEvents="none">
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
          hitR={view.hitR}
          locked={n.locked}
          moving={moving}
          onClick={n.locked || moving ? undefined : () => onArrowClick(n.dir, n.cityId)}
        />
      ))}

      {labels?.map((l) => {
        const p = PROJ.project(l.lon, l.lat)
        // 플레이어 자신의 시는 project 결과가 마커(view.c)와 겹친다 — 4방향 화살표 히트 영역과
        // 안 겹치도록 대각선(우상단)으로 띄운다. 이웃 시는 실좌표가 화살표(gap 거리)보다
        // 대체로 멀리 떨어져 있어 추가 회피 로직 없이 점 바로 위에 표시.
        const isSelf = Math.hypot(p.x - view.c.x, p.y - view.c.y) < view.markerR * 1.5
        const label = isSelf
          ? { x: p.x + view.markerR * 2, y: p.y - view.markerR * 2 }
          : { x: p.x, y: p.y - view.markerR * 1.2 }
        return (
          <Label
            key={l.cityId}
            x={label.x}
            y={label.y}
            fontSize={view.markerR * 2}
            name={l.name}
            onClick={onLabelClick ? () => onLabelClick(l.cityId) : undefined}
          />
        )
      })}
    </svg>
  )
}

function Label({
  x,
  y,
  fontSize,
  name,
  onClick,
}: {
  x: number
  y: number
  fontSize: number
  name: string
  onClick?: () => void
}) {
  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      textAnchor="middle"
      fill="#111827"
      stroke="#ffffff"
      strokeWidth={fontSize * 0.15}
      paintOrder="stroke"
      style={{ userSelect: 'none', cursor: onClick ? 'pointer' : undefined }}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? `${name} 정보 보기` : undefined}
      tabIndex={onClick ? 0 : undefined}
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
    >
      {name}
    </text>
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
  hitR,
  locked,
  moving,
  onClick,
}: {
  dir: Dir
  center: Point
  size: number
  hitR: number
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
      {/* 히트 영역 확대 — compact에서도 축소하지 않음(접근성 44px 기준) */}
      <circle cx={center.x} cy={center.y} r={hitR} fill="transparent" />
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
