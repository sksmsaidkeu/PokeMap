"""포켓몬 진화 체인 수집기 (PokeAPI).

입력: pokemon_species_export.csv (dex_no, name_en) — DB에서 내보냄
출력: pokemon_evolutions.csv (dex_no, chain_id, stage, name_kr, name_en)
      + supabase/migrations/<ts>_pokemon_evolutions.sql (테이블 + 시드)

우리 보유 399종이 속한 모든 진화 체인의 전 멤버를 수집한다("전체 db 추가 가능").
체인 트리를 BFS로 평탄화해 stage(0=기본형, 1, 2...) 부여. 분기(이브이 등)는
같은 stage에 여러 멤버로 표현.
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
SPECIES_CSV = "pokemon_species_export.csv"
OUT_CSV = "pokemon_evolutions.csv"


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


def ko_name(species_json):
    ko = next((n["name"] for n in species_json["names"] if n["language"]["name"] == "ko"), None)
    return ko or species_json["name"]


def flatten_chain(node, stage, out):
    """진화 트리 재귀 평탄화 → [(species_name, stage), ...]"""
    out.append((node["species"]["name"], stage))
    for child in node["evolves_to"]:
        flatten_chain(child, stage + 1, out)


def main():
    with open(SPECIES_CSV, encoding="utf-8-sig") as f:
        targets = [(int(r["dex_no"]), r["name_en"]) for r in csv.DictReader(f)]

    # 1) 각 보유 종의 evolution_chain url 수집(체인 단위로 dedupe)
    chain_urls = {}  # chain_url -> chain_id

    def get_chain_url(name_en):
        sp = fetch_json(f"{API}/pokemon-species/{name_en}")
        return sp["evolution_chain"]["url"]

    print(f"1/3 체인 URL 수집 ({len(targets)}종)...")
    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(get_chain_url, n): d for d, n in targets}
        done = 0
        for fut in as_completed(futs):
            try:
                url = fut.result()
                cid = int(url.rstrip("/").rsplit("/", 1)[1])
                chain_urls[url] = cid
            except Exception as e:
                print(f"  chain url 실패 dex={futs[fut]}: {e}", file=sys.stderr)
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(targets)}")

    print(f"  고유 체인: {len(chain_urls)}개")

    # 2) 각 체인 평탄화 → 멤버 species name + stage
    print("2/3 체인 평탄화...")
    members = {}  # species_name -> (chain_id, stage)
    for url, cid in chain_urls.items():
        chain = fetch_json(url)
        flat = []
        flatten_chain(chain["chain"], 0, flat)
        for sname, stage in flat:
            # 같은 종이 여러 체인에 없음 — 첫 등장 유지
            if sname not in members:
                members[sname] = (cid, stage)

    print(f"  전체 진화 멤버(고유 종): {len(members)}개")

    # 3) 각 멤버의 dex_no + 한글명 조회
    print("3/3 멤버 dex_no/한글명 조회...")
    rows = []  # dict(dex_no, chain_id, stage, name_kr, name_en)

    def get_member(sname):
        sp = fetch_json(f"{API}/pokemon-species/{sname}")
        return {
            "dex_no": sp["id"],
            "name_kr": ko_name(sp),
            "name_en": sname,
        }

    with ThreadPoolExecutor(max_workers=8) as pool:
        futs = {pool.submit(get_member, sname): sname for sname in members}
        done = 0
        for fut in as_completed(futs):
            sname = futs[fut]
            cid, stage = members[sname]
            try:
                m = fut.result()
                rows.append({**m, "chain_id": cid, "stage": stage})
            except Exception as e:
                print(f"  멤버 실패 {sname}: {e}", file=sys.stderr)
            done += 1
            if done % 50 == 0:
                print(f"  {done}/{len(members)}")

    rows.sort(key=lambda r: (r["chain_id"], r["stage"], r["dex_no"]))

    with open(OUT_CSV, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["dex_no", "chain_id", "stage", "name_kr", "name_en"])
        w.writeheader()
        w.writerows(rows)

    have = {d for d, _ in targets}
    missing = sorted({r["dex_no"] for r in rows} - have)
    print(f"\n총 진화 멤버 행: {len(rows)}")
    print(f"우리 DB에 이미 있는 종: {len({r['dex_no'] for r in rows} & have)}")
    print(f"DB에 없는 진화 멤버(신규 추가 대상): {len(missing)}")
    print(f"  missing dex_no 샘플: {missing[:20]}")
    with open("evolution_missing_dex.json", "w") as f:
        json.dump(missing, f)


if __name__ == "__main__":
    main()
