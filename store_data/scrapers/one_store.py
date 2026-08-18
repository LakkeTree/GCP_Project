"""원스토어 "쿠폰 득템전" 페이지 스크래퍼.

Kyungtae 브랜치 game-benefit-pipeline/crawlers/one_store.py가 실제로 열어봐서 검증한
URL·페이지 구조를 그대로 가져오되, 우리 card_data 패턴(Playwright + 프롬프트 기반
Gemini 추출)으로 재구현한다. 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "ONESTORE"
PROVIDER_OR_RETAILER = "ONE_STORE"
SOURCE_FILE = "store_onestore"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://m.onestore.co.kr/osmp/onestore/cpnEvent.omp"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "원스토어 '쿠폰 득템전' 페이지입니다. 게임별로 할인 쿠폰(1차/2차로 나뉘어 "
    "발급되는 경우 있음)을 제공합니다. 모든 쿠폰은 target_platform=ONE_STORE, "
    "category=DISCOUNT_STORE, stacking_layer=STORE_COUPON, "
    "disbursement_type=COUPON_ISSUE 입니다. 쿠폰은 버튼을 누르면 즉시 발급되는 "
    "방식이라 requires_pre_app=false 입니다(사전 응모가 아니라 즉시 발급형 쿠폰). "
    "1차/2차 쿠폰이 같이 적힌 경우 두 개의 별도 항목으로 분리하세요.\n"
    "★★★ item_or_event_name 형식을 반드시 정확히 지키세요 (매우 중요 — 이걸 "
    "안 지키면 나중에 같은 쿠폰이 서로 다른 걸로 착각되어 중복 저장됩니다):\n"
    "  '{게임명} {할인율}% 쿠폰[{1차 또는 2차}]' 형식을 항상 그대로 쓰세요.\n"
    "  예) '킹덤 가드:타워 디펜스 TD (Kingdom Guard) 50% 쿠폰[1차]'\n"
    "  절대로 할인율 숫자(예: '50%')를 이름에서 빼지 마세요.\n"
    "★★ target_game 필수 지침: 이 페이지의 모든 쿠폰은 특정 게임 전용입니다. "
    "항목 제목에 적힌 그 게임 이름을 target_game에 그대로 넣으세요. 이 "
    "페이지에서 target_game=ALL 로 채울 항목은 없습니다."
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
            id_domain="STORE",
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
