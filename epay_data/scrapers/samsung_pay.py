"""삼성페이(Galaxy Store 인앱결제) 포인트 적립/할인 혜택 페이지 스크래퍼.

대상 페이지: https://www.samsung.com/sec/apps/galaxy-store/

2026-08-18 headless Playwright로 직접 열어서 실제 콘텐츠를 확인했다. "#혜택"
섹션에 클릭 없이도 DOM에 이미 다 들어있는 카드 6개가 있다:
  - 혜택1 첫 결제: "5천 원 이하면 최종 결제 100원, 5천 원 초과하면 5천 원 할인"
    → BNF_0006과 일치(CSV보다 조건이 더 구체적, 2단계 구조)
  - 혜택2 위클리 출석체크, 혜택3 월간 쿠폰, 혜택6 친구 초대: 전부 구체적
    %/원 수치가 없는 안내문이라 스킵 대상(EXTRA_HINT가 이미 이렇게 처리하도록
    지시함)
  - 혜택4 월간 적립: "월간 누적 결제 금액에 따라 최대 100만 삼성전자 포인트" →
    BNF_0008과 일치(단, 700만원 이상이라는 임계값은 이 카드 문구엔 없고 CSV에만
    있었음 — 페이지에 명시 안 돼 있으면 min_prev_month_spend_krw 없이 추출될 수
    있음, 정상)
  - 혜택5: "25% 확률로, 결제 금액 100% 페이백" → BNF_0007과 정확히 일치

최초 작성 시 `page.wait_for_load_state("networkidle")`를 기본 타임아웃(30초)으로
불렀다가 TimeoutError로 실제 실행 실패(crawl_log에서 확인)했다 — 이 페이지가
백그라운드 트래킹/위젯 요청이 끊이지 않아 networkidle에 거의 도달하지 못한다.
zeropin_voucher.py 등 다른 스크래퍼처럼 짧은 타임아웃 + try/except로 무시하고
넘어가는 패턴으로 수정함(콘텐츠 자체는 networkidle 없이 'load' 이벤트만으로도
이미 다 렌더링돼 있는 것을 headless fetch로 확인했음).

2026-08-22 기준 스케줄 크롤링 대상에서 완전히 제외함(Cloud Run Job 인자, VM
vm_crawl_entrypoint.py 양쪽 모두). www.samsung.com이 Cloud Run/GCE 등 Google
호스팅 IP를 카테고리째로 차단하는 것으로 추정 — VM(별도 IP)으로 옮겨서 시도해도
동일하게 TimeoutError 재현됨(store_data/galaxy_store_tier.py도 같은 도메인, 같은
증상). 2026-08-18 수동 크롤링 결과 4건을 benefit_info에
source_file='legacy_manual_db'로 재태깅해 수동 관리 데이터로 남겨뒀다 — 계산
엔진은 source_file을 안 보므로 계산 결과엔 영향 없음. 이 파일 자체는 나중에
우회 경로를 찾으면 다시 스케줄에 넣을 수 있도록 그대로 둔다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "SAMSUNGPAY"
PROVIDER_OR_RETAILER = "SAMSUNG_PAY"
SOURCE_FILE = "epay_samsungpay"
DEST_FILENAME = "Epay_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://www.samsung.com/sec/apps/galaxy-store/"
REQUIRE_LOGIN = False

EXTRA_HINT = (
    "삼성페이(갤럭시 스토어 인앱결제) 혜택 안내 페이지입니다. 클릭/슬라이드로 "
    "넘겨보는 여러 개의 혜택 카드가 있을 수 있으니, 보이는 카드를 전부 "
    "확인하세요.\n"
    "★ target_platform=GALAXY_STORE, target_game=ALL, channel_type=IN_APP로 "
    "고정하세요.\n"
    "★ category는 즉시할인이면 DISCOUNT_E_PAY, 포인트 적립/리워드면 "
    "REWARD_E_PAY로 구분하세요.\n"
    "★ payment_method_restriction=POINT_ONLY, stacking_layer=PAYMENT_E_PAY, "
    "payment_route_type=DIRECT_PAY로 고정하세요.\n"
    "★ '확률로 지급'처럼 당첨 확률이 있는 이벤트는 is_probabilistic=TRUE로 "
    "표시하고, 확률(%)과 당첨 시 지급액/비율을 condition_raw_text에 그대로 "
    "남기세요.\n"
    "★ 첫 결제 전용 혜택이면 is_first_purchase=TRUE, condition_type="
    "FIRST_PURCHASE, user_segment=NEW_OR_RETURNING_USER로 표시하세요. '5천 원 "
    "이하면 최종 결제 금액 100원, 5천 원 초과면 5천 원 할인'처럼 금액 구간별로 "
    "혜택이 다르면 구간마다 별도 항목으로 분리하세요.\n"
    "★ 월간 누적 결제금액 조건(예: '월 700만원 이상')이 있으면 "
    "condition_raw_text에 원문 그대로 남기고, min_prev_month_spend_krw로 "
    "표현 가능하면 거기에도 반영하세요. 이 조건이 카드 문구에 없으면 억지로 "
    "만들어내지 말고 비워두세요.\n"
    "★ '출석체크', '월간 쿠폰', '친구 초대' 같은 카드는 보통 구체적인 %/원 "
    "수치 없이 홍보 문구만 있습니다 — 이런 카드는 결과에서 제외하세요. "
    "원문에 할인율/적립률/지급액처럼 계산에 필요한 핵심 숫자가 없는 카드는 "
    "전부 제외 대상입니다."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        # 기본 wait_until="load"는 Cloud Run(데이터센터 IP)에서 30초 타임아웃으로
        # 실패함(로컬에선 정상). domcontentloaded로 낮춰도 여전히 30초를 넘겨서
        # (2026-08-19 확인) 단순 JS 이벤트 지연이 아니라 이 사이트가 클라우드 IP를
        # 상대로 응답 자체를 늦추는 것으로 추정 — 타임아웃을 60초로 늘려서 대응.
        page.goto(BENEFIT_PAGE_URL, wait_until="domcontentloaded", timeout=60000)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            pass
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
