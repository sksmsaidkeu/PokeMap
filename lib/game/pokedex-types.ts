import type { Database } from "@/lib/supabase/types";

export type PokemonSpeciesRow = Pick<
  Database["public"]["Tables"]["pokemon_species"]["Row"],
  | "dex_no"
  | "name_kr"
  | "type1"
  | "type2"
  | "bst"
  | "flavor_text"
  | "height_dm"
  | "weight_hg"
  | "primary_ability"
  | "evo_chain_id"
  | "evo_stage"
>;

// 진화 라인 표시용 — 상세 팝업 스와이프 캐러셀 각 패널 데이터(pokemon_species에서 chain 단위 조회)
export type EvolutionMember = Pick<
  Database["public"]["Tables"]["pokemon_species"]["Row"],
  | "dex_no"
  | "name_kr"
  | "type1"
  | "type2"
  | "bst"
  | "flavor_text"
  | "height_dm"
  | "weight_hg"
  | "primary_ability"
  | "evo_stage"
>;

export type PokedexEntryRow = Pick<
  Database["public"]["Tables"]["user_pokedex"]["Row"],
  "dex_no" | "first_caught_at" | "catch_count"
>;

export type ProvinceProgressRow = Pick<
  Database["public"]["Views"]["v_user_province_progress"]["Row"],
  "province_id" | "caught_count" | "total_count" | "pct"
>;

export type ProvinceRow = Pick<
  Database["public"]["Tables"]["provinces"]["Row"],
  "id" | "name" | "legendary_dex_no"
>;

// 화면 렌더링용 조합 타입(DB row 1:1 아님) — 도 하나를 그리는 데 필요한 데이터 묶음
export type PokedexCard = {
  species: PokemonSpeciesRow;
  isLegendary: boolean;
  entry: PokedexEntryRow | null; // null이면 미포획(Locked)
};

export type PokedexProvinceGroup = {
  province: ProvinceRow;
  progress: ProvinceProgressRow | null;
  cards: PokedexCard[];
};
