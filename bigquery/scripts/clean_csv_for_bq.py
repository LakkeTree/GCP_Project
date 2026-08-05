"""
datas/ 폴더의 통합 CSV 2개를 BigQuery 적재용 JSONL로 정제한다.

입력:
  datas/Total_Platform_Connection_DB.csv
  datas/Total_Benefit_Info_DB.csv
출력:
  bigquery/cleaned/platform_connection.jsonl
  bigquery/cleaned/benefit_info.jsonl

사용법:
  python bigquery/scripts/clean_csv_for_bq.py
"""

import csv
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATAS_DIR = ROOT / "datas"
OUT_DIR = ROOT / "bigquery" / "cleaned"

# 원본 CSV에서 "빈 값"으로 취급할 문자열 모음 ("", "NULL", "nan" 등이 섞여 있음)
NULL_TOKENS = {"", "null", "nan", "none"}


def is_null(value: str) -> bool:
    """값이 NULL_TOKENS에 해당하는 빈 값인지 판별한다."""
    return value.strip().lower() in NULL_TOKENS


def to_bool(value: str, row_ctx: str) -> bool:
    """"TRUE"/"FALSE" 문자열을 실제 bool로 변환한다. 그 외 값이면 에러를 낸다."""
    v = value.strip().lower()
    if v == "true":
        return True
    if v == "false":
        return False
    raise ValueError(f"[{row_ctx}] boolean 값이 아님: {value!r}")


def to_int_or_none(value: str, row_ctx: str):
    """빈 값이면 None, 아니면 정수로 변환한다. (min/max 금액, 전월실적 컬럼용)"""
    if is_null(value):
        return None
    try:
        return int(float(value))
    except ValueError:
        raise ValueError(f"[{row_ctx}] 정수로 변환 불가: {value!r}")


def to_float(value: str, row_ctx: str) -> float:
    """benefit_value처럼 소수를 포함할 수 있는 필수 숫자 컬럼을 실수로 변환한다."""
    try:
        return float(value)
    except ValueError:
        raise ValueError(f"[{row_ctx}] 실수로 변환 불가: {value!r}")


def to_date_or_none(value: str):
    """빈 값이면 None, 아니면 날짜 문자열(YYYY-MM-DD)을 그대로 반환한다."""
    return None if is_null(value) else value.strip()


def to_str_or_none(value: str):
    """빈 값이면 None, 아니면 앞뒤 공백을 제거한 문자열을 반환한다. (note, source_url용)"""
    return None if is_null(value) else value.strip()


def to_denomination_list(value: str, row_ctx: str):
    """세미콜론으로 구분된 권종 문자열("5000;10000;...")을 정수 배열로 분해한다."""
    if is_null(value):
        return []
    parts = [p.strip() for p in value.split(";") if p.strip()]
    out = []
    for p in parts:
        try:
            out.append(int(float(p)))
        except ValueError:
            raise ValueError(f"[{row_ctx}] denomination_list 항목 변환 불가: {p!r}")
    return out


def clean_platform_connection():
    """Total_Platform_Connection_DB.csv를 읽어 정제한 뒤 JSONL로 저장한다."""
    src = DATAS_DIR / "Total_Platform_Connection_DB.csv"
    dst = OUT_DIR / "platform_connection.jsonl"
    print(f"[platform_connection] 읽는 중: {src.name}")

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[platform_connection] {len(rows)}행 정제 중...")
    cleaned = []
    for i, row in enumerate(rows, start=2):  # 헤더 포함 실제 파일 라인번호 (에러 메시지용)
        ctx = f"platform_connection L{i}"
        cleaned.append({
            "payment_method": row["payment_method"].strip(),
            "platform": row["platform"].strip(),
            "is_supported": to_bool(row["is_supported"], ctx),
            "note": to_str_or_none(row["note"]),
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for r in cleaned:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[platform_connection] 완료 → {dst.relative_to(ROOT)} ({len(cleaned)}행)")
    return cleaned


def clean_benefit_info():
    """Total_Benefit_Info_DB.csv를 읽어 정제한 뒤 JSONL로 저장한다. (핵심 정제 로직)"""
    src = DATAS_DIR / "Total_Benefit_Info_DB.csv"
    dst = OUT_DIR / "benefit_info.jsonl"
    print(f"[benefit_info] 읽는 중: {src.name}")

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"[benefit_info] {len(rows)}행 정제 중...")
    cleaned = []
    seen_ids = set()  # benefit_id 중복 검증용
    for i, row in enumerate(rows, start=2):
        ctx = f"benefit_info L{i} ({row.get('benefit_id')})"

        bid = row["benefit_id"].strip()
        if bid in seen_ids:
            raise ValueError(f"[{ctx}] benefit_id 중복: {bid}")
        seen_ids.add(bid)

        cleaned.append({
            "benefit_id": bid,
            "source_file": row["source_file"].strip(),
            "category": row["category"].strip(),
            "provider_or_retailer": row["provider_or_retailer"].strip(),
            "item_or_event_name": row["item_or_event_name"].strip(),
            "target_platform": row["target_platform"].strip(),
            "target_game": row["target_game"].strip(),
            "channel_type": row["channel_type"].strip(),
            "benefit_type": row["benefit_type"].strip(),
            "benefit_value": to_float(row["benefit_value"], ctx),
            "benefit_unit": row["benefit_unit"].strip(),
            "min_spend_krw": to_int_or_none(row["min_spend_krw"], ctx),
            "max_benefit_krw": to_int_or_none(row["max_benefit_krw"], ctx),
            "min_prev_month_spend_krw": to_int_or_none(row["min_prev_month_spend_krw"], ctx),
            "condition_type": row["condition_type"].strip(),
            "is_first_purchase": to_bool(row["is_first_purchase"], ctx),
            "requires_pre_app": to_bool(row["requires_pre_app"], ctx),
            "payment_method_restriction": row["payment_method_restriction"].strip(),
            "stacking_layer": row["stacking_layer"].strip(),
            "user_segment": row["user_segment"].strip(),
            "spend_exclusion_type": row["spend_exclusion_type"].strip(),
            "disbursement_type": row["disbursement_type"].strip(),
            "is_first_come_first_served": to_bool(row["is_first_come_first_served"], ctx),
            "is_tiered_limit": to_bool(row["is_tiered_limit"], ctx),
            "payment_route_type": row["payment_route_type"].strip(),
            "is_probabilistic": to_bool(row["is_probabilistic"], ctx),
            "denomination_list": to_denomination_list(row["denomination_list"], ctx),
            "start_date": to_date_or_none(row["start_date"]),
            "end_date": to_date_or_none(row["end_date"]),
            "source_url": to_str_or_none(row["source_url"]),
            "condition_raw_text": row["condition_raw_text"].strip(),
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for r in cleaned:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")

    print(f"[benefit_info] 완료 → {dst.relative_to(ROOT)} ({len(cleaned)}행)")
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
    except ValueError as e:
        print(f"\n[오류] 정제 실패: {e}", file=sys.stderr)
        sys.exit(1)

    summarize("platform_connection", pc_rows, ["note"])
    summarize(
        "benefit_info",
        bi_rows,
        ["max_benefit_krw", "min_prev_month_spend_krw", "start_date", "end_date", "source_url", "denomination_list"],
    )
    print("\n=== 정제 완료 ===")


if __name__ == "__main__":
    main()
