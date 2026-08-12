"""
CSV 행(dict) → BigQuery 적재용 dict로 정제하는 공용 로직.

파일 입출력을 하지 않는 순수 함수만 모아둔다. 로컬 CLI(local_csv_to_jsonl.py)와
Cloud Run Function(GCS에서 받은 CSV를 메모리에서 바로 정제) 양쪽에서 재사용한다.
"""

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


def to_bool_or_none(value: str, row_ctx: str):
    """빈 값이면 None, 아니면 to_bool로 변환한다. (is_active처럼 없을 수도 있는 컬럼용)"""
    return None if is_null(value) else to_bool(value, row_ctx)


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


def clean_platform_connection_rows(rows: list) -> list:
    """csv.DictReader가 만든 platform_connection 원본 행 리스트를 정제해 반환한다."""
    cleaned = []
    for i, row in enumerate(rows, start=2):  # 헤더 포함 실제 파일 라인번호 (에러 메시지용)
        ctx = f"platform_connection L{i}"
        cleaned.append({
            "payment_method": row["payment_method"].strip(),
            "platform": row["platform"].strip(),
            "is_supported": to_bool(row["is_supported"], ctx),
            "note": to_str_or_none(row["note"]),
        })
    return cleaned


def clean_benefit_info_rows(rows: list) -> list:
    """csv.DictReader가 만든 benefit_info 원본 행 리스트를 정제해 반환한다. (핵심 정제 로직)"""
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
            # 팀원 크롤링 CSV 전용 컬럼. 우리 CSV에는 없는 컬럼이라 row.get()으로 조회해서
            # 없으면 빈 문자열 취급 → 아래 함수들이 NULL로 변환한다.
            "content_hash": to_str_or_none(row.get("content_hash", "")),
            "crawled_at": to_str_or_none(row.get("crawled_at", "")),
            "updated_at": to_str_or_none(row.get("updated_at", "")),
            "is_active": to_bool_or_none(row.get("is_active", ""), ctx),
        })
    return cleaned
