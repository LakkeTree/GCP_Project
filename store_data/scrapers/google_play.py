"""구글플레이 게임 스토어 페이지 최상단 할인 배너 캐러셀 스크래퍼.

대상 페이지: https://play.google.com/store/games?device=windows&hl=ko

Kyungtae 브랜치 조사 결과, 배너 캐러셀은 브라우저에서 자바스크립트가 실행된 뒤에
채워지는 부분이라 Playwright 렌더링이 필요하다(카탈로그 목록은 서버사이드
렌더링이라 정적으로도 잡히지만, 배너는 안 잡힘). 로그인 불필요.

⚠️ Kyungtae 쪽에서도 이 배너가 실제 화면에 잡히는지 최종 검증은 못 한 상태였다.
로컬에서 처음 실행할 때 결과가 0건이면 wait_ms를 늘리거나 실제 화면을 F12로
확인해봐야 한다.
"""

from card_data.common import normalize
from card_data.common.ai_extract import extract_benefits
from card_data.scrapers.base import ScraperSession

PROVIDER_CODE = "GOOGLEPLAY"
PROVIDER_OR_RETAILER = "GOOGLE_PLAY"
SOURCE_FILE = "store_googleplay"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

BENEFIT_PAGE_URL = "https://play.google.com/store/games?device=windows&hl=ko"
REQUIRE_LOGIN = False

_DISMISS_BUTTON_TEXTS = ["전체 동의", "모두 동의", "Accept all"]

EXTRA_HINT = (
    "구글플레이 게임 스토어 페이지 최상단의 할인 배너 캐러셀입니다. "
    "배너는 보통 '게임명 + 구매 시 XX% 할인 혜택 제공' 형태의 제목과, "
    "'혜택은 M월 D일에 종료. 약관 참고' 같은 종료일 안내가 함께 붙어 나옵니다. "
    "(예: '쿠키런: 크럼블에서 구매 시 30% 할인 혜택 제공 / 혜택은 8월 12일에 종료') "
    "target_platform=GOOGLE_PLAY, category=DISCOUNT_STORE, "
    "stacking_layer=STORE_COUPON으로 고정하세요. 게임명이 명시된 배너는 그 게임을 "
    "target_game으로 쓰고, 페이지 하단의 인기 게임 목록·별점·장르 태그처럼 "
    "할인과 무관한 카탈로그 내용은 전부 무시하세요. 종료일에 연도가 없으면 "
    "제공되는 오늘 날짜의 연도를 쓰고, 시작일이 안 적혀 있으면 null로 두세요."
)


def scrape() -> list[dict]:
    with ScraperSession(PROVIDER_CODE, require_login=REQUIRE_LOGIN) as page:
        page.goto(BENEFIT_PAGE_URL)
        page.wait_for_load_state("networkidle")
        for text in _DISMISS_BUTTON_TEXTS:
            try:
                page.get_by_text(text, exact=False).first.click(timeout=2000)
                break
            except Exception:
                continue
        page.wait_for_timeout(3000)
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
