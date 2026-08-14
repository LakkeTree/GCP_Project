"""하나카드 모바일 게임 결제 혜택 스크래퍼.

원스토어1 하나카드 상세 페이지는 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "HANA"
PROVIDER_OR_RETAILER = "HANA_CARD"
SOURCE_FILE = "card_hana"
REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://www.hanacard.co.kr/OPI41000000D.web?schID=pcd&mID=PI41006884P&CD_PD_SEQ=14177"
PRODUCT_NAME = "원스토어1 하나카드"


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        page.wait_for_load_state("networkidle")
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PRODUCT_NAME)
    for item in items:
        item.item_or_event_name = PRODUCT_NAME
    return [
        normalize.to_row(
            item,
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
