"""KB국민카드 모바일 게임 결제 혜택 스크래퍼.

노리2 체크카드(KB Pay) 혜택 페이지는 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "KB"
PROVIDER_OR_RETAILER = "KB_KOOKMIN_CARD"
SOURCE_FILE = "card_kb"
DEST_FILENAME = "Card_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://card.kbcard.com/CRD/DVIEW/HCAMCXPRICAC0076?mainCC=a&cooperationcode=07964"
REQUIRE_LOGIN = False


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        page.wait_for_load_state("networkidle")
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER)
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
