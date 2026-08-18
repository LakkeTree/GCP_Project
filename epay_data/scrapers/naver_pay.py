"""네이버페이 적립 안내 페이지 스크래퍼.

대상 페이지: https://campaign2.naver.com/moneypay/

Kyungtae 브랜치는 자체 조사 도구로 이 URL에 접근했을 때 SITE_BLOCKED 응답을
받아서 실물 확인을 못 했다고 기록했으나, 우리 ScraperSession(Playwright 실제
브라우저)으로는 정상 접근 확인됨(2026-08-14 재검증) — 봇 탐지가 요청 방식
자체(진짜 브라우저 여부)를 보는 것으로 추정.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "NAVERPAY"
PROVIDER_OR_RETAILER = "NAVER_PAY"
SOURCE_FILE = "epay_naverpay"
DEST_FILENAME = "Epay_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://campaign2.naver.com/moneypay/"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "네이버페이 적립 안내 페이지입니다. target_platform=ALL, target_game=ALL로 "
    "고정하세요.\n"
    "★ 기본 구매적립(약 1%), 머니 결제 추가적립(최대 1.5%), 제휴통장 결제 "
    "추가적립(최대 0.5%)처럼 적립 방식별로 구조가 나뉘어 있으면 그 구조 "
    "그대로 별도 항목으로 분리하세요. 확실하지 않으면 가장 작은 단위(조건 "
    "하나)로 나누는 쪽을 선택하세요.\n"
    "★ category=REWARD_E_PAY, benefit_type=REWARD, "
    "stacking_layer=PAYMENT_E_PAY, disbursement_type=POINT_REWARD로 "
    "고정하세요.\n"
    "★ 월간 적립 한도(예: '머니 결제 적립은 월간 최대 200만 포인트')가 있으면 "
    "max_benefit_krw에 반영하세요.\n"
    "★ 게임 결제가 적립 제외 대상으로 명시되어 있는지 꼭 확인하고, "
    "제외 목록이 있으면 condition_raw_text에 원문 그대로 옮기세요. 명시적 "
    "제외 언급이 없으면 그 사실도 조건 설명에 남기세요.\n"
    "★ 원문에 할인율/적립률처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
    "제외하세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(2000)
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
    return [
        normalize.to_row(
            item,
            id_domain="EPAY",
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
