// 임시 배색 — 실제 스프라이트/디자인 시스템 연동 전까지의 목업용
const TYPE_COLORS: Record<string, string> = {
  normal: "bg-zinc-400",
  fire: "bg-orange-500",
  water: "bg-blue-500",
  electric: "bg-yellow-400",
  grass: "bg-green-500",
  ice: "bg-cyan-400",
  fighting: "bg-red-700",
  poison: "bg-purple-500",
  ground: "bg-amber-600",
  flying: "bg-indigo-400",
  psychic: "bg-pink-500",
  bug: "bg-lime-500",
  rock: "bg-yellow-700",
  ghost: "bg-violet-700",
  dragon: "bg-indigo-600",
  fairy: "bg-pink-300",
};

export function typeColorClass(type: string): string {
  return TYPE_COLORS[type] ?? "bg-zinc-400";
}

// 상세 탭 타입 뱃지용 — 색 배경 + 흰 글자 + 픽셀풍 테두리
export function typeBadgeClass(type: string): string {
  return `inline-block rounded border border-black px-2 py-0.5 text-xs font-bold text-white ${typeColorClass(type)}`;
}
