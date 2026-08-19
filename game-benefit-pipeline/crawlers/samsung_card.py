# -*- coding: utf-8 -*-
"""
crawlers/samsung_card.py
--------------------------------------------------------------------
삼성카드 '진행중인 이벤트' 페이지를 수집하는 크롤러입니다.
"""

from __future__ import annotations

from common.card_base import CardEventCrawler


class SamsungCardCrawler(CardEventCrawler):
    source_name = "samsung_card"
    PROVIDER_CODE = "SAMSUNG_CARD"
    PROVIDER_DISPLAY_NAME = "삼성카드"
    EVENT_URL = "https://www.samsungcard.com/personal/event/ing/UHPPBE1401M0.jsp?click=gnb_benefit_event"


if __name__ == "__main__":
    crawler = SamsungCardCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| {item.category.value}/{item.benefit_type.value}")
    finally:
        crawler.close()
