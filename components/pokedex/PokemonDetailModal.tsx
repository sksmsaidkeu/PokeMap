import type { PokedexCard } from "@/lib/game/pokedex-types";
import { PokemonSprite } from "./PokemonSprite";
import { typeBadgeClass, typeColorClass } from "./type-colors";

type PokemonDetailModalProps = {
  card: PokedexCard;
  onClose: () => void;
};

const PLACEHOLDER = "준비 중"; // height/weight/ability는 아직 DB에 값이 없어 플레이스홀더 처리

function dexLabel(dexNo: number): string {
  return `No.${String(dexNo).padStart(4, "0")}`;
}

// 몬스터볼 아이콘 — 별도 애셋 없이 CSS만으로 구성(적/백/흑 조합)
function PokeballIcon() {
  return (
    <div className="relative h-8 w-8 overflow-hidden rounded-full border-2 border-black bg-white">
      <div className="h-1/2 w-full bg-[#e3350d]" />
      <div className="absolute top-1/2 left-0 h-1 w-full -translate-y-1/2 bg-black" />
      <div className="absolute top-1/2 left-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white" />
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">{label}</dt>
      <dd className="text-sm font-bold text-black">{value}</dd>
    </div>
  );
}

export function PokemonDetailModal({ card, onClose }: PokemonDetailModalProps) {
  const { species, entry } = card;
  if (!entry) return null; // Locked 카드는 애초에 열리지 않지만 타입 안전을 위해 방어

  const types = [species.type1, species.type2].filter((t): t is string => Boolean(t));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#5b4b8a]/80 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-sm flex-col gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 최상단 박스: 빨간 헤더 + 기본 정보 */}
        <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
          <div className="flex items-center justify-between bg-[#e3350d] px-3 py-2">
            <div className="flex items-center gap-2">
              <PokeballIcon />
              <span className="text-xs font-bold text-white">{dexLabel(species.dex_no)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-white/70 px-2 py-0.5 text-xs font-bold text-white hover:bg-white/20"
            >
              닫기
            </button>
          </div>
          <div className="flex items-center gap-3 p-4">
            <div className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-lg bg-zinc-50">
              <PokemonSprite
                dexNo={species.dex_no}
                alt={species.name_kr}
                fallbackClass={typeColorClass(species.type1)}
              />
            </div>
            <div>
              <h2 className="flex items-center gap-2 text-lg font-bold text-black">
                {species.name_kr}
                {card.isLegendary && (
                  <span className="rounded bg-[#e3350d] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    전설
                  </span>
                )}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {types.map((t) => (
                  <span key={t} className={typeBadgeClass(t)}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 중간 박스: 요약 정보 2단 그리드(회색 구분선) */}
        <dl className="grid grid-cols-2 divide-x divide-y divide-zinc-200 overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
          <InfoCell label="키" value={PLACEHOLDER} />
          <InfoCell label="몸무게" value={PLACEHOLDER} />
          <InfoCell label="특성" value={PLACEHOLDER} />
          <InfoCell label="종족값 합" value={String(species.bst)} />
          <InfoCell
            label="최초 포획"
            value={new Date(entry.first_caught_at).toLocaleDateString("ko-KR")}
          />
          <InfoCell label="포획 횟수" value={String(entry.catch_count)} />
        </dl>

        {/* 하단 박스: 좌우 빨간 캡슐 사이드바 + 플레이버 텍스트 */}
        <div className="flex overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
          <div className="w-2 shrink-0 bg-[#e3350d]" />
          <p className="flex-1 p-4 text-sm leading-relaxed text-zinc-600">
            {species.flavor_text ?? "도감 설명 준비 중"}
          </p>
          <div className="w-2 shrink-0 bg-[#e3350d]" />
        </div>
      </div>
    </div>
  );
}
