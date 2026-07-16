import type { PokedexEntryRow, PokedexProvinceGroup } from "@/lib/game/pokedex-types";

// 로그인/포획 플로우(메인 파트)가 준비되기 전, 도감의 완성도별 화면을 확인하기 위한 더미.
// 실제 유저 데이터를 만들지 않고, 실 마스터 데이터(전부 Locked) 위에 포획 상태만 합성한다.
export type PreviewLevel = "full" | "half" | "newbie";

export function isPreviewLevel(v: string | undefined): v is PreviewLevel {
  return v === "full" || v === "half" || v === "newbie";
}

const CAUGHT_AT = "2026-07-01T00:00:00.000Z"; // 고정 더미값(비결정성 방지)

function caughtEntry(dexNo: number): PokedexEntryRow {
  return { dex_no: dexNo, first_caught_at: CAUGHT_AT, catch_count: 1 };
}

// full: 전설 포함 전량 포획 / half: 일반종 절반(짝수 인덱스) / newbie: 첫 도의 앞 2마리만
function shouldCatch(
  level: PreviewLevel,
  isLegendary: boolean,
  normalIndex: number,
  groupIndex: number,
): boolean {
  switch (level) {
    case "full":
      return true;
    case "half":
      return !isLegendary && normalIndex % 2 === 0;
    case "newbie":
      return groupIndex === 0 && !isLegendary && normalIndex < 2;
  }
}

export function applyPreview(
  groups: PokedexProvinceGroup[],
  level: PreviewLevel,
): PokedexProvinceGroup[] {
  return groups.map((group, groupIndex) => {
    let normalIndex = 0;
    const cards = group.cards.map((card) => {
      const caught = shouldCatch(level, card.isLegendary, normalIndex, groupIndex);
      if (!card.isLegendary) normalIndex += 1;
      return { ...card, entry: caught ? caughtEntry(card.species.dex_no) : null };
    });

    // 진행률은 일반종만 분모(전설 제외) — DB.md §7 v_user_province_progress와 동일 규칙
    const total = cards.filter((c) => !c.isLegendary).length;
    const caught = cards.filter((c) => !c.isLegendary && c.entry !== null).length;
    return {
      ...group,
      cards,
      progress: {
        province_id: group.province.id,
        total_count: total,
        caught_count: caught,
        pct: total === 0 ? 0 : caught / total,
      },
    };
  });
}
