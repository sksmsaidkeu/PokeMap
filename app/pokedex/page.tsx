import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PokedexBrowser } from "@/components/pokedex/PokedexBrowser";
import { getPokedexProvinceGroups } from "@/lib/game/pokedex-data";
import { applyPreview, isPreviewLevel } from "./preview-fixtures";
import { AppHeader } from "@/components/ui/AppHeader";
import { tierFromLabel } from "@/lib/game/tier";

// ?preview=full|half|newbie 는 로그인 없이도 QA용 완성도 더미를 볼 수 있게 auth 가드를 우회한다(PRD §5는 실데이터 접근만 대상)
export default async function PokedexPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { preview } = await searchParams;
  const level = typeof preview === "string" ? preview : undefined;
  const isPreview = isPreviewLevel(level);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !isPreview) redirect("/login");

  const [base, { count: caughtCount }] = await Promise.all([
    getPokedexProvinceGroups(),
    // select_own RLS로 로그인 유저 행만 잡히므로 별도 user_id 필터 불필요
    supabase.from("user_pokedex").select("dex_no", { count: "exact", head: true }),
  ]);
  const groups = isPreview ? applyPreview(base, level) : base;

  // 헤더는 실제 로그인 유저에게만 노출(미리보기 전용 방문자는 트레이너 정보가 없음)
  let trainerName = "";
  let tier = tierFromLabel(null);
  let totalSpecies = 0;
  if (user) {
    const [{ data: profile }, { data: tierLabel }, { count }] = await Promise.all([
      supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
      supabase.rpc("calc_user_tier", { p_user_id: user.id }),
      supabase.from("pokemon_species").select("dex_no", { count: "exact", head: true }),
    ]);
    trainerName = profile?.nickname ?? user.email?.split("@")[0] ?? "트레이너";
    tier = tierFromLabel(tierLabel);
    totalSpecies = count ?? 0;
  }

  return (
    <main className={`mx-auto max-w-4xl px-4 pb-8 ${user ? "pt-20" : "pt-8"}`}>
      {user && <AppHeader trainerName={trainerName} tier={tier} totalSpecies={totalSpecies} />}
      <h1 className="mb-6 text-xl font-bold">도감</h1>
      <PokedexBrowser groups={groups} caughtCount={caughtCount ?? 0} />
    </main>
  );
}
