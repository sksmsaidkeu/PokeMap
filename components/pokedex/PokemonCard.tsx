import type { PokedexCard } from "@/lib/game/pokedex-types";
import { PokemonSprite } from "./PokemonSprite";
import { typeColorClass } from "./type-colors";

type PokemonCardProps = {
  card: PokedexCard;
  onSelect: () => void;
};

function dexLabel(dexNo: number): string {
  return `No.${String(dexNo).padStart(4, "0")}`;
}

// 누적 포획 횟수에 따른 카드 프레임 색(50+ 금 / 30+ 은 / 10+ 동). 미만이면 기본 검정.
// 임계값은 도감 표시 전용 연출값(밸런스 상수 아님).
function catchFrame(count: number): { color: string; label: string } | null {
  if (count >= 50) return { color: "#f5b301", label: "골드" };
  if (count >= 30) return { color: "#9aa3ad", label: "실버" };
  if (count >= 10) return { color: "#c67c3e", label: "브론즈" };
  return null;
}

export function PokemonCard({ card, onSelect }: PokemonCardProps) {
  const { entry, species } = card;

  // 미포획: 명도 0% 검은 실루엣 + 클릭/탭 인터랙션 완전 비활성화(PRD §8.5)
  if (entry === null) {
    return (
      <div
        aria-disabled="true"
        className="flex flex-col rounded-xl border-2 border-black bg-white p-2 opacity-90"
      >
        <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50">
          {/* alt를 ???로 두는 이유: 미포획 종 이름이 스크린리더로 새는 것 방지 */}
          <PokemonSprite dexNo={species.dex_no} alt="???" silhouette />
        </div>
        <div className="mt-2">
          <p className="text-[10px] font-medium text-zinc-400">???</p>
          <p className="text-sm font-bold text-zinc-400">???</p>
        </div>
      </div>
    );
  }

  // 누적 포획 프레임 — 색상은 동적 hex라 인라인 스타일(Tailwind JIT가 못 잡음)
  const frame = catchFrame(entry.catch_count);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex flex-col rounded-xl border-[3px] border-black bg-white p-2 text-left transition hover:-translate-y-0.5 hover:shadow-[2px_2px_0_0_#000]"
      style={frame ? { borderColor: frame.color, boxShadow: `2px 2px 0 0 ${frame.color}` } : undefined}
    >
      <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50">
        <PokemonSprite
          dexNo={species.dex_no}
          alt={species.name_kr}
          fallbackClass={typeColorClass(species.type1)}
        />
        {card.isLegendary && (
          <span className="absolute right-1 top-1 rounded bg-[#e3350d] px-1 text-[9px] font-bold text-white">
            전설
          </span>
        )}
        {frame && (
          <span
            className="absolute left-1 top-1 rounded px-1 text-[9px] font-bold text-white"
            style={{ backgroundColor: frame.color }}
          >
            {frame.label}
          </span>
        )}
        {entry.catch_count > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
            x{entry.catch_count}
          </span>
        )}
      </div>
      <div className="mt-2">
        <p className="text-[10px] font-medium text-zinc-500">{dexLabel(species.dex_no)}</p>
        <p className="truncate text-sm font-bold text-black">{species.name_kr}</p>
      </div>
    </button>
  );
}
