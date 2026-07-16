import type { PokedexCard } from "@/lib/game/pokedex-types";
import { typeColorClass } from "./type-colors";

type PokemonCardProps = {
  card: PokedexCard;
  onSelect: () => void;
};

export function PokemonCard({ card, onSelect }: PokemonCardProps) {
  const { entry } = card;

  // 미포획: 명도 0% 검은 실루엣 + 클릭/탭 인터랙션 완전 비활성화(PRD §8.5)
  if (entry === null) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 p-3 opacity-90 dark:border-zinc-800"
      >
        <div className="h-14 w-14 rounded-full bg-black" />
        <span className="text-xs text-zinc-400">???</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 p-3 text-left transition hover:border-emerald-400 hover:shadow-sm dark:border-zinc-800"
    >
      <div className={`h-14 w-14 rounded-full ${typeColorClass(card.species.type1)}`} />
      <span className="text-xs font-medium">{card.species.name_kr}</span>
      {entry.catch_count > 1 && (
        <span className="text-[10px] text-zinc-500">x{entry.catch_count}</span>
      )}
      {card.isLegendary && <span className="text-[10px] text-amber-600">전설</span>}
    </button>
  );
}
