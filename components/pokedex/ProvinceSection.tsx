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
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-base font-semibold">{province.name}</h2>
        {progress && (
          <span className="text-xs text-zinc-500">
            {progress.caught_count}/{progress.total_count}
          </span>
        )}
      </div>

      {progress && (
        <div className="mb-4 mt-5">
          <ProgressBar pct={progress.pct ?? 0} />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {cards.map((card) => (
          <PokemonCard key={card.species.dex_no} card={card} onSelect={() => onSelectCard(card)} />
        ))}
      </div>
    </section>
  );
}
