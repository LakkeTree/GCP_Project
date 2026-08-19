"""토스페이 결제 적립 혜택 안내 페이지 스크래퍼.

대상 페이지: https://support.toss.im/faq/275

이 URL은 사용자가 브라우저에서 직접 확인해서 넘겨준 것(2026-08-18) — 혜택 관련
내용이 바로 적혀 있다고 함. WebFetch(JS 미실행 단순 HTML 조회)로는 완전히 빈
콘텐츠로 나와서(토스 지원센터가 JS로 본문을 그리는 구조로 추정) 이 크롤러 작성
시점에는 실제 내용을 직접 확인하지 못했다 — Playwright(실제 브라우저)는 JS
렌더링을 하므로 이 문제가 없을 것으로 예상되지만, 반드시 첫 실행 결과를 확인하고
필요하면 EXTRA_HINT를 조정할 것.

최종_간편결제수단_데이터.csv(2026-08-18 기준 팀 정리본)에는 TOSS_PAY 관련 행이
두 갈래로 나뉘어 있다:
  - BNF_0009/0010(e_payment_benefits.csv): 2026-08-01~08-31 한정 첫결제/재결제
    이벤트(구글플레이 대상, 최대 2,000원/1,000원) — 기간 한정이라 이 크롤러
    실행 시점엔 이미 종료됐거나 다른 이벤트로 바뀌어 있을 가능성이 높음
  - BNF_0047/0048(payment_reward_rates.csv, url 없었음): "토스프라임 이용 시
    4% 적립(20만원 초과 시 1%)" — 상시 요율에 가까움. 웹검색으로도 "토스페이
    결제 시 누적 20만원까지 4%, 이후 60만원까지 1% 적립, 월 최대 12,000P"라는
    유사한 내용이 확인돼(2026-08-18), 이 FAQ 페이지가 다루는 내용이 이쪽에
    가까울 것으로 추정된다.
이 두 갈래 다 나올 수 있으니, 페이지에 보이는 대로 전부 추출하고 위 목록에
억지로 끼워맞추지 말 것.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "TOSSPAY"
PROVIDER_OR_RETAILER = "TOSS_PAY"
SOURCE_FILE = "epay_tosspay"
DEST_FILENAME = "Epay_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://support.toss.im/faq/275"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "토스페이 결제 적립 혜택 안내 페이지입니다.\n"
    "★ target_game=ALL로 고정하세요. target_platform은 특정 스토어(예: "
    "GOOGLE_PLAY)로 한정한다는 언급이 없으면 ALL로, 있으면 그 스토어로 "
    "쓰세요.\n"
    "★ 상시 요율(등급/구간별 적립률)과 기간 한정 이벤트(특정 날짜 범위의 "
    "첫결제/재결제 보너스)가 둘 다 있을 수 있습니다 — 둘 다 있으면 각각 "
    "별도 항목으로 분리하고, 기간 한정 이벤트는 start_date/end_date를 원문 "
    "그대로 채우세요.\n"
    "★ '토스프라임' 가입 여부에 따라 적립률이 달라지면(가입자만 우대 적립 "
    "등), user_segment나 condition_raw_text에 그 조건을 명확히 남기세요.\n"
    "★ 결제 금액 구간별로 적립률이 달라지면(예: 누적 20만원까지 4%, 초과분 "
    "1%) 구간마다 별도 항목으로 분리하세요.\n"
    "★ category=REWARD_E_PAY, benefit_type=REWARD, "
    "stacking_layer=PAYMENT_E_PAY, disbursement_type=POINT_REWARD, "
    "payment_route_type=DIRECT_PAY로 고정하세요.\n"
    "★ 게임 결제(인앱결제)가 적립 제외 대상으로 명시돼 있는지 꼭 확인하고, "
    "제외 목록이 있으면 condition_raw_text에 원문 그대로 옮기세요.\n"
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
