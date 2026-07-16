"use client";

import { useState } from "react";
import type { PokedexCard, PokedexProvinceGroup } from "@/lib/game/pokedex-types";
import { ProvinceSection } from "./ProvinceSection";
import { PokemonDetailModal } from "./PokemonDetailModal";

type PokedexBrowserProps = {
  groups: PokedexProvinceGroup[];
};

export function PokedexBrowser({ groups }: PokedexBrowserProps) {
  const [selected, setSelected] = useState<PokedexCard | null>(null);

  return (
    <div className="min-h-full bg-[#F0F0F0] p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] sm:p-6">
        {groups.map((group) => (
          <ProvinceSection key={group.province.id} group={group} onSelectCard={setSelected} />
        ))}
      </div>
      {selected && <PokemonDetailModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
