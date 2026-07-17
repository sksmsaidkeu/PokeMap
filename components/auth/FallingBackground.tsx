// 몬스터볼이 위→아래로 천천히 떨어지는 배경 데코(DESIGN.md §2.1). 순수 CSS,
// prefers-reduced-motion 시 globals.css에서 숨긴다. 값은 하이드레이션 불일치를 피하려 고정.
const ITEMS = [
  { left: '6%', size: 30, duration: 14, delay: 0 },
  { left: '18%', size: 22, duration: 18, delay: 3 },
  { left: '31%', size: 36, duration: 11, delay: 6 },
  { left: '44%', size: 26, duration: 16, delay: 1 },
  { left: '57%', size: 20, duration: 20, delay: 8 },
  { left: '69%', size: 34, duration: 13, delay: 4 },
  { left: '81%', size: 24, duration: 17, delay: 2 },
  { left: '92%', size: 30, duration: 15, delay: 7 },
]

export default function FallingBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {ITEMS.map((it, i) => (
        <span
          key={i}
          className="falling-item pokeball"
          style={{
            left: it.left,
            width: it.size,
            height: it.size,
            animationDuration: `${it.duration}s`,
            animationDelay: `${it.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
