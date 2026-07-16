import type { PokedexProvinceGroup } from "@/lib/game/pokedex-types";

// 실제 Supabase 연동 전까지 화면만 검증하기 위한 목업 — pokemon.csv 실 데이터 기반.
// 연동 시 이 파일은 삭제하고 app/pokedex/page.tsx에서 Supabase 조회로 대체한다.
export const MOCK_PROVINCE_GROUPS: PokedexProvinceGroup[] = [
  {
    province: { id: 1, name: "서울특별시", legendary_dex_no: 150 },
    progress: { province_id: 1, caught_count: 4, total_count: 7, pct: 4 / 7 },
    cards: [
      {
        isLegendary: false,
        entry: { dex_no: 25, first_caught_at: "2026-06-01T09:00:00Z", catch_count: 3 },
        species: { dex_no: 25, name_kr: "피카츄", type1: "electric", type2: null, bst: 320, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: { dex_no: 6, first_caught_at: "2026-06-02T09:00:00Z", catch_count: 1 },
        species: { dex_no: 6, name_kr: "리자몽", type1: "fire", type2: "flying", bst: 534, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 3, name_kr: "이상해꽃", type1: "grass", type2: "poison", bst: 525, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: { dex_no: 9, first_caught_at: "2026-06-03T09:00:00Z", catch_count: 1 },
        species: { dex_no: 9, name_kr: "거북왕", type1: "water", type2: null, bst: 530, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: { dex_no: 133, first_caught_at: "2026-06-04T09:00:00Z", catch_count: 5 },
        species: { dex_no: 133, name_kr: "이브이", type1: "normal", type2: null, bst: 325, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 143, name_kr: "잠만보", type1: "normal", type2: null, bst: 540, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 130, name_kr: "갸라도스", type1: "water", type2: "flying", bst: 540, flavor_text: null },
      },
      {
        isLegendary: true,
        entry: null,
        species: { dex_no: 150, name_kr: "뮤츠", type1: "psychic", type2: null, bst: 680, flavor_text: null },
      },
    ],
  },
  {
    province: { id: 9, name: "경기도", legendary_dex_no: 144 },
    progress: { province_id: 9, caught_count: 2, total_count: 7, pct: 2 / 7 },
    cards: [
      {
        isLegendary: false,
        entry: { dex_no: 123, first_caught_at: "2026-06-10T09:00:00Z", catch_count: 1 },
        species: { dex_no: 123, name_kr: "스라크", type1: "bug", type2: "flying", bst: 500, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: { dex_no: 124, first_caught_at: "2026-06-11T09:00:00Z", catch_count: 2 },
        species: { dex_no: 124, name_kr: "루주라", type1: "ice", type2: "psychic", bst: 455, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 12, name_kr: "버터플", type1: "bug", type2: "flying", bst: 395, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 15, name_kr: "독침붕", type1: "bug", type2: "poison", bst: 395, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 18, name_kr: "피죤투", type1: "normal", type2: "flying", bst: 479, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 20, name_kr: "레트라", type1: "normal", type2: null, bst: 413, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 34, name_kr: "니드킹", type1: "poison", type2: "ground", bst: 505, flavor_text: null },
      },
      {
        isLegendary: true,
        entry: null,
        species: { dex_no: 144, name_kr: "프리져", type1: "ice", type2: "flying", bst: 580, flavor_text: null },
      },
    ],
  },
  {
    // 섬 최종 히든 지역 — 내륙 전체 100% 완료 전까지 진입 자체가 불가하므로 항상 0%/전체 잠김으로 보여야 한다(PRD §20)
    province: { id: 17, name: "제주도", legendary_dex_no: null },
    progress: { province_id: 17, caught_count: 0, total_count: 3, pct: 0 },
    cards: [
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 779, name_kr: "치갈기", type1: "water", type2: "psychic", bst: 475, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 780, name_kr: "할비롱", type1: "normal", type2: "dragon", bst: 485, flavor_text: null },
      },
      {
        isLegendary: false,
        entry: null,
        species: { dex_no: 781, name_kr: "타타륜", type1: "ghost", type2: "grass", bst: 517, flavor_text: null },
      },
    ],
  },
];
