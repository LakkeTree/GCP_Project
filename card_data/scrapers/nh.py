"""NH농협카드 모바일 게임 결제 혜택 스크래퍼.

NH농협카드 공식 홈페이지(card.nonghyup.com)는 자체 보안프로그램을 요구해서
Playwright로 직접 접근이 안 된다 — 대신 카드 비교 사이트 카드고릴라
(card-gorilla.com)의 카드 상세페이지를 원천으로 우회한다.

카드고릴라 상세페이지는 "주요혜택"이 아코디언으로 접혀 있고, 게임결제 조건은
접힌 상태에선 렌더링되지 않는다. 상품마다 펼쳐야 할 아코디언 라벨 텍스트가
달라서(zgm.play카드는 "선택형", GOODGAME 체크카드는 "게임") 상품별로 지정해서
클릭한 뒤 본문을 추출한다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "NH"
PROVIDER_OR_RETAILER = "NH_NONGHYUP_CARD"
SOURCE_FILE = "card_nh"
REQUIRE_LOGIN = False

# (URL, 상품명, 펼쳐야 할 아코디언 라벨 텍스트)
BENEFIT_PAGES = [
    ("https://www.card-gorilla.com/card/detail/2544", "NH농협 zgm.play카드", "선택형"),
    ("https://www.card-gorilla.com/card/detail/2443", "NH농협 GOODGAME 체크카드", "게임"),
]


def scrape() -> list[dict]:
    rows = []
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        for url, product_name, accordion_label in BENEFIT_PAGES:
            page.goto(url)
            page.wait_for_load_state("networkidle")
            page.get_by_text(accordion_label, exact=True).first.click()
            page.wait_for_timeout(300)
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
