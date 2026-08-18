"""Gemini 추출 결과(BenefitExtraction) → benefit_info 32개 컬럼 CSV 행으로 변환.

카드 전용 값(provider_or_retailer, id_prefix 등)도 여기서 하드코딩하지 않고
scrapers/*.py가 파라미터로 넘기게 한다 — 나중에 상품권 등 다른 도메인이 추가돼도
이 파일은 그대로 재사용 가능하도록.
"""

import csv
import hashlib
from pathlib import Path

from card_data.common.ai_extract import BenefitExtraction

CORE_FIELDS = [
    "benefit_id", "source_file", "category", "provider_or_retailer",
    "item_or_event_name", "target_platform", "target_game", "channel_type",
    "benefit_type", "benefit_value", "benefit_unit", "min_spend_krw",
    "max_benefit_krw", "min_prev_month_spend_krw", "condition_type",
    "is_first_purchase", "requires_pre_app", "payment_method_restriction",
    "stacking_layer", "user_segment", "spend_exclusion_type",
    "disbursement_type", "is_first_come_first_served", "is_tiered_limit",
    "payment_route_type", "is_probabilistic", "denomination_list",
    "start_date", "end_date", "source_url", "condition_raw_text",
    "content_hash", "crawled_at", "updated_at", "is_active",
]


def _bool_str(value: bool) -> str:
    return "TRUE" if value else "FALSE"


def _dedupe_hash(id_prefix: str, item: BenefitExtraction) -> str:
    """benefit_id 채번용 해시. end_date는 재료에서 의도적으로 제외한다 —
    이벤트 종료일만 연장된 경우를 새 혜택으로 오인하지 않기 위함(팀원 크롤러의
    dedupe.py와 동일한 이유, [[project-data-crawling-pipeline]] 참고)."""
    material = "|".join([
        id_prefix, item.category.value, item.item_or_event_name,
        item.target_platform.value, item.target_game, item.channel_type.value,
        item.benefit_type.value, str(item.benefit_value), item.benefit_unit.value,
        str(item.min_spend_krw), item.condition_type.value, item.condition_raw_text,
    ])
    return hashlib.sha256(material.encode("utf-8")).hexdigest()[:8]


def to_row(item: BenefitExtraction, *, id_domain: str, id_prefix: str, provider_or_retailer: str,
           source_file: str, source_url: str) -> dict:
    """id_domain 예: 'CARD', id_prefix 예: 'KB' → benefit_id는 BNF_CARD_KB_{해시8자리}."""
    benefit_id = f"BNF_{id_domain}_{id_prefix}_{_dedupe_hash(id_prefix, item)}"
    return {
        "benefit_id": benefit_id,
        "source_file": source_file,
        "category": item.category.value,
        "provider_or_retailer": provider_or_retailer,
        "item_or_event_name": item.item_or_event_name,
        "target_platform": item.target_platform.value,
        "target_game": item.target_game,
        "channel_type": item.channel_type.value,
        "benefit_type": item.benefit_type.value,
        "benefit_value": item.benefit_value,
        "benefit_unit": item.benefit_unit.value,
        "min_spend_krw": item.min_spend_krw,
        "max_benefit_krw": item.max_benefit_krw if item.max_benefit_krw is not None else "",
        "min_prev_month_spend_krw": (
            item.min_prev_month_spend_krw if item.min_prev_month_spend_krw is not None else ""
        ),
        "condition_type": item.condition_type.value,
        "is_first_purchase": _bool_str(item.is_first_purchase),
        "requires_pre_app": _bool_str(item.requires_pre_app),
        "payment_method_restriction": item.payment_method_restriction.value,
        "stacking_layer": item.stacking_layer.value,
        "user_segment": item.user_segment.value,
        "spend_exclusion_type": item.spend_exclusion_type.value,
        "disbursement_type": item.disbursement_type.value,
        "is_first_come_first_served": _bool_str(item.is_first_come_first_served),
        "is_tiered_limit": _bool_str(item.is_tiered_limit),
        "payment_route_type": item.payment_route_type.value,
        "is_probabilistic": _bool_str(item.is_probabilistic),
        "denomination_list": ";".join(str(d) for d in item.denomination_list),
        "start_date": item.start_date or "",
        "end_date": item.end_date or "",
        "source_url": source_url,
        "condition_raw_text": item.condition_raw_text,
        # 팀원 크롤링 CSV 전용 컬럼(변경 감지용, project_card_data_crawler 메모 참고).
        # 이 크롤러는 매번 전체교체본을 올리는 방식이라 지금은 채우지 않는다.
        "content_hash": "",
        "crawled_at": "",
        "updated_at": "",
        "is_active": "",
    }


def dedupe_rows(rows: list[dict]) -> list[dict]:
    """같은 benefit_id가 중복되면 첫 번째만 남긴다.

    csv_cleaning.clean_benefit_info_rows()는 CSV 안의 benefit_id 중복을 에러로
    처리하므로, 업로드 전에 여기서 미리 걸러낸다."""
    seen = set()
    out = []
    for row in rows:
        if row["benefit_id"] in seen:
            continue
        seen.add(row["benefit_id"])
        out.append(row)
    return out


def write_csv(rows: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=CORE_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
