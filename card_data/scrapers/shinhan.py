"""신한카드 모바일 게임 결제 혜택 스크래퍼.

카드 상세 페이지는 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.

Simple Plan/Simple Plan+는 게임결제 전용 카드가 아니라 국내 1%/해외 2% 결제일
할인이 붙는 범용 카드다. 게임결제도 이 국내/해외 할인에 포함되는지는 페이지 원문에
명시돼 있지 않아서, ai_extract의 필터 판단(모바일 게임 결제와 직접 관련 없으면
빈 리스트 반환)에 맡긴다 — 애매하면 빈 리스트가 나오는 게 맞는 동작.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SHINHAN"
PROVIDER_OR_RETAILER = "SHINHAN_CARD"
SOURCE_FILE = "card_shinhan"
REQUIRE_LOGIN = False

BENEFIT_PAGES = [
    ("https://www.shinhancard.com/pconts/html/card/apply/credit/1237253_2207.html", "신한카드 Simple Plan"),
    ("https://www.shinhancard.com/pconts/html/card/apply/credit/1237252_2207.html", "신한카드 Simple Plan+"),
]


def scrape() -> list[dict]:
    rows = []
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        for url, product_name in BENEFIT_PAGES:
            page.goto(url)
            page.wait_for_load_state("networkidle")
            raw_text = page.inner_text("body")

            items = extract_benefits(raw_text, provider_name=product_name)
            for item in items:
                item.item_or_event_name = product_name
            rows.extend(
                normalize.to_row(
                    item,
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
