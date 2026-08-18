"""
datas/ 폴더의 통합 CSV 2개를 BigQuery 적재용 JSONL로 정제한다.

입력:
  datas/Total_Platform_Connection_DB.csv
  datas/Total_Benefit_Info_DB.csv
  datas/Total_Game_Info_DB.csv
출력:
  bigquery/cleaned/platform_connection.jsonl
  bigquery/cleaned/benefit_info.jsonl
  bigquery/cleaned/game_info.jsonl

정제 로직 자체는 csv_cleaning.py에 있다. 이 스크립트는 로컬 파일 입출력만 담당한다.

사용법:
  python bigquery/scripts/local_csv_to_jsonl.py
"""

import csv
import json
import sys
from pathlib import Path

from csv_cleaning import clean_benefit_info_rows, clean_game_info_rows, clean_platform_connection_rows

ROOT = Path(__file__).resolve().parents[2]
DATAS_DIR = ROOT / "datas"
OUT_DIR = ROOT / "bigquery" / "cleaned"


def clean_platform_connection():
    """Total_Platform_Connection_DB.csv를 읽어 정제한 뒤 JSONL로 저장한다."""
    src = DATAS_DIR / "Total_Platform_Connection_DB.csv"
    dst = OUT_DIR / "platform_connection.jsonl"
    print(f"[platform_connection] 읽는 중: {src.name}")

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[platform_connection] {len(rows)}행 정제 중...")
    cleaned = clean_platform_connection_rows(rows)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for r in cleaned:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[platform_connection] 완료 → {dst.relative_to(ROOT)} ({len(cleaned)}행)")
    return cleaned


def clean_benefit_info():
    """Total_Benefit_Info_DB.csv를 읽어 정제한 뒤 JSONL로 저장한다."""
    src = DATAS_DIR / "Total_Benefit_Info_DB.csv"
    dst = OUT_DIR / "benefit_info.jsonl"
    print(f"[benefit_info] 읽는 중: {src.name}")

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[benefit_info] {len(rows)}행 정제 중...")
    cleaned = clean_benefit_info_rows(rows)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for r in cleaned:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[benefit_info] 완료 → {dst.relative_to(ROOT)} ({len(cleaned)}행)")
    return cleaned


def clean_game_info():
    """Total_Game_Info_DB.csv를 읽어 정제한 뒤 JSONL로 저장한다."""
    src = DATAS_DIR / "Total_Game_Info_DB.csv"
    dst = OUT_DIR / "game_info.jsonl"
    print(f"[game_info] 읽는 중: {src.name}")

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[game_info] {len(rows)}행 정제 중...")
    cleaned = clean_game_info_rows(rows)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for r in cleaned:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[game_info] 완료 → {dst.relative_to(ROOT)} ({len(cleaned)}행)")
    return cleaned


def summarize(name: str, rows: list, nullable_fields: list):
    """정제 결과에서 NULLABLE 컬럼별 NULL(빈 배열 포함) 개수를 출력해 검증한다."""
    print(f"\n[{name}] 검증 요약 (총 {len(rows)}행)")
    for field in nullable_fields:
        null_count = sum(1 for r in rows if r.get(field) in (None, []))
        print(f"  - {field}: NULL/빈배열 {null_count}행")


def main():
    """정제 전체 과정을 순서대로 실행하는 진입점."""
    print("=== BigQuery 적재용 CSV 정제 시작 ===\n")
    try:
        pc_rows = clean_platform_connection()
        bi_rows = clean_benefit_info()
        gi_rows = clean_game_info()
    except ValueError as e:
        print(f"\n[오류] 정제 실패: {e}", file=sys.stderr)
        sys.exit(1)

    summarize("platform_connection", pc_rows, ["note"])
    summarize(
        "benefit_info",
        bi_rows,
        ["max_benefit_krw", "min_prev_month_spend_krw", "start_date", "end_date", "source_url", "denomination_list"],
    )
    summarize("game_info", gi_rows, ["description", "icon_url", "genre_tags"])
    print("\n=== 정제 완료 ===")


if __name__ == "__main__":
    main()
