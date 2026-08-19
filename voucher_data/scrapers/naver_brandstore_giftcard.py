"""네이버 브랜드스토어(brand.naver.com)에서 구글 플레이 기프트카드를 정가보다
할인된 가격에 파는 판매 페이지를 수집하는 스크래퍼.

최종_간편결제수단_데이터.csv(BNF_0019, 2026-08-18 기준 팀 정리본)에 등록된 소스
URL을 그대로 쓴다. 작성 시점에 직접 열어보고 확인한 상태가 아니므로, 첫 실행
결과와 실제 페이지 구조를 반드시 확인하고 필요하면 EXTRA_HINT를 조정할 것.

provider_or_retailer는 원본 taxonomy 그대로 'GOOGLE_PLAY_NAVER_STORE'를 쓴다
(플랫폼명이 판매처명에 들어간 표기지만, Kyungtae 원안 그대로 채택).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GOOGLE_PLAY_NAVER_STORE"
PROVIDER_OR_RETAILER = "GOOGLE_PLAY_NAVER_STORE"
SOURCE_FILE = "voucher_naver_brandstore"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://brand.naver.com/googlegiftcode/category/f6ff2a7fd6b74e71ae561299475ea532?cp=1"
TARGET_PLATFORM = "GOOGLE_PLAY"

EXTRA_HINT = (
    "네이버 브랜드스토어에서 구글 플레이 기프트카드/기프트코드를 정가보다 할인된 "
    "가격에 파는 카테고리 목록 페이지입니다.\n"
    "★ target_platform=GOOGLE_PLAY, target_game=ALL로 고정하세요.\n"
    "★ category=GIFT_CARD, benefit_type=DISCOUNT, disbursement_type=CHARGE_PURCHASE, "
    "stacking_layer=GIFT_CARD, payment_route_type=GIFTCODE_CHARGE로 고정하세요.\n"
    "★★ 권종(5천원권/1만원권/3만원권 등)마다 할인율이 다르면 반드시 별도 항목으로 "
    "분리하세요. denomination_list에는 그 항목의 권종 금액만 넣으세요. 권종별 "
    "할인율이 동일하면 전체 권종을 denomination_list 하나에 다 넣어도 됩니다.\n"
    "★ benefit_value는 정가 대비 할인율(%)입니다. 페이지에 할인율이 직접 안 나오고 "
    "정가/판매가만 있으면 (정가-판매가)/정가*100으로 계산하세요.\n"
    "★ min_spend_krw=0으로 고정하세요.\n"
    "★ 목록 페이지에 이 판매처가 공식으로 파는 구글 플레이 기프트카드 상품만 "
    "대상으로 하고, 무관한 상품은 무시하세요.\n"
    "★ 결제수단 제한(카드만 가능/무통장 불가 등)이나 1회 구매 수량 한도가 안내돼 "
    "있으면 payment_method_restriction과 condition_raw_text에 반영하세요.\n"
    "★ 이 페이지에 관련 상품이 없거나 품절/판매중지 상태면 빈 리스트를 반환하세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
        page.wait_for_timeout(2000)
        raw_text = page.inner_text("body")

        items = extract_benefits(
            raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT
        )
        return [
            normalize.to_row(
                item,
                id_domain="VOUCHER",
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
