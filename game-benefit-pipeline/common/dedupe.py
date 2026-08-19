# -*- coding: utf-8 -*-
"""
common/dedupe.py
--------------------------------------------------------------------
중복 제거와 변경 감지를 담당합니다.

[핵심 설계: 수동 데이터와 자동 데이터를 절대 섞지 않습니다]
기존 108건은 benefit_id 가 BNF_0001 ~ BNF_0108 처럼 순번입니다.
크롤러가 만드는 데이터에 이 순번 방식을 쓰면 언젠가 반드시 충돌합니다.
그래서 크롤링분은 접두어를 다르게 씁니다.

    수동 입력분 : BNF_0001            (기존 데이터. 파이프라인이 절대 건드리지 않음)
    자동 수집분 : BNF_AUTO_PAYCO_3F9A2B71

이렇게 하면 나중에 "AI가 수집한 것만 검수하고 싶다" 할 때
WHERE benefit_id LIKE 'BNF_AUTO_%' 한 줄로 분리할 수 있습니다.

[왜 순번이 아니라 해시인가?]
크롤러는 매일 같은 페이지를 다시 읽습니다. 순번을 쓰면 어제 읽은 혜택이
오늘 새 번호를 받아 중복으로 쌓입니다. 해시는 '같은 내용 = 항상 같은 값'이라
며칠을 돌려도 같은 혜택은 같은 ID가 나옵니다.
"""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Iterable

from common.schema import BenefitExtraction, BenefitInfo, normalize_code

# 자동 수집분을 구분하는 접두어입니다. 이 값은 바꾸지 마세요.
AUTO_ID_PREFIX = "BNF_AUTO"


def _enum_value(v) -> str:
    """Enum이든 문자열이든 문자열 값으로 통일해서 꺼냅니다."""
    return str(v.value if hasattr(v, "value") else v)


def _sha256_short(text: str, length: int = 8) -> str:
    """
    문자열을 SHA-256으로 해싱한 뒤 앞 몇 글자만 잘라 돌려줍니다.
    해시는 '같은 입력 -> 항상 같은 출력'이라 ID 만들기에 적합합니다.
    """
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:length].upper()


def make_benefit_id(item: BenefitExtraction) -> str:
    """
    자동 수집 혜택의 고유 ID를 만듭니다.

    형식:  BNF_AUTO_{제공처}_{해시8자리}
    예시:  BNF_AUTO_SHINHAN_CARD_3F9A2B71

    해시 재료 (이 값들이 모두 같으면 '같은 혜택'으로 봅니다):
      제공처 / 혜택명 / 플랫폼 / 게임 / 중첩계층 / 시작일

    ⚠️ 종료일은 일부러 뺐습니다.
       이벤트 연장이 흔한데, 종료일을 넣으면 '연장된 같은 이벤트'가
       새 혜택으로 잡혀 중복이 쌓입니다.

    ⚠️ stacking_layer 는 넣었습니다.
       같은 이벤트가 "카드사 할인 + 간편결제 적립"처럼 계층별로 쪼개지는데,
       이걸 안 넣으면 서로 다른 혜택이 같은 ID로 뭉쳐 덮어써집니다.
    """
    provider = normalize_code(item.provider_or_retailer) or "UNKNOWN"

    seed = "|".join([
        provider,
        item.item_or_event_name.strip().lower(),
        _enum_value(item.target_platform),
        normalize_code(item.target_game),
        _enum_value(item.stacking_layer),
        item.start_date or "ALWAYS",     # 상시 혜택은 "ALWAYS" 로 취급
    ])

    # 제공처 코드가 너무 길면 ID가 지저분해지므로 24자로 제한합니다.
    return f"{AUTO_ID_PREFIX}_{provider[:24]}_{_sha256_short(seed)}"


def make_content_hash(item: BenefitExtraction) -> str:
    """
    혜택 내용 전체의 지문을 만듭니다.
    ID와 달리 '종료일, 할인율, 한도, 조건' 등 바뀔 수 있는 값을 모두 포함합니다.
    -> 값이 하나라도 바뀌면 해시가 달라지므로 '수정됨'을 감지할 수 있습니다.
    """
    seed = "|".join([
        _enum_value(item.category),
        normalize_code(item.provider_or_retailer),
        item.item_or_event_name.strip().lower(),
        _enum_value(item.target_platform),
        normalize_code(item.target_game),
        _enum_value(item.channel_type),
        _enum_value(item.benefit_type),
        f"{item.benefit_value:.4f}",
        _enum_value(item.benefit_unit),
        str(item.min_spend_krw),
        str(item.max_benefit_krw),           # None 과 0 이 구분되어야 하므로 str() 사용
        str(item.min_prev_month_spend_krw),
        _enum_value(item.condition_type),
        str(item.is_first_purchase),
        str(item.requires_pre_app),
        _enum_value(item.payment_method_restriction),
        _enum_value(item.stacking_layer),
        _enum_value(item.user_segment),
        _enum_value(item.spend_exclusion_type),
        _enum_value(item.disbursement_type),
        _enum_value(item.payment_route_type),
        str(item.is_first_come_first_served),
        str(item.is_tiered_limit),
        str(item.is_probabilistic),
        ",".join(str(d) for d in item.denomination_list),
        item.start_date or "",
        item.end_date or "",
    ])
    return _sha256_short(seed, length=16)


def to_benefit_info(
    item: BenefitExtraction,
    source_name: str,
    source_url: str | None = None,
) -> BenefitInfo:
    """
    AI가 뽑은 결과(BenefitExtraction)에 ID·해시·수집시각을 채워
    BigQuery에 저장할 최종 형태(BenefitInfo)로 바꿉니다.

    Args:
        source_name: 크롤러 이름. source_file 컬럼에 들어갑니다. 예) "one_store"
        source_url:  원문 페이지 주소
    """
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")

    return BenefitInfo(
        **item.model_dump(),
        benefit_id=make_benefit_id(item),
        source_file=source_name,
        source_url=source_url,
        content_hash=make_content_hash(item),
        crawled_at=now_iso,
        updated_at=now_iso,
    )


def deduplicate(items: Iterable[BenefitInfo]) -> list[BenefitInfo]:
    """
    같은 실행 안에서 중복된 혜택을 제거합니다.
    (같은 이벤트가 배너와 목록에 두 번 나오는 경우가 흔합니다)

    같은 benefit_id 가 여러 개면 마지막에 수집된 것을 남깁니다.
    """
    unique: dict[str, BenefitInfo] = {}
    for item in items:
        unique[item.benefit_id] = item
    return list(unique.values())


def is_auto_generated(benefit_id: str) -> bool:
    """이 혜택이 크롤러가 만든 것인지 확인합니다. (수동 입력분 보호용)"""
    return str(benefit_id).startswith(AUTO_ID_PREFIX)
