"""
"간편 결제수단 데이터 - 통합_혜택_계산DB.csv"(구 수기 정리본)에는 있지만 현재 21개
스크래퍼 중 어디에도 해당 provider_or_retailer를 다루는 크롤러가 없어 라이브
benefit_info에 전혀 존재하지 않는 행들을 1회성으로 적재한다.

대상 46행은 2026-08-17 diff 리포트에서 확정한 "① 신규 결제수단" 버킷 (아래
LEGACY_BENEFIT_IDS)이며, ②(검토 필요)/③(이미 존재)/④(만료) 버킷은 이 스크립트가
다루지 않는다.

benefit_id는 원본 CSV의 BNF_0001 식 번호 대신, 크롤러와 동일한 규칙
(card_data/common/normalize.py의 _dedupe_hash)을 그대로 적용해
BNF_LEGACY_{PROVIDER}_{해시8자리}로 재채번한다 — 원본 번호는 라이브 테이블의
BNF_CARD_KB_xxxx 같은 크롤러 채번 규칙과 겹치지 않아 그대로 둬도 충돌은 없지만,
같은 규칙을 쓰면 이 스크립트를 재실행해도(source_file 기준 scoped delete 후
재삽입) 항상 같은 ID가 나와 멱등성이 보장된다.

source_file은 전부 "legacy_manual_db"로 통일한다 — load_to_bigquery.py의
load_benefit_info()가 source_file 기준으로 기존 행을 지우고 새로 넣는 방식이라,
이후 이 legacy 데이터만 다시 정리하거나 걷어낼 때 한 번에 식별 가능하게 하기 위함.

사용법: python bigquery/scripts/import_legacy_new_providers.py
"""

import csv
import hashlib
from pathlib import Path

from google.cloud import bigquery

from csv_cleaning import clean_benefit_info_rows
from load_to_bigquery import load_benefit_info

ROOT = Path(__file__).resolve().parents[2]
OLD_CSV = ROOT / "간편 결제수단 데이터 - 통합_혜택_계산DB.csv"
SOURCE_FILE_TAG = "legacy_manual_db"

# 2026-08-17 diff 리포트 "① 신규 결제수단" 버킷 (라이브에 provider 자체가 없던 46행)
LEGACY_BENEFIT_IDS = {
    "BNF_0006", "BNF_0007", "BNF_0008", "BNF_0009", "BNF_0010",
    "BNF_0018", "BNF_0019", "BNF_0020", "BNF_0021", "BNF_0022", "BNF_0023", "BNF_0024",
    "BNF_0025", "BNF_0026", "BNF_0027", "BNF_0032", "BNF_0033", "BNF_0034",
    "BNF_0047", "BNF_0048", "BNF_0049", "BNF_0050", "BNF_0051", "BNF_0052",
    "BNF_0055", "BNF_0056", "BNF_0057", "BNF_0058", "BNF_0059", "BNF_0060",
    "BNF_0061", "BNF_0062", "BNF_0063", "BNF_0064", "BNF_0065", "BNF_0066",
    "BNF_0067", "BNF_0068", "BNF_0069", "BNF_0070",
    "BNF_0073", "BNF_0074", "BNF_0075", "BNF_0076", "BNF_0077", "BNF_0078",
}


def _dedupe_hash(provider: str, row: dict) -> str:
    material = "|".join([
        provider, row["category"], row["item_or_event_name"], row["target_platform"],
        row["target_game"], row["channel_type"], row["benefit_type"],
        row["benefit_value"], row["benefit_unit"], row["min_spend_krw"],
        row["condition_type"], row["condition_raw_text"],
    ])
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:8]


def main():
    with OLD_CSV.open(encoding="utf-8-sig", newline="") as f:
        all_rows = list(csv.DictReader(f))

    target_rows = [r for r in all_rows if r["benefit_id"].strip() in LEGACY_BENEFIT_IDS]
    if len(target_rows) != len(LEGACY_BENEFIT_IDS):
        found = {r["benefit_id"].strip() for r in target_rows}
        missing = LEGACY_BENEFIT_IDS - found
        raise SystemExit(f"CSV에서 못 찾은 benefit_id: {missing}")

    for row in target_rows:
        provider = row["provider_or_retailer"].strip()
        row["benefit_id"] = f"BNF_LEGACY_{provider}_{_dedupe_hash(provider, row)}"
        row["source_file"] = SOURCE_FILE_TAG

    cleaned = clean_benefit_info_rows(target_rows)

    client = bigquery.Client(project="positive-tuner-504502-m5")
    n = load_benefit_info(client, cleaned)
    print(f"적재 완료: {n}행 (source_file={SOURCE_FILE_TAG})")

    no_icon = sorted({r["provider_or_retailer"] for r in cleaned if r["payment_method_icon_url"] is None})
    if no_icon:
        print(f"payment_method_icon_url 매핑 없는 provider (후속 작업 필요): {no_icon}")


if __name__ == "__main__":
    main()
