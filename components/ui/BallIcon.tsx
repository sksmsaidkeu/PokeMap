// 미니멀 벡터 몬스터볼 — 상단 반원 색(topColor)만 등급별로 바꿔 재사용.
// 지도 마커(기존 SVG 안에 삽입)와 헤더/등급표 배지(독립 <svg>) 양쪽에서 같은 그림을 쓴다.

// SVG 프리미티브만 반환(부모 <svg> 안에 그대로 삽입). clipPath 대신 반원 아크 2개로 그려
// 인스턴스마다 필요한 고유 id를 없앴다.
export function BallGlyph({
  cx,
  cy,
  r,
  topColor,
}: {
  cx: number
  cy: number
  r: number
  topColor: string
}) {
  const band = r * 0.16
  return (
    <>
      {/* 상단 반원(등급색) / 하단 반원(흰색) */}
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy} Z`} fill={topColor} />
      <path d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 0 ${cx + r} ${cy} Z`} fill="#f7f7f7" />
      {/* 외곽선 + 중앙 밴드 + 버튼 */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#111827" strokeWidth={band} />
      <line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke="#111827" strokeWidth={band} />
      <circle cx={cx} cy={cy} r={r * 0.32} fill="#f7f7f7" stroke="#111827" strokeWidth={r * 0.12} />
    </>
  )
}

// 독립 아이콘 — 헤더/등급표 배지용.
export function BallIcon({ topColor, size, label }: { topColor: string; size: number; label?: string }) {
  const c = size / 2
  const r = size / 2 - size * 0.08 // 외곽선이 잘리지 않게 여백
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <BallGlyph cx={c} cy={c} r={r} topColor={topColor} />
    </svg>
  )
}
