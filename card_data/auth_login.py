"""카드사 홈페이지에 1회 수동 로그인하고 세션(storage_state)을 저장한다.

이후 본 크롤러(scrapers/*.py)는 이 저장된 세션을 불러와 로그인 단계 없이 바로
혜택 페이지로 진입한다. 세션이 만료되면 이 스크립트를 다시 실행해서 갱신한다.

storage_state 파일은 로그인 세션 토큰이 담긴 민감정보이므로 .gitignore 처리됨
(card_data/.auth/) — 커밋되지 않는다.

사용법 (repo 루트에서, -m으로 패키지 실행):
  python -m card_data.auth_login kb https://accounts.kbcard.com/...(로그인 페이지 URL)
"""

import sys

from playwright.sync_api import sync_playwright

from card_data.scrapers.base import AUTH_DIR, auth_state_path


def main() -> None:
    if len(sys.argv) != 3:
        print("사용법: python -m card_data.auth_login <provider_code> <로그인 URL>")
        sys.exit(1)

    provider_code, login_url = sys.argv[1], sys.argv[2]
    AUTH_DIR.mkdir(exist_ok=True)
    state_path = auth_state_path(provider_code)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()
        page.goto(login_url)

        input(f"[{provider_code}] 브라우저에서 로그인을 완료한 뒤, 이 터미널로 돌아와 Enter를 누르세요...")

        context.storage_state(path=str(state_path))
        print(f"세션 저장 완료: {state_path}")
        browser.close()


if __name__ == "__main__":
    main()
