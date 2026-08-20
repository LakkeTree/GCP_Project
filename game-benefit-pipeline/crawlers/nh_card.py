# -*- coding: utf-8 -*-
"""
crawlers/nh_card.py
--------------------------------------------------------------------
NH농협카드 이벤트 페이지를 수집하는 크롤러입니다.

⚠️ 다른 4곳과 달리, 검색 결과 스니펫에 실제 이벤트 제목들("복날 이벤트",
"NH농협카드로 코레일 예매하고 2천원 캐시백" 등)이 텍스트로 그대로
보였습니다 — 이건 서버가 완성된 HTML을 보낼 가능성(SSR)을 시사합니다.
그렇다면 Playwright 없이 common/http_client.py 만으로도 될 수 있는데,
일단 안전하게 Playwright로 통일해뒀습니다. 로컬에서 확인해보시고
http_client만으로 잘 되면 더 가볍게 바꿔드릴 수 있습니다.
"""

from __future__ import annotations

from common.card_base import CardEventCrawler


class NhCardCrawler(CardEventCrawler):
    source_name = "nh_card"
    PROVIDER_CODE = "NH_NONGHYUP_CARD"
    PROVIDER_DISPLAY_NAME = "NH농협카드"
    EVENT_URL = "https://nhpay.nonghyup.com/bn/BN600000F"


if __name__ == "__main__":
    crawler = NhCardCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| {item.category.value}/{item.benefit_type.value}")
    finally:
        crawler.close()

