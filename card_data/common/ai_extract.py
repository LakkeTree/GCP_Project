"""Gemini 구조화 추출: 혜택 페이지 원문 텍스트 → BenefitExtraction 리스트.

카드사별 DOM 파싱/분류 로직을 최소화하기 위해, scrapers/*.py는 페이지의 원문
텍스트만 이 모듈에 넘기고 32개 컬럼 스키마로의 구조화는 Gemini가 담당한다.
도메인(카드 → 상품권/문화상품권 등)이 바뀌어도 이 파일은 손대지 않고 프롬프트나
Enum 값만 조정하면 재사용 가능하도록, 카드 전용 로직은 넣지 않는다.
"""

import os
from enum import Enum
from typing import Optional

from google import genai
from google.genai import types
from pydantic import BaseModel

MODEL_NAME = "gemini-3.6-flash"

SYSTEM_PROMPT = """당신은 카드사/판매처 혜택 페이지에서 "모바일 게임 결제(인앱결제)"와
직접 관련된 혜택만 골라 정해진 스키마로 구조화하는 데이터 추출기입니다.

규칙:
- 모바일 게임 결제와 무관한 혜택(주유, 마트, 카페, 통신비 등)은 절대 포함하지 마세요.
- 하나의 혜택이 여러 target_platform(GOOGLE_PLAY/APP_STORE/ONE_STORE/GALAXY_STORE)에
  각각 적용된다고 명시돼 있으면, platform마다 별도 항목으로 나눠서 출력하세요.
  특정 플랫폼 언급 없이 전체 다 된다고 하면 target_platform=ALL 하나로 출력하세요.
- target_game은 특정 게임명이 명시되지 않으면 "ALL"로 쓰세요.
- min_spend_krw, max_benefit_krw 등 금액은 "무제한/한도없음"이면 null, 실제 0원부터
  적용이면 0으로 명확히 구분하세요. 원문에 없는 숫자는 절대 추측하지 말고 null로
  두세요.
- condition_raw_text에는 원문의 조건 설명을 요약하지 말고 최대한 그대로 담으세요.
- 이 페이지에 모바일 게임 결제 관련 혜택이 없으면 빈 리스트를 반환하세요.
"""


class TargetPlatform(str, Enum):
    GOOGLE_PLAY = "GOOGLE_PLAY"
    APP_STORE = "APP_STORE"
    ONE_STORE = "ONE_STORE"
    GALAXY_STORE = "GALAXY_STORE"
    ALL = "ALL"


class ChannelType(str, Enum):
    IN_APP = "IN_APP"
    ONLINE = "ONLINE"
    OFFLINE = "OFFLINE"


class BenefitType(str, Enum):
    REWARD = "REWARD"
    DISCOUNT = "DISCOUNT"
    CASHBACK = "CASHBACK"
    FEE = "FEE"


class BenefitUnit(str, Enum):
    PERCENT = "PERCENT"
    KRW = "KRW"


class ConditionType(str, Enum):
    GENERAL = "GENERAL"
    FIRST_PURCHASE = "FIRST_PURCHASE"
    PRE_REGISTRATION = "PRE_REGISTRATION"
    PREV_SPEND_REQUIRED = "PREV_SPEND_REQUIRED"
    MEMBERSHIP_TIER = "MEMBERSHIP_TIER"
    CONVERSION_FEE = "CONVERSION_FEE"


class PaymentMethodRestriction(str, Enum):
    NONE = "NONE"
    CARD_ONLY = "CARD_ONLY"
    CASH_ONLY = "CASH_ONLY"
    POINT_ONLY = "POINT_ONLY"
    # telecom_data 통신사 휴대폰결제 정액제 부가서비스(SKT 휴대폰결제멤버십, KT
    # 콘텐츠페이 등)처럼 "휴대폰 소액결제로 결제해야만" 적용되는 혜택 전용.
    # engine/calculator.py는 이 필드를 실제 필터링에 쓰지 않으므로(주석 참고,
    # POINT_ONLY 회귀 버그 이후 의도적으로 미사용) 값을 추가해도 계산 로직에는
    # 영향 없음 — 원문 조건을 정확히 표현하기 위한 값이다.
    PHONE_BILLING_ONLY = "PHONE_BILLING_ONLY"


class StackingLayer(str, Enum):
    STORE_COUPON = "STORE_COUPON"
    PAYMENT_PG = "PAYMENT_PG"
    PAYMENT_E_PAY = "PAYMENT_E_PAY"
    CARD_ISSUER = "CARD_ISSUER"
    GIFT_CARD = "GIFT_CARD"


class UserSegment(str, Enum):
    ALL_USERS = "ALL_USERS"
    NEW_OR_RETURNING_USER = "NEW_OR_RETURNING_USER"
    VIP_MEMBER = "VIP_MEMBER"


class SpendExclusionType(str, Enum):
    NONE = "NONE"
    VOUCHER_EXCLUDED = "VOUCHER_EXCLUDED"
    CASH_EXCLUDED = "CASH_EXCLUDED"


class DisbursementType(str, Enum):
    INSTANT_DISCOUNT = "INSTANT_DISCOUNT"
    POINT_REWARD = "POINT_REWARD"
    COUPON_ISSUE = "COUPON_ISSUE"
    BILL_DISCOUNT = "BILL_DISCOUNT"
    CHARGE_PURCHASE = "CHARGE_PURCHASE"
    INFO_ONLY = "INFO_ONLY"


class PaymentRouteType(str, Enum):
    DIRECT_PAY = "DIRECT_PAY"
    DIRECT_LINK = "DIRECT_LINK"
    GIFTCODE_CHARGE = "GIFTCODE_CHARGE"
    INDIRECT_CONVERSION = "INDIRECT_CONVERSION"


class BenefitCategory(str, Enum):
    """Kyungtae 브랜치 common/schema.py의 분류를 그대로 채택한다 — engine/calculator.py가
    category=="GIFT_CARD"/"VOUCHER_PURCHASE" 문자열을 직접 참조하므로, 값을 새로
    만들지 않고 그쪽 taxonomy에 맞춘다."""

    REWARD_E_PAY = "REWARD_E_PAY"
    CARD = "CARD"
    VOUCHER_PURCHASE = "VOUCHER_PURCHASE"
    GIFT_CARD = "GIFT_CARD"
    SUMMARY_STORE_TIER_REWARD_RATES = "SUMMARY_STORE_TIER_REWARD_RATES"
    DISCOUNT_STORE = "DISCOUNT_STORE"
    DISCOUNT_TELECOM = "DISCOUNT_TELECOM"
    DISCOUNT_E_PAY = "DISCOUNT_E_PAY"
    DISCOUNT_CARD = "DISCOUNT_CARD"
    REWARD_TELECOM = "REWARD_TELECOM"
    DISCOUNT_PG = "DISCOUNT_PG"
    REWARD_STORE = "REWARD_STORE"


class BenefitExtraction(BaseModel):
    category: BenefitCategory
    item_or_event_name: str
    target_platform: TargetPlatform
    target_game: str
    channel_type: ChannelType
    benefit_type: BenefitType
    benefit_value: float
    benefit_unit: BenefitUnit
    min_spend_krw: int
    max_benefit_krw: Optional[int] = None
    min_prev_month_spend_krw: Optional[int] = None
    condition_type: ConditionType
    is_first_purchase: bool
    requires_pre_app: bool
    payment_method_restriction: PaymentMethodRestriction
    stacking_layer: StackingLayer
    user_segment: UserSegment
    spend_exclusion_type: SpendExclusionType
    disbursement_type: DisbursementType
    is_first_come_first_served: bool
    is_tiered_limit: bool
    payment_route_type: PaymentRouteType
    is_probabilistic: bool
    denomination_list: list[int] = []
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    condition_raw_text: str


_CLIENT: genai.Client | None = None


def _client() -> genai.Client:
    """genai.Client는 임시 객체로 체이닝해서 쓰면(예: _client().models...) 요청 도중
    내부 httpx 커넥션이 조기 종료되는 알려진 버그가 있다
    (https://github.com/googleapis/python-genai/issues/1763). 모듈 전역에 한 번만
    만들어서 재사용하는 방식으로 우회한다."""
    global _CLIENT
    if _CLIENT is None:
        # google-genai SDK는 api_key를 명시해도 시스템 환경변수 GOOGLE_API_KEY가
        # 있으면 그쪽을 우선 사용한다(다른 도구가 잡아둔 무관한 키일 수 있음).
        # 이 프로세스 안에서만 지워서 우리가 지정한 GEMINI_API_KEY가 항상 쓰이게 한다.
        os.environ.pop("GOOGLE_API_KEY", None)
        # GEMINI_API_KEY에 Vertex AI Express Mode API 키를 넣어 쓴다 — 무료 등급
        # (하루 20건) 대신 GCP 프로젝트 할당량을 쓰기 위함. vertexai=True + api_key만
        # 넘기면 project/location 없이도 Express Mode로 인증된다(google-genai
        # _api_client.py의 "Handle when to use Vertex AI in express mode" 분기 참고).
        _CLIENT = genai.Client(vertexai=True, api_key=os.environ["GEMINI_API_KEY"])
    return _CLIENT


def extract_benefits(
    page_text: str, *, provider_name: str, extra_hint: str = ""
) -> list[BenefitExtraction]:
    """혜택 페이지 원문 텍스트에서 모바일 게임 결제 혜택만 구조화해서 뽑아낸다.

    extra_hint: 페이지별 고정값 지시(예: "target_platform=ONE_STORE로 고정")나
    포맷 규칙처럼 SYSTEM_PROMPT의 일반 규칙만으로는 부족한 경우 scrapers/*.py가
    채워 넣는 추가 지침. 없으면 일반 규칙만으로 추출한다.
    """
    prompt = f"카드사/판매처: {provider_name}\n\n페이지 원문:\n{page_text}"
    if extra_hint:
        prompt = f"{extra_hint}\n\n{prompt}"
    client = _client()
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            response_mime_type="application/json",
            response_schema=list[BenefitExtraction],
        ),
    )
    if response.parsed is None:
        raise ValueError(f"Gemini 응답 파싱 실패, raw text: {response.text!r}")
    return response.parsed
