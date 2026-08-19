# -*- coding: utf-8 -*-
"""
crawlers/naver_pay.py
--------------------------------------------------------------------
네이버페이 적립 안내 페이지를 수집하는 크롤러입니다.

대상 페이지 (사용자가 찾아준 URL):
    https://campaign2.naver.com/moneypay/

⚠️ 중요한 미검증 상태: 이 URL을 직접 열어보려 했는데 "접근이 차단됨"
(SITE_BLOCKED) 응답을 받아서, 실제 페이지 내용을 전혀 못 봤습니다.
robots.txt로 명시적으로 막힌 것과는 다른 종류의 차단(예: 자동화 도구
탐지, 리퍼러 검사, 특정 지역 제한 등)으로 보입니다.

그래서 이 크롤러는 원스토어/갤럭시 스토어 때처럼 Playwright(진짜 브라우저
흉내)로 만들어뒀습니다 — 제 검색 도구는 막혔지만, 실제 브라우저 자동화는
다를 수 있어서 시도해볼 가치가 있습니다. 로컬에서 실행하신 뒤 결과를 꼭
확인해 주세요. 이번에도 막히면(예: 빈 결과, 접근 거부 페이지) 이 소스는
포기해야 할 수도 있습니다.
"""

from __future__ import annotations

from typing import Iterator

from common.browser import BrowserClient
from common.http_client import html_to_text
from common.logger import get_logger
from crawlers.base import BaseCrawler, PageContent

log = get_logger(__name__)


class NaverPayCrawler(BaseCrawler):
    """네이버페이 적립 안내 페이지를 수집합니다."""

    source_name = "naver_pay"

    context_hint = (
        "네이버페이 적립 안내 페이지입니다. provider_or_retailer는 반드시 "
        "'NAVER_PAY'로 고정하세요. target_platform=ALL, target_game=ALL로 "
        "고정하세요.\n"
        "★ 등급제(브론즈/실버 등)인지, 페이코처럼 결제 방식별 고정 요율인지 "
        "원문을 보고 판단해서 그 구조 그대로 항목을 나누세요. 확실하지 않으면 "
        "가장 작은 단위(조건 하나)로 나누는 쪽을 선택하세요.\n"
        "★ category=REWARD_E_PAY, benefit_type=REWARD, "
        "stacking_layer=PAYMENT_E_PAY, disbursement_type=POINT_REWARD로 "
        "고정하세요.\n"
        "★ 게임 결제가 적립 제외 대상으로 명시되어 있는지 꼭 확인하고, "
        "제외 목록이 있으면 condition_raw_text에 원문 그대로 옮기세요.\n"
        "★ 원문에 할인율/적립률처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
        "제외하세요."
    )

    EVENT_URL = "https://campaign2.naver.com/moneypay/"

    def fetch_pages(self) -> Iterator[PageContent]:
        with BrowserClient() as browser:
            html = browser.get_rendered_html(
                self.EVENT_URL, wait_ms=4000,
                dismiss_button_texts=["전체 동의", "모두 동의", "동의", "Accept all"],
            )

        if not html:
            log.error(
                "[naver_pay] 페이지를 못 가져왔습니다. 접근 차단이 "
                "Playwright로도 안 뚫리는 것으로 보입니다."
            )
            return

        text = html_to_text(html)
        if not text or len(text.strip()) < 30:
            log.warning(
                "[naver_pay] 내용이 너무 짧습니다 — 접근 거부 페이지이거나 "
                "빈 화면일 가능성이 높습니다. 실제로 뭐가 왔는지 확인이 필요합니다."
            )
            return

        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = NaverPayCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:100]}")
    finally:
        crawler.close()
