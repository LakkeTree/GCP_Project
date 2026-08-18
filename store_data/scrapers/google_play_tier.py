"""구글플레이 포인트(Play Points) 등급별 적립률 페이지 스크래퍼.

대상 페이지 (Kyungtae 브랜치에서 실제로 열어봐서 확인함):
    https://play.google.com/intl/ALL_kr/about/playpoints/notifications/how-to-earn-points/

실제로 확인된 내용(2026-08-12 기준): 브론즈 1,000원당 1포인트 ~ 다이아몬드
1,000원당 2포인트. 1포인트=1원으로 가정해 퍼센트로 환산한다(이 환산율이
구글플레이 포인트에도 정확히 맞는지는 미확인 — Gemini가 원문 표현을
condition_raw_text에 그대로 남기게 해서 나중에 검증 가능하게 한다).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GOOGLEPLAY_TIER"
PROVIDER_OR_RETAILER = "GOOGLE_PLAY"
SOURCE_FILE = "store_googleplay_tier"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://play.google.com/intl/ALL_kr/about/playpoints/notifications/how-to-earn-points/"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "구글플레이 Play Points 등급별 적립률 공식 안내 페이지입니다. "
    "target_platform=GOOGLE_PLAY, category=SUMMARY_STORE_TIER_REWARD_RATES로 "
    "고정하세요. target_game=ALL로 고정하세요(특정 게임이 아니라 모든 구매에 "
    "적용됨).\n"
    "★★ 매우 중요: 이 페이지는 '1,000원당 N포인트' 형식입니다. 1포인트를 "
    "1원으로 간주해서 백분율로 환산하세요. 계산식: (포인트 ÷ 1000) × 100 "
    "= 포인트 ÷ 10 (%). 예) 브론즈 '1,000원당 1포인트' → benefit_value=0.1, "
    "benefit_unit=PERCENT. 실버 '1,000원당 1.1포인트' → benefit_value=0.11.\n"
    "★ 등급마다(브론즈/실버/골드/플래티넘/다이아몬드) 별도의 항목으로 "
    "분리하세요 — 하나로 뭉치지 마세요. item_or_event_name에 등급 이름을 "
    "반드시 포함하세요(예: 'Google Play Points 브론즈 등급 적립').\n"
    "★ stacking_layer=STORE_COUPON, disbursement_type=POINT_REWARD, "
    "benefit_type=REWARD로 고정하세요.\n"
    "★ condition_raw_text에는 원문의 정확한 포인트 표현(예: '1,000원당 "
    "1포인트')을 그대로 옮겨서, 나중에 사람이 환산이 맞는지 검증할 수 있게 "
    "하세요."
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
