"""도감 상세 팝업용 필드(키/몸무게/특성/도감설명) PokeAPI 수집기.

입력: pokemon_species.csv (dex_no, name_en — supabase_species_export.py로 DB에서 내보냄)
출력: pokemon_details.csv (dex_no, height_dm, weight_hg, primary_ability, flavor_text)
      + supabase/migrations/<timestamp>_pokemon_species_details.sql (ALTER + UPDATE)

재실행 시 pokemon_details.csv에 이미 있는 dex_no는 재요청하지 않는다(캐시) — PokeAPI 부하 최소화.
"""
import csv
import json
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone

API = "https://pokeapi.co/api/v2"
DETAILS_CSV = "pokemon_details.csv"
SPECIES_CSV = "pokemon_species_export.csv"

# 한글 로컬라이즈가 비교적 온전한 최신 버전부터 우선 탐색 — 없으면 발견되는 첫 ko 항목으로 폴백
VERSION_PRIORITY = [
    "scarlet", "violet", "sword", "shield", "ultra-sun", "ultra-moon",
    "sun", "moon", "omega-ruby", "alpha-sapphire", "x", "y",
]

_ability_ko_cache = {}


def fetch_json(url, retries=3):
    req = urllib.request.Request(url, headers={"User-Agent": "pokemap-pokedex-data/1.0"})
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                return json.loads(res.read())
        except (urllib.error.URLError, urllib.error.HTTPError) as e:
            if attempt == retries - 1:
                raise
            time.sleep(1.5 * (attempt + 1))


def pick_flavor_text(species_json):
    ko_entries = [e for e in species_json["flavor_text_entries"] if e["language"]["name"] == "ko"]
    if not ko_entries:
        return None
    by_version = {e["version"]["name"]: e["flavor_text"] for e in ko_entries}
    for v in VERSION_PRIORITY:
        if v in by_version:
            text = by_version[v]
            break
    else:
        text = ko_entries[0]["flavor_text"]
    return text.replace("\n", " ").replace("\f", " ").replace("­", "").strip()


def ability_ko_name(slug):
    if slug not in _ability_ko_cache:
        data = fetch_json(f"{API}/ability/{slug}")
        ko = next((n["name"] for n in data["names"] if n["language"]["name"] == "ko"), slug)
        _ability_ko_cache[slug] = ko
    return _ability_ko_cache[slug]


def fetch_one(dex_no, name_en):
    pokemon = fetch_json(f"{API}/pokemon/{name_en}")
    # 폼 변형(-standard/-male/-midday 등)은 /pokemon-species/{name_en}에 없다 —
    # /pokemon 응답의 species.name(폼 접미사 없는 기본 종 슬러그)으로 조회
    species = fetch_json(f"{API}/pokemon-species/{pokemon['species']['name']}")

    non_hidden = sorted(
        (a for a in pokemon["abilities"] if not a["is_hidden"]),
        key=lambda a: a["slot"],
    )
    ability_slug = (non_hidden or pokemon["abilities"])[0]["ability"]["name"]

    return {
        "dex_no": dex_no,
        "height_dm": pokemon["height"],
        "weight_hg": pokemon["weight"],
        "primary_ability": ability_ko_name(ability_slug),
        "flavor_text": pick_flavor_text(species) or "",
    }


def load_cached():
    try:
        with open(DETAILS_CSV, encoding="utf-8") as f:
            return {int(r["dex_no"]): r for r in csv.DictReader(f)}
    except FileNotFoundError:
        return {}


def sql_str(value):
    return "'" + str(value).replace("'", "''") + "'"


def sql_opt_str(value):
    return "NULL" if value is None or value == "" else sql_str(value)


def main():
    with open(SPECIES_CSV, encoding="utf-8-sig") as f:
        targets = [(int(r["dex_no"]), r["name_en"]) for r in csv.DictReader(f)]

    cached = load_cached()
    todo = [(d, n) for d, n in targets if d not in cached]
    print(f"total {len(targets)}, cached {len(cached)}, fetching {len(todo)}")

    results = dict(cached)
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fetch_one, d, n): (d, n) for d, n in todo}
        done = 0
        for fut in as_completed(futures):
            d, n = futures[fut]
            try:
                results[d] = fut.result()
            except Exception as e:
                print(f"FAILED dex_no={d} ({n}): {e}", file=sys.stderr)
            done += 1
            if done % 25 == 0:
                print(f"  {done}/{len(todo)}")

    rows = [results[d] for d, _ in targets if d in results]
    missing = [d for d, _ in targets if d not in results]
    if missing:
        print(f"WARNING: missing dex_no after fetch: {missing}", file=sys.stderr)

    with open(DETAILS_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["dex_no", "height_dm", "weight_hg", "primary_ability", "flavor_text"])
        w.writeheader()
        for r in sorted(rows, key=lambda r: int(r["dex_no"])):
            w.writerow(r)

    values_sql = ",\n".join(
        f"  ({r['dex_no']}, {r['height_dm']}, {r['weight_hg']}, "
        f"{sql_opt_str(r['primary_ability'])}, {sql_opt_str(r['flavor_text'])})"
        for r in sorted(rows, key=lambda r: int(r["dex_no"]))
    )

    migration = f"""-- 시드 데이터: fetch_pokemon_details.py 산출물(PokeAPI). 재생성 시 pokemon_details.csv를 지우고 스크립트 재실행.
alter table pokemon_species
  add column if not exists height_dm smallint,
  add column if not exists weight_hg smallint,
  add column if not exists primary_ability text;

update pokemon_species as p
set height_dm = v.height_dm,
    weight_hg = v.weight_hg,
    primary_ability = v.primary_ability,
    flavor_text = coalesce(v.flavor_text, p.flavor_text)
from (values
{values_sql}
) as v(dex_no, height_dm, weight_hg, primary_ability, flavor_text)
where p.dex_no = v.dex_no;
"""

    ts = sys.argv[1] if len(sys.argv) > 1 else datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    out_path = f"supabase/migrations/{ts}_pokemon_species_details.sql"
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(migration)

    print(f"rows: {len(rows)}, written: {out_path}")


if __name__ == "__main__":
    main()
