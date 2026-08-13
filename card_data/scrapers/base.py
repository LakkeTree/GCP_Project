"""카드사 스크래퍼 공통 Playwright 셋업 (headed 브라우저 + storage_state 세션 재사용).

로그인은 auth_login.py가 1회 수동으로 처리하고 그 결과(storage_state)를 이 클래스가
불러와서 재사용한다 — 크롤링할 때마다 다시 로그인하지 않기 위함.
"""

from pathlib import Path

from playwright.sync_api import BrowserContext, sync_playwright

AUTH_DIR = Path(__file__).resolve().parents[1] / ".auth"


def auth_state_path(provider_code: str) -> Path:
    """카드사별 저장된 로그인 세션(storage_state) 파일 경로."""
    return AUTH_DIR / f"{provider_code}.json"


class ScraperSession:
    """`with ScraperSession(provider_code) as page:` 형태로 로그인된 세션의 페이지를 얻는다."""

    def __init__(self, provider_code: str, *, headless: bool = False, require_login: bool = True):
        self.provider_code = provider_code
        self.headless = headless
        self.require_login = require_login
        self._playwright = None
        self._browser = None
        self._context: BrowserContext | None = None

    def __enter__(self):
        state_path = auth_state_path(self.provider_code)
        if self.require_login and not state_path.exists():
            raise FileNotFoundError(
                f"{state_path} 없음 — 먼저 다음을 실행해서 1회 수동 로그인 후 세션을 "
                f"저장해야 함:\n  python -m card_data.auth_login {self.provider_code} <로그인 URL>"
            )
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(headless=self.headless, slow_mo=150)
        self._context = self._browser.new_context(
            storage_state=str(state_path) if self.require_login else None
        )
        return self._context.new_page()

    def __exit__(self, exc_type, exc, tb):
        if self._context:
            self._context.close()
        if self._browser:
            self._browser.close()
        if self._playwright:
            self._playwright.stop()
