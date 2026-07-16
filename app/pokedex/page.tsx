import { PokedexBrowser } from "@/components/pokedex/PokedexBrowser";
import { MOCK_PROVINCE_GROUPS } from "./mock-data";

// TODO: 목업 데이터를 Supabase 조회(user_pokedex/pokemon_species/region_spawn_pool/v_user_province_progress)로 교체
export default function PokedexPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold">도감</h1>
      <PokedexBrowser groups={MOCK_PROVINCE_GROUPS} />
    </main>
  );
}
