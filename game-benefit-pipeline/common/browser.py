# -*- coding: utf-8 -*-
"""
common/browser.py
--------------------------------------------------------------------
자바스크립트가 실행되어야 내용이 채워지는 페이지(SPA)를 가져오는 모듈입니다.

[초보자 설명: http_client.py 랑 뭐가 다른가?]
http_client.py 는 requests 라이브러리로 "서버가 원래 보내주는 HTML"만 받습니다.
원스토어 이벤트 페이지처럼 서버가 완성된 HTML을 보내주는 사이트는 이걸로 충분합니다.

하지만 구글의 Play Points 혜택 페이지(playpoints.withgoogle.com)처럼
React/Vue 같은 프레임워크로 만든 사이트는, 서버가 빈 뼈대(<div id="app"></div>
정도)만 보내고, 실제 내용은 브라우저 안에서 자바스크립트가 실행되면서 채워집니다.
requests 로는 이 빈 뼈대만 받게 되어 아무 내용도 못 가져옵니다.

이 문제를 해결하려면 "진짜 브라우저처럼 행동하는 프로그램"이 필요합니다.
Playwright가 그 역할을 합니다 — 화면에 안 보이는(headless) 크롬을 실제로 띄워서
자바스크립트를 실행시킨 뒤, 완성된 HTML을 돌려줍니다.

[언제 이 모듈을 쓰나]
- http_client.get() 으로 가져온 텍스트가 이상하게 짧거나 실제 내용이 없다면
  (예: <script> 태그만 잔뜩 있고 눈에 보이는 텍스트가 없다면) SPA일 가능성이 큽니다.
  이럴 때 이 모듈로 바꿔서 시도해 보세요.

[설치 확인]
    pip install -r requirements.txt 를 이미 하셨다면 playwright 패키지는 있습니다.
    브라우저 실행 파일은 별도로 한 번 더 설치해야 합니다:
        playwright install chromium
    (이 한 줄을 안 하면 "Executable doesn't exist" 에러가 납니다)
"""

from __future__ import annotations

from typing import Optional

from playwright.sync_api import sync_playwright

from common.config import get_settings
from common.logger import get_logger

log = get_logger(__name__)


class BrowserClient:
    """
    Playwright를 감싼 클래스. with 문으로 씁니다.

        with BrowserClient() as browser:
            html = browser.get_rendered_html("https://...")
    """

    def __init__(self, headless: bool = True):
        self.settings = get_settings()
        self.headless = headless
        self._playwright = None
        self._browser = None

    def __enter__(self) -> "BrowserClient":
        # sync_playwright()는 브라우저 자동화 세션을 시작합니다.
        self._playwright = sync_playwright().start()
        # headless=True: 화면에 창을 띄우지 않고 백그라운드에서 실행합니다.
        # (서버/CI 환경에서는 화면 자체가 없으므로 headless가 아니면 아예 안 돌아갑니다)
        self._browser = self._playwright.chromium.launch(headless=self.headless)
        return self

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()

    def get_rendered_html(
        self,
        url: str,
        wait_selector: Optional[str] = None,
        wait_ms: int = 3000,
        scroll_to_bottom: bool = False,
        dismiss_button_texts: Optional[list[str]] = None,
    ) -> Optional[str]:
        """
        페이지를 열고 자바스크립트가 다 실행될 때까지 기다린 뒤, 완성된 HTML을 돌려줍니다.

        Args:
            url: 가져올 페이지 주소
            wait_selector: 이 CSS 선택자가 화면에 나타날 때까지 기다립니다.
                          (예: "div.perk-card" 처럼 혜택 카드가 실제로 그려지는
                          걸 감지하는 선택자를 알고 있으면 가장 안전합니다)
            wait_ms: wait_selector가 없을 때, 그냥 이만큼(밀리초) 무작정 기다립니다.
                    (기본 3초. 느린 사이트는 늘려야 할 수 있습니다)
            scroll_to_bottom: True면 페이지 끝까지 스크롤합니다. "스크롤해야 더
                             불러오는" 무한 스크롤 목록(예: 혜택 카드가 스크롤할
                             때마다 추가로 로딩되는 경우)에 필요합니다.
            dismiss_button_texts: ["전체 동의", "모두 동의"] 처럼, 페이지에 뜨는
                             쿠키 동의/팝업 버튼의 문구 목록을 주면 자동으로
                             찾아서 클릭합니다. (구글 계열 사이트에서 흔히
                             나오는 쿠키 동의 화면이 실제 콘텐츠를 가로막는
                             문제를 해결하기 위함입니다) 버튼이 없으면 그냥
                             건너뛰므로, "혹시 나올 수도 있는" 상황에 안전하게
                             넣어둘 수 있습니다.

        Returns:
            완성된 HTML 문자열. 실패하면 None.
        """
        if self._browser is None:
            raise RuntimeError(
                "BrowserClient는 'with BrowserClient() as browser:' 형태로 써야 합니다."
            )

        page = self._browser.new_page(
            # 실제 브라우저인 것처럼 보이게 하는 설정들
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
            viewport={"width": 1280, "height": 900},
        )

        try:
            log.debug("페이지 여는 중: %s", url)
            # networkidle: 네트워크 요청이 잠잠해질 때까지 기다립니다.
            # (자바스크립트가 API를 호출해서 데이터를 받아오는 경우까지 기다려 줍니다)
            page.goto(url, wait_until="networkidle", timeout=self.settings.http_timeout_sec * 1000)

            if dismiss_button_texts:
                self._dismiss_popup(page, dismiss_button_texts)

            if wait_selector:
                log.debug("선택자 대기 중: %s", wait_selector)
                page.wait_for_selector(wait_selector, timeout=self.settings.http_timeout_sec * 1000)
            else:
                page.wait_for_timeout(wait_ms)

            if scroll_to_bottom:
                self._scroll_to_bottom(page)

            return page.content()

        except Exception as e:
            log.error("페이지 렌더링 실패 [%s]: %s", url, e)
            return None

        finally:
            page.close()

    @staticmethod
    def _dismiss_popup(page, button_texts: list[str]) -> None:
        """
        쿠키 동의 등으로 뜨는 팝업의 버튼을 찾아서 클릭합니다.
        버튼이 안 보이면(짧은 시간 안에 못 찾으면) 조용히 넘어갑니다 —
        팝업이 원래 없는 페이지에서도 안전하게 쓸 수 있게 하기 위함입니다.
        """
        for text in button_texts:
            try:
                # get_by_text: 화면에 보이는 글자로 요소를 찾습니다.
                # exact=False로 두면 "전체 동의" 버튼 안에 다른 글자가
                # 섞여 있어도(예: 아이콘 뒤에 붙은 텍스트) 찾아낼 수 있습니다.
                button = page.get_by_text(text, exact=False).first
                button.click(timeout=3000)
                log.info("팝업 버튼 클릭됨: '%s'", text)
                page.wait_for_timeout(1000)  # 클릭 후 화면이 안정될 시간을 줍니다.
                return  # 하나 클릭했으면 충분하니 나머지 후보는 안 봐도 됩니다.
            except Exception:
                continue  # 이 문구의 버튼은 없었던 것 — 다음 후보를 시도합니다.

    @staticmethod
    def _scroll_to_bottom(page, max_scrolls: int = 10, pause_ms: int = 800) -> None:
        """
        페이지 끝까지 여러 번 스크롤합니다. 무한 스크롤 목록에서 항목을
        다 불러오기 위해 씁니다. 더 이상 늘어나지 않으면 일찍 멈춥니다.
        """
        previous_height = 0
        for _ in range(max_scrolls):
            page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            page.wait_for_timeout(pause_ms)
            current_height = page.evaluate("document.body.scrollHeight")
            if current_height == previous_height:
                break  # 더 이상 새 내용이 안 늘어나면 멈춥니다.
            previous_height = current_height