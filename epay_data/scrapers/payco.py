"""페이코(PAYCO) 포인트 적립 리워드 페이지 스크래퍼.

대상 페이지 (Kyungtae 브랜치에서 실제로 열어봐서 확인함):
    https://www.payco.com/point/reward.nhn

실제로 확인된 내용(2026-08-12 기준) — 등급제가 아니라 결제 방식별 고정 요율:
    앱 결제(충전 포인트): 온라인 1%, 오프라인 1% (VISA 컨택리스는 예외로 0.3%)
    실물카드 결제: 0.3%

제외 업종 목록(대학 등록금·상품권·통신비·보험료·공과금·교통 등)에 "게임 결제"가
명시적으로 없어서, 페이코 결제는 게임 결제에도 정상 적용될 가능성이 높다고 판단됨
(Kyungtae 조사 결과 그대로 채택).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "PAYCO"
PROVIDER_OR_RETAILER = "PAYCO"
SOURCE_FILE = "epay_payco"
DEST_FILENAME = "Epay_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://www.payco.com/point/reward.nhn"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "페이코(PAYCO) 공식 포인트 리워드 안내 페이지입니다. target_platform=ALL, "
    "target_game=ALL로 고정하세요(특정 스토어·게임이 아니라 페이코로 결제하는 "
    "모든 곳에 적용됨).\n"
    "★ 이 페이지는 등급제가 아니라 '결제 방식별 고정 요율'입니다 "
    "(브론즈/실버 같은 등급 이름이 없습니다). 다음처럼 결제 방식마다 "
    "별도 항목으로 분리하세요.\n"
    "  - 앱에서 충전 포인트로 결제 (온라인/오프라인 공통 1%)\n"
    "  - VISA 컨택리스 결제 (예외로 0.3%로 낮음 — 반드시 별도 항목으로)\n"
    "  - 포인트 실물카드로 결제 (0.3%)\n"
    "★ category=REWARD_E_PAY, benefit_type=REWARD, "
    "stacking_layer=PAYMENT_E_PAY, disbursement_type=POINT_REWARD로 "
    "고정하세요.\n"
    "★★ 페이지의 '제외 업종' 목록(대학 등록금, 상품권/기프티콘, 4대보험료, "
    "통신비, 보험료, 공과금, 해외결제, 교통, 식권 등)에 '게임 결제'가 "
    "명시적으로 포함되어 있지 않습니다. 즉 게임 결제는 이 적립 대상에서 "
    "제외되지 않는 것으로 보입니다 — condition_raw_text에 이 제외 업종 "
    "목록을 원문 그대로 옮겨 적어서, 나중에 사람이 게임이 정말 제외 "
    "대상이 아닌지 재확인할 수 있게 하세요.\n"
    "★ 포인트 적립 시점이 결제 다음달 25일이라는 안내가 있으면 "
    "condition_raw_text에 포함하세요."
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
