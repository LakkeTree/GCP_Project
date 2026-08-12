# -*- coding: utf-8 -*-
"""
crawlers/kb_card.py
--------------------------------------------------------------------
KB국민카드 이벤트 페이지를 수집하는 크롤러입니다.

⚠️ URL은 검색으로만 찾았고 실제로 열어서 확인하지 못했습니다.
신한카드와 같은 자바스크립트 SPA 패턴일 가능성이 높아 Playwright로
만들었지만, 로컬에서 처음 실행하실 때 결과를 꼭 확인해 주세요.
"""

from __future__ import annotations

from common.card_base import CardEventCrawler


class KbCardCrawler(CardEventCrawler):
    source_name = "kb_card"
    PROVIDER_CODE = "KB_KOOKMIN_CARD"
    PROVIDER_DISPLAY_NAME = "KB국민카드"
    EVENT_URL = "https://m.kbcard.com/BON/DVIEW/MBBV0002"


if __name__ == "__main__":
    crawler = KbCardCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| {item.category.value}/{item.benefit_type.value}")
    finally:
        crawler.close()
