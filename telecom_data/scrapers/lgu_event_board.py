"""LG U+ '진행 중 이벤트' 목록 → 상세 동적 탐색 스크래퍼.

store_data/scrapers/galaxy_store.py와 같은 2단계 패턴(목록에서 키워드로 후보를
고른 뒤 상세 페이지를 열어 Gemini로 추출)이지만, 이 사이트는 목록의 이벤트
카드가 실제 <a href="..."> 링크가 아니라 href="#none" + 클라이언트 라우팅
(SPA)으로 동작한다(2026-08-14 실사 확인: 카드 클릭 시
`/benefit-event/ongoing/{id}`로 이동, 새 URL이 팀원이 준 82419 이벤트 URL과
동일 패턴). 그래서 galaxy_store.py처럼 href를 파싱해서 바로 이동하는 대신,
후보 카드를 실제로 클릭 → 상세 내용 읽기 → 뒤로가기 방식을 쓴다.

★ 실제 이벤트 링크(href="...#none")와 상단/하단 내비게이션 메뉴(href="...#",
'none' 접미사 없음)를 href 끝문자로 구분한다 — 실사에서 확인한 차이.

이 목록에는 group2로 계획했던 "구글플레이 스토어 50% 할인"(82419) 이벤트도
키워드 필터에 걸려 자연히 포함되므로, 그 이벤트를 위한 별도 하드코딩
스크래퍼(lgu_googleplay_event.py)는 만들지 않기로 함 — 이 동적 탐색 하나로
충분하고, 새 이벤트가 생겨도 자동으로 잡힌다는 장점이 있음.

⚠️ 카드를 클릭한 뒤 page.go_back()으로 목록에 돌아와서 다음 후보를 이어서
클릭하는 방식이라, 클릭 시점에 미리 뽑아둔 후보 인덱스가 뒤로가기 후에도 같은
순서로 유지된다고 가정한다(같은 세션 안에서 SPA 뒤로가기이므로 순서가 흔들릴
가능성은 낮지만, 사이트 개편으로 카드 순서가 로딩마다 바뀌면 이 가정이
깨질 수 있음 — 다음 세션에서 결과가 이상하면 이 부분부터 의심할 것).
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "LGU_EVENT_BOARD"
PROVIDER_OR_RETAILER = "LGU_PLUS"
SOURCE_FILE = "telecom_lgu_event_board"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

LIST_URL_TEMPLATE = "https://www.lguplus.com/benefit-event/ongoing?pageNo={page}&sortBaseCd=N&tabId="

# 실사(2026-08-14) 결과 pageNo=1(추천순 상단)엔 게임 관련 이벤트가 안 보이고
# pageNo=2에 있었다 — 페이지마다 노출되는 이벤트가 달라질 수 있어 앞쪽 2페이지를
# 훑는다.
LIST_PAGES = [1, 2]

# 진짜 이벤트 카드만 골라내는 키워드. 목록에는 통신비 할인, 인터넷/IPTV 결합,
# 휴대폰 구매 등 게임과 무관한 이벤트가 훨씬 많이 섞여 있다.
KEYWORD_HINTS = ("게임", "스토어")

MAX_DETAIL_PAGES = 5

EXTRA_HINT = (
    "LG U+ '진행 중 이벤트' 게시판의 이벤트 상세 페이지입니다. "
    "provider_or_retailer=LGU_PLUS, stacking_layer=PAYMENT_PG로 고정하세요.\n"
    "★★ 매우 중요: 이 게시판에는 휴대폰 할인, 인터넷/IPTV 결합, 친구추천, "
    "출석체크처럼 게임과 무관한 이벤트가 훨씬 많이 섞여 있습니다. 반드시 "
    "원스토어·구글플레이·앱스토어·갤럭시스토어 게임 결제에 직접 적용되는 "
    "할인·적립·쿠폰만 추출하세요. 해당 없으면 빈 리스트를 반환하세요.\n"
    "★ target_platform은 원문에 명시된 스토어로 정하고(예: '구글 플레이 "
    "스토어' → GOOGLE_PLAY), 특정 스토어 언급이 없으면 ALL로 두세요. "
    "target_game=ALL로 고정하세요.\n"
    "★ category는 benefit_type=DISCOUNT면 DISCOUNT_TELECOM, REWARD/CASHBACK이면 "
    "REWARD_TELECOM으로 정하세요.\n"
    "★ 'LG U+ 휴대폰결제 이용고객' 또는 '휴대폰결제로 결제'처럼 결제수단이 "
    "휴대폰결제로 한정된다는 문구가 있으면 payment_method_restriction="
    "PHONE_BILLING_ONLY로, 없으면 NONE으로 정하세요.\n"
    "★ '이벤트 응모하기' 같은 사전 응모 절차가 안내돼 있으면 "
    "requires_pre_app=true, 즉시 적용이면 false로 정하세요.\n"
    "★ '최대 할인 금액 N원' 같은 한도가 있으면 max_benefit_krw에 넣고, "
    "'누적 결제금액 기준' 같은 조건은 condition_raw_text에 명시하세요. "
    "정기결제(자동결제) 제외 같은 예외 조항도 condition_raw_text에 반드시 "
    "남기세요.\n"
    "★ 원문에 할인율/기간처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
    "제외하세요. 댓글, '좋아요', '공유하기' 같은 페이지 UI 텍스트는 무시하세요."
)


def _wait_settled(page) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=10000)
    except Exception:
        page.wait_for_timeout(2000)


def _find_candidate_indices(page) -> list[tuple[int, str]]:
    """목록에서 '진짜 이벤트 카드'(href='#none')만 훑어 키워드 매칭된
    (anchor 인덱스, 제목 미리보기) 후보를 돌려준다."""
    anchors = page.query_selector_all("a[href$='#none']")
    candidates: list[tuple[int, str]] = []
    for i, a in enumerate(anchors):
        text = (a.inner_text() or "").strip()
        if not text:
            continue
        if any(keyword in text for keyword in KEYWORD_HINTS):
            candidates.append((i, text.replace("\n", " ")[:80]))
    return candidates[:MAX_DETAIL_PAGES]


def scrape() -> list[dict]:
    rows = []
    seen_urls: set[str] = set()
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        for page_no in LIST_PAGES:
            list_url = LIST_URL_TEMPLATE.format(page=page_no)
            page.goto(list_url)
            _wait_settled(page)

            candidates = _find_candidate_indices(page)

            for idx, title_preview in candidates:
                anchors = page.query_selector_all("a[href$='#none']")
                if idx >= len(anchors):
                    continue
                try:
                    anchors[idx].click(timeout=5000)
                except Exception:
                    continue
                _wait_settled(page)
                detail_url = page.url

                if "/benefit-event/ongoing/" not in detail_url or detail_url in seen_urls:
                    # 클릭이 상세 페이지로 이어지지 않았거나(광고 배너 등) 이미
                    # 다른 페이지에서 처리한 이벤트면 건너뛴다.
                    page.go_back()
                    _wait_settled(page)
                    continue
                seen_urls.add(detail_url)

                raw_text = f"[목록 제목 미리보기: {title_preview}]\n\n{page.inner_text('body')}"
                items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
                rows.extend(
                    normalize.to_row(
                        item,
                        id_domain="TELECOM",
                        id_prefix=PROVIDER_CODE,
                        provider_or_retailer=PROVIDER_OR_RETAILER,
                        source_file=SOURCE_FILE,
                        source_url=detail_url,
                    )
                    for item in items
                )

                page.go_back()
                _wait_settled(page)

    return rows


if __name__ == "__main__":
    for row in scrape():
        print(row)
