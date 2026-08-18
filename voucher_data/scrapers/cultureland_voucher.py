"""컬쳐랜드 비즈몰(슈퍼콘 운영)의 게임 관련 상품권/기프트코드 할인 판매가 스크래퍼.

대상 페이지 (Kyungtae 브랜치에서 실제로 열어봐서 확인함):
    https://culture.supercon.io/main

실제로 확인된 내용(2026-08-12 기준): Google Play 기프트코드 1만원권 할인율 3.0%,
판매가 9,700원. 정식 통신판매업 등록 업체(주식회사 슈퍼콘, 제2021-서울송파-3092호).
이건 '이벤트'가 아니라 '상시 판매 가격'이라 크롤링할 때마다 할인율이 바뀔 수 있다.

provider_or_retailer는 판매처(슈퍼콘)가 아니라 Kyungtae 브랜치가 정한
'CULTURELAND_CASH'(상품권 브랜드 코드)를 그대로 채택한다 — engine/calculator.py나
나중에 합칠 데이터의 provider 코드 체계와 어긋나지 않게 하기 위함. voucher_data의
다른 스크래퍼(zeropin_voucher)는 반대로 판매처명(ZEROPIN)을 쓰는데, 이 역시
Kyungtae 원본 그대로다 — 두 크롤러가 서로 다른 판매처에서 같은 브랜드 상품권을
팔기 때문에 이런 비일관성이 원본에도 있다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "CULTURELAND"
PROVIDER_OR_RETAILER = "CULTURELAND_CASH"
SOURCE_FILE = "voucher_cultureland"
DEST_FILENAME = "Voucher_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://culture.supercon.io/main"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "컬쳐랜드 비즈몰(정식 통신판매업 등록 업체, 슈퍼콘 운영)의 모바일쿠폰/"
    "상품권 판매 목록 페이지입니다. 이 사이트는 스타벅스·GS25·치킨 등 "
    "게임과 무관한 상품권도 훨씬 많이 판매합니다.\n"
    "★★ 매우 중요: 'Google Play 기프트코드', '원스토어', '앱스토어', "
    "'갤럭시스토어' 같은 게임 스토어 관련 기프트코드/캐시만 추출하세요. "
    "그 외(카페, 편의점, 치킨, 영화관 등)는 전부 무시하세요.\n"
    "★★ target_platform은 실제로 확인된 스토어별 사용 가능 여부를 반영해야 "
    "합니다 — 상품권이라고 아무 스토어에나 다 되는 게 아닙니다.\n"
    "  - 상품명에 'Google Play 기프트코드'가 명시된 항목 -> GOOGLE_PLAY로 "
    "고정하세요.\n"
    "  - '컬쳐랜드상품권', '문화상품권', '컬쳐캐쉬'처럼 특정 스토어명이 "
    "없는 일반 충전형 상품 -> ONE_STORE로 고정하세요(원스토어 캐시로 전환하는 "
    "용도로 가장 안정적으로 확인됨). condition_raw_text에 '갤럭시 스토어에서도 "
    "결제 가능하나 인증 오류로 실패하는 사례가 있어 완전히 안정적이지 않음. "
    "구글플레이는 직접 결제수단이 아니며 별도로 구글플레이 기프트코드 구매에만 "
    "사용 가능. 애플 앱스토어는 지원 안 함'이라고 반드시 남기세요.\n"
    "★ category=VOUCHER_PURCHASE, benefit_type=DISCOUNT, "
    "disbursement_type=CHARGE_PURCHASE, stacking_layer=GIFT_CARD로 "
    "고정하세요. target_game=ALL로 고정하세요.\n"
    "★ benefit_value는 '할인율'입니다(예: '할인율 3.0%' -> benefit_value=3.0, "
    "benefit_unit=PERCENT). 정가와 판매가 차이를 직접 계산하지 말고, 페이지에 "
    "적힌 할인율을 그대로 쓰세요.\n"
    "★ denomination_list에 그 상품의 권종(예: 1만원권 -> [10000])을 넣으세요. "
    "여러 권종이 있으면 각각 별도 항목으로 분리하세요.\n"
    "★ min_spend_krw=0으로 고정하세요(이건 결제 조건이 아니라 상품 구매 "
    "자체입니다). max_benefit_krw는 정가와 판매가의 차액(원 단위)을 계산해서 "
    "넣으세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        page.wait_for_load_state("networkidle")
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
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
