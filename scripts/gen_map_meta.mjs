// korea_map_data.min.json(841KB)에서 지도 렌더에 실제로 쓰는 부분만 추출해
// korea_map_meta.min.json(~47KB)을 재생성한다. RegionMap은 main_map_bounds + hidden_areas만
// 읽는데, 원본은 안 쓰는 regions 배열(파일의 94% ≈ 791KB)까지 client 번들에 싣고 있었다.
// 시군구 폴리곤은 별도의 korea_municipalities.min.json이 담당하므로 regions는 순수 죽은 무게.
//
// 실행: node scripts/gen_map_meta.mjs  (원본 files/*.json은 수정하지 않음, §22)
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = JSON.parse(readFileSync(join(root, 'files/korea_map_data.min.json'), 'utf8'))

// RegionMap은 hidden_areas의 real_geometry를 읽지 않는다(real_point만) → 폴리곤 strip(~40KB 절감)
const hidden_areas = src.hidden_areas.map(({ real_geometry, ...rest }) => rest)
const meta = { main_map_bounds: src.main_map_bounds, hidden_areas }
const out = join(root, 'files/korea_map_meta.min.json')
writeFileSync(out, JSON.stringify(meta))

console.log(`wrote ${out} (${JSON.stringify(meta).length} bytes, from ${JSON.stringify(src).length})`)
