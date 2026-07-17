"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { PokedexCard, PokedexProvinceGroup } from "@/lib/game/pokedex-types";
import { ProvinceSection } from "./ProvinceSection";
import { PokemonDetailModal } from "./PokemonDetailModal";

type PokedexBrowserProps = {
  groups: PokedexProvinceGroup[];
  caughtCount: number;
};

export function PokedexBrowser({ groups, caughtCount }: PokedexBrowserProps) {
  const [selected, setSelected] = useState<PokedexCard | null>(null);
  const [query, setQuery] = useState("");

  // 이름 검색: 매칭 카드만 남기고, 남은 카드가 없는 도 그룹은 숨김(DESIGN.md §2.3①)
  const filtered = useMemo(() => {
    const q = query.trim();
    if (!q) return groups;
    return groups
      .map((group) => ({
        ...group,
        cards: group.cards.filter((c) => c.species.name_kr.includes(q)),
      }))
      .filter((group) => group.cards.length > 0);
  }, [groups, query]);

  return (
    <div className="min-h-full bg-[#F0F0F0] p-4">
      <div className="mx-auto max-w-3xl rounded-2xl border-2 border-black bg-white p-4 shadow-[4px_4px_0_0_#000] sm:p-6">
        {/* 헤더: 뒤로가기 + 검색 입력 + 돋보기 (DESIGN.md §2.3①) */}
        <form
          className="mb-4 flex items-center gap-2"
          onSubmit={(e) => e.preventDefault()}
          role="search"
        >
          {/* 터치 타깃 44px 이상(PRD §23) — h-11/w-11 고정 */}
          <Link
            href="/map"
            aria-label="지도로 돌아가기"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#e3350d] font-bold text-white hover:brightness-110"
          >
            ‹
          </Link>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="포켓몬 이름 검색"
            className="h-11 w-40 min-w-0 rounded-lg border-2 border-black px-3 text-base outline-none focus:ring-2 focus:ring-[#e3350d] sm:w-56"
          />
          <button
            type="submit"
            aria-label="검색"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#c9a86a] text-white hover:brightness-110"
          >
            🔍
          </button>
          {/* 4차 검증 반영: 검색 버튼 오른쪽, 도감 칸 우측 상단 끝에 포획 수만 표시(트레이너 정보 없이) */}
          <span
            role="status"
            aria-label={`포획한 포켓몬 ${caughtCount}마리`}
            className="ml-auto flex items-center gap-1 text-sm font-bold text-black"
          >
            <span className="pokeball" style={{ width: 18, height: 18 }} aria-hidden />
            {caughtCount}마리
          </span>
        </form>

        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">검색 결과가 없습니다</p>
        ) : (
          filtered.map((group) => (
            <ProvinceSection key={group.province.id} group={group} onSelectCard={setSelected} />
          ))
        )}
      </div>
      {selected && <PokemonDetailModal card={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
