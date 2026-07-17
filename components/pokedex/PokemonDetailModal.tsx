"use client";

import { useEffect, useRef } from "react";
import type { PokedexCard } from "@/lib/game/pokedex-types";
import { PokemonSprite } from "./PokemonSprite";
import { typeBadgeClass, typeColorClass } from "./type-colors";

type PokemonDetailModalProps = {
  card: PokedexCard;
  onClose: () => void;
};

const PLACEHOLDER = "준비 중"; // 일부 최신세대는 PokeAPI에 값 자체가 없어 폴백 처리

function dexLabel(dexNo: number): string {
  return `No.${String(dexNo).padStart(4, "0")}`;
}

// height_dm/weight_hg는 PokeAPI 단위(decimetre/hectogram) 그대로 저장 — 표시 시 m/kg로 환산(DB.md §4.7)
function formatHeight(heightDm: number | null): string {
  return heightDm == null ? PLACEHOLDER : `${(heightDm / 10).toFixed(1)}m`;
}

function formatWeight(weightHg: number | null): string {
  return weightHg == null ? PLACEHOLDER : `${(weightHg / 10).toFixed(1)}kg`;
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // 접근성(PRD §23): 열릴 때만 포커스 이동 + 닫힐 때 원래 위치로 복원 + 배경 스크롤 잠금.
  // 마운트 시 1회만 실행([] 의존성) — onClose에 걸면 부모 리렌더마다 포커스가 다시 끌려가 입력을 방해함.
  useEffect(() => {
    const prevActive = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      prevActive?.focus(); // 카드 그리드의 원래 위치로 포커스 복원
    };
  }, []);

  // ESC 닫기 + Tab 포커스 트랩(aria-modal 약속대로 포커스를 다이얼로그 안에 가둠)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = dialogRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
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
  }, [onClose]);

  if (!entry) return null; // Locked 카드는 애초에 열리지 않지만 타입 안전을 위해 방어

  const types = [species.type1, species.type2].filter((t): t is string => Boolean(t));

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${species.name_kr} 상세 정보`}
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
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="min-h-11 min-w-11 rounded border border-white/70 px-3 text-xs font-bold text-white hover:bg-white/20"
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
          <InfoCell label="키" value={formatHeight(species.height_dm)} />
          <InfoCell label="몸무게" value={formatWeight(species.weight_hg)} />
          <InfoCell label="특성" value={species.primary_ability ?? PLACEHOLDER} />
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
