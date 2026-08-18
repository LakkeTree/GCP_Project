"""제로핀(zeropin.co.kr)에서 게임 결제와 관련된 상품권/기프트카드 할인 판매가를
수집하는 스크래퍼.

Kyungtae 브랜치가 실제로 열어봐서 이미 확인한 URL 5개를 그대로 하드코딩한다
(2026-08-12 기준, 정식 통신판매업 등록 업체: 상호 세이프핀,
통신판매업신고번호 제2022-용인기흥-3057). 제로핀은 25개 넘는 상품권을 팔지만
게임 결제와 명확히 관련된 5개만 크롤링한다(넥슨카드·한게임 등 특정 게임사
전용 캐시는 target_platform 범위 밖이라 제외).

provider_or_retailer는 판매처명 'ZEROPIN'을 쓴다(Kyungtae 원본 그대로) —
cultureland_voucher.py가 브랜드명 'CULTURELAND_CASH'를 쓰는 것과 표기 기준이
다르지만, 두 크롤러 모두 원본 taxonomy를 그대로 채택하기로 한 결정에 따른 것.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "ZEROPIN"
PROVIDER_OR_RETAILER = "ZEROPIN"
SOURCE_FILE = "voucher_zeropin"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

# 게임 결제와 명확히 관련된 상품권만 골랐다.
PRODUCT_PAGES = {
    "컬쳐랜드 상품권": "https://zeropin.co.kr/product/culture",
    "문화상품권(18핀)": "https://zeropin.co.kr/product/culture2",
    "북앤라이프 도서상품권": "https://zeropin.co.kr/product/book",
    "구글 기프트카드": "https://zeropin.co.kr/product/google",
    "스마트문상": "https://zeropin.co.kr/product/smart",
}

EXTRA_HINT = (
    "제로핀(정식 통신판매업 등록 업체)의 상품권 판매 페이지입니다.\n"
    "★ 상품명에 따라 target_platform을 다르게 정하세요:\n"
    "  - '구글 기프트카드' -> GOOGLE_PLAY (구글 공식 기프트코드라 구글플레이 "
    "전용입니다). condition_raw_text에 '갤럭시 스토어에서는 구글 기프트카드로 "
    "결제 불가(삼성 공식 확인)'를 반드시 남기세요.\n"
    "  - '컬쳐랜드', '문화상품권', '북앤라이프', '스마트문상' -> ONE_STORE "
    "(ALL이 아닙니다! 이 상품권들은 체크아웃에서 결제수단으로 바로 고르는 게 "
    "아니라, 먼저 '원스토어 캐시'로 충전/전환한 뒤에 쓰는 방식입니다. "
    "구글플레이·앱스토어가 이 상품권을 직접 받는지는 확인되지 않았고, 애플은 "
    "자사 기프트카드만 받으므로 ALL로 표시하면 부정확합니다). "
    "condition_raw_text에 '갤럭시 스토어에서도 결제 가능하나 인증 오류로 "
    "실패하는 사례가 있어 완전히 안정적이지 않음. 구글플레이는 직접 "
    "결제수단이 아니며, 컬쳐랜드 상품은 별도로 구글플레이 기프트코드 구매에 "
    "사용 가능'을 반드시 남기세요.\n"
    "target_game=ALL로 고정하세요.\n"
    "★ category=VOUCHER_PURCHASE, benefit_type=DISCOUNT, "
    "disbursement_type=CHARGE_PURCHASE, stacking_layer=GIFT_CARD로 "
    "고정하세요.\n"
    "★★ 권종(5만원권/3만원권/1만원권 등)마다 할인율이 다르면 반드시 별도 "
    "항목으로 분리하세요. denomination_list에는 그 항목의 권종 금액만(예: "
    "1만원권이면 [10000]) 넣으세요.\n"
    "★ benefit_value는 표에 적힌 할인율을 그대로 쓰세요(예: '6.5%↓' -> 6.5). "
    "정가와 판매가로 직접 계산하지 말고 원문의 할인율 표기를 우선하세요.\n"
    "★ min_spend_krw=0으로 고정하세요. max_benefit_krw는 정가-판매가 차액(원)을 "
    "계산해서 넣으세요.\n"
    "★ 일일 구매 한도 안내(예: '문화상품권 일일 구매한도 20만원')가 있으면 "
    "condition_raw_text에 포함하세요."
)


def scrape() -> list[dict]:
    rows = []
    # ⚠️ 상품마다 새 ScraperSession(=새 브라우저 컨텍스트)을 연다. 하나의
    # 컨텍스트로 5개 URL을 연속 이동해봤더니(SPA 라우팅 추정) 첫 페이지만
    # 정상 렌더링되고 그 뒤로는 계속 뼈대만 있는 690자짜리 스켈레톤 페이지가
    # 나오는 문제를 실제로 확인했다(networkidle/고정 대기 다 소용없었음).
    # 컨텍스트를 매번 새로 만드니 5개 전부 정상 렌더링됨 — 세션/로컬스토리지
    # 상태가 반복 탐색 시 렌더링을 방해하는 것으로 추정.
    for name, url in PRODUCT_PAGES.items():
        with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
            page.goto(url)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass
            page.wait_for_timeout(2000)
            raw_text = f"[상품명: {name}]\n\n{page.inner_text('body')}"

            items = extract_benefits(
                raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT
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
