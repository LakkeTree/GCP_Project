"""SKT T멤버십의 '원스토어' 제휴 브랜드 상세 페이지 스크래퍼.

Kyungtae 브랜치 game-benefit-pipeline/crawlers/skt_membership.py가 실제로 열어봐서
검증한 URL과 팀원이 이번에 다시 찾은 URL이 완전히 동일하다(brandId=1213).
그 크롤러가 확인한 내용(2026-08-12 기준): 게임/게임 인앱 카테고리 10% 할인
또는 적립(일 최대 10,000원), 앱 인앱 카테고리 10%(일 최대 3,000원). 원스토어
본인 ID 인증 완료 고객 대상.

Kyungtae 원안은 stacking_layer=STORE_COUPON이었지만, engine/calculator.py를
확인해보니 STORE_COUPON은 provider_or_retailer가 스토어명이 아니면 held_methods
검사를 건너뛰어 버려서(원스토어 자체 쿠폰용으로 설계된 분기) "이 유저가 SKT
가입자인지"를 전혀 반영하지 못한다. 그래서 이 포팅에서는 PAYMENT_PG로
바꿔서 held_methods에 "SKT"가 있어야만 적용되도록 한다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SKT_ONESTORE"
PROVIDER_OR_RETAILER = "SKT"
SOURCE_FILE = "telecom_skt_onestore"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://sktmembership.tworld.co.kr/mps/pc-bff/benefitbrand/detail.do?brandId=1213"

EXTRA_HINT = (
    "SKT T멤버십의 '원스토어' 제휴 브랜드 상세 페이지입니다. "
    "provider_or_retailer=SKT, target_platform=ONE_STORE, target_game=ALL, "
    "stacking_layer=PAYMENT_PG로 고정하세요.\n"
    "★★ 매우 중요: 이 페이지엔 게임과 무관한 카테고리(쇼핑, 콘텐츠 구독 "
    "등)도 섞여 있습니다. '게임' 또는 '게임 인앱' 카테고리에 해당하는 "
    "혜택만 추출하세요. '앱' 카테고리는 게임이 포함될 수 있으니 포함하되, "
    "쇼핑·구독 카테고리는 제외하세요.\n"
    "★ 할인형과 적립형이 따로 있으면 별도 항목으로 분리하세요 "
    "(할인형: benefit_type=DISCOUNT, disbursement_type=INSTANT_DISCOUNT, "
    "category=DISCOUNT_TELECOM / 적립형: benefit_type=REWARD, "
    "disbursement_type=POINT_REWARD, category=REWARD_TELECOM).\n"
    "★ requires_pre_app=true로 고정하세요 (원스토어 본인 ID 인증이 "
    "선행되어야 적용됩니다). payment_method_restriction=NONE으로 "
    "고정하세요(휴대폰결제 전용이 아니라 원스토어 인증 계정이면 결제수단과 "
    "무관하게 적용됩니다).\n"
    "★ '일 최대 N원/N포인트' 같은 한도가 있으면 max_benefit_krw에 넣으세요.\n"
    "★ 원문에 할인율/적립률처럼 핵심 정보가 없으면 결과에서 제외하세요."
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
