# -*- coding: utf-8 -*-
"""
crawlers/hana_card.py
--------------------------------------------------------------------
하나카드 '진행중인 이벤트' 페이지를 수집하는 크롤러입니다.

⚠️ URL은 검색으로만 찾았고 실제로 열어서 확인하지 못했습니다.
검색 결과에 "진행중인 이벤트 목록 및 응모/당첨 확인은 하나Pay 앱 또는
모바일웹에서 확인 가능합니다"라는 안내문이 있었습니다 — 이 웹 페이지가
실제 목록을 다 보여주는지, 아니면 앱 전용으로 안내만 하는지 로컬에서
꼭 확인해 주세요. 만약 앱 전용이면(원스토어/구글플레이 순위 때처럼)
이 크롤러는 사용할 수 없는 소스라는 뜻입니다.
"""

from __future__ import annotations

from common.card_base import CardEventCrawler


class HanaCardCrawler(CardEventCrawler):
    source_name = "hana_card"
    PROVIDER_CODE = "HANA_CARD"
    PROVIDER_DISPLAY_NAME = "하나카드"
    EVENT_URL = "https://m.hanacard.co.kr/MKEVT1000M.web"


if __name__ == "__main__":
    crawler = HanaCardCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| {item.category.value}/{item.benefit_type.value}")
    finally:
        crawler.close()
