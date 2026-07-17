'use client'

import { memo, useMemo, useState } from 'react'
import rawMap from '@/files/korea_map_data.min.json'
import rawMunis from '@/files/korea_municipalities.min.json'
import { BallGlyph } from '@/components/ui/BallIcon'
import { TIERS, type UserTier } from '@/lib/game/tier'
import {
  createProjection,
  geoPath,
  labelRingArea,
  polygonLabelPoint,
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
  tier: UserTier // 플레이어 등급 — 마커를 해당 등급 볼 스프라이트로 표시
  onArrowClick: (dir: Dir, cityId: number) => void
}

// 독도 등 symbolic 항목은 real_geometry 없이 real_point만 갖는다(원본 데이터 주석 참고)
interface RawHidden { color: string; real_geometry?: Geometry; real_point?: [number, number] }
interface RawMap { main_map_bounds: Bounds; hidden_areas: RawHidden[] }

const map = rawMap as unknown as RawMap
const PROJ = createProjection(map.main_map_bounds, 1000)

// 폴리곤 없는 symbolic 지역(독도)은 실좌표에 점으로 표시(시군구 데이터엔 독도가 별도 항목이 없음)
const SYMBOLIC_DOTS: { color: string; p: Point }[] = map.hidden_areas
  .filter((h) => h.real_geometry == null && h.real_point != null)
  .map((h) => ({ color: h.color, p: PROJ.project(h.real_point![0], h.real_point![1]) }))

const ZOOM = 0.28 // 플레이어+인접 시가 보이는 수준(PRD §8.2)

// 시군구 채우기 + 경계 + 이름 라벨(southkorea-maps kostat 2013, EPSG:4326). 채우기 색은 도별 대표색
// (전처리 단계에서 각 시군구에 소속 도 색을 구워넣음) → 채우기·경계가 같은 데이터셋이라 완벽히 정렬되고
// 도마다 1색으로 깔끔하다(6차 검증). 기존 33개 region 폴리곤(도 단위, 생활권별 다중 음영) 채우기는 폐기.
interface RawMunis { municipalities: { name: string; color: string; geometry: Geometry }[] }
const CITY_SHAPES: { name: string; color: string; d: string; label: Point; area: number }[] = (
  rawMunis as unknown as RawMunis
).municipalities.map((m) => {
  const label = polygonLabelPoint(m.geometry, PROJ.project)
  return {
    name: m.name,
    color: m.color,
    d: geoPath(m.geometry, PROJ.project),
    label,
    area: labelRingArea(m.geometry, PROJ.project),
  }
})

// 뷰(줌·투영)는 플레이어 위치와 무관하게 고정이라 시군구 레이어는 완전 정적 → 모듈 로드시 한 번만
// 엘리먼트를 만들고 memo로 재렌더를 막아, 이동 글라이드(매 프레임 viewBox만 이동) 때 노드가
// 매 프레임 재생성되는 것을 피한다. (viewBox만 바뀌고 path/라벨 좌표·폰트는 그대로다.)
const VW = PROJ.width * ZOOM
const CITY_STROKE = VW * 0.0026
const LABEL_FONT = PROJ.height * ZOOM * 0.019
// 라벨 밀집 완화(3차 검증): 면적 큰 시군구 우선으로, 이미 배치된 라벨과 최소거리(LABEL_MIN_DIST)
// 미만이면 생략. 서울처럼 좁은 곳에 뭉친 구는 대표 3~5개만 남고, 지방은 전부 표시된다.
const LABEL_MIN_DIST = VW * 0.095
const CITY_LABELS: { name: string; label: Point }[] = (() => {
  const kept: { name: string; label: Point }[] = []
  for (const s of [...CITY_SHAPES].sort((a, b) => b.area - a.area)) {
    if (kept.every((k) => Math.hypot(k.label.x - s.label.x, k.label.y - s.label.y) >= LABEL_MIN_DIST)) {
      kept.push({ name: s.name, label: s.label })
    }
  }
  return kept
})()

const CityFills = memo(function CityFills() {
  return (
    <g fillRule="evenodd" pointerEvents="none">
      {CITY_SHAPES.map((s, i) => (
        <path key={i} d={s.d} fill={s.color} />
      ))}
    </g>
  )
})

const CityBorders = memo(function CityBorders() {
  return (
    <g fill="none" stroke="#ffffff" strokeWidth={CITY_STROKE} strokeLinejoin="round" pointerEvents="none">
      {CITY_SHAPES.map((s, i) => (
        <path key={i} d={s.d} />
      ))}
    </g>
  )
})

const CityLabels = memo(function CityLabels() {
  return (
    <g
      pointerEvents="none"
      fontSize={LABEL_FONT}
      fontWeight={700}
      textAnchor="middle"
      fill="#ffffff"
      stroke="#111827"
      strokeWidth={LABEL_FONT * 0.22}
      paintOrder="stroke"
      style={{ dominantBaseline: 'central' }}
    >
      {CITY_LABELS.map((s, i) => (
        <text key={i} x={s.label.x.toFixed(1)} y={s.label.y.toFixed(1)}>
          {s.name}
        </text>
      ))}
    </g>
  )
})

export default function RegionMap({
  playerCentroid,
  neighbors,
  legendarySite,
  moving = false,
  tier,
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
      {/* 채우기: 시군구 폴리곤을 도별 대표색으로(채우기·경계 동일 데이터셋 → 정렬 어긋남 없음, 6차 검증) */}
      <CityFills />
      {/* 독도 등 점 표시(시군구 데이터에 없는 symbolic 지역) */}
      <g pointerEvents="none">
        {SYMBOLIC_DOTS.map((s, i) => (
          <circle key={i} cx={s.p.x} cy={s.p.y} r={view.markerR * 1.4} fill={s.color} />
        ))}
      </g>
      {/* 시군구 경계선 하나로 통일(굵은 도 경계 레이어 제거, 3차 검증). 도 구분은 채우기 색 + 경계선 */}
      <CityBorders />
      {/* 시 이름 라벨(흰 글씨 + 검은 테두리) — 경계 위, 마커 아래 */}
      <CityLabels />

      {legendary && <LegendaryMark p={legendary} r={view.markerR * 1.6} />}

      {/* 플레이어 마커: 등급별 벡터 볼(5차 검증 — 등급 올라가면 슈퍼/하이퍼/마스터볼) */}
      <PlayerMark c={view.c} r={view.markerR} topColor={TIERS[tier].topColor} />

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

// 플레이어 위치 마커: 등급별 미니멀 벡터 볼(헤더 배지와 동일 스타일). 흰 하단 반원 + 검은
// 외곽선으로 어떤 도 색상 위에서도 대비가 확보돼 별도 배경 없이도 잘 보인다.
function PlayerMark({ c, r, topColor }: { c: Point; r: number; topColor: string }) {
  return (
    <g aria-hidden pointerEvents="none">
      <BallGlyph cx={c.x} cy={c.y} r={r} topColor={topColor} />
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
