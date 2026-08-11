# -*- coding: utf-8 -*-
"""
crawlers/galaxy_store.py
--------------------------------------------------------------------
갤럭시 스토어 프로모션을 수집하는 크롤러입니다.

⚠️ 원스토어와 구조가 완전히 다릅니다. 원스토어는 "쿠폰 득템전" 하나의 페이지에
   모든 쿠폰이 나열되어 있었지만, 갤럭시 스토어는 그런 단일 목록 페이지가
   없습니다. 대신 삼성 공식 계정("갤럭시스토어마케팅_담당")이 삼성 커뮤니티
   게시판(Samsung Members)에 이벤트 하나당 게시글 하나씩 올리는 방식입니다.

   그래서 이 크롤러는 2단계로 동작합니다.
     1단계) 게시판 목록 페이지에서 최근 게시글 제목 + 링크를 모읍니다.
     2단계) 제목에 할인/쿠폰 관련 키워드가 있는 게시글만 골라, 그 상세 페이지를
            열어서 실제 조건(할인율, 기간, 대상 게임)을 Gemini로 추출합니다.

   목록 페이지: https://r1.community.samsung.com/t5/forums/filteredbylabelpage/
                board-id/kr-community-svc-store/label-name/프로모션

⚠️ v2 변경: common/http_client.py(requests) 대신 common/browser.py(Playwright)를
   씁니다. 실제로 requests로 시도해보니 403 Forbidden 이 났습니다 — 삼성 커뮤니티가
   쓰는 Khoros/Lithium 플랫폼이 TLS 지문·헤더 패턴으로 "진짜 브라우저가 아닌
   요청"을 걸러내는 것으로 보입니다(User-Agent만 바꿔서는 못 피해갑니다).
   Playwright는 실제 크로미움을 띄우기 때문에 이런 지문 기반 차단을 대부분
   통과합니다. 페이지 내용 자체는 자바스크립트 없이도 이미 완성된 형태로 오는
   것을 확인했으므로(구글플레이 Perks 페이지와는 다른 이유), 여기서 Playwright는
   'JS 실행'이 아니라 '진짜 브라우저처럼 보이기 위한 용도'로 씁니다.

⚠️ 참여 방식도 원스토어와 다릅니다. 원스토어는 버튼 한 번으로 즉시 쿠폰이
   발급됐지만, 갤럭시 스토어 이벤트는 대부분 "삼성 계정 로그인 → 이벤트 참여
   버튼 클릭 → (때로는 게임 다운로드까지) → 쿠폰 수령"처럼 여러 단계를 거칩니다.
   그래서 requires_pre_app=true 를 기본으로 안내합니다.

   ★ 게시글 안의 "이벤트 참여하기" 버튼은 앱 전용 딥링크라 크롤러가 못 엽니다.
   하지만 이 크롤러는 그 버튼을 클릭하지 않습니다 — 게시글 본문 자체에 이미
   기간/할인율/조건이 텍스트로 다 적혀 있어서, 본문만 읽어도 충분합니다.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from common.browser import BrowserClient
from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


@dataclass
class TopicLink:
    """게시판 목록에서 뽑아낸 게시글 하나(제목 + 링크)."""

    title: str
    url: str


class GalaxyStoreCrawler(BaseCrawler):
    """갤럭시 스토어 프로모션(Samsung Members 게시판)을 수집합니다."""

    source_name = "galaxy_store"

    context_hint = (
        "갤럭시 스토어 프로모션 게시글입니다. target_platform=GALAXY_STORE로 "
        "고정하세요.\n"
        "★ category/benefit_type 구분: '페이백'은 결제 후 나중에 돌려받는 방식이라 "
        "benefit_type=CASHBACK 입니다(즉시 할인이 아닙니다). '즉시 할인 쿠폰'은 "
        "benefit_type=DISCOUNT, '포인트 적립'은 benefit_type=REWARD 입니다.\n"
        "★ requires_pre_app: 갤럭시 스토어 이벤트는 대부분 '삼성 계정 로그인 → "
        "이벤트 참여하기 버튼 클릭' 절차가 필요합니다(원스토어처럼 즉시 발급되는 "
        "것이 아닙니다). 참여 절차(STEP1, STEP2 등)가 안내되어 있으면 "
        "requires_pre_app=true로 표시하세요.\n"
        "★ stacking_layer=STORE_COUPON, disbursement_type은 페이백이면 "
        "BILL_DISCOUNT 또는 POINT_REWARD(원문에서 포인트/캐시로 돌려준다고 하면 "
        "POINT_REWARD, 결제 금액 자체를 환급한다면 BILL_DISCOUNT), 즉시 할인이면 "
        "INSTANT_DISCOUNT, 참여만 하고 쿠폰을 나중에 받는 구조면 COUPON_ISSUE.\n"
        "★ target_game: 특정 게임 전용이면 그 게임명을 쓰고(예: 'FC모바일', "
        "'삼국지 전략판'), 'RPG/전략 게임 31종'처럼 여러 게임이 뭉뚱그려져 "
        "있고 개별 게임명이 원문에 안 나오면 target_game=ALL로 두세요.\n"
        "★ 원문에 할인율/기간처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
        "제외하세요. 댓글, '좋아요', '조회수' 같은 게시판 UI 텍스트는 무시하세요."
    )

    LIST_URL = (
        "https://r1.community.samsung.com/t5/forums/filteredbylabelpage/"
        "board-id/kr-community-svc-store/label-name/%ED%94%84%EB%A1%9C%EB%AA%A8%EC%85%98"
    )

    # 목록에서 상세 페이지 링크를 찾을 때 쓰는 정규식.
    # Samsung Members 게시글 URL은 전부 ".../m-p/숫자" 형태로 끝납니다.
    _TOPIC_LINK_PATTERN = re.compile(r"/m-p/\d+$")

    # 제목에 이 단어들 중 하나라도 있으면 "혜택일 가능성이 높다"고 보고
    # 상세 페이지를 열어봅니다. 필요에 따라 추가/조정하세요.
    KEYWORD_HINTS = ("쿠폰", "할인", "페이백", "적립", "%", "혜택")

    # 그래도 상세 페이지를 몇 개나 열어볼지 상한선.
    # (목록 1페이지에 약 50개 글이 있는데, 전부 열면 느리고 오래된 것은
    #  이미 종료됐을 가능성이 높습니다. 최근 것 위주로 이 개수만큼만 봅니다)
    MAX_DETAIL_PAGES = 15

    # ------------------------------------------------------------------
    # 1단계: 목록 페이지에서 후보 링크 뽑기
    # ------------------------------------------------------------------
    def _parse_topic_links(self, html: str) -> list[TopicLink]:
        """목록 페이지 HTML에서 '혜택일 가능성이 있는' 게시글만 골라 돌려줍니다."""
        soup = BeautifulSoup(html, "lxml")
        candidates: list[TopicLink] = []
        seen_urls: set[str] = set()

        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if not self._TOPIC_LINK_PATTERN.search(href):
                continue  # 게시글 상세 링크가 아니면 건너뜁니다.

            title = a_tag.get_text(strip=True)
            if not title:
                continue  # 제목 없는 링크(썸네일 이미지 링크 등)는 건너뜁니다.

            full_url = urljoin(self.LIST_URL, href)
            if full_url in seen_urls:
                continue  # 같은 글이 이미지 링크+텍스트 링크 두 번 걸리는 경우 방지
            seen_urls.add(full_url)

            if any(keyword in title for keyword in self.KEYWORD_HINTS):
                candidates.append(TopicLink(title=title, url=full_url))

        return candidates[: self.MAX_DETAIL_PAGES]

    # ------------------------------------------------------------------
    # 2단계: 후보 각각의 상세 페이지를 가져와 PageContent로 변환
    # ------------------------------------------------------------------
    def fetch_pages(self) -> Iterator[PageContent]:
        # 브라우저를 한 번만 띄우고, 그 안에서 목록+상세 페이지를 전부 처리합니다.
        # (요청마다 새 브라우저를 띄우면 느리고, 어차피 탭(page)은
        #  get_rendered_html() 호출마다 새로 열렸다 닫히므로 이걸로 충분합니다)
        with BrowserClient() as browser:
            list_html = browser.get_rendered_html(self.LIST_URL, wait_ms=4000)
            if not list_html:
                return

            candidates = self._parse_topic_links(list_html)
            if not candidates:
                return

            for topic in candidates:
                detail_html = browser.get_rendered_html(topic.url, wait_ms=3000)
                if not detail_html:
                    continue  # 이 글만 건너뛰고 나머지는 계속 진행합니다.

                text = html_to_text(detail_html)
                if not text or len(text.strip()) < 30:
                    continue

                yield PageContent(
                    url=topic.url,
                    text=f"[게시글 제목: {topic.title}]\n\n{text}",
                    hint=self.context_hint,
                )


# =============================================================================
# 로컬에서 직접 테스트하고 싶을 때
# =============================================================================
#     python -m crawlers.galaxy_store
#
# ⚠️ 목록 1페이지 안에서 키워드에 걸리는 글이 몇 개나 되는지, 최대
#    MAX_DETAIL_PAGES(15)개까지 상세 페이지를 하나씩 엽니다. Playwright로
#    실제 브라우저를 띄우기 때문에 원스토어보다 실행 시간이 더 오래 걸립니다.
# ⚠️ 여전히 403/차단이 발생하면: wait_ms를 늘려보거나, common/browser.py의
#    User-Agent를 최신 버전으로 바꿔보세요. 그래도 안 되면 이 사이트가
#    Playwright 수준도 차단하는 강한 봇 방지(예: Akamai)를 쓰는 것이므로
#    다른 소스를 고려해야 합니다.

if __name__ == "__main__":
    crawler = GalaxyStoreCrawler()
    try:
        with BrowserClient() as browser:
            list_html = browser.get_rendered_html(GalaxyStoreCrawler.LIST_URL, wait_ms=4000)
        candidates = crawler._parse_topic_links(list_html) if list_html else []
        print(f"\n1단계: 목록에서 키워드 매칭된 후보 {len(candidates)}건")
        for c in candidates:
            print(f"  - {c.title}")

        results = crawler.run(upload_to_gcs=False)
        print(f"\n2단계: 최종 추출된 혜택 {len(results)}건\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.target_game} | "
                  f"{item.benefit_value}{item.benefit_unit.value} | ~{item.end_date}")
    finally:
        crawler.close()
