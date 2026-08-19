"""G마켓(gmarket.co.kr) 브랜드샵에서 구글 플레이 기프트카드를 정가보다 할인된
가격에 파는 판매 페이지를 수집하는 스크래퍼.

최종_간편결제수단_데이터.csv(BNF_0020, 2026-08-18 기준 팀 정리본)에 등록된 소스
URL을 그대로 쓴다. 작성 시점에 직접 열어보고 확인한 상태가 아니므로, 첫 실행
결과와 실제 페이지 구조를 반드시 확인하고 필요하면 EXTRA_HINT를 조정할 것.

provider_or_retailer는 원본 taxonomy 그대로 'GMARKET'을 쓴다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GMARKET"
PROVIDER_OR_RETAILER = "GMARKET"
SOURCE_FILE = "voucher_gmarket"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = "https://www.gmarket.co.kr/n/brandshop/googlegiftcode/all?spm=gmktpc.brandshophome.0.0.70bf65efFPwMA0"
TARGET_PLATFORM = "GOOGLE_PLAY"

EXTRA_HINT = (
    "G마켓 브랜드샵에서 구글 플레이 기프트카드/기프트코드를 정가보다 할인된 "
    "가격에 파는 판매 페이지입니다.\n"
    "★ target_platform=GOOGLE_PLAY, target_game=ALL로 고정하세요.\n"
    "★ category=GIFT_CARD, benefit_type=DISCOUNT, disbursement_type=CHARGE_PURCHASE, "
    "stacking_layer=GIFT_CARD, payment_route_type=GIFTCODE_CHARGE로 고정하세요.\n"
    "★★ 권종(5천원권/1만원권/3만원권 등)마다 할인율이 다르면 반드시 별도 항목으로 "
    "분리하세요. denomination_list에는 그 항목의 권종 금액만 넣으세요. 권종별 "
    "할인율이 동일하면 전체 권종을 denomination_list 하나에 다 넣어도 됩니다.\n"
    "★ benefit_value는 정가 대비 할인율(%)입니다. 페이지에 할인율이 직접 안 나오고 "
    "정가/판매가만 있으면 (정가-판매가)/정가*100으로 계산하세요.\n"
    "★ min_spend_krw=0으로 고정하세요.\n"
    "★ 1회 구매 수량 한도(예: 최대 5개)가 안내돼 있으면 condition_raw_text에 "
    "반영하세요.\n"
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
