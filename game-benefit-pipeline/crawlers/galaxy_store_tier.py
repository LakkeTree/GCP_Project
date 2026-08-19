# -*- coding: utf-8 -*-
"""
crawlers/galaxy_store_tier.py
--------------------------------------------------------------------
삼성전자 멤버십 등급별 갤럭시 스토어 포인트 적립률 페이지를 수집하는
크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://www.samsung.com/sec/membership/membershipLevel/

실제로 확인한 내용 (2026-08-12 기준):
    일반: 0.1% (월 적립한도 60,000 포인트)
    스타: 0.1% (동일 조건)
    프레스티지: 0.1% + 추가 1% (2년 적립한도 80,000 포인트)
    로열블루: 0.1% + 추가 2% (2년 적립한도 200,000 포인트)

    페이지에 갤럭시 스토어 전용 예외 조항도 명시되어 있었습니다:
    "갤럭시스토어에서 적립되는 포인트는 월/2년 적립한도 적용되지 않습니다."
    "갤럭시스토어에서 사용한 삼성전자 포인트는 등급 선정 구매금액에서 제외됩니다."

⚠️ 이 페이지는 삼성전자 멤버십 전체(가전제품 구매 포함)를 다루는 페이지라,
갤럭시 스토어와 무관한 내용(TV·냉장고 무상수리 연장 등)도 많이 섞여 있습니다.
프롬프트에서 갤럭시 스토어 관련 내용만 추출하도록 강하게 지시해뒀습니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class GalaxyStoreTierCrawler(BaseCrawler):
    """삼성전자 멤버십 등급별 갤럭시 스토어 적립률을 수집합니다."""

    source_name = "galaxy_store_tier"

    context_hint = (
        "삼성전자 멤버십 '등급별 혜택' 공식 페이지입니다. 이 페이지는 TV·냉장고 "
        "같은 가전제품 구매 혜택까지 전부 다루는데, 그건 게임 결제와 무관하니 "
        "무시하세요. 오직 '갤럭시스토어' 언급이 있는 포인트 적립률만 추출하세요.\n"
        "target_platform=GALAXY_STORE, category=SUMMARY_STORE_TIER_REWARD_RATES, "
        "target_game=ALL로 고정하세요.\n"
        "★ 등급마다(일반/스타/프레스티지/로열블루) 별도의 항목으로 분리하세요. "
        "item_or_event_name에 등급 이름을 반드시 포함하세요(예: '삼성전자 멤버십 "
        "로열블루 등급 갤럭시스토어 적립').\n"
        "★★ 매우 중요: benefit_value는 그 등급에서 실제로 받는 '총' 적립률을 "
        "쓰세요. 예를 들어 로열블루는 기본 0.1% + 추가 2% = 총 2.1%입니다. "
        "0.1%와 2%를 각각 별도 항목으로 쪼개지 말고, condition_raw_text에 "
        "'기본 0.1% + 추가 2%' 처럼 구성 내역을 원문 그대로 적어서 검증할 수 "
        "있게 하세요.\n"
        "★ stacking_layer=STORE_COUPON, disbursement_type=POINT_REWARD, "
        "benefit_type=REWARD로 고정하세요.\n"
        "★ 월/2년 적립 한도가 있으면 max_benefit_krw에 그 한도(원 단위, "
        "포인트=원으로 간주)를 넣으세요. 갤럭시스토어는 이 한도가 적용 안 "
        "된다고 명시되어 있으니, 갤럭시스토어 관련 항목이라면 이 사실을 "
        "condition_raw_text에 반드시 남기세요."
    )

    EVENT_URL = "https://www.samsung.com/sec/membership/membershipLevel/"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return

        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = GalaxyStoreTierCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:100]}")
    finally:
        crawler.close()
