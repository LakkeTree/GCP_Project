"""갤럭시 스토어 프로모션(Samsung Members 게시판) 스크래퍼.

원스토어와 달리 "쿠폰 득템전" 같은 단일 목록 페이지가 없다. 대신 삼성 공식
계정이 삼성 커뮤니티 게시판(Samsung Members)에 이벤트 하나당 게시글 하나씩
올리는 방식이라, 2단계로 동작한다:
  1) 게시판 목록 페이지에서 최근 게시글 제목+링크를 모은다.
  2) 제목에 할인/쿠폰 관련 키워드가 있는 게시글만 골라 상세 페이지를 열고
     본문을 Gemini로 추출한다.

Kyungtae 브랜치 game-benefit-pipeline/crawlers/galaxy_store.py가 실제로 검증한
목록 URL·링크 패턴(/m-p/숫자)·키워드 필터를 그대로 가져오되, 우리 card_data
패턴(ScraperSession + extract_benefits)으로 재구현한다.

Kyungtae는 requests가 403(TLS/헤더 지문 차단)이라 별도 Playwright 클라이언트를
썼는데, 우리 ScraperSession은 원래부터 실제 브라우저(Playwright)를 쓰므로
추가 조치 없이 통과된다. 로그인 없이 공개 접근 가능해서 REQUIRE_LOGIN=False.

⚠️ zeropin_voucher.py에서 확인된 것과 같은 이유로, 목록 페이지와 각 상세
페이지를 전부 별개의 ScraperSession(=새 브라우저 컨텍스트)으로 연다 — 한
컨텍스트로 여러 URL을 연속 이동하면 이후 페이지가 제대로 안 뜰 수 있다는 게
다른 스크래퍼에서 실제로 관측된 문제라, 여기서도 미리 그 패턴을 따른다.
"""

import re

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GALAXYSTORE"
PROVIDER_OR_RETAILER = "GALAXY_STORE"
SOURCE_FILE = "store_galaxystore"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

LIST_URL = (
    "https://r1.community.samsung.com/t5/forums/filteredbylabelpage/"
    "board-id/kr-community-svc-store/label-name/%ED%94%84%EB%A1%9C%EB%AA%A8%EC%85%98"
)

# Samsung Members 게시글 상세 URL은 전부 ".../m-p/숫자" 형태로 끝난다.
_TOPIC_LINK_PATTERN = re.compile(r"/m-p/\d+$")

# 제목에 이 단어 중 하나라도 있으면 상세 페이지를 열어본다.
KEYWORD_HINTS = ("쿠폰", "할인", "페이백", "적립", "%", "혜택")

# 목록 1페이지에 글이 많이 있는데, 전부 열면 느리고 오래된 글은 이미 종료됐을
# 가능성이 높다. 최근 것 위주로 이 개수만큼만 상세 페이지를 연다.
MAX_DETAIL_PAGES = 5

EXTRA_HINT = (
    "갤럭시 스토어 프로모션 게시글입니다. target_platform=GALAXY_STORE로 "
    "고정하세요.\n"
    "★ benefit_type 구분: '페이백'은 결제 후 나중에 돌려받는 방식이라 "
    "benefit_type=CASHBACK입니다(즉시 할인이 아닙니다). '즉시 할인 쿠폰'은 "
    "benefit_type=DISCOUNT, '포인트 적립'은 benefit_type=REWARD입니다.\n"
    "★ category: benefit_type=DISCOUNT면 category=DISCOUNT_STORE, "
    "benefit_type=REWARD 또는 CASHBACK이면 category=REWARD_STORE로 정하세요.\n"
    "★ requires_pre_app: 갤럭시 스토어 이벤트는 대부분 '삼성 계정 로그인 → "
    "이벤트 참여하기 버튼 클릭' 절차가 필요합니다(원스토어처럼 즉시 발급되는 "
    "게 아닙니다). 참여 절차(STEP1, STEP2 등)가 안내돼 있으면 "
    "requires_pre_app=true로 표시하세요.\n"
    "★ stacking_layer=STORE_COUPON, disbursement_type은 페이백이면 "
    "BILL_DISCOUNT 또는 POINT_REWARD(원문에서 포인트/캐시로 돌려준다고 하면 "
    "POINT_REWARD, 결제 금액 자체를 환급한다면 BILL_DISCOUNT), 즉시 할인이면 "
    "INSTANT_DISCOUNT, 참여만 하고 쿠폰을 나중에 받는 구조면 COUPON_ISSUE.\n"
    "★ target_game: 특정 게임 전용이면 그 게임명을 쓰고(예: 'FC모바일', "
    "'삼국지 전략판'), 'RPG/전략 게임 31종'처럼 여러 게임이 뭉뚱그려져 "
    "있고 개별 게임명이 원문에 안 나오면 target_game=ALL로 두세요.\n"
    "★★ 매우 중요: 게시글 하나에 '게임 목록 + 각 게임마다 받는 혜택'이 "
    "나열된 경우(예: '8월 월간 쿠폰' 이벤트에 참여 게임 22개가 각각 "
    "8,000원 쿠폰을 받는 구조), 이건 게임 하나짜리 혜택이 아니라 게임 "
    "개수만큼의 서로 다른 혜택입니다. 목록에 있는 게임 하나하나를 별도 "
    "항목으로 분리하고, 각 항목의 target_game에 그 게임의 이름을 정확히 "
    "넣으세요. target_game을 전부 ALL로 두거나 item_or_event_name을 게시글 "
    "제목 그대로 복사하면, 서로 다른 게임의 혜택인데도 나중에 시스템이 같은 "
    "혜택으로 착각해서 하나만 남기고 나머지를 지워버립니다.\n"
    "★ 원문에 할인율/기간처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
    "제외하세요. 댓글, '좋아요', '조회수' 같은 게시판 UI 텍스트는 무시하세요."
)


def _wait_settled(page) -> None:
    """삼성 커뮤니티는 백그라운드 스크립트가 계속 붙어 있어 networkidle이 끝까지
    안 오는 경우가 있다 — 타임아웃 나면 이미 본문은 렌더링된 상태이므로 진행한다."""
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        page.wait_for_timeout(2000)


def _find_topics(page) -> list[tuple[str, str]]:
    """목록 페이지에서 '혜택일 가능성이 있는' 게시글 (제목, 절대URL)만 골라 돌려준다."""
    anchors = page.eval_on_selector_all(
        "a[href]",
        "els => els.map(e => ({href: e.href, text: e.innerText.trim()}))",
    )
    seen: set[str] = set()
    topics: list[tuple[str, str]] = []
    for a in anchors:
        href = a["href"]
        title = a["text"]
        if not title or not _TOPIC_LINK_PATTERN.search(href):
            continue
        if href in seen:
            continue
        seen.add(href)
        if any(keyword in title for keyword in KEYWORD_HINTS):
            topics.append((title, href))
    return topics[:MAX_DETAIL_PAGES]


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(LIST_URL)
        _wait_settled(page)
        topics = _find_topics(page)

    rows = []
    for title, url in topics:
        with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
            page.goto(url)
            _wait_settled(page)
            raw_text = f"[게시글 제목: {title}]\n\n{page.inner_text('body')}"

        items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
        rows.extend(
            normalize.to_row(
                item,
                id_domain="STORE",
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
