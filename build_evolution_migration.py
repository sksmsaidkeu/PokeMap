"""진화 데이터 마이그레이션 생성기.

입력: pokemon_evolutions.csv (dex_no, chain_id, stage, name_kr, name_en) — 538 멤버 전체
      evolution_missing_dex.json (146) — DB에 없는 진화 멤버
출력: supabase/migrations/<ts>_pokemon_evolutions.sql
      + public/sprites/pokemon/<dex>.png (146종 신규 다운로드)

- pokemon_species에 evo_chain_id/evo_stage 컬럼 추가
- 146 신규 종 INSERT(type1/bst NOT NULL이라 상세 조회 필수)
- 538 전 멤버 evo_chain_id/evo_stage UPDATE
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

API = "https://pokeapi.co/api/v2"
SPRITE_URL = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{dex}.png"
EVO_CSV = "pokemon_evolutions.csv"
MISSING_JSON = "evolution_missing_dex.json"
SPRITE_DIR = "public/sprites/pokemon"

VERSION_PRIORITY = ["scarlet", "violet", "sword", "shield", "ultra-sun", "ultra-moon",
                    "sun", "moon", "omega-ruby", "alpha-sapphire", "x", "y"]


def fetch_json(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "pokemap-evo/1.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=20) as res:
                return json.loads(res.read())
        except (urllib.error.URLError, urllib.error.HTTPError):
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def download_sprite(dex):
    path = f"{SPRITE_DIR}/{dex}.png"
    if os.path.exists(path):
        return True
    req = urllib.request.Request(SPRITE_URL.format(dex=dex), headers={"User-Agent": "pokemap-evo/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as res:
            data = res.read()
        with open(path, "wb") as f:
            f.write(data)
        return True
    except Exception as e:
        print(f"  sprite 실패 dex={dex}: {e}", file=sys.stderr)
        return False


def pick_flavor(species_json):
    ko = [e for e in species_json["flavor_text_entries"] if e["language"]["name"] == "ko"]
    if not ko:
        return None
    by_v = {e["version"]["name"]: e["flavor_text"] for e in ko}
    text = next((by_v[v] for v in VERSION_PRIORITY if v in by_v), ko[0]["flavor_text"])
    return text.replace("\n", " ").replace("\f", " ").replace("­", "").strip()


def ability_ko(slug, cache):
    if slug not in cache:
        d = fetch_json(f"{API}/ability/{slug}")
        cache[slug] = next((n["name"] for n in d["names"] if n["language"]["name"] == "ko"), slug)
    return cache[slug]


def fetch_detail(dex, name_en, cache):
    # 폼 변형 종(마우스홀드/팔라핀 등)은 /pokemon/{species_name}이 404 —
    # 종의 varieties에서 is_default 폼의 pokemon 슬러그로 조회.
    try:
        pk = fetch_json(f"{API}/pokemon/{name_en}")
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        sp0 = fetch_json(f"{API}/pokemon-species/{name_en}")
        default = next((v["pokemon"]["name"] for v in sp0["varieties"] if v["is_default"]),
                       sp0["varieties"][0]["pokemon"]["name"])
        pk = fetch_json(f"{API}/pokemon/{default}")
    sp = fetch_json(f"{API}/pokemon-species/{pk['species']['name']}")
    types = sorted(pk["types"], key=lambda t: t["slot"])
    non_hidden = sorted((a for a in pk["abilities"] if not a["is_hidden"]), key=lambda a: a["slot"])
    ability_slug = (non_hidden or pk["abilities"])[0]["ability"]["name"]
    return {
        "dex_no": dex,
        "type1": types[0]["type"]["name"],
        "type2": types[1]["type"]["name"] if len(types) > 1 else None,
        "bst": sum(s["base_stat"] for s in pk["stats"]),
        "height_dm": pk["height"],
        "weight_hg": pk["weight"],
        "primary_ability": ability_ko(ability_slug, cache),
        "flavor_text": pick_flavor(sp) or "",
    }


def sql_str(v):
    return "'" + str(v).replace("'", "''") + "'"


def sql_opt(v):
    return "NULL" if v is None or v == "" else sql_str(v)


def main():
    with open(EVO_CSV, encoding="utf-8-sig") as f:
        evo = list(csv.DictReader(f))  # 538 rows
    missing = set(json.load(open(MISSING_JSON)))
    name_en_by_dex = {int(r["dex_no"]): r["name_en"] for r in evo}
    name_kr_by_dex = {int(r["dex_no"]): r["name_kr"] for r in evo}

    # 1) 146 신규 종 상세 조회
    print(f"1/3 신규 {len(missing)}종 상세 조회...")
    cache = {}
    details = {}
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(fetch_detail, d, name_en_by_dex[d], cache): d for d in missing}
        done = 0
        for fut in as_completed(futs):
            d = futs[fut]
            try:
                details[d] = fut.result()
            except Exception as e:
                print(f"  상세 실패 dex={d}: {e}", file=sys.stderr)
            done += 1
            if done % 30 == 0:
                print(f"  {done}/{len(missing)}")

    # 2) 스프라이트 다운로드(146)
    print("2/3 스프라이트 다운로드...")
    ok = 0
    with ThreadPoolExecutor(max_workers=8) as pool:
        for r in as_completed([pool.submit(download_sprite, d) for d in missing]):
            ok += 1 if r.result() else 0
    print(f"  스프라이트: {ok}/{len(missing)}")

    # 3) 마이그레이션 SQL
    print("3/3 마이그레이션 생성...")
    new_rows = []
    for d in sorted(missing):
        if d not in details:
            print(f"  경고: dex={d} 상세 없음 — 건너뜀", file=sys.stderr)
            continue
        x = details[d]
        new_rows.append(
            f"  ({d}, {sql_str(name_en_by_dex[d])}, {sql_str(name_kr_by_dex[d])}, "
            f"{sql_str(x['type1'])}, {sql_opt(x['type2'])}, {x['bst']}, "
            f"{x['height_dm']}, {x['weight_hg']}, {sql_opt(x['primary_ability'])}, {sql_opt(x['flavor_text'])})"
        )

    evo_rows = sorted(((int(r["dex_no"]), int(r["chain_id"]), int(r["stage"])) for r in evo),
                      key=lambda t: t[0])
    evo_values = ",\n".join(f"  ({d}, {c}, {s})" for d, c, s in evo_rows)

    sql = f"""-- 진화 데이터: build_evolution_migration.py 산출물(PokeAPI).
-- 도감 상세의 진화 라인 표시용. 스폰풀에 없는 중간 진화형 {len(new_rows)}종도 함께 추가(표시 전용, 카드로는 노출 안 됨).
alter table pokemon_species
  add column if not exists evo_chain_id smallint,
  add column if not exists evo_stage smallint;

-- 신규 진화 멤버(스폰 대상 아님) — region_spawn_pool에 안 넣으므로 도감 카드/진행률엔 영향 없음.
insert into pokemon_species
  (dex_no, name_en, name_kr, type1, type2, bst, height_dm, weight_hg, primary_ability, flavor_text)
values
{",".join(chr(10) + r for r in new_rows)}
on conflict (dex_no) do nothing;

-- 전 진화 멤버 체인/단계 지정({len(evo_rows)}종)
update pokemon_species as p
set evo_chain_id = v.chain_id, evo_stage = v.stage
from (values
{evo_values}
) as v(dex_no, chain_id, stage)
where p.dex_no = v.dex_no;
"""
    ts = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    out = f"supabase/migrations/{ts}_pokemon_evolutions.sql"
    with open(out, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"\n신규 종: {len(new_rows)}, 진화 그룹 지정: {len(evo_rows)}")
    print(f"written: {out}")


if __name__ == "__main__":
    main()
