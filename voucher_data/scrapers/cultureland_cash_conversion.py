"""컬쳐랜드(cultureland.co.kr)에서 컬쳐캐시를 제휴 포인트/플랫폼 결제수단으로
전환할 때 부과되는 전환 수수료율을 수집하는 스크래퍼.

최종_간편결제수단_데이터.csv(BNF_0079~0082, BNF_0084, 2026-08-18 기준 팀
정리본)의 provider_or_retailer='CULTURELAND_CASH' 행이 가리키는 출처 페이지를
WebFetch로 직접 열어서 실제 값을 확인한 뒤 작성했다. 확인 결과 PAYCO 전환
수수료가 CSV엔 8%로 기록돼 있었지만 실제 페이지(2026-08-18 기준)엔 6%로,
스마일머니(구 스마일캐시) 전환 수수료도 CSV엔 3%였지만 실제로는 5%로 이미
바뀌어 있었다 — 이 값들이 수시로 바뀐다는 뜻이라, 자동화로 잡아내야 할
실익이 확인된 셈이다. 네이버페이(6%)·SSG MONEY(5%)·구글플레이 충전(3%)은
CSV 기록값과 일치했다.

BNF_0083(갤럭시 스토어, "컬쳐랜드 계정 직접 연동 결제, 수수료 없음")은
컬쳐랜드 사이트 안에서 대응하는 안내 페이지를 찾지 못해 이번 크롤러 범위에서
제외한다 — 갤럭시 스토어 앱 결제화면 쪽 정보일 가능성이 있어 별도 확인 필요.

각 `conversion/*_bridge.do` 페이지는 로그인 없이도 수수료·조건 텍스트가 그대로
노출된다(실제 전환 실행에는 로그인이 필요하지만 안내 문구 열람에는 불필요).
실제 전환 버튼은 클릭하지 않고 페이지 텍스트만 읽는다.

provider_or_retailer는 원본 taxonomy 그대로 'CULTURELAND_CASH'를 쓴다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "CULTURELAND_CASH"
PROVIDER_OR_RETAILER = "CULTURELAND_CASH"
SOURCE_FILE = "voucher_cultureland_cash_conversion"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

# 전환 대상 표시명 -> (URL, target_platform, payment_method_restriction, 전환 유형)
PRODUCT_PAGES = {
    "네이버페이 포인트": (
        "https://www.cultureland.co.kr/conversion/naverpay_bridge.do",
        "ALL", "POINT_ONLY", "제휴포인트",
    ),
    "PAYCO 포인트": (
        "https://www.cultureland.co.kr/conversion/payco_bridge.do",
        "ALL", "POINT_ONLY", "제휴포인트",
    ),
    "스마일머니": (
        "https://www.cultureland.co.kr/conversion/smilecash_bridge.do",
        "ALL", "POINT_ONLY", "제휴포인트",
    ),
    "SSG MONEY": (
        "https://www.cultureland.co.kr/conversion/ssgpay_bridge.do",
        "ALL", "POINT_ONLY", "제휴포인트",
    ),
    "구글 플레이 기프트코드": (
        "https://www.cultureland.co.kr/google/googleBuy.do",
        "GOOGLE_PLAY", "NONE", "플랫폼",
    ),
}

ITEM_NAME_BY_TYPE = {
    "제휴포인트": "상품권 캐시→제휴포인트 전환 수수료 - 전환 수수료율",
    "플랫폼": "상품권 캐시→플랫폼 결제 전환 - 전환 수수료율",
}

EXTRA_HINT_TEMPLATE = (
    "컬쳐랜드에서 컬쳐캐시를 {target}(으)로 전환할 때의 수수료 안내 페이지입니다.\n"
    "★ item_or_event_name은 정확히 다음 문자열을 그대로 쓰세요: '{item_name}'\n"
    "★ target_platform={platform}, target_game=ALL, channel_type=ONLINE으로 "
    "고정하세요.\n"
    "★ category=VOUCHER_PURCHASE, benefit_type=FEE, benefit_unit=PERCENT, "
    "condition_type=CONVERSION_FEE, disbursement_type=CHARGE_PURCHASE, "
    "stacking_layer=GIFT_CARD, payment_route_type=INDIRECT_CONVERSION, "
    "payment_method_restriction={restriction}로 고정하세요.\n"
    "★ benefit_value는 페이지에 명시된 전환 수수료율(%)을 그대로 쓰세요(할인이 "
    "아니라 고객 부담 수수료이며, 수수료가 없으면 0으로 쓰세요).\n"
    "★ min_spend_krw=0, max_benefit_krw=0으로 고정하세요.\n"
    "★ condition_raw_text는 'Target: {target} | Cond: (조건 요약) | Note: "
    "(수수료 설명)' 형식으로 쓰고, 최소 전환 금액·보유 한도·본인인증 필요 "
    "여부 같은 조건이 있으면 Cond에 요약해서 담으세요.\n"
    "★ 이 페이지에 전환 수수료 정보가 없거나 서비스가 종료됐으면 빈 리스트를 "
    "반환하세요."
)


def scrape() -> list[dict]:
    rows = []
    for target, (url, platform, restriction, conv_type) in PRODUCT_PAGES.items():
        with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
            page.goto(url)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            page.wait_for_timeout(2000)
            raw_text = f"[전환 대상: {target}]\n\n{page.inner_text('body')}"

            hint = EXTRA_HINT_TEMPLATE.format(
                target=target,
                item_name=ITEM_NAME_BY_TYPE[conv_type],
                platform=platform,
                restriction=restriction,
            )
            items = extract_benefits(
                raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=hint
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
