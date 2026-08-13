# -*- coding: utf-8 -*-
"""
crawlers/skt_membership.py
--------------------------------------------------------------------
SKT T멤버십의 '원스토어' 제휴 브랜드 상세 페이지를 수집하는 크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://sktmembership.tworld.co.kr/mps/pc-bff/benefitbrand/detail.do?brandId=1213

실제로 확인한 내용 (2026-08-12 기준):
    게임/게임 인앱 카테고리: 10% 할인 또는 적립, 일 최대 10,000원(포인트)
    앱 인앱 카테고리: 10% 할인 또는 적립, 일 최대 3,000원(포인트)
    쇼핑 카테고리: 5% (게임과 무관, 참고용)

⚠️ brandId=1213은 '원스토어' 전용 페이지입니다. T멤버십이 게임 스토어 중
원스토어만 제휴하고 있는 것으로 보입니다(구글플레이·갤럭시 스토어 제휴는
못 찾음). 페이지 인증 필요 문구("원스토어 본인 ID로 인증 완료한 고객에
한해 제공")가 있어 requires_pre_app=true로 처리하도록 지시했습니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class SktMembershipCrawler(BaseCrawler):
    """SKT T멤버십의 원스토어 혜택을 수집합니다."""

    source_name = "skt_membership"

    context_hint = (
        "SKT T멤버십의 '원스토어' 제휴 브랜드 상세 페이지입니다. "
        "provider_or_retailer는 반드시 'SKT'로 고정하세요. "
        "target_platform=ONE_STORE, target_game=ALL로 고정하세요.\n"
        "★★ 매우 중요: 이 페이지엔 게임과 무관한 카테고리(쇼핑, 콘텐츠 구독 "
        "등)도 섞여 있습니다. '게임' 또는 '게임 인앱' 카테고리에 해당하는 "
        "혜택만 추출하세요. '앱' 카테고리는 게임이 포함될 수 있으니 포함하되, "
        "쇼핑·구독 카테고리는 제외하세요.\n"
        "★ 할인형과 적립형이 따로 있으면 별도 항목으로 분리하세요 "
        "(할인형: benefit_type=DISCOUNT, disbursement_type=INSTANT_DISCOUNT / "
        "적립형: benefit_type=REWARD, disbursement_type=POINT_REWARD).\n"
        "★ stacking_layer=STORE_COUPON으로 고정하세요.\n"
        "★ requires_pre_app=true로 고정하세요 (원스토어 본인 ID 인증이 "
        "선행되어야 적용됩니다).\n"
        "★ '일 최대 N원/N포인트' 같은 한도가 있으면 max_benefit_krw에 넣으세요.\n"
        "★ 원문에 할인율/적립률처럼 핵심 정보가 없으면 결과에서 제외하세요."
    )

    EVENT_URL = "https://sktmembership.tworld.co.kr/mps/pc-bff/benefitbrand/detail.do?brandId=1213"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return
        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = SktMembershipCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:100]}")
    finally:
        crawler.close()
