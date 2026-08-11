# -*- coding: utf-8 -*-
"""
crawlers/base.py
--------------------------------------------------------------------
모든 크롤러가 물려받는 '틀'입니다.

[초보자 설명: 왜 이런 걸 만드나?]
원스토어, 갤럭시스토어, 구글플레이, 앱스토어 크롤러를 각각 만들면
'페이지 가져오기 -> AI 정제 -> 중복 제거 -> BigQuery 저장' 과정이 4번 중복됩니다.
나중에 저장 방식을 바꾸려면 4군데를 다 고쳐야 하죠.

그래서 공통 과정은 여기(BaseCrawler)에 한 번만 적어 두고,
각 스토어 크롤러는 서로 다른 부분인 "어떤 URL에서 어떻게 텍스트를 뽑을지"만
구현하게 합니다. 이걸 '템플릿 메서드 패턴'이라고 부릅니다.

[새 크롤러 만드는 법]
    class MyStoreCrawler(BaseCrawler):
        source_name = "my_store"
        def fetch_pages(self):
            html = self.http.get("https://...")
            yield PageContent(url="https://...", text=html_to_text(html))
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Iterator, Optional
from zoneinfo import ZoneInfo

from common.ai_client import GeminiClient
from common.bq_client import BigQueryClient
from common.dedupe import deduplicate, to_benefit_info
from common.http_client import HttpClient
from common.logger import get_logger
from common.schema import BenefitInfo

log = get_logger(__name__)

# 한국 시간대. 날짜 계산은 반드시 KST 기준으로 해야 합니다.
KST = ZoneInfo("Asia/Seoul")


@dataclass
class PageContent:
    """크롤러가 가져온 페이지 하나를 담는 상자."""

    url: str                                   # 원문 주소
    text: str                                  # 태그를 걷어낸 순수 텍스트
    hint: Optional[str] = None                 # AI에게 줄 추가 힌트
    meta: dict = field(default_factory=dict)   # 필요하면 자유롭게 쓰는 여분 공간


class BaseCrawler(ABC):
    """모든 스토어 크롤러의 부모 클래스."""

    # 자식 클래스가 반드시 자기 이름으로 덮어써야 하는 값입니다.
    source_name: str = "base"

    # AI에게 줄 기본 힌트. 자식 클래스에서 덮어쓰면 정확도가 올라갑니다.
    context_hint: str = ""

    def __init__(
        self,
        ai: Optional[GeminiClient] = None,
        bq: Optional[BigQueryClient] = None,
        http: Optional[HttpClient] = None,
    ):
        """
        의존성을 밖에서 넣어줄 수 있게 만들었습니다(의존성 주입).
        이렇게 하면 테스트할 때 가짜 객체로 바꿔치기하기 쉽습니다.
        아무것도 안 넣으면 알아서 진짜 객체를 만듭니다.
        """
        self.http = http or HttpClient()
        self._ai = ai            # 실제로 쓸 때 만들도록 미뤄 둡니다(지연 초기화).
        self._bq = bq

    # ------------------------------------------------------------------
    # 지연 초기화용 property
    # ------------------------------------------------------------------
    @property
    def ai(self) -> GeminiClient:
        """Gemini 클라이언트. 처음 쓰는 순간에 만들어집니다."""
        if self._ai is None:
            self._ai = GeminiClient()
        return self._ai

    @property
    def bq(self) -> BigQueryClient:
        """BigQuery 클라이언트. 처음 쓰는 순간에 만들어집니다."""
        if self._bq is None:
            self._bq = BigQueryClient()
        return self._bq

    # ------------------------------------------------------------------
    # 자식 클래스가 반드시 구현해야 하는 부분
    # ------------------------------------------------------------------
    @abstractmethod
    def fetch_pages(self) -> Iterator[PageContent]:
        """
        수집 대상 페이지들을 하나씩 돌려줍니다.

        @abstractmethod 가 붙어 있으면, 자식 클래스가 이 함수를 만들지 않은 채
        객체를 만들려고 하면 파이썬이 에러를 냅니다. 깜빡 잊는 걸 막아줍니다.

        return 대신 yield 를 쓰면 '한 번에 하나씩' 흘려보낼 수 있어
        페이지가 아주 많아도 메모리를 적게 씁니다.
        """
        raise NotImplementedError

    # ------------------------------------------------------------------
    # 공통 실행 흐름 (자식은 이걸 고칠 필요가 없습니다)
    # ------------------------------------------------------------------
    def run(self, save_to_bq: bool = True) -> list[BenefitInfo]:
        """
        크롤링 전체 과정을 실행합니다.
          1. 페이지 수집
          2. Gemini로 정제
          3. ID/해시 부여
          4. 중복 제거
          5. BigQuery 업서트

        Args:
            save_to_bq: False로 두면 BigQuery에 저장하지 않고 결과만 돌려줍니다.
                        (파서를 새로 만들 때 이걸 False로 두고 확인하면 편합니다)
        """
        today = datetime.now(KST).strftime("%Y-%m-%d")
        log.info("=" * 60)
        log.info("[%s] 크롤링 시작 (기준일: %s)", self.source_name, today)
        log.info("=" * 60)

        collected: list[BenefitInfo] = []
        page_count = 0

        # --- 1~3단계: 페이지별로 수집하고 정제합니다 ---
        for page in self.fetch_pages():
            page_count += 1

            if not page.text or len(page.text.strip()) < 30:
                log.warning("[%s] 내용이 너무 짧아 건너뜁니다: %s", self.source_name, page.url)
                continue

            log.info("[%s] 페이지 분석 중 (%d번째): %s", self.source_name, page_count, page.url)

            extractions = self.ai.extract_benefits(
                raw_text=page.text,
                today=today,
                context_hint=page.hint or self.context_hint,
            )

            for extraction in extractions:
                collected.append(
                    to_benefit_info(
                        extraction,
                        source_name=self.source_name,
                        source_url=page.url,
                    )
                )

        # --- 4단계: 중복 제거 ---
        before = len(collected)
        results = deduplicate(collected)
        if before != len(results):
            log.info("[%s] 중복 %d건을 제거했습니다.", self.source_name, before - len(results))

        log.info("[%s] 페이지 %d개에서 혜택 %d건을 수집했습니다.",
                 self.source_name, page_count, len(results))

        # --- 5단계: BigQuery 저장 ---
        if save_to_bq and results:
            summary = self.bq.upsert_benefits(results)
            log.info("[%s] 저장 결과: %s", self.source_name, summary)
        elif not save_to_bq:
            log.info("[%s] save_to_bq=False 이므로 저장을 건너뜁니다.", self.source_name)

        return results

    def close(self) -> None:
        """다 쓴 자원을 정리합니다."""
        self.http.close()

    def __enter__(self) -> "BaseCrawler":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.close()