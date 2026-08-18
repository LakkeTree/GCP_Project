"""KT 멤버십의 '원스토어' 제휴 브랜드 상세 페이지 스크래퍼.

Kyungtae 브랜치 game-benefit-pipeline/crawlers/kt_membership.py가 실제로 열어봐서
검증한 URL과 팀원이 이번에 다시 찾은 URL이 완전히 동일하다
(membership.kt.com/discount/partner/C23/66/PartnerDetail.do). 그 크롤러가
확인한 내용(2026-08-12 기준): [상시혜택] 게임/앱(인앱결제) 10% 할인 일 1회
최대 1만원, [생일혜택] 1만원 이상 결제 시 5천원 할인(생일 달 한정). 쿠폰은
KT멤버십 앱에서만 다운로드 가능.

Kyungtae 원안은 stacking_layer=STORE_COUPON이었지만, skt_onestore_membership.py와
동일한 이유로(engine/calculator.py의 STORE_COUPON 분기가 통신사 provider를
held_methods 검증 없이 통과시켜버림) PAYMENT_PG로 바꿔서 held_methods에 "KT"가
있어야만 적용되도록 한다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "KT_ONESTORE"
PROVIDER_OR_RETAILER = "KT"
SOURCE_FILE = "telecom_kt_onestore"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://membership.kt.com/discount/partner/C23/66/PartnerDetail.do"

EXTRA_HINT = (
    "KT 멤버십의 '원스토어' 제휴 브랜드 상세 페이지입니다. "
    "provider_or_retailer=KT, target_platform=ONE_STORE, target_game=ALL, "
    "stacking_layer=PAYMENT_PG로 고정하세요.\n"
    "★★ '원스토리앱'(이북/만화/웹툰) 관련 혜택은 게임이 아니니 제외하세요. "
    "'게임'과 '앱(인앱결제)' 카테고리만 추출하세요.\n"
    "★ [상시혜택]과 [생일혜택]은 조건이 다르니 별도 항목으로 분리하세요. "
    "생일 한정 혜택은 user_segment=ALL_USERS로 두고 condition_raw_text에 "
    "'생일 당월 한정'을 명시하세요.\n"
    "★ category=DISCOUNT_TELECOM, benefit_type=DISCOUNT, "
    "disbursement_type=COUPON_ISSUE로 고정하세요 (앱에서 쿠폰을 다운로드 "
    "받는 방식이므로).\n"
    "★ requires_pre_app=true, payment_method_restriction=NONE으로 "
    "고정하세요 (KT멤버십 앱에서 쿠폰을 다운로드해야 사용 가능하지만, "
    "결제수단 자체는 휴대폰결제로 한정되지 않습니다).\n"
    "★ '일 1회, 최대 N원' 같은 한도가 있으면 max_benefit_krw에 넣고, "
    "1일 1회 제한은 condition_raw_text에 명시하세요."
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
