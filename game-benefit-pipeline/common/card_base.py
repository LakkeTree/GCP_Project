# -*- coding: utf-8 -*-
"""
common/card_base.py
--------------------------------------------------------------------
카드사 이벤트 페이지 크롤러 5개(신한/국민/삼성/하나/NH농협)가 공유하는 부모
클래스입니다. crawlers/ 폴더가 아니라 common/에 둔 이유가 있습니다 —
scripts/run_all.py의 자동 탐색(discover_crawlers)이 crawlers/ 폴더 안의
모든 클래스를 "실행 가능한 크롤러"로 인식하는데, 이 클래스 자체는
URL이 없는 '틀'이라 직접 실행하면 안 됩니다. common/에 두면 자동 탐색
대상에서 자연히 빠집니다.

⚠️ 카드사 이벤트 페이지는 원스토어와 성격이 완전히 다릅니다.
   - 신한카드는 실제로 열어봐서 자바스크립트 템플릿({{=$data...}})이
     그대로 보이는 것까지 확인했습니다 → Playwright 필요.
   - 국민/삼성/하나/NH농협은 URL만 검색으로 찾았고, 실제로 열어서
     확인은 못 했습니다. 신한카드와 같은 패턴일 가능성이 높아 일단
     전부 Playwright로 통일했습니다. 로컬에서 처음 실행하실 때 결과가
     이상하면 (예: 자바스크립트 없이도 되는 곳이라 오히려 느리기만 하고
     문제는 없을 수도, 또는 선택자를 더 좁혀야 할 수도 있습니다) 알려주세요.
   - 카드사 이벤트 목록에는 게임과 무관한 이벤트(주유, 여행, 마트, 통신비,
     대출 등)가 훨씬 많이 섞여 있습니다. 그래서 프롬프트에서 "게임/앱 결제
     관련만 추출하라"는 지침을 특히 강하게 넣었습니다.
"""

from __future__ import annotations

from typing import Iterator, Optional

from common.browser import BrowserClient
from common.http_client import html_to_text
from common.logger import get_logger
from crawlers.base import BaseCrawler, PageContent

log = get_logger(__name__)


class CardEventCrawler(BaseCrawler):
    """
    카드사 이벤트 목록 페이지를 수집하는 크롤러의 공통 틀입니다.
    실제 크롤러는 이 클래스를 상속해서 EVENT_URL, source_name,
    PROVIDER_CODE 세 가지만 채우면 됩니다.
    """

    # --- 자식 클래스가 반드시 채워야 하는 값들 ---
    EVENT_URL: str = ""            # 카드사 이벤트 목록 페이지 주소
    PROVIDER_CODE: str = ""        # common/schema.py 의 KNOWN_PROVIDER_CODES 코드
    PROVIDER_DISPLAY_NAME: str = ""  # 프롬프트에 넣을 한글 이름 (예: "신한카드")

    # 이벤트 목록이 그려질 때까지 기다릴 CSS 선택자. 모르면 None으로 두고
    # wait_ms(무작정 대기)에 의존합니다.
    WAIT_SELECTOR: Optional[str] = None
    WAIT_MS: int = 4000

    # 이벤트 목록만 뽑고 싶을 때 지정. 모르면 None으로 두고 전체에서 뽑습니다.
    LIST_SELECTOR: Optional[str] = None

    @property
    def context_hint(self) -> str:  # type: ignore[override]
        """
        provider 이름이 자식 클래스마다 다르므로, 매번 새로 만들어 돌려줍니다.
        (BaseCrawler는 context_hint를 클래스 속성으로 기대하지만, 파이썬에서는
        property로 만들어도 동일하게 self.context_hint로 접근되어 문제없습니다)
        """
        return (
            f"{self.PROVIDER_DISPLAY_NAME} 홈페이지의 '진행중인 이벤트' 목록 페이지입니다. "
            f"provider_or_retailer는 반드시 '{self.PROVIDER_CODE}'로 고정하세요.\n"
            "★★ 매우 중요: 이 목록에는 주유·여행·마트·통신비·대출·신차구매 같은 "
            "게임과 전혀 무관한 이벤트가 훨씬 더 많이 섞여 있습니다. 반드시 다음 "
            "조건에 해당하는 이벤트만 추출하세요.\n"
            "  (1) 게임 결제/구독에 직접 적용되는 할인·캐시백·적립\n"
            "  (2) 구글플레이·앱스토어·원스토어·갤럭시스토어 결제에 적용되는 혜택\n"
            "  (3) '온라인 결제', '간편결제', 'OO페이 결제' 처럼 특정 업종을 "
            "한정하지 않는 범용 결제 혜택 (게임 결제에도 적용될 수 있으므로 포함)\n"
            "위 세 가지에 해당하지 않는 이벤트(주유소, 여행사, 마트, 통신 요금, "
            "대출, 카드 신규발급 축하금 등)는 전부 무시하세요. 애매하면 빼는 "
            "쪽을 선택하세요 — 억지로 포함시키지 마세요.\n"
            "★ target_platform: 이벤트가 특정 스토어를 명시하면 그 스토어로, "
            "'온라인 결제 전체'처럼 범용이면 ALL로 두세요.\n"
            "★ stacking_layer=CARD_ISSUER로 고정하세요 (카드사가 직접 주는 혜택).\n"
            "★ category: 결제 즉시 깎이면 DISCOUNT_CARD, 나중에 포인트/캐시백으로 "
            "돌려주면 CASHBACK에 준하는 성격이니 benefit_type=CASHBACK을 쓰세요.\n"
            "★ disbursement_type: 카드 명세서에서 바로 빠지는 청구할인이면 "
            "BILL_DISCOUNT, 포인트로 적립되면 POINT_REWARD, 결제 시 즉시 할인되면 "
            "INSTANT_DISCOUNT로 구분하세요.\n"
            "★ 원문에 할인율/금액처럼 계산에 필요한 핵심 정보가 없으면 결과에서 "
            "제외하세요."
        )

    def fetch_pages(self) -> Iterator[PageContent]:
        with BrowserClient() as browser:
            html = browser.get_rendered_html(
                self.EVENT_URL,
                wait_selector=self.WAIT_SELECTOR,
                wait_ms=self.WAIT_MS,
                scroll_to_bottom=True,  # 이벤트 목록이 스크롤형일 가능성이 높아 켜둡니다.
            )

        if not html:
            return

        text = html_to_text(html, selector=self.LIST_SELECTOR)
        yield PageContent(
            url=self.EVENT_URL,
            text=text,
            hint=self.context_hint,
        )
