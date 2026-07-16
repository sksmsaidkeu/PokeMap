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
    <div>
      {groups.map((group) => (
        <ProvinceSection key={group.province.id} group={group} onSelectCard={setSelected} />
      ))}
      {selected && <PokemonDetailModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
