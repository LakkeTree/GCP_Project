# -*- coding: utf-8 -*-
"""
common/http_client.py
--------------------------------------------------------------------
웹페이지를 안전하게 가져오는 모듈입니다.

[초보자 설명]
requests.get(url) 을 그냥 쓰면 문제가 생깁니다.
 - 네트워크가 잠깐 끊기면 그 자리에서 프로그램이 죽습니다.  -> 재시도 필요
 - 요청을 너무 빨리 연속으로 보내면 상대 서버가 차단합니다. -> 대기 시간 필요
 - 브라우저인 척 하지 않으면 아예 응답을 안 주는 사이트가 있습니다. -> User-Agent 필요

이 모듈은 그 세 가지를 자동으로 처리해 줍니다.
"""

from __future__ import annotations

import time
from typing import Optional

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from common.config import get_settings
from common.logger import get_logger

log = get_logger(__name__)

# 일반적인 크롬 브라우저인 것처럼 보이게 하는 헤더입니다.
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    "Connection": "keep-alive",
}


class HttpClient:
    """재시도와 예의(대기 시간)를 갖춘 HTTP 요청기."""

    def __init__(self, extra_headers: Optional[dict] = None):
        self.settings = get_settings()

        # Session 을 쓰면 연결을 재사용해서 속도가 빨라집니다.
        self.session = requests.Session()
        self.session.headers.update(DEFAULT_HEADERS)
        if extra_headers:
            self.session.headers.update(extra_headers)

        # 재시도 규칙 설정
        retry_policy = Retry(
            total=3,                                  # 최대 3번까지 재시도
            backoff_factor=1.5,                       # 1.5초 -> 3초 -> 6초 로 점점 길게 대기
            status_forcelist=[429, 500, 502, 503, 504],  # 이 응답코드일 때 재시도
            allowed_methods=["GET", "POST"],
        )
        adapter = HTTPAdapter(max_retries=retry_policy, pool_connections=10, pool_maxsize=10)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        # 마지막 요청 시각을 기억해서, 너무 빨리 다음 요청을 보내지 않게 합니다.
        self._last_request_time = 0.0

    def _wait_politely(self) -> None:
        """직전 요청으로부터 CRAWL_DELAY_SEC 만큼 지나지 않았으면 그만큼 기다립니다."""
        elapsed = time.time() - self._last_request_time
        remaining = self.settings.crawl_delay_sec - elapsed
        if remaining > 0:
            time.sleep(remaining)
        self._last_request_time = time.time()

    def get(self, url: str, params: Optional[dict] = None) -> Optional[str]:
        """
        페이지의 HTML 원문을 문자열로 가져옵니다.
        실패하면 None 을 돌려줍니다. (프로그램을 죽이지 않습니다)
        """
        self._wait_politely()
        try:
            log.debug("GET 요청: %s", url)
            response = self.session.get(
                url, params=params, timeout=self.settings.http_timeout_sec
            )
            response.raise_for_status()   # 404, 500 등이면 여기서 예외 발생

            # 한글이 깨지는 걸 막기 위해 인코딩을 자동 추정합니다.
            if response.encoding is None or response.encoding.lower() == "iso-8859-1":
                response.encoding = response.apparent_encoding

            return response.text

        except requests.exceptions.RequestException as e:
            log.error("요청 실패 [%s]: %s", url, e)
            return None

    def get_json(self, url: str, params: Optional[dict] = None) -> Optional[dict | list]:
        """
        JSON API를 호출해서 결과를 파이썬 dict/list 로 돌려줍니다.
        (스토어들은 화면 뒤에서 JSON API를 쓰는 경우가 많아 이게 HTML 파싱보다 훨씬 편합니다)
        """
        self._wait_politely()
        try:
            log.debug("GET(JSON) 요청: %s", url)
            response = self.session.get(
                url,
                params=params,
                timeout=self.settings.http_timeout_sec,
                headers={"Accept": "application/json"},
            )
            response.raise_for_status()
            return response.json()
        except (requests.exceptions.RequestException, ValueError) as e:
            log.error("JSON 요청 실패 [%s]: %s", url, e)
            return None

    def close(self) -> None:
        """세션을 닫습니다. 프로그램이 끝날 때 호출하면 좋습니다."""
        self.session.close()

    # with 문으로 쓸 수 있게 해 주는 함수들입니다.
    #   with HttpClient() as client:  ...
    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.close()


def html_to_text(html: str, selector: Optional[str] = None) -> str:
    """
    HTML에서 사람이 읽을 수 있는 텍스트만 뽑아냅니다.

    [왜 필요한가?]
    HTML 원문에는 <script>, <style>, 광고 코드 등 쓸모없는 내용이 90% 이상입니다.
    이걸 그대로 Gemini에 넣으면 돈은 돈대로 나가고 정확도는 떨어집니다.
    태그를 걷어내고 알맹이 텍스트만 남겨서 넣어야 합니다.

    Args:
        html: HTML 원문 문자열
        selector: CSS 선택자. 예) "div.event-list" 처럼 특정 영역만 뽑고 싶을 때 사용.
                  None이면 페이지 전체에서 텍스트를 뽑습니다.
    """
    soup = BeautifulSoup(html, "lxml")

    # 내용과 무관한 태그들을 통째로 제거합니다.
    for tag in soup(["script", "style", "noscript", "iframe", "svg", "header", "footer", "nav"]):
        tag.decompose()

    target = soup
    if selector:
        found = soup.select_one(selector)
        if found is None:
            log.warning("선택자 '%s' 에 해당하는 요소를 찾지 못했습니다. 전체에서 추출합니다.", selector)
        else:
            target = found

    # separator="\n" : 태그 경계마다 줄바꿈을 넣어 문단 구분이 살아나게 합니다.
    text = target.get_text(separator="\n", strip=True)

    # 빈 줄이 3줄 이상 연속되면 2줄로 줄입니다.
    lines = [line.strip() for line in text.split("\n")]
    cleaned_lines = [line for line in lines if line]
    return "\n".join(cleaned_lines)
