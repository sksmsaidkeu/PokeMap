import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import type {
  PokedexCard,
  PokedexEntryRow,
  PokedexProvinceGroup,
  PokemonSpeciesRow,
  ProvinceProgressRow,
  ProvinceRow,
} from "@/lib/game/pokedex-types";

// 설치된 @supabase/ssr(0.5.2)가 supabase-js(2.110) postgrest 파서로 스키마 제네릭을 흘려보내지 못해
// createClient()로 만든 클라이언트의 select 결과가 never[]로 추론된다(런타임 데이터는 정상).
// 그래서 각 결과 배열을 생성 타입(Database)에서 파생한 실제 row 타입으로 명시 주석한다 — never[]는 임의 타입에 대입 가능.
type LivingAreaRow = Pick<Database["public"]["Tables"]["living_areas"]["Row"], "id" | "province_id">;
type SpawnPoolRow = Pick<
  Database["public"]["Tables"]["region_spawn_pool"]["Row"],
  "dex_no" | "is_legendary" | "living_area_id"
>;

// 도감 화면 데이터 조립. 마스터 테이블은 일괄 조회 후 TS에서 도별로 묶는다(N+1 금지, CLAUDE.md §21).
//
// 호출자(page.tsx)가 auth.getUser()를 마친 클라이언트와 userId를 넘긴다 — 여기서 별도 클라이언트를
// 새로 만들면 그 클라는 getUser()를 거치지 않아, 미들웨어가 없는 이 앱에선 만료된 액세스 토큰이
// 갱신되지 않은 채 쿼리가 나가 auth.uid()가 풀리고 user_pokedex RLS가 0행을 반환한다(=포획했는데
// 전부 미포획으로 표시). 유저 쿼리는 map 페이지와 동일하게 .eq("user_id")로도 명시 스코프한다.
// userId가 없으면(프리뷰/비로그인) 유저 데이터 조회를 건너뛰어 전 카드 미포획 + 진행률 0/N.
export async function getPokedexProvinceGroups(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
): Promise<PokedexProvinceGroup[]> {
  const [provincesRes, livingAreasRes, spawnPoolRes, speciesRes, pokedexRes, progressRes] =
    await Promise.all([
      supabase.from("provinces").select("id,name,legendary_dex_no").order("id"),
      supabase.from("living_areas").select("id,province_id"),
      supabase.from("region_spawn_pool").select("dex_no,is_legendary,living_area_id"),
      supabase
        .from("pokemon_species")
        .select(
          "dex_no,name_kr,type1,type2,bst,flavor_text,height_dm,weight_hg,primary_ability,evo_chain_id,evo_stage",
        ),
      userId
        ? supabase
            .from("user_pokedex")
            .select("dex_no,first_caught_at,catch_count")
            .eq("user_id", userId)
        : Promise.resolve({ data: [] as PokedexEntryRow[] }),
      userId
        ? supabase
            .from("v_user_province_progress")
            .select("province_id,caught_count,total_count,pct")
            .eq("user_id", userId)
        : Promise.resolve({ data: [] as ProvinceProgressRow[] }),
    ]);

  const provinces: ProvinceRow[] = provincesRes.data ?? [];
  const livingAreas: LivingAreaRow[] = livingAreasRes.data ?? [];
  const spawnPool: SpawnPoolRow[] = spawnPoolRes.data ?? [];
  const species: PokemonSpeciesRow[] = speciesRes.data ?? [];
  const pokedex: PokedexEntryRow[] = pokedexRes.data ?? [];
  const progress: ProvinceProgressRow[] = progressRes.data ?? [];

  const speciesByDex = new Map(species.map((s) => [s.dex_no, s]));
  const entryByDex = new Map(pokedex.map((e) => [e.dex_no, e]));
  const progressByProvince = new Map<number, ProvinceProgressRow>();
  for (const p of progress) {
    if (p.province_id !== null) progressByProvince.set(p.province_id, p);
  }

  const provinceIdByLivingArea = new Map(livingAreas.map((la) => [la.id, la.province_id]));

  // 도별로 { dex_no → 전설 여부 } 집계 — 여러 생활권에 같은 종이 있어도 도 단위로 1장만.
  const dexByProvince = new Map<number, Map<number, boolean>>();
  for (const row of spawnPool) {
    const provinceId = provinceIdByLivingArea.get(row.living_area_id);
    if (provinceId === undefined) continue;
    let dexMap = dexByProvince.get(provinceId);
    if (!dexMap) {
      dexMap = new Map<number, boolean>();
      dexByProvince.set(provinceId, dexMap);
    }
    dexMap.set(row.dex_no, (dexMap.get(row.dex_no) ?? false) || row.is_legendary);
  }

  return provinces.map((province) => {
    const dexMap = dexByProvince.get(province.id) ?? new Map<number, boolean>();

    const cards: PokedexCard[] = [];
    let normalTotal = 0;
    for (const [dexNo, isLegendary] of dexMap) {
      const speciesRow = speciesByDex.get(dexNo);
      if (!speciesRow) continue; // 스폰 풀에 있으나 종 정보가 없는 데이터 갭 방어
      cards.push({ species: speciesRow, isLegendary, entry: entryByDex.get(dexNo) ?? null });
      if (!isLegendary) normalTotal += 1;
    }
    // 전설은 진행률 분모에서 제외(v_user_province_progress와 동일 규칙), 카드는 전설을 뒤로.
    // 그 외에는 한글명 가나다 순(localeCompare 'ko') — 도감 열람 편의(같은 이름 없음 → dex_no 타이브레이커 불필요).
    cards.sort(
      (a, b) =>
        Number(a.isLegendary) - Number(b.isLegendary) ||
        a.species.name_kr.localeCompare(b.species.name_kr, "ko"),
    );

    // 로그인 유저가 없으면 뷰에 행이 없으므로 total만 로컬 계산하고 caught/pct는 0.
    const provinceProgress: ProvinceProgressRow = progressByProvince.get(province.id) ?? {
      province_id: province.id,
      caught_count: 0,
      total_count: normalTotal,
      pct: 0,
    };

    return { province, progress: provinceProgress, cards };
  });
}
