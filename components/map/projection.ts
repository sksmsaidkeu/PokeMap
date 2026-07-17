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

// GeoJSON geometry → SVG path d. Polygon은 링 배열(멀티파트 조각), MultiPolygon은 폴리곤 배열.
// evenodd fill-rule과 함께 쓰면 분리된 섬 조각과 실제 구멍 둘 다 올바르게 채워진다.
export function geoPath(geometry: Geometry, project: (lon: number, lat: number) => Point): string {
  const rings: number[][][] =
    geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : geometry.coordinates
  return rings.map((ring) => ringToSubpath(ring, project)).join(' ')
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
