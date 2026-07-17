// lon/lat → SVG 좌표 순수 함수. 실제 확률/게임 판정 없음, 좌표 변환만.

export type Bounds = { xlim: [number, number]; ylim: [number, number] }
export type Point = { x: number; y: number }

export type PolygonGeom = { type: 'Polygon'; coordinates: number[][][] }
export type MultiPolygonGeom = { type: 'MultiPolygon'; coordinates: number[][][][] }
export type Geometry = PolygonGeom | MultiPolygonGeom

export type Projection = {
  project: (lon: number, lat: number) => Point
  width: number
  height: number
}

// 위도가 올라갈수록 경도 1도의 실제 폭이 좁아진다 → mid위도 cos로 x를 보정해 가로 눌림 방지(equirectangular).
export function createProjection(bounds: Bounds, width = 1000): Projection {
  const [minLon, maxLon] = bounds.xlim
  const [minLat, maxLat] = bounds.ylim
  const lonScale = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180)
  const geoW = (maxLon - minLon) * lonScale
  const geoH = maxLat - minLat
  const scale = width / geoW
  const height = geoH * scale

  const project = (lon: number, lat: number): Point => ({
    x: (lon - minLon) * lonScale * scale,
    y: (maxLat - lat) * scale, // 위도↑ = 화면 위쪽(SVG y는 아래로 증가하므로 뒤집음)
  })

  return { project, width, height }
}

// Polygon은 링 배열(멀티파트 조각), MultiPolygon은 폴리곤 배열 → 한 겹 평탄화해 링 배열로 통일.
export function ringsOf(geometry: Geometry): number[][][] {
  return geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates
}

// GeoJSON geometry → SVG path d.
// evenodd fill-rule과 함께 쓰면 분리된 섬 조각과 실제 구멍 둘 다 올바르게 채워진다.
export function geoPath(geometry: Geometry, project: (lon: number, lat: number) => Point): string {
  return ringsOf(geometry).map((ring) => ringToSubpath(ring, project)).join(' ')
}

// 라벨 배치용 대표점: 지오메트리에서 면적이 가장 큰 링(본토 조각)의 면적가중 중심을 투영좌표로
// 반환. 작은 부속 섬에 라벨이 찍히는 걸 막고, 오목한 형태에서도 무게중심이 대체로 도형 안에 든다.
export function polygonLabelPoint(
  geometry: Geometry,
  project: (lon: number, lat: number) => Point,
): Point {
  const rings: number[][][] =
    geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates
  let bestPts: Point[] | null = null
  let bestArea = -1
  for (const ring of rings) {
    const pts = ring.map(([lon, lat]) => project(lon, lat))
    let a = 0
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % pts.length]
      a += p.x * q.y - q.x * p.y
    }
    a = Math.abs(a * 0.5)
    if (a > bestArea) {
      bestArea = a
      bestPts = pts
    }
  }
  const pts = bestPts ?? []
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const cross = p.x * q.y - q.x * p.y
    area += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  area *= 0.5
  if (Math.abs(area) < 1e-9) {
    // 퇴화(면적 0) 링 → 정점 평균으로 폴백
    const n = pts.length || 1
    return {
      x: pts.reduce((s, p) => s + p.x, 0) / n,
      y: pts.reduce((s, p) => s + p.y, 0) / n,
    }
  }
  return { x: cx / (6 * area), y: cy / (6 * area) }
}

// 라벨 우선순위용: 가장 큰 링의 투영 면적(부속 섬 제외한 본토 크기 근사).
export function labelRingArea(
  geometry: Geometry,
  project: (lon: number, lat: number) => Point,
): number {
  const rings: number[][][] =
    geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates
  let best = 0
  for (const ring of rings) {
    let a = 0
    for (let i = 0; i < ring.length; i++) {
      const p = project(ring[i][0], ring[i][1])
      const q = project(ring[(i + 1) % ring.length][0], ring[(i + 1) % ring.length][1])
      a += p.x * q.y - q.x * p.y
    }
    best = Math.max(best, Math.abs(a * 0.5))
  }
  return best
}

function ringToSubpath(ring: number[][], project: (lon: number, lat: number) => Point): string {
  let d = ''
  for (let i = 0; i < ring.length; i++) {
    const [lon, lat] = ring[i]
    const p = project(lon, lat)
    d += `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  return d + 'Z'
}
