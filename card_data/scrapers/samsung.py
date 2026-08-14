"""삼성카드 모바일 게임 결제 혜택 스크래퍼.

카드 상세 페이지는 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.
카드 상품이 여러 개라 URL 목록을 순회해서 결과를 합친다. item_or_event_name은
Gemini의 페이지 해석에 맡기지 않고 상품명을 코드에 고정해서 덮어쓴다 — 이름이
비슷한 상품끼리(iD GLOBAL / iD SELECT ON) 잘못 뽑히거나 실행마다 다르게 뽑혀서
benefit_id 해시(dedupe 기준)가 흔들리는 걸 막기 위함.

"주요혜택" 목록의 "인앱결제/디지털콘텐츠..." 항목은 요약 배지일 뿐, 전월실적
구간별 한도 같은 실제 조건은 그 항목을 클릭해야 펼쳐지는 "카드 서비스 상세"
섹션에 있다 (배지 텍스트만으로 추출하면 한도/전월실적 조건이 통째로 빠짐).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SAMSUNG"
PROVIDER_OR_RETAILER = "SAMSUNG_CARD"
SOURCE_FILE = "card_samsung"
REQUIRE_LOGIN = False

BENEFIT_PAGES = [
    ("https://www.samsungcard.com/home/card/cardinfo/PGHPPCCCardCardinfoDetails001?code=AAP1824", "삼성 iD GLOBAL 카드"),
    ("https://www.samsungcard.com/home/card/cardinfo/PGHPPCCCardCardinfoDetails001?code=AAP1877", "삼성 iD SELECT ON 카드"),
]


def scrape() -> list[dict]:
    rows = []
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        for url, product_name in BENEFIT_PAGES:
            page.goto(url)
            page.wait_for_load_state("networkidle")
            page.get_by_text("인앱", exact=False).first.click()
            page.wait_for_timeout(500)
            raw_text = page.inner_text("body")

            items = extract_benefits(raw_text, provider_name=product_name)
            for item in items:
                item.item_or_event_name = product_name
            rows.extend(
                normalize.to_row(
                    item,
                    id_domain="CARD",
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
