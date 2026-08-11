# -*- coding: utf-8 -*-
"""
common/schema.py
--------------------------------------------------------------------
"혜택 정보(benefit_info)" 와 "플랫폼 호환성(platform_connection)" 데이터의
정확한 모양을 정의하는 모듈입니다. 이 파일이 프로젝트 전체의 '기준'입니다.

⚠️ 이 파일의 모든 Enum 값은 제공해 주신 benefit_info.jsonl 108건 /
   platform_connection.jsonl 80건을 전수 분석해서 뽑아낸 '실제 값'입니다.
   추측으로 넣은 값이 아니므로, 계산엔진(calculator.py)과 그대로 호환됩니다.

[초보자 설명: 이게 왜 중요한가?]
AI는 같은 뜻을 여러 표기로 뱉습니다. "원스토어", "onestore", "ONE STORE" 처럼요.
그러면 calculator.py 의 STORE_PROVIDER_TO_PLATFORM 매핑이 실패하고,
혜택이 계산에서 조용히 누락됩니다. 버그를 발견하기도 어렵습니다.
그래서 AI 결과를 반드시 이 파일의 검사를 통과시킨 뒤에만 저장합니다.
"""

from __future__ import annotations

import re
from datetime import date, datetime, timezone
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# =============================================================================
# 1) 코드 체계 (Enum) — 실제 데이터에서 추출한 값
# =============================================================================


class BenefitCategory(str, Enum):
    """혜택의 큰 분류. (실데이터 108건에서 관측된 10종 + 확장 2종)"""

    REWARD_E_PAY = "REWARD_E_PAY"                                # 간편결제 적립 (37건)
    CARD = "CARD"                                                # 카드사 혜택 (20건)
    VOUCHER_PURCHASE = "VOUCHER_PURCHASE"                        # 상품권 구매 (12건)
    GIFT_CARD = "GIFT_CARD"                                      # 기프트카드 (9건)
    SUMMARY_STORE_TIER_REWARD_RATES = "SUMMARY_STORE_TIER_REWARD_RATES"  # 스토어 등급별 적립률 (9건)
    DISCOUNT_STORE = "DISCOUNT_STORE"                            # 스토어 직접 할인 (8건)
    DISCOUNT_TELECOM = "DISCOUNT_TELECOM"                        # 통신사 할인 (6건)
    DISCOUNT_E_PAY = "DISCOUNT_E_PAY"                            # 간편결제 할인 (3건)
    DISCOUNT_CARD = "DISCOUNT_CARD"                              # 카드 할인 (2건)
    REWARD_TELECOM = "REWARD_TELECOM"                            # 통신사 적립 (2건)
    # --- 아래 2종은 아직 데이터에 없지만 앞으로 나올 수 있어 미리 등록해 둡니다 ---
    DISCOUNT_PG = "DISCOUNT_PG"                                  # PG사 할인
    REWARD_STORE = "REWARD_STORE"                                # 스토어 적립


class Platform(str, Enum):
    """적용 플랫폼(스토어). 실데이터 관측 5종."""

    ALL = "ALL"
    GOOGLE_PLAY = "GOOGLE_PLAY"
    ONE_STORE = "ONE_STORE"
    APP_STORE = "APP_STORE"
    GALAXY_STORE = "GALAXY_STORE"


class ChannelType(str, Enum):
    """결제가 일어나는 채널."""

    IN_APP = "IN_APP"     # 게임 앱 안에서 결제
    ONLINE = "ONLINE"     # 웹/외부 사이트 결제
    OFFLINE = "OFFLINE"   # 오프라인 매장


class BenefitType(str, Enum):
    """혜택의 성격. calculator.py 의 CALCULABLE_TYPES 와 정확히 일치합니다."""

    DISCOUNT = "DISCOUNT"    # 즉시 할인
    REWARD = "REWARD"        # 적립
    CASHBACK = "CASHBACK"    # 캐시백
    FEE = "FEE"              # 수수료 (전환 수수료 등, 값이 클수록 불리)


class BenefitUnit(str, Enum):
    """benefit_value 의 단위. 실데이터는 PERCENT/KRW 두 종류뿐입니다."""

    PERCENT = "PERCENT"
    KRW = "KRW"


class ConditionType(str, Enum):
    """혜택을 받기 위한 조건의 종류."""

    GENERAL = "GENERAL"                          # 특별한 조건 없음
    PREV_SPEND_REQUIRED = "PREV_SPEND_REQUIRED"  # 전월 실적 필요
    MEMBERSHIP_TIER = "MEMBERSHIP_TIER"          # 회원 등급 조건
    CONVERSION_FEE = "CONVERSION_FEE"            # 전환 수수료
    FIRST_PURCHASE = "FIRST_PURCHASE"            # 첫 결제 한정
    PRE_REGISTRATION = "PRE_REGISTRATION"        # 사전 응모 필요


class PaymentMethodRestriction(str, Enum):
    """결제수단 제한."""

    NONE = "NONE"
    POINT_ONLY = "POINT_ONLY"
    CARD_ONLY = "CARD_ONLY"
    CASH_ONLY = "CASH_ONLY"


class StackingLayer(str, Enum):
    """
    중첩 계층. 같은 계층끼리는 동시에 못 쓰고, 다른 계층끼리는 겹쳐 쓸 수 있습니다.
    calculator.py 의 PAYMENT_LAYER_ORDER 와 맞춰야 합니다.
    """

    STORE_COUPON = "STORE_COUPON"
    PAYMENT_PG = "PAYMENT_PG"          # 계산엔진은 쓰지만 아직 데이터에는 없음
    PAYMENT_E_PAY = "PAYMENT_E_PAY"
    CARD_ISSUER = "CARD_ISSUER"
    GIFT_CARD = "GIFT_CARD"


class UserSegment(str, Enum):
    """대상 사용자군."""

    ALL_USERS = "ALL_USERS"
    VIP_MEMBER = "VIP_MEMBER"
    NEW_OR_RETURNING_USER = "NEW_OR_RETURNING_USER"


class SpendExclusionType(str, Enum):
    """실적 산정에서 제외되는 결제 유형."""

    NONE = "NONE"
    VOUCHER_EXCLUDED = "VOUCHER_EXCLUDED"   # 상품권 결제는 실적 제외
    CASH_EXCLUDED = "CASH_EXCLUDED"         # 현금 결제는 실적 제외


class DisbursementType(str, Enum):
    """혜택이 실제로 지급되는 방식."""

    INSTANT_DISCOUNT = "INSTANT_DISCOUNT"   # 결제 시점에 즉시 차감
    POINT_REWARD = "POINT_REWARD"           # 포인트로 적립
    CHARGE_PURCHASE = "CHARGE_PURCHASE"     # 충전/구매 형태
    COUPON_ISSUE = "COUPON_ISSUE"           # 쿠폰 발급
    BILL_DISCOUNT = "BILL_DISCOUNT"         # 청구 할인
    INFO_ONLY = "INFO_ONLY"                 # 참고용 정보 (계산에서 제외됨)


class PaymentRouteType(str, Enum):
    """결제 경로 유형."""

    DIRECT_PAY = "DIRECT_PAY"                    # 바로 결제
    GIFTCODE_CHARGE = "GIFTCODE_CHARGE"          # 기프트코드로 충전 후 결제
    DIRECT_LINK = "DIRECT_LINK"                  # 계정 직접 연동
    INDIRECT_CONVERSION = "INDIRECT_CONVERSION"  # 포인트 전환을 거침


# -----------------------------------------------------------------------------
# 제공처 코드 (실데이터 35종 전체)
# -----------------------------------------------------------------------------
KNOWN_PROVIDER_CODES: set[str] = {
    # 카드사
    "SHINHAN_CARD", "NH_NONGHYUP_CARD", "SAMSUNG_CARD", "KB_KOOKMIN_CARD", "HANA_CARD",
    # 간편결제
    "PAYCO", "NAVER_PAY", "KAKAO_PAY", "TOSS_PAY", "SAMSUNG_PAY", "APPLE_PAY",
    # 스토어
    "GOOGLE_PLAY", "GOOGLE_PLAY_STORE", "GALAXY_STORE", "ONE_STORE",
    # 기프트카드
    "GOOGLE_PLAY_GIFTCARD", "GALAXY_STORE_GIFTCARD", "ONESTORE_GIFTCARD", "APPLE_GIFTCARD",
    # 상품권
    "CULTURELAND_CASH", "CULTURELAND_VOUCHER", "CULTURELAND_BYPASS", "BOOKNLIFE_VOUCHER",
    # 통신사
    "KT", "SKT", "LGU_PLUS",
    # 유통/커머스
    "SSG_COM", "11STREET", "GMARKET", "ZEROPIN", "CU_CONVENIENCE_STORE",
    "GOOGLE_PLAY_NAVER_STORE",
    # 기타 경로
    "KCP_BANK_ACCOUNT", "QUICK_BANK_TRANSFER", "GALAXY_STORE_X_KAKAO_PAY",
}

# 게임 코드 (실데이터 2종 + 확장 여지)
KNOWN_GAME_CODES: set[str] = {
    "ALL",
    "COOKIERUN_KINGDOM",
}

# platform_connection 에 등록된 결제수단 코드 20종
KNOWN_PAYMENT_METHODS: set[str] = {
    "CULTURELAND_CASH", "PAYCO", "TOSS_PAY", "GALAXY_STORE_GIFTCARD",
    "GOOGLE_PLAY_GIFTCARD", "NAVER_PAY", "SAMSUNG_PAY", "STORE_MEMBERSHIP_REWARD",
    "APPLE_PAY", "KAKAO_PAY", "APPLE_GIFTCARD", "ONESTORE_GIFTCARD",
    "CULTURELAND_VOUCHER", "BOOKNLIFE_VOUCHER", "KCP_BANK_ACCOUNT",
    "QUICK_BANK_TRANSFER", "CULTURELAND_BYPASS", "SKT", "KT", "LGU_PLUS",
}


# =============================================================================
# 2) 코드 정규화
# =============================================================================

# 허용 문자: 영문 대문자, 숫자, 언더스코어, 한글.
# 한글을 남기는 이유: 신규 게임명을 AI가 한글로 뱉었을 때 통째로 지워지면
# 전부 UNKNOWN 으로 뭉개져 구분이 불가능해지기 때문입니다.
_CODE_CLEAN_PATTERN = re.compile(r"[^A-Z0-9_가-힣]")
_DATE_PATTERN = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# 한글/변형 표기 -> 표준 코드 사전.
# 새 표기를 발견할 때마다 여기에 한 줄씩 추가하면 데이터가 계속 깨끗해집니다.
CODE_ALIASES: dict[str, str] = {
    # 스토어
    "원스토어": "ONE_STORE", "ONESTORE": "ONE_STORE",
    "갤럭시스토어": "GALAXY_STORE", "삼성갤럭시스토어": "GALAXY_STORE", "GALAXYSTORE": "GALAXY_STORE",
    "구글플레이": "GOOGLE_PLAY", "플레이스토어": "GOOGLE_PLAY", "구글플레이스토어": "GOOGLE_PLAY",
    "GOOGLEPLAY": "GOOGLE_PLAY", "PLAYSTORE": "GOOGLE_PLAY",
    "앱스토어": "APP_STORE", "애플앱스토어": "APP_STORE", "APPSTORE": "APP_STORE",
    # 간편결제
    "페이코": "PAYCO",
    "네이버페이": "NAVER_PAY", "NAVERPAY": "NAVER_PAY",
    "카카오페이": "KAKAO_PAY", "KAKAOPAY": "KAKAO_PAY",
    "토스": "TOSS_PAY", "토스페이": "TOSS_PAY", "TOSSPAY": "TOSS_PAY",
    "삼성페이": "SAMSUNG_PAY", "SAMSUNGPAY": "SAMSUNG_PAY",
    "애플페이": "APPLE_PAY", "APPLEPAY": "APPLE_PAY",
    # 카드사
    "신한카드": "SHINHAN_CARD", "SHINHAN": "SHINHAN_CARD",
    "농협카드": "NH_NONGHYUP_CARD", "NH카드": "NH_NONGHYUP_CARD", "NH_CARD": "NH_NONGHYUP_CARD",
    "삼성카드": "SAMSUNG_CARD",
    "국민카드": "KB_KOOKMIN_CARD", "KB카드": "KB_KOOKMIN_CARD", "KB_CARD": "KB_KOOKMIN_CARD",
    "하나카드": "HANA_CARD",
    # 통신사
    "SK텔레콤": "SKT", "SK_TELECOM": "SKT",
    "KT": "KT", "올레": "KT",
    "LG유플러스": "LGU_PLUS", "LGUPLUS": "LGU_PLUS", "유플러스": "LGU_PLUS",
    # 상품권
    "컬쳐랜드": "CULTURELAND_CASH", "컬처랜드": "CULTURELAND_CASH", "CULTURELAND": "CULTURELAND_CASH",
    "문화상품권": "CULTURELAND_VOUCHER",
    "북앤라이프": "BOOKNLIFE_VOUCHER", "도서문화상품권": "BOOKNLIFE_VOUCHER",
    # 커머스
    "SSG": "SSG_COM", "신세계": "SSG_COM", "쓱닷컴": "SSG_COM",
    "11번가": "11STREET",
    "지마켓": "GMARKET", "G마켓": "GMARKET",
    "제로핀": "ZEROPIN",
    "CU": "CU_CONVENIENCE_STORE", "씨유": "CU_CONVENIENCE_STORE",
    # 게임
    "쿠키런킹덤": "COOKIERUN_KINGDOM", "쿠키런": "COOKIERUN_KINGDOM",
    "COOKIERUNKINGDOM": "COOKIERUN_KINGDOM",
    # 전체
    "전체": "ALL", "모두": "ALL", "무관": "ALL", "공통": "ALL",
}


def normalize_code(value: str) -> str:
    """
    자유로운 문자열을 표준 코드로 통일합니다.

    처리 순서:
      1) 대문자화, 공백·하이픈·콜론 등을 언더스코어로 변환
      2) 허용되지 않는 문자 제거 (한글은 보존)
      3) CODE_ALIASES 사전에 있으면 표준 코드로 치환

    예시:
        "원스토어"       -> "ONE_STORE"
        "one-store"      -> "ONE_STORE"
        "쿠키런: 킹덤"   -> "COOKIERUN_KINGDOM"
        "신규게임"       -> "신규게임"  (사전에 없으면 한글 유지)
    """
    if not value:
        return ""

    upper = str(value).strip().upper()
    upper = re.sub(r"[\s\-:/.,·&()]+", "_", upper)
    cleaned = _CODE_CLEAN_PATTERN.sub("", upper)
    cleaned = re.sub(r"_+", "_", cleaned).strip("_")

    if cleaned in CODE_ALIASES:
        return CODE_ALIASES[cleaned]

    # 언더스코어를 제거한 형태로도 한 번 더 조회합니다. ("원_스토어" -> "원스토어")
    without_underscore = cleaned.replace("_", "")
    if without_underscore in CODE_ALIASES:
        return CODE_ALIASES[without_underscore]

    return cleaned


def _normalize_date(v) -> Optional[str]:
    """
    날짜를 YYYY-MM-DD 로 정리합니다.
    ⚠️ '상시' 혜택은 날짜가 없습니다(실데이터 108건 중 95건이 null).
       따라서 비어 있는 값은 에러가 아니라 None 으로 처리합니다.
    """
    if v is None:
        return None
    text = str(v).strip()
    if text == "" or text.lower() in ("null", "none", "nan", "-"):
        return None
    if not _DATE_PATTERN.match(text):
        raise ValueError(f"날짜 형식이 잘못되었습니다(YYYY-MM-DD 여야 함): {v!r}")
    datetime.strptime(text, "%Y-%m-%d")   # 2026-02-30 같은 없는 날짜를 걸러냅니다.
    return text


# =============================================================================
# 3) AI가 뽑아내야 할 결과물 (BenefitExtraction)
# =============================================================================


class BenefitExtraction(BaseModel):
    """
    AI가 웹페이지에서 추출해야 하는 혜택 1건.
    benefit_id·수집시각 등 관리용 필드는 우리가 나중에 채우므로 여기엔 없습니다.
    """

    # --- 분류 ---
    category: BenefitCategory = Field(description="혜택의 큰 분류")
    provider_or_retailer: str = Field(description="혜택 제공 주체 코드. 예: SHINHAN_CARD")
    item_or_event_name: str = Field(description="이벤트/혜택의 실제 이름(한글 원문)")
    target_platform: Platform = Field(description="적용 플랫폼. 특정 안 되면 ALL")
    target_game: str = Field(default="ALL", description="적용 게임 코드. 전체면 ALL")
    channel_type: ChannelType = Field(default=ChannelType.IN_APP, description="결제 채널")

    # --- 혜택 수치 ---
    benefit_type: BenefitType = Field(description="혜택 성격")
    benefit_value: float = Field(description="혜택 수치. 20% -> 20.0, 5000원 -> 5000.0")
    benefit_unit: BenefitUnit = Field(description="PERCENT 또는 KRW")
    min_spend_krw: int = Field(default=0, description="최소 결제 금액(원). 조건 없으면 0")
    max_benefit_krw: Optional[int] = Field(
        default=None,
        description="최대 혜택 한도(원). 한도가 명시되면 그 값, 무제한이면 null, 한도 정보가 불명확하면 0",
    )
    min_prev_month_spend_krw: Optional[int] = Field(
        default=None, description="전월 실적 요구 금액(원). 조건 없으면 null"
    )

    # --- 조건 ---
    condition_type: ConditionType = Field(default=ConditionType.GENERAL, description="조건 종류")
    is_first_purchase: bool = Field(default=False, description="첫 결제 한정 여부")
    requires_pre_app: bool = Field(default=False, description="사전 응모 필요 여부")
    payment_method_restriction: PaymentMethodRestriction = Field(
        default=PaymentMethodRestriction.NONE, description="결제수단 제한"
    )
    user_segment: UserSegment = Field(default=UserSegment.ALL_USERS, description="대상 사용자군")

    # --- 중첩·지급 방식 ---
    stacking_layer: StackingLayer = Field(description="중첩 계층")
    spend_exclusion_type: SpendExclusionType = Field(
        default=SpendExclusionType.NONE, description="실적 제외 유형"
    )
    disbursement_type: DisbursementType = Field(description="지급 방식")
    payment_route_type: PaymentRouteType = Field(
        default=PaymentRouteType.DIRECT_PAY, description="결제 경로 유형"
    )

    # --- 플래그 ---
    is_first_come_first_served: bool = Field(default=False, description="선착순 여부")
    is_tiered_limit: bool = Field(default=False, description="실적 구간별 차등 한도 여부")
    is_probabilistic: bool = Field(default=False, description="확률형(랜덤 당첨) 여부")

    # --- 기타 ---
    denomination_list: list[int] = Field(
        default_factory=list, description="상품권/기프트카드 권종 목록(원). 없으면 빈 배열"
    )
    start_date: Optional[str] = Field(default=None, description="시작일 YYYY-MM-DD. 상시면 null")
    end_date: Optional[str] = Field(default=None, description="종료일 YYYY-MM-DD. 상시면 null")
    condition_raw_text: str = Field(
        default="", description="조건 원문 텍스트. 사람이 검증할 수 있게 원문 그대로 보존"
    )

    # ------------------------------------------------------------------
    # 검증기
    # ------------------------------------------------------------------

    @field_validator("provider_or_retailer", mode="before")
    @classmethod
    def _normalize_provider(cls, v):
        """제공처 코드를 표준화합니다. 비면 UNKNOWN (ALL 로 두면 의미가 왜곡됩니다)."""
        code = normalize_code(str(v)) if v else ""
        return code or "UNKNOWN"

    @field_validator("target_game", mode="before")
    @classmethod
    def _normalize_game(cls, v):
        """게임 코드를 표준화합니다. 비면 ALL(전체 대상)."""
        code = normalize_code(str(v)) if v else ""
        return code or "ALL"

    @field_validator("item_or_event_name", "condition_raw_text", mode="before")
    @classmethod
    def _clean_text(cls, v):
        """공백·줄바꿈을 정리하고 과도하게 긴 텍스트는 자릅니다."""
        text = re.sub(r"\s+", " ", str(v or "")).strip()
        return text[:500]

    @field_validator("start_date", "end_date", mode="before")
    @classmethod
    def _validate_dates(cls, v):
        return _normalize_date(v)

    @field_validator("benefit_value")
    @classmethod
    def _check_value(cls, v: float):
        if v < 0:
            raise ValueError(f"benefit_value 는 0 이상이어야 합니다: {v}")
        return float(v)

    @field_validator("min_spend_krw", mode="before")
    @classmethod
    def _check_min_spend(cls, v):
        if v is None or v == "":
            return 0
        return max(0, int(v))

    @field_validator("max_benefit_krw", "min_prev_month_spend_krw", mode="before")
    @classmethod
    def _check_optional_int(cls, v):
        """
        빈 문자열은 null 로 바꿉니다.
        ⚠️ 0 과 null 은 다릅니다. calculator.py 기준:
             null = 진짜 무제한
             0    = 한도 정보가 구조화되지 않음(FALLBACK_PERCENT_CAP_KRW 적용 대상)
           둘을 뭉개면 계산 결과가 달라지므로 0을 null로 바꾸지 않습니다.
        """
        if v is None or v == "":
            return None
        return int(v)

    @field_validator("denomination_list", mode="before")
    @classmethod
    def _parse_denominations(cls, v):
        """
        권종 목록을 정수 리스트로 정리합니다.
        문자열("5000;10000" 또는 "5000,10000")로 와도 처리합니다.
        이상한 값은 조용히 버립니다 — 없는 권종을 지어내면 안 되기 때문입니다.
        """
        if v is None or v == "":
            return []
        if isinstance(v, str):
            parts = re.split(r"[;,|]", v)
        elif isinstance(v, (list, tuple)):
            parts = list(v)
        else:
            return []

        result: list[int] = []
        for p in parts:
            try:
                num = int(str(p).strip().replace(",", "").replace("원", ""))
                if num > 0:
                    result.append(num)
            except (ValueError, TypeError):
                continue
        return sorted(set(result))

    @model_validator(mode="after")
    def _cross_field_check(self):
        """여러 필드를 함께 보는 검사."""
        # 1) 두 날짜가 모두 있을 때만 순서를 검사합니다.
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError(
                f"end_date({self.end_date})가 start_date({self.start_date})보다 빠릅니다."
            )
        # 2) 퍼센트 값이 100을 넘으면 AI가 잘못 읽은 것입니다.
        #    (calculator.py 도 100% 이상 DISCOUNT+PERCENT 는 비정상으로 간주해 제외합니다)
        if self.benefit_unit == BenefitUnit.PERCENT and self.benefit_value > 100:
            raise ValueError(f"퍼센트 값이 100을 초과합니다: {self.benefit_value}")
        # 3) 전월 실적 금액이 있으면 condition_type 을 맞춰 줍니다.
        if self.min_prev_month_spend_krw and self.condition_type == ConditionType.GENERAL:
            object.__setattr__(self, "condition_type", ConditionType.PREV_SPEND_REQUIRED)
        # 4) 첫 결제 한정이면 condition_type 을 맞춰 줍니다.
        if self.is_first_purchase and self.condition_type == ConditionType.GENERAL:
            object.__setattr__(self, "condition_type", ConditionType.FIRST_PURCHASE)
        return self


# =============================================================================
# 4) BigQuery 에 저장되는 최종 형태 (BenefitInfo)
# =============================================================================


class BenefitInfo(BenefitExtraction):
    """BenefitExtraction + 관리용 메타 정보."""

    benefit_id: str = Field(default="", description="혜택 고유 ID. 예: BNF_AUTO_ONE_STORE_3F9A2B71")
    source_file: str = Field(default="", description="원본 출처. 크롤링분은 크롤러 이름")

    # --- 파이프라인 운영용 추가 컬럼 ---
    source_url: Optional[str] = Field(default=None, description="원문 페이지 주소")
    content_hash: str = Field(default="", description="내용 변경 감지용 해시")
    crawled_at: Optional[str] = Field(default=None, description="최초 수집 시각(UTC ISO)")
    updated_at: Optional[str] = Field(default=None, description="마지막 갱신 시각(UTC ISO)")
    is_active: bool = Field(default=True, description="오늘 기준 유효 여부")

    def to_bq_row(self) -> dict:
        """BigQuery 적재용 순수 dict 로 변환합니다. Enum 은 문자열로 풉니다."""
        row = self.model_dump()
        for key, value in row.items():
            if isinstance(value, Enum):
                row[key] = value.value
        return row

    def refresh_active_flag(self, today: Optional[date] = None) -> None:
        """
        오늘 기준 유효 여부를 다시 계산합니다.
        날짜가 없는(상시) 혜택은 항상 유효로 봅니다.
        """
        today_str = (today or datetime.now(timezone.utc).date()).isoformat()
        if self.start_date and today_str < self.start_date:
            self.is_active = False
        elif self.end_date and today_str > self.end_date:
            self.is_active = False
        else:
            self.is_active = True


# =============================================================================
# 5) 플랫폼 호환성 (platform_connection)
# =============================================================================


class PlatformConnection(BaseModel):
    """'이 결제수단을 이 플랫폼에서 쓸 수 있는가'를 나타내는 1건."""

    payment_method: str = Field(description="결제수단 코드. 예: NAVER_PAY")
    platform: Platform = Field(description="플랫폼 코드")
    is_supported: bool = Field(description="지원 여부")
    note: Optional[str] = Field(default=None, description="비고(수수료·폐지 사유 등)")

    @field_validator("payment_method", mode="before")
    @classmethod
    def _normalize_method(cls, v):
        return normalize_code(str(v))

    @field_validator("note", mode="before")
    @classmethod
    def _clean_note(cls, v):
        if v is None or str(v).strip() == "":
            return None
        return re.sub(r"\s+", " ", str(v)).strip()[:300]

    def to_bq_row(self) -> dict:
        row = self.model_dump()
        for key, value in row.items():
            if isinstance(value, Enum):
                row[key] = value.value
        return row


# =============================================================================
# 6) AI 프롬프트용 '허용 값 목록' 생성
# =============================================================================


def build_allowed_values_prompt() -> str:
    """
    Gemini 에게 "이 목록 안에서만 골라라"라고 알려주는 안내문을 만듭니다.
    위 Enum 을 수정하면 이 안내문도 자동으로 따라 바뀝니다.
    """
    lines = [
        "## 반드시 아래 목록 안의 값만 사용하세요 (목록에 없는 값을 지어내지 마세요)",
        "",
        f"- category: {', '.join(e.value for e in BenefitCategory)}",
        f"- target_platform: {', '.join(e.value for e in Platform)}",
        f"- channel_type: {', '.join(e.value for e in ChannelType)}",
        f"- benefit_type: {', '.join(e.value for e in BenefitType)}",
        f"- benefit_unit: {', '.join(e.value for e in BenefitUnit)}",
        f"- condition_type: {', '.join(e.value for e in ConditionType)}",
        f"- payment_method_restriction: {', '.join(e.value for e in PaymentMethodRestriction)}",
        f"- stacking_layer: {', '.join(e.value for e in StackingLayer)}",
        f"- user_segment: {', '.join(e.value for e in UserSegment)}",
        f"- spend_exclusion_type: {', '.join(e.value for e in SpendExclusionType)}",
        f"- disbursement_type: {', '.join(e.value for e in DisbursementType)}",
        f"- payment_route_type: {', '.join(e.value for e in PaymentRouteType)}",
        "",
        "## provider_or_retailer 는 아래 코드 중 하나를 우선 사용하세요.",
        "## 목록에 없는 새 제공처라면 영문 대문자+언더스코어로 새 코드를 만드세요.",
        f"{', '.join(sorted(KNOWN_PROVIDER_CODES))}",
        "",
        "## target_game 은 특정 게임 전용일 때만 코드를 넣고, 아니면 ALL 입니다.",
        f"알려진 게임 코드: {', '.join(sorted(KNOWN_GAME_CODES))}",
    ]
    return "\n".join(lines)
