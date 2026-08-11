# -*- coding: utf-8 -*-
"""
crawlers/google_play.py
--------------------------------------------------------------------
구글플레이 게임 스토어 페이지 최상단의 할인 배너 캐러셀을 수집하는 크롤러입니다.

대상 페이지: https://play.google.com/store/games?device=windows&hl=ko

[여기 오기까지의 시행착오 — 왜 이 URL/방식인지 기록해 둡니다]
1. 처음엔 device 파라미터 없는 기본 URL을 시도했으나, 게임 카탈로그(인기 게임
   목록)만 있고 할인/쿠폰 정보가 전혀 없었습니다.
2. playpoints.withgoogle.com/perks 페이지를 대안으로 찾았으나, 사용자 확인 결과
   경품 추천 사이트였지 쿠폰 제공 페이지가 아니었습니다. (폐기)
3. 사용자가 캡처로 device=windows 탭 최상단에 실제 할인 배너
   ("쿠키런: 크럼블에서 구매 시 30% 할인 혜택 제공 / 혜택은 8월 12일에 종료")가
   있다는 걸 확인해 주었습니다.
4. 그런데 device=windows 파라미터를 붙여 정적으로 가져와봐도 이 배너는 안 잡혔습니다.
   게임 카탈로그 목록(서버가 미리 렌더링해 보내는 부분)은 잘 잡히는데, 배너
   캐러셀만 계속 비어 있었습니다. → 배너 캐러셀은 브라우저에서 자바스크립트가
   실행된 뒤에 채워지는 부분이고, 카탈로그 목록은 서버사이드 렌더링되는 부분이라
   같은 페이지 안에 두 가지 방식이 섞여 있는 것으로 판단했습니다.
   그래서 common/http_client.py 대신 common/browser.py(Playwright)를 씁니다.

⚠️ 이 판단도 아직 실제 렌더링 화면으로 직접 검증하지는 못했습니다(이 환경은
   google.com 계열 도메인에 접속이 안 됩니다). 로컬에서 처음 실행해서 배너가
   실제로 텍스트에 잡히는지 꼭 확인해 주세요.

[로컬에서 처음 실행하기 전에]
    playwright install chromium
"""

from __future__ import annotations

from typing import Iterator

from common.browser import BrowserClient
from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class GooglePlayCrawler(BaseCrawler):
    """구글플레이 게임 스토어 최상단 할인 배너 캐러셀을 수집합니다."""

    source_name = "google_play"

    context_hint = (
        "구글플레이 게임 스토어 페이지 최상단의 할인 배너 캐러셀입니다. "
        "배너는 보통 '게임명 + 구매 시 XX% 할인 혜택 제공' 형태의 제목과, "
        "'혜택은 M월 D일에 종료. 약관 참고' 같은 종료일 안내가 함께 붙어 나옵니다. "
        "(예: '쿠키런: 크럼블에서 구매 시 30% 할인 혜택 제공 / 혜택은 8월 12일에 종료') "
        "target_platform=GOOGLE_PLAY로 고정하세요. 게임명이 명시된 배너는 그 게임을 "
        "target_game으로 쓰고, 페이지 하단의 인기 게임 목록·별점·장르 태그처럼 "
        "할인과 무관한 카탈로그 내용은 전부 무시하세요. 종료일에 연도가 없으면 "
        "제공되는 오늘 날짜의 연도를 쓰고, 시작일이 안 적혀 있으면 null로 두세요."
    )

    EVENT_URL = "https://play.google.com/store/games?device=windows&hl=ko"

    # ⚠️ 배너 캐러셀을 감싸는 요소의 class를 브라우저 개발자 도구(F12)로 확인해서
    # 넣어주세요. 지금은 몰라서 None으로 뒀고, 그러면 카탈로그까지 전부 포함된
    # 페이지 전체 텍스트가 Gemini에 넘어갑니다 — 동작은 하지만 노이즈가 많고
    # 입력 길이가 커져 비용이 늘어납니다. (Gemini 시스템 프롬프트가 카탈로그
    # 내용을 걸러내긴 하지만, selector로 애초에 안 보내는 게 훨씬 낫습니다)
    LIST_SELECTOR = None

    # 배너가 그려질 때까지 정확히 기다리고 싶으면 여기에 CSS 선택자를 넣으세요.
    # 예: "div[class*='promo']" 처럼 배너 요소를 특정할 수 있으면 가장 안전합니다.
    WAIT_SELECTOR = None

    def fetch_pages(self) -> Iterator[PageContent]:
        with BrowserClient() as browser:
            # 서버가 'Windows' 탭 기본값을 User-Agent로 판단하는 것으로 보여
            # common/browser.py에 이미 Windows Chrome User-Agent를 설정해 뒀습니다.
            # 그래도 혹시 기본 탭이 다르게 나올 경우를 대비해, 페이지 로드 후
            # 'Windows' 탭을 명시적으로 한 번 클릭합니다. 탭이 안 보이거나
            # 이미 선택되어 있으면 조용히 넘어갑니다(있으면 좋고 없어도 무방).
            html = browser.get_rendered_html(
                self.EVENT_URL,
                wait_selector=self.WAIT_SELECTOR,
                wait_ms=5000,
                scroll_to_bottom=False,  # 배너는 스크롤 없이 최상단에 바로 보입니다.
            )

        if not html:
            return

        text = html_to_text(html, selector=self.LIST_SELECTOR)
        yield PageContent(
            url=self.EVENT_URL,
            text=text,
            hint=self.context_hint,
        )


# =============================================================================
# 로컬에서 직접 테스트하고 싶을 때
# =============================================================================
#     python -m crawlers.google_play
#
# 결과가 0건이거나 배너 관련 내용이 안 보이면 확인할 것 (우선순위 순):
#   1) playwright install chromium 을 안 했다 -> 실행 자체가 에러로 죽습니다.
#   2) 콘솔에 찍히는 원문 텍스트 안에 "쿠키런" 같은 배너 문구가 아예 없다
#      -> 배너가 여전히 안 잡히는 것. wait_ms를 8000~10000으로 늘려 재시도하거나,
#         F12로 배너를 감싸는 class를 찾아 WAIT_SELECTOR에 넣어 재시도하세요.
#   3) 배너 문구는 텍스트에 있는데 Gemini 추출 결과가 0건이다
#      -> 프롬프트(context_hint) 문제일 수 있습니다. data/output/ 에 저장되는
#         원문 텍스트를 직접 열어서 실제로 어떤 문장으로 들어갔는지 확인해 보세요.

if __name__ == "__main__":
    crawler = GooglePlayCrawler()
    try:
        results = crawler.run(save_to_bq=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.target_game} | "
                  f"{item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:80]}")
    finally:
        crawler.close()
