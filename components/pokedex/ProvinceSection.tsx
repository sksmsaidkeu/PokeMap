import type { PokedexCard, PokedexProvinceGroup } from "@/lib/game/pokedex-types";
import { PokemonCard } from "./PokemonCard";
import { ProgressBar } from "./ProgressBar";

type ProvinceSectionProps = {
  group: PokedexProvinceGroup;
  onSelectCard: (card: PokedexCard) => void;
};

export function ProvinceSection({ group, onSelectCard }: ProvinceSectionProps) {
  const { province, progress, cards } = group;

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline justify-between border-l-4 border-[#e3350d] pl-2">
        <h2 className="text-base font-bold text-black">{province.name}</h2>
        {progress && (
          <span className="text-xs font-medium text-zinc-500">
            {progress.caught_count}/{progress.total_count}
          </span>
        )}
      </div>

      {progress && (
        <div className="mb-4 mt-5">
          <ProgressBar pct={progress.pct ?? 0} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {cards.map((card) => (
          <PokemonCard key={card.species.dex_no} card={card} onSelect={() => onSelectCard(card)} />
        ))}
      </div>
    </section>
  );
}
