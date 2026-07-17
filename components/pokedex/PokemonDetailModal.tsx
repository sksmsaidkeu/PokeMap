"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { EvolutionMember, PokedexCard, PokedexEntryRow } from "@/lib/game/pokedex-types";
import { PokemonSprite } from "./PokemonSprite";
import { typeBadgeClass, typeColorClass } from "./type-colors";

type PokemonDetailModalProps = {
  card: PokedexCard;
  onClose: () => void;
};

const PLACEHOLDER = "준비 중"; // 일부 최신세대는 PokeAPI에 값 자체가 없어 폴백 처리

// 캐러셀 각 패널 데이터 — 진화 라인 멤버(clicked 카드 포함) + 유저 포획 정보
type Panel = {
  species: EvolutionMember;
  entry: PokedexEntryRow | null;
  isLegendary: boolean;
};

function dexLabel(dexNo: number): string {
  return `No.${String(dexNo).padStart(4, "0")}`;
}

// 종족값(BST)에 따른 볼 등급 — 포켓몬 강함 표시용(유저 등급 배지 PRD §17과 별개, 선택 UI 아님).
// 임계값은 도감 표시 전용 연출값(밸런스 상수 아님).
function bstBall(bst: number): { label: string; color: string } {
  if (bst >= 600) return { label: "마스터볼", color: "#7c4dff" };
  if (bst >= 500) return { label: "하이퍼볼", color: "#f5b301" };
  if (bst >= 400) return { label: "수퍼볼", color: "#2f7fe0" };
  return { label: "몬스터볼", color: "#e3350d" };
}

// height_dm/weight_hg는 PokeAPI 단위(decimetre/hectogram) — 표시 시 m/kg로 환산(DB.md §4.7)
function formatHeight(heightDm: number | null): string {
  return heightDm == null ? PLACEHOLDER : `${(heightDm / 10).toFixed(1)}m`;
}
function formatWeight(weightHg: number | null): string {
  return weightHg == null ? PLACEHOLDER : `${(weightHg / 10).toFixed(1)}kg`;
}

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

// 진화 라인 한 폼의 상세 카드(3-박스). 캐러셀 각 패널이 이 컴포넌트를 렌더한다.
function DetailPanel({ panel }: { panel: Panel }) {
  const { species, entry, isLegendary } = panel;
  const types = [species.type1, species.type2].filter((t): t is string => Boolean(t));
  // 종족값 등급 — 헤더/사이드바 색감을 등급색으로 통일(task 4)
  const ball = bstBall(species.bst);

  return (
    <div className="flex w-full shrink-0 flex-col gap-3 px-0.5">
      {/* 최상단: 등급색 헤더(도감번호 + 볼 등급) + 스프라이트 + 이름/타입 */}
      <div className="overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <div className="flex items-center gap-2 px-3 py-2" style={{ backgroundColor: ball.color }}>
          <PokeballIcon />
          <span className="text-xs font-bold text-white">{dexLabel(species.dex_no)}</span>
          <span className="ml-auto flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold">
            <span
              aria-hidden
              className="h-3 w-3 rounded-full border border-black"
              style={{ backgroundColor: ball.color }}
            />
            <span style={{ color: ball.color }}>{ball.label}</span>
          </span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white">
            {entry ? "포획" : "미포획"}
          </span>
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
              {isLegendary && (
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

      {/* 중간: 요약 정보 2단 그리드 */}
      <dl className="grid grid-cols-2 divide-x divide-y divide-zinc-200 overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <InfoCell label="키" value={formatHeight(species.height_dm)} />
        <InfoCell label="몸무게" value={formatWeight(species.weight_hg)} />
        <InfoCell label="특성" value={species.primary_ability ?? PLACEHOLDER} />
        <InfoCell label="종족값 합" value={String(species.bst)} />
        <InfoCell
          label="최초 포획"
          value={entry ? new Date(entry.first_caught_at).toLocaleDateString("ko-KR") : "미포획"}
        />
        <InfoCell label="포획 횟수" value={entry ? String(entry.catch_count) : "-"} />
      </dl>

      {/* 하단: 플레이버 텍스트(사이드바도 등급색) */}
      <div className="flex overflow-hidden rounded-xl border-2 border-black bg-white shadow-[4px_4px_0_0_#000]">
        <div className="w-2 shrink-0" style={{ backgroundColor: ball.color }} />
        <p className="flex-1 p-4 text-sm leading-relaxed text-zinc-600">
          {species.flavor_text ?? "도감 설명 준비 중"}
        </p>
        <div className="w-2 shrink-0" style={{ backgroundColor: ball.color }} />
      </div>
    </div>
  );
}

export function PokemonDetailModal({ card, onClose }: PokemonDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef<number | null>(null);

  // 초기엔 클릭한 포켓몬 1장만(로딩 중 깜빡임 방지). 진화 라인 로드되면 교체.
  const [panels, setPanels] = useState<Panel[]>([
    { species: card.species, entry: card.entry, isLegendary: card.isLegendary },
  ]);
  const [index, setIndex] = useState(0);

  // 접근성(PRD §23): 열릴 때 포커스 이동 + 닫힐 때 복원 + 배경 스크롤 잠금. 마운트 1회만.
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      prevActive?.focus();
    };
  }, []);

  // 진화 라인 로드: 같은 evo_chain_id의 전 멤버 + 유저 포획 정보(RLS로 본인 것만).
  useEffect(() => {
    const chainId = card.species.evo_chain_id;
    if (chainId == null) return; // 체인 없음 — 단독 표시 유지
    let cancelled = false;

    (async () => {
      const supabase = createClient();
      const { data: members } = await supabase
        .from("pokemon_species")
        .select(
          "dex_no,name_kr,type1,type2,bst,flavor_text,height_dm,weight_hg,primary_ability,evo_stage",
        )
        .eq("evo_chain_id", chainId)
        .order("evo_stage")
        .order("dex_no")
        .returns<EvolutionMember[]>();
      if (cancelled || !members || members.length === 0) return;

      const dexNos = members.map((m) => m.dex_no);
      const { data: caught } = await supabase
        .from("user_pokedex")
        .select("dex_no,first_caught_at,catch_count")
        .in("dex_no", dexNos)
        .returns<PokedexEntryRow[]>();
      const caughtByDex = new Map((caught ?? []).map((e) => [e.dex_no, e]));

      const next: Panel[] = members.map((m) => ({
        species: m,
        // 프리뷰 등으로 클릭 카드에 entry가 있으면 그것도 반영
        entry:
          caughtByDex.get(m.dex_no) ??
          (m.dex_no === card.species.dex_no ? card.entry : null),
        isLegendary: m.dex_no === card.species.dex_no && card.isLegendary,
      }));
      if (cancelled) return;
      setPanels(next);
      setIndex(Math.max(0, next.findIndex((p) => p.species.dex_no === card.species.dex_no)));
    })();

    return () => {
      cancelled = true;
    };
  }, [card]);

  const count = panels.length;
  const go = (next: number) => setIndex(Math.min(count - 1, Math.max(0, next)));

  // ESC 닫기 + ←/→ 진화 이동 + Tab 포커스 트랩
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight") return setIndex((i) => Math.min(count - 1, i + 1));
      if (e.key === "ArrowLeft") return setIndex((i) => Math.max(0, i - 1));
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const f = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, count]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${card.species.name_kr} 상세 정보`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#5b4b8a]/80 p-4"
      onClick={onClose}
    >
      <div className="flex w-full max-w-sm flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        {/* 진화 라인 내비게이션(멤버 2 이상일 때만) — 미니 스프라이트 + 화살표, 현재 폼 강조 */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-1 rounded-xl border-2 border-black bg-white p-2 shadow-[4px_4px_0_0_#000]">
            {panels.map((p, i) => (
              <div key={p.species.dex_no} className="flex items-center">
                {i > 0 && <span className="px-0.5 text-xs font-bold text-zinc-400">▶</span>}
                <button
                  type="button"
                  aria-label={`${p.species.name_kr}(으)로 이동`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                  className={`relative h-11 w-11 rounded-lg border-2 ${
                    i === index ? "border-[#e3350d] bg-[#fff2ef]" : "border-transparent bg-zinc-50"
                  }`}
                >
                  <PokemonSprite
                    dexNo={p.species.dex_no}
                    alt={p.species.name_kr}
                    fallbackClass={typeColorClass(p.species.type1)}
                  />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 캐러셀: 좌우 스와이프/화살표로 진화 폼 이동 */}
        <div
          className="overflow-hidden"
          onTouchStart={(e) => {
            touchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchStartX.current;
            if (dx <= -40) go(index + 1);
            else if (dx >= 40) go(index - 1);
            touchStartX.current = null;
          }}
        >
          <div
            className="flex transition-transform duration-300"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {panels.map((p) => (
              <DetailPanel key={p.species.dex_no} panel={p} />
            ))}
          </div>
        </div>

        {/* 하단 컨트롤: 이전/닫기/다음 */}
        <div className="flex items-center gap-2">
          {count > 1 ? (
            <button
              type="button"
              aria-label="이전 진화"
              disabled={index === 0}
              onClick={() => go(index - 1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white font-bold text-black disabled:opacity-30"
            >
              ‹
            </button>
          ) : (
            <span className="w-11 shrink-0" />
          )}
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border-2 border-black bg-[#e3350d] text-sm font-bold text-white hover:brightness-110"
          >
            닫기
          </button>
          {count > 1 ? (
            <button
              type="button"
              aria-label="다음 진화"
              disabled={index === count - 1}
              onClick={() => go(index + 1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-black bg-white font-bold text-black disabled:opacity-30"
            >
              ›
            </button>
          ) : (
            <span className="w-11 shrink-0" />
          )}
        </div>
      </div>
    </div>
  );
}
