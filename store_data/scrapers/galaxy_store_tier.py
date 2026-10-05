"""삼성전자 멤버십 등급별 갤럭시 스토어 포인트 적립률 페이지 스크래퍼.

대상 페이지 (Kyungtae 브랜치에서 실제로 열어봐서 확인함):
    https://www.samsung.com/sec/membership/membershipLevel/

실제로 확인된 내용(2026-08-12 기준): 일반/스타 0.1%, 프레스티지 0.1%+1%,
로열블루 0.1%+2%. 이 페이지는 삼성전자 멤버십 전체(가전제품 포함)를 다루므로
갤럭시 스토어 관련 내용만 추출하도록 강하게 지시한다.

2026-08-22 기준 스케줄 크롤링 대상에서 제외함(benefit-crawler-store Job 인자에서
galaxy_store_tier 삭제). www.samsung.com이 Cloud Run/GCE 등 Google 호스팅 IP를
카테고리째로 차단하는 것으로 추정(samsung_pay.py와 동일 증상 — VM으로 옮겨도
TimeoutError 재현됨, 2026-08-22 확인). 등급별 적립률은 자주 바뀌는 값이 아니라서,
2026-08-18 수동 크롤링 결과 4건을 benefit_info에 source_file='legacy_manual_db'로
재태깅해 수동 관리 데이터로 남겨뒀다 — 계산 엔진(game-pay-api/engine)은
source_file을 안 보므로 계산 결과엔 영향 없음. 이 파일 자체는 나중에 우회 경로를
찾으면 다시 스케줄에 넣을 수 있도록 그대로 둔다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GALAXYSTORE_TIER"
PROVIDER_OR_RETAILER = "GALAXY_STORE"
SOURCE_FILE = "store_galaxystore_tier"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://www.samsung.com/sec/membership/membershipLevel/"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "삼성전자 멤버십 '등급별 혜택' 공식 페이지입니다. 이 페이지는 TV·냉장고 "
    "같은 가전제품 구매 혜택까지 전부 다루는데, 그건 게임 결제와 무관하니 "
    "무시하세요. 오직 '갤럭시스토어' 언급이 있는 포인트 적립률만 추출하세요.\n"
    "target_platform=GALAXY_STORE, category=SUMMARY_STORE_TIER_REWARD_RATES, "
    "target_game=ALL로 고정하세요.\n"
    "★ 등급마다(일반/스타/프레스티지/로열블루) 별도의 항목으로 분리하세요. "
    "item_or_event_name에 등급 이름을 반드시 포함하세요(예: '삼성전자 멤버십 "
    "로열블루 등급 갤럭시스토어 적립').\n"
    "★★ 매우 중요: benefit_value는 그 등급에서 실제로 받는 '총' 적립률을 "
    "쓰세요. 예를 들어 로열블루는 기본 0.1% + 추가 2% = 총 2.1%입니다. "
    "0.1%와 2%를 각각 별도 항목으로 쪼개지 말고, condition_raw_text에 "
    "'기본 0.1% + 추가 2%' 처럼 구성 내역을 원문 그대로 적어서 검증할 수 "
    "있게 하세요.\n"
    "★ stacking_layer=STORE_COUPON, disbursement_type=POINT_REWARD, "
    "benefit_type=REWARD로 고정하세요.\n"
    "★ 월/2년 적립 한도가 있으면 max_benefit_krw에 그 한도(원 단위, "
    "포인트=원으로 간주)를 넣으세요. 갤럭시스토어는 이 한도가 적용 안 "
    "된다고 명시되어 있으니, 갤럭시스토어 관련 항목이라면 이 사실을 "
    "condition_raw_text에 반드시 남기세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        try:
            # 삼성닷컴은 백그라운드 분석/채팅 스크립트가 계속 붙어 있어
            # networkidle이 끝까지 안 오는 경우가 있다 — 타임아웃 나면
            # 이미 본문은 렌더링된 상태이므로 그냥 진행한다.
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            page.wait_for_timeout(2000)
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
