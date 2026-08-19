# -*- coding: utf-8 -*-
"""
crawlers/lgu_membership.py
--------------------------------------------------------------------
LG U+ 멤버십의 '진행중인 이벤트/혜택' 목록 페이지를 수집하는 크롤러입니다.

대상 페이지:
    https://www.lguplus.com/benefit-event/ongoing

⚠️ SKT·KT와 달리, LG U+가 지금도 '원스토어 게임 카테고리 할인' 같은
게임 전용 혜택을 운영하는지 명확한 전용 페이지를 못 찾았습니다. 검색
중 나무위키에서 "2023년 6월부터는 SKT, LGU+를 제외하고 KT한테만
이벤트를 진행시키고 있다"는 문구를 봤는데, 이게 사실이면 LG U+는 원스토어
게임 할인을 지금 안 하고 있을 수 있습니다.

그래서 이 크롤러는 카드사 크롤러들과 같은 방식(전체 이벤트 목록에서
게임/앱 관련만 필터링)으로 만들었습니다 — 게임 관련 이벤트가 실제로
있으면 잡히고, 없으면 0건이 나올 텐데 그것도 정상입니다(이 회사가
지금은 게임 혜택을 안 한다는 뜻이니까요).
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class LguMembershipCrawler(BaseCrawler):
    """LG U+ 멤버십 진행중 이벤트에서 게임/앱 관련 혜택을 수집합니다."""

    source_name = "lgu_membership"

    context_hint = (
        "LG U+ 멤버십 '진행중인 이벤트/혜택' 목록 페이지입니다. "
        "provider_or_retailer는 반드시 'LGU_PLUS'로 고정하세요.\n"
        "★★ 매우 중요: 이 목록에는 휴대폰 할인, 구독 서비스(넷플릭스 등), "
        "여행, 문화생활처럼 게임과 무관한 이벤트가 훨씬 많이 섞여 있습니다. "
        "반드시 다음에 해당하는 이벤트만 추출하세요.\n"
        "  (1) 원스토어·구글플레이·앱스토어·갤럭시스토어 게임 결제에 "
        "직접 적용되는 할인·적립·쿠폰\n"
        "  (2) '게임' 카테고리로 명시된 혜택\n"
        "위에 해당하지 않으면(휴대폰 구독, OTT 할인 등) 전부 무시하세요. "
        "애매하면 빼는 쪽을 선택하세요.\n"
        "★ target_platform은 원문에 명시된 스토어로, 특정 스토어 언급이 "
        "없으면 ALL로 두세요. target_game=ALL로 고정하세요.\n"
        "★ stacking_layer=STORE_COUPON, disbursement_type은 원문 성격에 맞게 "
        "COUPON_ISSUE 또는 INSTANT_DISCOUNT로 판단하세요.\n"
        "★ 원문에 할인율/금액처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
        "제외하세요."
    )

    EVENT_URL = "https://www.lguplus.com/benefit-event/ongoing"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return
        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = LguMembershipCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        if not results:
            print("0건입니다 — LG U+가 지금 게임 전용 혜택을 운영하지 않을 "
                  "가능성이 있습니다(정상일 수 있음). 원문에 게임 관련 "
                  "이벤트가 실제로 있는지 브라우저로 직접 확인해 보세요.")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
    finally:
        crawler.close()
