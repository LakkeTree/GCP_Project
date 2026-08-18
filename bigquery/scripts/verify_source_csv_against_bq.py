"""
datas/ 의 원본 CSV를 local_csv_to_jsonl.py(csv_cleaning.py)로 정제한 결과와,
BigQuery에 실제 적재되어 있는 데이터를 대조한다.

CSV 파일 자체의 바이트 해시가 아니라 "정제 후 행 내용"을 기준으로 비교한다.
BigQuery에도 원래 이 정제 과정을 거친 JSONL이 적재되었으므로, 같은 정제
로직을 다시 돌려 나온 결과와 BigQuery 조회 결과가 같아야 두 데이터가
일치한다고 볼 수 있다.

사용법:
  python bigquery/scripts/verify_source_csv_against_bq.py
"""

import hashlib
import json
import sys
from datetime import date, datetime
from decimal import Decimal

from google.cloud import bigquery

from local_csv_to_jsonl import clean_benefit_info, clean_platform_connection

PROJECT_ID = "positive-tuner-504502-m5"
DATASET_ID = "benefit"
LOCATION = "asia-northeast3"

BENEFIT_TABLE = "benefit_info"
PLATFORM_TABLE = "platform_connection"


def normalize_bq_value(value):
    """BigQuery 조회 결과 값을 local_csv_to_jsonl.py 출력과 같은 파이썬 타입으로 맞춘다."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (list, tuple)):
        return list(value)
    return value


def fetch_table_rows(client: bigquery.Client, table_name: str) -> list[dict]:
    """BigQuery 테이블 전체를 읽어 정규화된 딕셔너리 리스트로 반환한다."""
    table_id = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
    rows = client.list_rows(table_id)
    return [
        {key: normalize_bq_value(value) for key, value in row.items()}
        for row in rows
    ]


def row_hash(row: dict) -> str:
    """행 딕셔너리를 키 정렬된 JSON으로 직렬화해 SHA256 해시로 만든다."""
    payload = json.dumps(row, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def compare(name: str, csv_rows: list[dict], bq_rows: list[dict], key_field) -> bool:
    """
    csv_rows(정제된 CSV)와 bq_rows(BigQuery 조회 결과)를 key_field 기준으로 대조한다.
    key_field가 튜플이면 복합키로 취급한다.
    """
    def key_of(row):
        if isinstance(key_field, tuple):
            return tuple(row[f] for f in key_field)
        return row[key_field]

    csv_by_key = {key_of(r): r for r in csv_rows}
    bq_by_key = {key_of(r): r for r in bq_rows}

    # BigQuery 테이블에는 local_csv_to_jsonl.py가 모르는 운영용 컬럼(예: content_hash,
    # is_active 등)이 나중에 추가됐을 수 있다. CSV에 없는 컬럼까지 비교하면
    # 항상 불일치로 나오므로, CSV 쪽 필드만 기준으로 비교한다.
    expected_fields = set(csv_rows[0].keys()) if csv_rows else set()
    extra_bq_fields = set()
    for row in bq_by_key.values():
        extra_bq_fields |= (row.keys() - expected_fields)
    if extra_bq_fields:
        print(f"[참고] BigQuery에만 있는 컬럼(비교 제외): {sorted(extra_bq_fields)}")

    print(f"\n=== {name} ===")
    print(f"CSV 정제 결과: {len(csv_rows)}행 / BigQuery: {len(bq_rows)}행")

    only_in_csv = csv_by_key.keys() - bq_by_key.keys()
    only_in_bq = bq_by_key.keys() - csv_by_key.keys()
    common = csv_by_key.keys() & bq_by_key.keys()
    mismatched = [
        k for k in common
        if row_hash(csv_by_key[k]) != row_hash({f: bq_by_key[k][f] for f in expected_fields})
    ]

    if only_in_csv:
        print(f"[CSV에만 있음 → BigQuery 미반영] {len(only_in_csv)}건: {sorted(only_in_csv)[:10]}")
    if only_in_bq:
        print(f"[BigQuery에만 있음 → CSV에서 사라짐] {len(only_in_bq)}건: {sorted(only_in_bq)[:10]}")
    if mismatched:
        print(f"[내용 불일치] {len(mismatched)}건: {sorted(mismatched)[:10]}")
        sample = sorted(mismatched)[0]
        print(f"  예시({sample}) CSV : {csv_by_key[sample]}")
        print(f"  예시({sample}) BQ  : {bq_by_key[sample]}")

    ok = not only_in_csv and not only_in_bq and not mismatched
    print("일치" if ok else "불일치 발견")
    return ok


def main() -> None:
    client = bigquery.Client(project=PROJECT_ID, location=LOCATION)

    benefit_csv_rows = clean_benefit_info()
    platform_csv_rows = clean_platform_connection()

    benefit_bq_rows = fetch_table_rows(client, BENEFIT_TABLE)
    platform_bq_rows = fetch_table_rows(client, PLATFORM_TABLE)

    benefit_ok = compare("benefit_info", benefit_csv_rows, benefit_bq_rows, "benefit_id")
    platform_ok = compare(
        "platform_connection", platform_csv_rows, platform_bq_rows, ("payment_method", "platform")
    )

    if not (benefit_ok and platform_ok):
        sys.exit(1)


if __name__ == "__main__":
    main()
