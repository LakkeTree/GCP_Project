# -*- coding: utf-8 -*-
"""
crawlers/kt_membership.py
--------------------------------------------------------------------
KT 멤버십의 '원스토어' 제휴 브랜드 상세 페이지를 수집하는 크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://membership.kt.com/discount/partner/C23/66/PartnerDetail.do

실제로 확인한 내용 (2026-08-12 기준):
    [상시혜택] 전등급 대상
      게임(유료게임, 인앱결제): 10% 할인, 일 1회, 최대 1만원
      앱(유료앱, 인앱결제): 10% 할인, 일 1회, 최대 1만원
      원스토리앱(이북/만화/웹툰): 5% 할인, 일 1회, 최대 5천원 (게임 아님, 참고용)
    [생일혜택] 5천원 할인 (1만원 이상 결제 시, 생일 달 한정)

⚠️ "쿠폰 다운로드는 KT멤버십 앱에서만 가능"이라는 안내가 있습니다 — 정보
페이지 자체는 웹에서 보이지만, 실제 쿠폰을 받으려면 앱이 필요하다는 뜻이라
requires_pre_app=true로 처리하도록 지시했습니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class KtMembershipCrawler(BaseCrawler):
    """KT 멤버십의 원스토어 혜택을 수집합니다."""

    source_name = "kt_membership"

    context_hint = (
        "KT 멤버십의 '원스토어' 제휴 브랜드 상세 페이지입니다. "
        "provider_or_retailer는 반드시 'KT'로 고정하세요. "
        "target_platform=ONE_STORE, target_game=ALL로 고정하세요.\n"
        "★★ '원스토리앱'(이북/만화/웹툰) 관련 혜택은 게임이 아니니 제외하세요. "
        "'게임'과 '앱(인앱결제)' 카테고리만 추출하세요.\n"
        "★ [상시혜택]과 [생일혜택]은 조건이 다르니 별도 항목으로 분리하세요. "
        "생일 한정 혜택은 is_first_purchase는 아니지만 user_segment는 "
        "ALL_USERS로 두고 condition_raw_text에 '생일 당월 한정'을 명시하세요.\n"
        "★ stacking_layer=STORE_COUPON, benefit_type=DISCOUNT, "
        "disbursement_type=COUPON_ISSUE로 고정하세요 (앱에서 쿠폰을 다운로드 "
        "받는 방식이므로).\n"
        "★ requires_pre_app=true로 고정하세요 (KT멤버십 앱에서 쿠폰을 "
        "다운로드해야 사용 가능합니다).\n"
        "★ '일 1회, 최대 N원' 같은 한도가 있으면 max_benefit_krw에 넣고, "
        "1일 1회 제한은 condition_raw_text에 명시하세요."
    )

    EVENT_URL = "https://membership.kt.com/discount/partner/C23/66/PartnerDetail.do"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return
        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = KtMembershipCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:100]}")
    finally:
        crawler.close()
