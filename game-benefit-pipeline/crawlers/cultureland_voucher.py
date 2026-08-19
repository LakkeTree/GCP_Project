# -*- coding: utf-8 -*-
"""
crawlers/cultureland_voucher.py
--------------------------------------------------------------------
컬쳐랜드 비즈몰의 게임 관련 상품권/기프트코드 할인 판매 페이지를
수집하는 크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://culture.supercon.io/main

실제로 확인한 내용 (2026-08-12 기준):
    Google Play 기프트코드 1만원권: 할인율 3.0%, 판매가 9,700원 (정가 10,000원)
    (주)슈퍼콘이 운영하는 정식 통신판매업 등록 업체입니다
    (통신판매업 제 2021-서울송파-3092호).

⚠️ 이 사이트는 스타벅스·GS25 같은 게임과 무관한 상품권도 훨씬 많이
파는 종합 쇼핑몰입니다. 프롬프트에서 구글플레이·원스토어·앱스토어·
갤럭시스토어 기프트코드/캐시만 추출하도록 강하게 지시했습니다.

이건 '이벤트'가 아니라 '상시 판매 가격'이라, 매번 크롤링할 때마다
할인율이 달라질 수 있습니다(프로모션에 따라 변동).
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class CulturelandVoucherCrawler(BaseCrawler):
    """컬쳐랜드 비즈몰의 게임 관련 기프트코드 할인 판매가를 수집합니다."""

    source_name = "cultureland_voucher"

    context_hint = (
        "컬쳐랜드 비즈몰(정식 통신판매업 등록 업체, 슈퍼콘 운영)의 모바일쿠폰/"
        "상품권 판매 목록 페이지입니다. 이 사이트는 스타벅스·GS25·치킨 등 "
        "게임과 무관한 상품권도 훨씬 많이 판매합니다.\n"
        "★★ 매우 중요: 'Google Play 기프트코드', '원스토어', '앱스토어', "
        "'갤럭시스토어' 같은 게임 스토어 관련 기프트코드/캐시만 추출하세요. "
        "그 외(카페, 편의점, 치킨, 영화관 등)는 전부 무시하세요.\n"
        "★ provider_or_retailer='CULTURELAND_CASH'로 고정하세요 (판매 주체는 "
        "컬쳐랜드입니다). target_game=ALL로 고정하세요.\n"
        "★★ target_platform은 실제로 확인된 스토어별 사용 가능 여부를 반영해야 "
        "합니다 — 상품권이라고 아무 스토어에나 다 되는 게 아닙니다.\n"
        "  - 상품명에 'Google Play 기프트코드'가 명시된 항목 -> GOOGLE_PLAY로 "
        "고정하세요 (컬쳐랜드 앱 안에서 컬쳐캐쉬로 구글플레이 기프트코드를 "
        "직접 구매할 수 있는 것으로 공식 확인됨).\n"
        "  - '컬쳐랜드상품권', '문화상품권', '컬쳐캐쉬'처럼 특정 스토어명이 "
        "없는 일반 충전형 상품 -> ONE_STORE로 고정하세요 (원스토어 캐시로 "
        "전환하는 용도로 가장 안정적으로 확인됨). condition_raw_text에 "
        "'갤럭시 스토어에서도 결제 가능하나 인증 오류(B7700 등)로 실패하는 "
        "사례가 있어 완전히 안정적이지 않음. 구글플레이는 직접 결제수단이 "
        "아니며 별도로 구글플레이 기프트코드 구매에만 사용 가능. 애플 "
        "앱스토어는 지원 안 함'이라고 반드시 남기세요.\n"
        "★ category=VOUCHER_PURCHASE, benefit_type=DISCOUNT, "
        "disbursement_type=CHARGE_PURCHASE, stacking_layer=GIFT_CARD로 "
        "고정하세요.\n"
        "★ benefit_value는 '할인율'입니다 (예: '할인율 3.0%' -> "
        "benefit_value=3.0, benefit_unit=PERCENT). 정가와 판매가 차이를 "
        "직접 계산하지 말고, 페이지에 적힌 할인율을 그대로 쓰세요.\n"
        "★ denomination_list에 그 상품의 권종(예: 1만원권 -> [10000])을 "
        "넣으세요. 여러 권종이 있으면 각각 별도 항목으로 분리하세요.\n"
        "★ min_spend_krw=0으로 고정하세요 (이건 결제 조건이 아니라 상품 구매 "
        "자체입니다). max_benefit_krw는 정가와 판매가의 차액(원 단위)을 "
        "계산해서 넣으세요."
    )

    EVENT_URL = "https://culture.supercon.io/main"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return
        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = CulturelandVoucherCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| 권종: {item.denomination_list}")
    finally:
        crawler.close()