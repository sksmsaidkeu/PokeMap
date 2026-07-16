import type { PokedexCard } from "@/lib/game/pokedex-types";
import { PokemonSprite } from "./PokemonSprite";
import { typeColorClass } from "./type-colors";

type PokemonCardProps = {
  card: PokedexCard;
  onSelect: () => void;
};

function dexLabel(dexNo: number): string {
  return `No.${String(dexNo).padStart(4, "0")}`;
}

export function PokemonCard({ card, onSelect }: PokemonCardProps) {
  const { entry, species } = card;

  // 미포획: 명도 0% 검은 실루엣 + 클릭/탭 인터랙션 완전 비활성화(PRD §8.5)
  if (entry === null) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col rounded-xl border-2 border-black bg-white p-2 opacity-90"
      >
        <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50">
          {/* alt를 ???로 두는 이유: 미포획 종 이름이 스크린리더로 새는 것 방지 */}
          <PokemonSprite dexNo={species.dex_no} alt="???" silhouette />
        </div>
        <div className="mt-2">
          <p className="text-[10px] font-medium text-zinc-400">???</p>
          <p className="text-sm font-bold text-zinc-400">???</p>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col rounded-xl border-2 border-black bg-white p-2 text-left transition hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
    >
      <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50">
        <PokemonSprite
          dexNo={species.dex_no}
          alt={species.name_kr}
          fallbackClass={typeColorClass(species.type1)}
        />
        {card.isLegendary && (
          <span className="absolute right-1 top-1 rounded bg-[#e3350d] px-1 text-[9px] font-bold text-white">
            전설
          </span>
        )}
        {entry.catch_count > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
            x{entry.catch_count}
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-[10px] font-medium text-zinc-500">{dexLabel(species.dex_no)}</p>
        <p className="truncate text-sm font-bold text-black">{species.name_kr}</p>
      </div>
    </button>
  );
}
