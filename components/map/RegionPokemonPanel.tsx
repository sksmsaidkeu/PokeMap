'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { PokemonSprite } from '@/components/pokedex/PokemonSprite'
import {
  getRegionSpawnStatus,
  type RegionSpawnStatusEntry,
} from '@/lib/game/regionSpawnStatus'

export type RegionPokemonPanelProps = {
  cityId: number | null
  onClose: () => void
}

// 지도에서 시 이름 클릭 → 그 시 서식 포켓몬 실루엣 목록(PRD §8.2 "정보 보기").
// 확률/포획 로직 없는 단순 조회라 서버 판정 이슈 없음(§22) — 뷰가 이미 RLS로 caught 여부를 재검증한다.
export function RegionPokemonPanel({ cityId, onClose }: RegionPokemonPanelProps) {
  const [entries, setEntries] = useState<RegionSpawnStatusEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (cityId == null) return
    let cancelled = false
    setLoading(true)
    setErrorMessage(null)
    getRegionSpawnStatus(cityId).then(({ data, error }) => {
      if (cancelled) return
      setLoading(false)
      if (error) {
        setErrorMessage(error.message)
        setEntries([])
        return
      }
      setEntries([...data].sort((a, b) => (a.dex_no ?? 0) - (b.dex_no ?? 0)))
    })
    return () => {
      cancelled = true
    }
  }, [cityId])

  return (
    <Modal open={cityId != null} onClose={onClose}>
      <div className="flex max-h-[70vh] flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-black">이 지역 서식 포켓몬</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded border border-black px-3 text-xs font-bold text-black hover:bg-zinc-100"
          >
            닫기
          </button>
        </div>

        {loading && <p className="text-sm text-zinc-500">불러오는 중...</p>}
        {!loading && errorMessage && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}
        {!loading && !errorMessage && entries.length === 0 && (
          <p className="text-sm text-zinc-500">정보 없음</p>
        )}
        {!loading && !errorMessage && entries.length > 0 && (
          <ul className="grid grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
            {entries.map((entry) => (
              <li key={entry.dex_no}>
                <RegionPokemonItem entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function RegionPokemonItem({ entry }: { entry: RegionSpawnStatusEntry }) {
  const caught = entry.caught === true
  const catchCount = entry.catch_count ?? 0
  // 미포획: 도감 PokemonCard와 동일하게 이름을 "???"로 숨겨 스크린리더로 새지 않게 한다
  const name = caught ? (entry.pokemon_species?.name_kr ?? '???') : '???'
  const label = caught
    ? `${name}${entry.is_legendary ? ' (전설)' : ''}, 포획 ${catchCount}회`
    : `미포획 포켓몬${entry.is_legendary ? ' (전설)' : ''}`

  return (
    <div
      aria-label={label}
      className="flex flex-col rounded-xl border-2 border-black bg-white p-2"
    >
      <div className="relative flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-50">
        <PokemonSprite dexNo={entry.dex_no ?? 0} alt={name} silhouette={!caught} />
        {entry.is_legendary && (
          <span className="absolute right-1 top-1 rounded bg-[#e3350d] px-1 text-[9px] font-bold text-white">
            전설
          </span>
        )}
        {caught && catchCount > 1 && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[9px] font-bold text-white">
            x{catchCount}
          </span>
        )}
      </div>
      <p className="mt-1 truncate text-xs font-bold text-black">{name}</p>
    </div>
  )
}
