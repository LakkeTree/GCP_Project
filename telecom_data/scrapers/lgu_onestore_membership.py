"""LG U+ 멤버십의 'APP/기기' 제휴 혜택 필터 페이지 스크래퍼(원스토어 항목).

Kyungtae 브랜치는 LG U+ 전용 게임 혜택 페이지를 못 찾아서(나무위키상
"2023년 6월부터 SKT·LGU+ 제외하고 KT만 이벤트 진행" 문구를 근거로) 목록
크롤러(lgu_event_board.py 계열)만 만들어뒀는데, 팀원이 이번에 실제 필터
페이지를 새로 찾았다(2026-08-14 확인, 정적 렌더링):
    https://www.lguplus.com/benefit-membership?urcMbspDivsCd=01&urcMbspBnftDivsCd=02&urcMbspCatgNo=78

"APP/기기" 카테고리 안에 원스토어("최대 10% 할인, 최대 1만원 할인")가 실제로
있는 것을 확인했다 — Kyungtae의 추정과 달리 LG U+도 원스토어 제휴 할인을
운영 중이다. 같은 카테고리에 게임과 무관한 'V컬러링 멤버십 프로모션' 등도
섞여 있어 필터링이 필요하다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "LGU_ONESTORE"
PROVIDER_OR_RETAILER = "LGU_PLUS"
SOURCE_FILE = "telecom_lgu_onestore"
DEST_FILENAME = "Telecom_Benefit_Info_DB.csv"

REQUIRE_LOGIN = False

BENEFIT_PAGE_URL = (
    "https://www.lguplus.com/benefit-membership"
    "?urcMbspDivsCd=01&urcMbspBnftDivsCd=02&urcMbspCatgNo=78"
)

EXTRA_HINT = (
    "LG U+ 멤버십 'APP/기기' 카테고리 제휴 혜택 목록 페이지입니다. "
    "provider_or_retailer=LGU_PLUS, stacking_layer=PAYMENT_PG, "
    "category=DISCOUNT_TELECOM으로 고정하세요.\n"
    "★★ 매우 중요: '원스토어' 제휴사 항목만 추출하세요. 통화연결음(V컬러링) "
    "등 게임/앱마켓 결제와 무관한 다른 제휴사 항목은 전부 제외하세요.\n"
    "★ target_platform=ONE_STORE, target_game=ALL, benefit_type=DISCOUNT, "
    "disbursement_type=INSTANT_DISCOUNT로 고정하세요. "
    "payment_method_restriction=NONE으로 고정하세요(휴대폰결제 전용이라는 "
    "명시가 없으면 결제수단 제한 없음으로 봅니다).\n"
    "★ requires_pre_app은 원문에 사전 인증/응모 절차가 명시돼 있으면 true, "
    "명시가 없으면 false로 판단하세요.\n"
    "★ '최대 N% 할인(최대 M원 할인)' 형식이면 benefit_value=N(PERCENT), "
    "max_benefit_krw=M으로 넣으세요.\n"
    "★ 원문에 할인율처럼 핵심 정보가 없으면 결과에서 제외하세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        try:
            page.wait_for_load_state("networkidle", timeout=10000)
        except Exception:
            page.wait_for_timeout(2000)
        raw_text = page.inner_text("body")

    items = extract_benefits(raw_text, provider_name=PROVIDER_OR_RETAILER, extra_hint=EXTRA_HINT)
    return [
        normalize.to_row(
            item,
            id_domain="TELECOM",
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
