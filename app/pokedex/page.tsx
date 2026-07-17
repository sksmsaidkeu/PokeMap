import { createClient } from "@/lib/supabase/server";
import { PokedexBrowser } from "@/components/pokedex/PokedexBrowser";
import { getPokedexProvinceGroups } from "@/lib/game/pokedex-data";
import { applyPreview, isPreviewLevel } from "./preview-fixtures";

// ?preview=full|half|newbie 로 완성도별 더미 화면 확인(로그인/포획 플로우 준비 전 임시)
export default async function PokedexPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { preview } = await searchParams;
  const level = typeof preview === "string" ? preview : undefined;

  const supabase = await createClient();
  const [base, { count: caughtCount }] = await Promise.all([
    getPokedexProvinceGroups(),
    // select_own RLS로 로그인 유저 행만 잡히므로 별도 user_id 필터 불필요
    supabase.from("user_pokedex").select("dex_no", { count: "exact", head: true }),
  ]);
  const groups = isPreviewLevel(level) ? applyPreview(base, level) : base;

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold">도감</h1>
      <PokedexBrowser groups={groups} caughtCount={caughtCount ?? 0} />
    </main>
  );
}
