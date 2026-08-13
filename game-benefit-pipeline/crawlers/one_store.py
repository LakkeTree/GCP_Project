# -*- coding: utf-8 -*-
"""
crawlers/one_store.py
--------------------------------------------------------------------
원스토어 "쿠폰 득템전" 페이지(게임별 할인 쿠폰 목록)를 수집하는 크롤러입니다.

대상 페이지: https://m.onestore.co.kr/osmp/onestore/cpnEvent.omp
페이지 구조: 게임명 + 종료일 + 쿠폰 할인율(1차/2차)이 게임별로 반복되는 목록.
             그 아래로 설치 안내, FAQ, 개인정보 동의 팝업 등 쿠폰과 무관한
             텍스트가 훨씬 더 많이 딸려 있습니다. (실제로 열어서 확인한 내용)

⚠️ 아직 실제 HTML의 CSS 선택자(class 이름)를 확인하지 못했습니다. 이 코드는
   페이지 전체를 가져와 Gemini의 "혜택 아닌 내용은 무시하라" 지침에 의존합니다.
   나중에 브라우저 개발자 도구(F12)로 쿠폰 목록을 감싸는 div의 class를 확인해서
   SELECTOR 값에 넣어 주시면, 불필요한 텍스트를 걷어내고 정확도・비용 모두
   개선됩니다. (걷어내는 방법은 파일 아래 주석 참고)
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent


class OneStoreCrawler(BaseCrawler):
    """원스토어 쿠폰 득템전 페이지를 수집합니다."""

    source_name = "one_store"

    # Gemini에게 주는 페이지 맥락 힌트. 정확할수록 분류 정확도가 올라갑니다.
    context_hint = (
        "원스토어 '쿠폰 득템전' 페이지입니다. 게임별로 할인 쿠폰(1차/2차로 나뉘어 "
        "발급되는 경우 있음)을 제공합니다. 모든 쿠폰은 target_platform=ONE_STORE, "
        "category=DISCOUNT_STORE, stacking_layer=STORE_COUPON, "
        "disbursement_type=COUPON_ISSUE 입니다. 쿠폰은 버튼을 누르면 즉시 발급되는 "
        "방식이라 requires_pre_app=false 입니다(사전 응모가 아니라 즉시 발급형 쿠폰). "
        "1차/2차 쿠폰이 같이 적힌 경우 두 개의 별도 항목으로 분리하세요.\n"
        "★★★ item_or_event_name 형식을 반드시 정확히 지키세요 (매우 중요 — 이걸 "
        "안 지키면 나중에 같은 쿠폰이 서로 다른 걸로 착각되어 중복 저장됩니다):\n"
        "  '{게임명} {할인율}% 쿠폰[{1차 또는 2차}]' 형식을 항상 그대로 쓰세요.\n"
        "  예) '킹덤 가드:타워 디펜스 TD (Kingdom Guard) 50% 쿠폰[1차]'\n"
        "  절대로 할인율 숫자(예: '50%')를 이름에서 빼지 마세요. '[1차]'만 남기고 "
        "'50% 쿠폰'을 생략하면 안 됩니다 — 항상 게임명+할인율+쿠폰+차수를 전부 "
        "포함해야 합니다.\n"
        "★★ target_game 필수 지침: 이 페이지의 모든 쿠폰은 특정 게임 전용입니다 "
        "(예: '머지 스위츠' 쿠폰은 머지 스위츠 구매에만 쓸 수 있고 다른 게임에는 "
        "적용되지 않습니다). 항목 제목에 적힌 그 게임 이름을 target_game에 그대로 "
        "넣으세요. 이 페이지에서 target_game=ALL 로 채울 항목은 없습니다."
    )

    # 이벤트 목록 페이지 URL. 여러 개면 URLS 리스트에 추가하세요.
    EVENT_URL = "https://m.onestore.co.kr/osmp/onestore/cpnEvent.omp"

    # ⚠️ 실제 HTML을 열어서 쿠폰 목록을 감싸는 부분의 class를 확인하면 여기에 넣으세요.
    # 예: "div.coupon-list" 처럼 지정하면 그 영역만 정확히 뽑아 노이즈가 크게 줄어듭니다.
    # None으로 두면 페이지 전체에서 텍스트를 뽑습니다(현재 기본값 — 아직 미확인).
    LIST_SELECTOR = None

    def fetch_pages(self) -> Iterator[PageContent]:
        html = self.http.get(self.EVENT_URL)
        if not html:
            # http_client가 이미 재시도까지 마친 뒤 실패한 것이므로 여기서는
            # 그냥 건너뜁니다. BaseCrawler.run()이 빈 페이지는 자동으로 스킵합니다.
            return

        text = html_to_text(html, selector=self.LIST_SELECTOR)
        yield PageContent(
            url=self.EVENT_URL,
            text=text,
            hint=self.context_hint,
        )


# =============================================================================
# 로컬에서 직접 테스트하고 싶을 때
# =============================================================================
# GEMINI_API_KEY를 .env에 설정한 뒤, 프로젝트 최상위 폴더에서:
#     python -m crawlers.one_store
# 를 실행하면 BigQuery에 저장하지 않고 추출 결과만 화면에 보여줍니다.

if __name__ == "__main__":
    import json

    crawler = OneStoreCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.target_game} | "
                  f"{item.benefit_value}{item.benefit_unit.value} | ~{item.end_date}")
            print(f"  조건: {item.condition_raw_text[:80]}")
    finally:
        crawler.close()