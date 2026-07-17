import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PokedexBrowser } from "@/components/pokedex/PokedexBrowser";
import { getPokedexProvinceGroups } from "@/lib/game/pokedex-data";
import { applyPreview, isPreviewLevel } from "./preview-fixtures";
import { AppHeader, tierFromLabel } from "@/components/ui/AppHeader";

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

  const base = await getPokedexProvinceGroups();
  const groups = isPreview ? applyPreview(base, level) : base;

  let header: ReactNode = null;
  if (user) {
    const [{ data: profile }, { data: tierLabel }] = await Promise.all([
      supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
      supabase.rpc("calc_user_tier", { p_user_id: user.id }),
    ]);
    header = (
      <AppHeader
        trainerName={profile?.nickname ?? user.email?.split("@")[0] ?? "트레이너"}
        tier={tierFromLabel(tierLabel)}
      />
    );
  }

  return (
    <main className={`mx-auto max-w-4xl px-4 pb-8 ${user ? "pt-20" : "pt-8"}`}>
      {header}
      <h1 className="mb-6 text-xl font-bold">도감</h1>
      <PokedexBrowser groups={groups} />
    </main>
  );
}
