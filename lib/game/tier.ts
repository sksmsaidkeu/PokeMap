// 등급 상수/판정 로직 — 서버 컴포넌트(map/pokedex page.tsx)와 클라이언트 컴포넌트(AppHeader)
// 양쪽에서 다 호출해야 해서 'use client' 파일(AppHeader.tsx)이 아닌 여기 둔다.
// 'use client' 모듈의 export는 서버에서 컴포넌트/props로만 쓸 수 있고 함수로 직접 호출은 불가.
export type UserTier = 'monster' | 'super' | 'hyper' | 'master'

// 스프라이트 에셋 확보 전까지 볼 고유색 원형으로 대체 — 에셋 도착 시 badgeClass 자리를 <Image>로 교체.
// 표시 전용 배지: 볼 종류 선택 UI 아님(PRD §17, CLAUDE.md §22)
// pct는 calc_user_tier(DB.md §6.5)의 등급 임계값과 동일 — 바뀌면 두 곳 다 갱신 필요.
export const TIER_ORDER: UserTier[] = ['monster', 'super', 'hyper', 'master']
export const TIERS: Record<UserTier, { label: string; badgeClass: string; pct: number }> = {
  monster: { label: '몬스터볼', badgeClass: 'bg-red-500', pct: 0 },
  super: { label: '슈퍼볼', badgeClass: 'bg-blue-600', pct: 0.3 },
  hyper: { label: '하이퍼볼', badgeClass: 'bg-yellow-400', pct: 0.6 },
  master: { label: '마스터볼', badgeClass: 'bg-purple-600', pct: 0.9 },
}

const TIER_BY_LABEL: Record<string, UserTier> = {
  몬스터볼: 'monster',
  슈퍼볼: 'super',
  하이퍼볼: 'hyper',
  마스터볼: 'master',
}

// calc_user_tier RPC는 표시용 한글 라벨을 반환(DB.md §6.5) — 배지 키로 역매핑.
// rpc 실패/미조회 시 최저 등급 폴백(헤더가 페이지 렌더를 막을 이유는 없다).
export function tierFromLabel(label: string | null | undefined): UserTier {
  return TIER_BY_LABEL[label ?? ''] ?? 'monster'
}
