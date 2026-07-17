// 포켓몬 타입별 배경색 — 불바피디아/포켓몬GO 관례 배색(도감 밖 UI 장식 목적, 확률/게임 로직과 무관)
export const POKEMON_TYPE_COLORS: Record<string, string> = {
  normal: '#A8A878',
  fire: '#F08030',
  water: '#6890F0',
  electric: '#F8D030',
  grass: '#78C850',
  ice: '#98D8D8',
  fighting: '#C03028',
  poison: '#A040A0',
  ground: '#E0C068',
  flying: '#A890F0',
  psychic: '#F85888',
  bug: '#A8B820',
  rock: '#B8A038',
  ghost: '#705898',
  dragon: '#7038F8',
  dark: '#705848',
  steel: '#B8B8D0',
  fairy: '#EE99AC',
}

const FALLBACK_GROUND = '#F0F0F0'

// 단일 타입은 하단을 중립색으로, 복합 타입은 두 타입 색을 위/아래로 블렌드
export function encounterBackground(type1: string, type2: string | null) {
  const top = POKEMON_TYPE_COLORS[type1] ?? FALLBACK_GROUND
  const bottom = type2 ? POKEMON_TYPE_COLORS[type2] ?? FALLBACK_GROUND : FALLBACK_GROUND
  return `linear-gradient(to bottom, ${top}, ${bottom})`
}
