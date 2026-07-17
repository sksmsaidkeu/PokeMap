// 등급 매핑(순수 함수) — 'use client'인 AppHeader와 분리해 서버 컴포넌트(map/pokedex 페이지)에서도
// 호출 가능하게 한다. 클라이언트 모듈의 함수는 서버에서 호출할 수 없기 때문.
export type UserTier = 'monster' | 'super' | 'hyper' | 'master'

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
