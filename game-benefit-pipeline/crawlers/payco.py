# -*- coding: utf-8 -*-
"""
crawlers/payco.py
--------------------------------------------------------------------
페이코(PAYCO) 포인트 적립 리워드 페이지를 수집하는 크롤러입니다.

대상 페이지 (직접 열어서 확인함 — 서버가 완성된 HTML을 줘서 Playwright 불필요):
    https://www.payco.com/point/reward.nhn

실제로 확인한 내용 (2026-08-12 기준) — 등급제가 아니라 결제 방식별 고정 요율:
    앱 결제(충전 포인트) : 온라인 1%, 오프라인 1%
    (VISA 컨택리스 결제는 예외로 0.3%)
    실물카드 결제         : 0.3%

⚠️ 제외 업종 목록에 대학 등록금·상품권·통신비·보험료·공과금·교통 등은
있지만 "게임 결제"는 명시적으로 제외되어 있지 않았습니다 — 즉 페이코 앱으로
게임을 결제해도 이 적립이 정상 적용될 가능성이 높습니다. 프롬프트에서
이 점을 근거 있는 추정으로 명시했습니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class PaycoCrawler(BaseCrawler):
    """페이코 포인트 적립 리워드 페이지를 수집합니다."""

    source_name = "payco"

    context_hint = (
        "페이코(PAYCO) 공식 포인트 리워드 안내 페이지입니다. provider_or_retailer는 "
        "반드시 'PAYCO'로 고정하세요. target_platform=ALL, target_game=ALL로 "
        "고정하세요(특정 스토어·게임이 아니라 페이코로 결제하는 모든 곳에 적용됨).\n"
        "★ 이 페이지는 등급제가 아니라 '결제 방식별 고정 요율'입니다 "
        "(브론즈/실버 같은 등급 이름이 없습니다). 다음처럼 결제 방식마다 "
        "별도 항목으로 분리하세요.\n"
        "  - 앱에서 충전 포인트로 결제 (온라인/오프라인 공통 1%)\n"
        "  - VISA 컨택리스 결제 (예외로 0.3%로 낮음 — 반드시 별도 항목으로)\n"
        "  - 포인트 실물카드로 결제 (0.3%)\n"
        "★ category=REWARD_E_PAY, benefit_type=REWARD, "
        "stacking_layer=PAYMENT_E_PAY, disbursement_type=POINT_REWARD로 "
        "고정하세요.\n"
        "★★ 페이지의 '제외 업종' 목록(대학 등록금, 상품권/기프티콘, 4대보험료, "
        "통신비, 보험료, 공과금, 해외결제, 교통, 식권 등)에 '게임 결제'가 "
        "명시적으로 포함되어 있지 않습니다. 즉 게임 결제는 이 적립 대상에서 "
        "제외되지 않는 것으로 보입니다 — condition_raw_text에 이 제외 업종 "
        "목록을 원문 그대로 옮겨 적어서, 나중에 사람이 게임이 정말 제외 "
        "대상이 아닌지 재확인할 수 있게 하세요.\n"
        "★ 포인트 적립 시점이 결제 다음달 25일이라는 안내가 있으면 "
        "condition_raw_text에 포함하세요."
    )

    EVENT_URL = "https://www.payco.com/point/reward.nhn"

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            return

        text = html_to_text(html)
        yield PageContent(url=self.EVENT_URL, text=text, hint=self.context_hint)


if __name__ == "__main__":
    crawler = PaycoCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value}")
            print(f"  조건: {item.condition_raw_text[:100]}")
    finally:
        crawler.close()
