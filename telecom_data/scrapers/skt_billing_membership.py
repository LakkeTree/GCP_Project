"""SKT '휴대폰 결제 멤버십' 부가서비스 페이지 스크래퍼.

Kyungtae 브랜치에는 없던 소스 — 팀원이 새로 찾은 URL이다. 대상 페이지 2개
(둘 다 실제로 열어서 정적 렌더링 확인함, 2026-08-14):
    일반:     https://www.tworld.co.kr/web/product/callplan/NA00008061 (월 2,900원)
    플래티넘: https://www.tworld.co.kr/web/product/callplan/NA00009764 (월 9,900원)

skt_onestore_membership.py(T멤버십 원스토어 제휴)와는 완전히 다른 메커니즘이다.
그건 T멤버십 회원이면 누구나 받는 제휴 할인이지만, 이건 별도로 매달 요금을
내고 "가입"해야 하는 유료 부가서비스다 — 가입 후 휴대폰 결제(소액결제)로
모바일 앱마켓/콘텐츠를 결제하면 결제금액의 일정 %를 할인해준다.

★ stacking_layer=PAYMENT_PG 선택 이유: engine/calculator.py의
filter_eligible_benefits()는 stacking_layer=="STORE_COUPON"이면서
provider_or_retailer가 스토어명이 아닌 경우 held_methods 검사를 건너뛰고
무조건 통과시킨다(원스토어/구글플레이 등 스토어 자체 쿠폰용으로 설계된
분기라서). 통신사 혜택을 STORE_COUPON으로 넣으면 "이 유저가 SKT 가입자인지"
전혀 체크하지 않게 되어버리므로, PAYMENT_PG로 넣어 held_methods에 "SKT"가
있어야만 적용되도록 한다(카드사 CARD_ISSUER 혜택과 동일한 방식).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SKT_BILLING"
PROVIDER_OR_RETAILER = "SKT"
SOURCE_FILE = "telecom_skt_billing"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

TIER_PAGES = {
    "일반": "https://www.tworld.co.kr/web/product/callplan/NA00008061",
    "플래티넘": "https://www.tworld.co.kr/web/product/callplan/NA00009764",
}

EXTRA_HINT = (
    "SKT '휴대폰 결제 멤버십' 부가서비스 상품 페이지입니다. 매달 요금(일반 "
    "2,900원, 플래티넘 9,900원)을 내고 가입하는 구독형 상품으로, 가입 후 "
    "휴대폰 결제(소액결제)로 모바일 앱마켓·콘텐츠를 결제하면 할인을 받습니다.\n"
    "provider_or_retailer=SKT, stacking_layer=PAYMENT_PG, "
    "category=DISCOUNT_TELECOM, benefit_type=DISCOUNT, "
    "payment_method_restriction=PHONE_BILLING_ONLY로 고정하세요(휴대폰 결제로 "
    "낸 금액에만 적용되고 카드/삼성페이 등 다른 결제수단은 해당 없음).\n"
    "★ target_platform=ALL로 고정하세요(구글Play·원스토어·AppStore 등 "
    "특정 마켓 하나로 한정되지 않습니다). target_game=ALL, "
    "requires_pre_app=true(부가서비스 가입이 선행되어야 함)로 고정하세요.\n"
    "★★ 매우 중요: 이 상품 자체의 월 구독료(예: '이용요금 2,900원')는 "
    "min_spend_krw가 아닙니다 — min_spend_krw=0으로 고정하고, 구독료는 "
    "condition_raw_text에 '월 이용요금 2,900원(부가세 포함) 별도 가입 필요'처럼 "
    "반드시 명시하세요.\n"
    "★ '콘텐츠 이용료 N% 할인'과 '휴대폰결제+콘텐츠 합산 월 M원 이상 시 "
    "추가 K원 할인'은 조건이 다른 별도 혜택이니 각각 다른 항목으로 "
    "분리하세요. 후자는 min_spend_krw에 그 합산 기준 금액(M)을 넣고, "
    "benefit_unit=KRW, benefit_value=K로 정액 할인으로 표현하세요.\n"
    "★ 원문에 '월 최대 N원 할인' 같은 한도가 있으면 max_benefit_krw에 "
    "넣으세요.\n"
    "★ item_or_event_name에 요금제 등급(일반/플래티넘)을 반드시 포함하세요 "
    "(예: 'SKT 휴대폰결제 멤버십 콘텐츠 3% 할인', 'SKT 휴대폰결제 멤버십 "
    "플래티넘 콘텐츠 5% 할인'). 등급을 안 넣으면 서로 다른 상품의 혜택이 "
    "같은 것으로 착각되어 하나만 남고 지워집니다."
)


def scrape() -> list[dict]:
    rows = []
    for tier, url in TIER_PAGES.items():
        with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
            page.goto(url)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                page.wait_for_timeout(2000)
            raw_text = f"[요금제 등급: {tier}]\n\n{page.inner_text('body')}"

        items = extract_benefits(
            raw_text,
            provider_name=f"{PROVIDER_OR_RETAILER} 휴대폰결제 멤버십({tier})",
            extra_hint=EXTRA_HINT,
        )
        rows.extend(
            normalize.to_row(
                item,
                id_domain="TELECOM",
                id_prefix=PROVIDER_CODE,
                provider_or_retailer=PROVIDER_OR_RETAILER,
                source_file=SOURCE_FILE,
                source_url=url,
            )
            for item in items
        )
    return rows


if __name__ == "__main__":
    for row in scrape():
        print(row)
