import type { PokedexCard } from "@/lib/game/pokedex-types";
import { typeColorClass } from "./type-colors";

type PokemonDetailModalProps = {
  card: PokedexCard;
  onClose: () => void;
};

export function PokemonDetailModal({ card, onClose }: PokemonDetailModalProps) {
  const { species, entry } = card;
  if (!entry) return null; // Locked 카드는 애초에 열리지 않지만 타입 안전을 위해 방어

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl bg-white p-6 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className={`h-20 w-20 rounded-full ${typeColorClass(species.type1)}`} />
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            닫기
          </button>
        </div>

        <h2 className="mt-3 text-lg font-semibold">
          {species.name_kr}
          {card.isLegendary && <span className="ml-2 text-xs text-amber-600">전설</span>}
        </h2>

        <dl className="mt-3 grid grid-cols-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
          <dt>타입</dt>
          <dd>{[species.type1, species.type2].filter(Boolean).join(" / ")}</dd>
          <dt>종족값 합</dt>
          <dd>{species.bst}</dd>
          <dt>최초 포획</dt>
          <dd>{new Date(entry.first_caught_at).toLocaleDateString("ko-KR")}</dd>
          <dt>포획 횟수</dt>
          <dd>{entry.catch_count}</dd>
        </dl>

        <p className="mt-3 text-sm text-zinc-500">
          {species.flavor_text ?? "도감 설명 준비 중"}
        </p>
      </div>
    </div>
  );
}
