"""SSG닷컴(ssg.com)에서 구글 플레이/원스토어 기프트카드를 정가보다 할인된 가격에
파는 판매 페이지를 수집하는 스크래퍼.

최종_간편결제수단_데이터.csv(BNF_0018, BNF_0023, 2026-08-18 기준 팀 정리본)에
등록된 소스 URL을 그대로 쓴다. 제로핀(zeropin_voucher.py)과 달리 이 두 URL은
작성 시점에 직접 열어보고 확인한 상태가 아니므로, 첫 실행 결과와 실제 페이지
구조를 반드시 확인하고 필요하면 EXTRA_HINT를 조정할 것.

provider_or_retailer는 원본 taxonomy 그대로 'SSG_COM'을 쓴다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SSG_COM"
PROVIDER_OR_RETAILER = "SSG_COM"
SOURCE_FILE = "voucher_ssg"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

# (상품명 -> (URL, target_platform))
PRODUCT_PAGES = {
    "구글 플레이 기프트카드": (
        "https://www.ssg.com/search.ssg?query=%EA%B5%AC%EA%B8%80+%EA%B8%B0%ED%94%84%ED%8A%B8%EC%B9%B4%EB%93%9C",
        "GOOGLE_PLAY",
    ),
    "원스토어 기프트카드": (
        "https://m-shinsegaemall.ssg.com/mall/disp/brandMain?brandId=3000024601",
        "ONE_STORE",
    ),
}

EXTRA_HINT_TEMPLATE = (
    "SSG닷컴에서 {platform} 기프트카드/기프트코드를 정가보다 할인된 가격에 파는 "
    "판매 페이지입니다.\n"
    "★ target_platform={platform}, target_game=ALL로 고정하세요.\n"
    "★ category=GIFT_CARD, benefit_type=DISCOUNT, disbursement_type=CHARGE_PURCHASE, "
    "stacking_layer=GIFT_CARD, payment_route_type=GIFTCODE_CHARGE로 고정하세요.\n"
    "★★ 권종(5천원권/1만원권/3만원권 등)마다 할인율이 다르면 반드시 별도 항목으로 "
    "분리하세요. denomination_list에는 그 항목의 권종 금액만 넣으세요. 권종별 "
    "할인율이 동일하면 전체 권종을 denomination_list 하나에 다 넣어도 됩니다.\n"
    "★ benefit_value는 정가 대비 할인율(%)입니다. 페이지에 할인율이 직접 안 나오고 "
    "정가/판매가만 있으면 (정가-판매가)/정가*100으로 계산하세요.\n"
    "★ min_spend_krw=0으로 고정하세요.\n"
    "★ 결제수단 제한(카드만 가능/무통장 불가 등)이나 1회 구매 수량 한도가 안내돼 "
    "있으면 payment_method_restriction과 condition_raw_text에 반영하세요.\n"
    "★ 검색결과 페이지라면 이 상품(기프트카드/기프트코드) 자체가 아닌 무관한 "
    "검색결과는 무시하세요.\n"
    "★ 이 페이지에 관련 상품이 없거나 품절/판매중지 상태면 빈 리스트를 반환하세요."
)


def scrape() -> list[dict]:
    rows = []
    # ⚠️ zeropin_voucher.py와 동일하게 상품마다 새 ScraperSession(=새 브라우저
    # 컨텍스트)을 연다 — SPA 라우팅 페이지에서 컨텍스트 재사용 시 두 번째 페이지부터
    # 스켈레톤만 렌더링되는 문제가 실제로 확인된 적이 있어 방어적으로 유지한다.
    for name, (url, platform) in PRODUCT_PAGES.items():
        with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
            page.goto(url)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            page.wait_for_timeout(2000)
            raw_text = f"[상품명: {name}]\n\n{page.inner_text('body')}"

            items = extract_benefits(
                raw_text,
                provider_name=PROVIDER_OR_RETAILER,
                extra_hint=EXTRA_HINT_TEMPLATE.format(platform=platform),
            )
            rows.extend(
                normalize.to_row(
                    item,
                    id_domain="VOUCHER",
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
