// 도(province)별 지도 배경색 — 하늘색(#cce8f4) 계열 명도 변주로 팔레트 소규모 확장(DESIGN.md §1.1.1, 사용자 확인 완료)
// 폴리곤 자체 색(생활권 구분)과는 무관 — RegionMap.tsx의 SVG 레터박스 배경 전용
export const PROVINCE_BG_COLORS: Record<number, string> = {
  1: '#CCE8F4', // 서울특별시
  2: '#C2E4F2', // 부산광역시
  3: '#B8E0F0', // 대구광역시
  4: '#D6ECF6', // 인천광역시
  5: '#AEDCF0', // 광주광역시
  6: '#C8E6F5', // 대전광역시
  7: '#A4D8EE', // 울산광역시
  8: '#DCEFF8', // 세종특별자치시
  9: '#BEE2F1', // 경기도
  10: '#9ACFEA', // 강원도
  11: '#D2EAF5', // 충청북도
  12: '#B4DEEF', // 충청남도
  13: '#C6E5F3', // 전라북도
  14: '#90CBE8', // 전라남도
  15: '#DAE9F6', // 경상북도
  16: '#AAD9ED', // 경상남도
  17: '#E2F1F9', // 제주도
}

export const DEFAULT_REGION_BG = '#eaf1f5' // 기존 고정값 — provinceId 미지정/미매핑 시 폴백

export function regionBackground(provinceId?: number): string {
  if (provinceId == null) return DEFAULT_REGION_BG
  return PROVINCE_BG_COLORS[provinceId] ?? DEFAULT_REGION_BG
}
