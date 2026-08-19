# -*- coding: utf-8 -*-
"""
crawlers/google_play_tier.py
--------------------------------------------------------------------
구글플레이 포인트(Play Points) 등급별 적립률 페이지를 수집하는 크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://play.google.com/intl/ALL_kr/about/playpoints/notifications/how-to-earn-points/

실제로 확인한 내용 (2026-08-12 기준):
    브론즈: 1,000원당 1포인트 적립
    실버:   1,000원당 1.1포인트 적립
    골드:   1,000원당 1.3포인트 적립
    플래티넘: 1,000원당 1.6포인트 적립
    다이아몬드: 1,000원당 2포인트 적립

⚠️ 중요한 가정 (팀 확인 필요): 저희 스키마의 benefit_unit은 PERCENT/KRW만
허용하는데, 이 페이지는 "포인트"로 되어 있습니다. "1포인트 = 1원"이라고
가정해서 퍼센트로 환산했습니다(예: 브론즈 1,000원당 1포인트 → 0.1%).
이 환산율은 삼성 리워즈 포인트에서는 공식 문서로 확인했지만, 구글플레이
포인트에도 똑같이 적용되는지는 확인 못 했습니다. 실제 포인트 가치가
다르면(예: 100포인트=90원 같은 할인 환전) benefit_value가 부정확할 수
있으니, 조원분들과 확인해보시길 권합니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class GooglePlayTierCrawler(BaseCrawler):
    """구글플레이 포인트 등급별 적립률을 수집합니다."""

    source_name = "google_play_tier"

    context_hint = (
        "구글플레이 Play Points 등급별 적립률 공식 안내 페이지입니다. "
        "target_platform=GOOGLE_PLAY, category=SUMMARY_STORE_TIER_REWARD_RATES로 "
        "고정하세요. target_game=ALL로 고정하세요(특정 게임이 아니라 모든 구매에 "
        "적용됨).\n"
        "★★ 매우 중요: 이 페이지는 '1,000원당 N포인트' 형식입니다. 1포인트를 "
        "1원으로 간주해서 백분율로 환산하세요. 계산식: (포인트 ÷ 1000) × 100 "
        "= 포인트 ÷ 10 (%). 예) 브론즈 '1,000원당 1포인트' → benefit_value=0.1, "
        "benefit_unit=PERCENT. 실버 '1,000원당 1.1포인트' → benefit_value=0.11.\n"
        "★ 등급마다(브론즈/실버/골드/플래티넘/다이아몬드) 별도의 항목으로 "
        "분리하세요 — 하나로 뭉치지 마세요. item_or_event_name에 등급 이름을 "
        "반드시 포함하세요(예: 'Google Play Points 브론즈 등급 적립').\n"
        "★ stacking_layer=STORE_COUPON, disbursement_type=POINT_REWARD, "
        "benefit_type=REWARD로 고정하세요.\n"
        "★ condition_raw_text에는 원문의 정확한 포인트 표현("
        "예: '1,000원당 1포인트')을 그대로 옮겨서, 나중에 사람이 환산이 "
        "맞는지 검증할 수 있게 하세요.\n"
        "★ '신규 가입 7일간 3포인트' 같은 한시적 프로모션은 별도 항목으로 "
        "분리하되 category는 그대로 SUMMARY_STORE_TIER_REWARD_RATES를 "
        "쓰거나, 명확히 이벤트성이면 REWARD_STORE로 표기해도 됩니다."
    )

    EVENT_URL = "https://play.google.com/intl/ALL_kr/about/playpoints/notifications/how-to-earn-points/"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return

        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = GooglePlayTierCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:80]}")
    finally:
        crawler.close()
