# -*- coding: utf-8 -*-
"""
crawlers/shinhan_card.py
--------------------------------------------------------------------
신한카드 '진행 중 이벤트' 목록 페이지 + 각 이벤트 배너의 상세 페이지를
수집하는 크롤러입니다.

대상 목록 페이지 (사용자가 직접 찾아준 URL):
    https://www.shinhancard.com/mob/MOBFM829N/MOBFM829R03.shc?sourcePage=R01

⚠️ 갤럭시 스토어와 같은 2단계 구조입니다.
   1단계) 목록 페이지를 Playwright로 렌더링해서, 이벤트 배너들의 실제 링크를 뽑습니다.
   2단계) 그 링크들을 각각 열어서 진짜 조건(할인율/기간 등)을 Gemini로 추출합니다.

⚠️ 이번엔 중요한 불확실성이 있습니다. 목록 페이지를 정적으로 가져와보니
   이벤트 배너 부분이 `javascript:void(0);` 형태로 되어 있었습니다 —
   이건 <a href="실제주소"> 가 아니라 자바스크립트 클릭 핸들러로 페이지를
   이동시키는 방식일 수 있다는 뜻입니다. 이 경우 아래 _parse_event_links()가
   찾는 "일반적인 <a href> 링크"로는 안 잡힐 수 있습니다.

   그래서 이 크롤러는 2단계 전략을 씁니다:
     A) 렌더링된 HTML에서 진짜 href가 있는 링크를 먼저 찾아봅니다.
        (SPA도 접근성/SEO를 위해 실제 href를 같이 넣어두는 경우가 흔합니다)
     B) A에서 하나도 못 찾으면, 배너를 실제로 클릭해서 이동한 뒤의
        주소를 캡처하는 방식으로 자동 전환합니다.

   B 방식은 배너 개수만큼 페이지를 열고-클릭하고-뒤로가기를 반복해야 해서
   A보다 훨씬 느립니다. 로컬에서 실행해보시고 어느 방식으로 잡히는지,
   그리고 실제로 몇 건이 잡히는지 꼭 확인해 주세요.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.browser import BrowserClient
from common.http_client import html_to_text
from common.logger import get_logger
from crawlers.base import BaseCrawler, PageContent

log = get_logger(__name__)


@dataclass
class EventLink:
    """이벤트 배너 하나(제목 + 링크)."""

    title: str
    url: str


class ShinhanCardCrawler(BaseCrawler):
    """신한카드 진행 중 이벤트 + 상세 페이지를 수집합니다."""

    source_name = "shinhan_card"

    context_hint = (
        "신한카드 이벤트 상세 페이지입니다. provider_or_retailer는 반드시 "
        "'SHINHAN_CARD'로 고정하세요.\n"
        "★★ 매우 중요: 이 이벤트가 게임 결제/구독, 또는 구글플레이·앱스토어·"
        "원스토어·갤럭시스토어·간편결제 같은 범용 온라인 결제에 적용되는 "
        "혜택이 아니라면(예: 주유, 여행, 마트, 통신비, 대출, 카드 신규발급 "
        "축하금 등) 결과에서 완전히 제외하세요. 애매하면 빼세요.\n"
        "★ stacking_layer=CARD_ISSUER로 고정하세요.\n"
        "★ category: 즉시 할인이면 DISCOUNT_CARD, 나중에 돌려받는 성격이면 "
        "benefit_type=CASHBACK을 쓰세요.\n"
        "★ disbursement_type: 카드 명세서에서 바로 빠지면 BILL_DISCOUNT, "
        "포인트로 적립되면 POINT_REWARD, 결제 시 즉시 할인되면 INSTANT_DISCOUNT.\n"
        "★ 원문에 할인율/금액처럼 계산에 필요한 핵심 정보가 없으면 제외하세요."
    )

    LIST_URL = "https://www.shinhancard.com/mob/MOBFM829N/MOBFM829R03.shc?sourcePage=R01"

    # 목록에서 상세 페이지를 몇 개까지 열어볼지 상한선.
    MAX_DETAIL_PAGES = 15

    # 이벤트 상세 링크로 보이는 href를 걸러내는 패턴.
    # ⚠️ 실제 링크 형태를 못 봐서 일단 넓게 잡았습니다(신한카드 도메인 안의
    # /mob/ 이나 /pconts/ 경로). 로컬에서 실행해보고 엉뚱한 링크(로그인,
    # 약관 등)까지 섞여 들어오면 이 패턴을 좁혀야 합니다.
    _EVENT_LINK_PATTERN = re.compile(r"/(mob|pconts)/.*(evt|event|Evt|Event)", re.IGNORECASE)

    # ------------------------------------------------------------------
    # A) 렌더링된 HTML에서 진짜 href 링크 찾기
    # ------------------------------------------------------------------
    def _parse_event_links_from_html(self, html: str) -> list[EventLink]:
        soup = BeautifulSoup(html, "lxml")
        links: list[EventLink] = []
        seen: set[str] = set()

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if href.startswith("javascript:") or not href.strip():
                continue  # 클릭 핸들러 자리표시자는 건너뜁니다.
            if not self._EVENT_LINK_PATTERN.search(href):
                continue

            title = re.sub(r"\s+", " ", a_tag.get_text(strip=True)).strip()
            full_url = urljoin(self.LIST_URL, href)
            if full_url in seen:
                continue
            seen.add(full_url)
            links.append(EventLink(title=title or "(제목 없음)", url=full_url))

        return links[: self.MAX_DETAIL_PAGES]

    # ------------------------------------------------------------------
    # B) 진짜 href를 못 찾았을 때: 배너를 직접 클릭해서 이동 주소 캡처
    # ------------------------------------------------------------------
    def _collect_links_by_clicking(self, browser: BrowserClient, page, max_banners: int = 15) -> list[EventLink]:
        """
        클릭 가능한 배너 요소를 순서대로 클릭해서, 이동한 뒤의 URL을 모읍니다.
        각 클릭 후에는 원래 목록 페이지로 되돌아갑니다.
        """
        links: list[EventLink] = []

        # 배너로 보이는 요소들의 개수를 먼저 셉니다.
        # ⚠️ 이 선택자("li a, .event-item a" 등)도 실제 DOM 구조를 못 봐서
        # 추측입니다 — 로컬에서 F12로 배너 요소의 class를 확인해서 정확한
        # 선택자로 바꿔주시면 훨씬 안정적으로 동작합니다.
        candidate_selector = "a, [onclick]"
        count = page.locator(candidate_selector).count()

        for i in range(min(count, max_banners)):
            try:
                element = page.locator(candidate_selector).nth(i)
                title = (element.text_content() or "").strip()
                if not title:
                    continue

                with page.expect_navigation(timeout=8000):
                    element.click()

                links.append(EventLink(title=title, url=page.url))
                page.go_back(timeout=8000)

            except Exception as e:
                log.debug("배너 클릭 실패(건너뜀, %d번째): %s", i, e)
                continue

        return links

    # ------------------------------------------------------------------
    def fetch_pages(self) -> Iterator[PageContent]:
        with BrowserClient() as browser:
            list_html = browser.get_rendered_html(self.LIST_URL, wait_ms=4000, scroll_to_bottom=True)
            if not list_html:
                return

            links = self._parse_event_links_from_html(list_html)

            if not links:
                log.warning(
                    "[shinhan_card] href 방식으로 링크를 못 찾았습니다. "
                    "클릭 방식(B)으로 전환합니다 — 더 오래 걸립니다."
                )
                # 내부 Playwright page 객체가 필요해서 BrowserClient 내부를 직접 씁니다.
                page = browser._browser.new_page()
                try:
                    page.goto(self.LIST_URL, wait_until="networkidle", timeout=20000)
                    links = self._collect_links_by_clicking(browser, page, self.MAX_DETAIL_PAGES)
                finally:
                    page.close()

            log.info("[shinhan_card] 이벤트 후보 %d건 발견", len(links))

            for link in links:
                detail_html = browser.get_rendered_html(link.url, wait_ms=3000)
                if not detail_html:
                    continue

                text = html_to_text(detail_html)
                if not text or len(text.strip()) < 30:
                    continue

                yield PageContent(
                    url=link.url,
                    text=f"[이벤트 제목: {link.title}]\n\n{text}",
                    hint=self.context_hint,
                )


# =============================================================================
# 로컬에서 직접 테스트하고 싶을 때
# =============================================================================
#     python -m crawlers.shinhan_card
#
# 콘솔에 "href 방식으로 링크를 못 찾았습니다"가 뜨면 A 방식이 실패해서
# B(클릭) 방식으로 넘어간 것입니다 — 정상 동작이지만 훨씬 느립니다.
# 결과가 0건이면 _EVENT_LINK_PATTERN 이나 클릭 선택자를 F12로 실제
# DOM을 보고 조정해야 합니다.

if __name__ == "__main__":
    crawler = ShinhanCardCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| {item.category.value}/{item.benefit_type.value}")
    finally:
        crawler.close()