"""KT '콘텐츠페이 휴대폰결제 플러스' 부가서비스 페이지 스크래퍼.

Kyungtae 브랜치에는 없던 소스 — 팀원이 새로 찾은 URL이다.
대상 페이지: https://ktconpay.com/ktplay/addService (2026-08-14 확인, 정적 렌더링)

SKT의 skt_billing_membership.py와 동일한 메커니즘: 매달 요금을 내고 가입하는
부가서비스로, 가입 후 휴대폰 결제(소액결제)로 앱마켓을 결제하면 결제 다음달
KT 청구서에서 할인받는다. 프리미엄형(9,900원)/일반형(3,900원) 두 등급이 한
페이지에 같이 나온다. 대상 마켓에 구글플레이·애플앱스토어·갤럭시스토어와
함께 넷플릭스·소니·MS스토어·Xbox·스포티파이도 적혀 있는데, 이 혜택 자체는
특정 마켓 전용이 아니라 "휴대폰결제로 결제하면" 전부 적용되는 방식이라
게임 마켓만 따로 골라낼 필요는 없다(원문 성격 자체가 마켓 불문 정률 할인).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "KT_BILLING"
PROVIDER_OR_RETAILER = "KT"
SOURCE_FILE = "telecom_kt_billing"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://ktconpay.com/ktplay/addService"

EXTRA_HINT = (
    "KT '휴대폰결제 플러스' 부가서비스 상품 페이지입니다(프리미엄형 월 "
    "9,900원, 일반형 월 3,900원 — 한 페이지에 두 등급이 같이 나옵니다). "
    "가입 후 휴대폰 결제(소액결제)로 구글플레이·애플앱스토어·갤럭시스토어 "
    "등에서 결제하면 결제 다음달 KT 청구서에서 할인받습니다.\n"
    "provider_or_retailer=KT, stacking_layer=PAYMENT_PG, "
    "category=DISCOUNT_TELECOM, benefit_type=DISCOUNT, "
    "disbursement_type=BILL_DISCOUNT(다음달 청구서 반영이므로), "
    "payment_method_restriction=PHONE_BILLING_ONLY로 고정하세요.\n"
    "★ target_platform=ALL, target_game=ALL, requires_pre_app=true(부가서비스 "
    "가입이 선행되어야 함)로 고정하세요.\n"
    "★★ 기본할인과 추가할인은 조건(구간)이 다른 별도 혜택이니 분리하세요. "
    "예: 일반형은 '기본할인 결제금액의 5%(최대 1.5만원)'과 '30만원 초과 "
    "결제 시 추가 4천원'을 각각 다른 항목으로 만드세요. 후자는 "
    "min_spend_krw에 그 기준 금액을 넣고 benefit_unit=KRW로 정액 할인 "
    "표현하세요.\n"
    "★ item_or_event_name에 요금제 등급(프리미엄형/일반형)을 반드시 "
    "포함하세요(예: 'KT 휴대폰결제 플러스 일반형 기본 5% 할인'). 등급을 안 "
    "넣으면 서로 다른 상품의 혜택이 같은 것으로 착각되어 하나만 남고 "
    "지워집니다.\n"
    "★ '최대 할인액 N원' 총 한도가 있으면 max_benefit_krw에 넣으세요. "
    "월 구독료(9,900원/3,900원) 자체는 min_spend_krw가 아니라 "
    "condition_raw_text에 명시하세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            page.wait_for_timeout(2000)
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
    return [
        normalize.to_row(
            item,
            id_domain="TELECOM",
            id_prefix=PROVIDER_CODE,
            provider_or_retailer=PROVIDER_OR_RETAILER,
            source_file=SOURCE_FILE,
            source_url=BENEFIT_PAGE_URL,
        )
        for item in items
    ]


if __name__ == "__main__":
    for row in scrape():
        print(row)
