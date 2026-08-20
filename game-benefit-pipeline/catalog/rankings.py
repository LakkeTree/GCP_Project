# -*- coding: utf-8 -*-
"""
catalog/rankings.py
--------------------------------------------------------------------
"기준이 될 게임 명단"을 만드는 모듈입니다. 구글플레이·앱스토어 두 곳의
순위 페이지에서 게임명을 모읍니다.

⚠️ 원스토어·갤럭시 스토어는 여기 없습니다. 폰에서 보신 순위 화면(원스토어
100위, 구글플레이 198위)은 둘 다 스토어 앱 안에서만 보이는 화면이라,
크롤러(웹 브라우저 자동화)로는 애초에 가져올 방법이 없습니다.
   - 원스토어: 대체 웹 경로(m.onestore.co.kr/v2/...)가 있지만 robots.txt가
     명시적으로 크롤링을 금지하고 있어 우회하면 안 됩니다.
   - 갤럭시 스토어: 순위를 보여주는 웹 페이지 자체를 찾지 못했습니다
     (galaxystore.samsung.com/games 는 앱 카탈로그 SPA일 뿐 순위 개념이 없음).

그래서 이 두 스토어는 "명단을 만드는 데"는 안 쓰고, 대신
catalog/compatibility.py 에서 "이미 알고 있는 게임이 그 스토어에도
있는지 검색"하는 방식으로만 참여합니다. (전체 순위를 긁는 것보다 개별
검색이 훨씬 가벼운 작업이라 그쪽은 가능할 여지가 있습니다)

⚠️ 아직 실제 라이브 사이트로 최종 검증은 못 했습니다(이 환경에서
google.com/apple.com 접속 불가). 로컬에서 처음 실행하실 때 결과 건수를
꼭 확인해 주세요.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterator

from common.browser import BrowserClient
from common.config import PROJECT_ROOT
from common.http_client import HttpClient, html_to_text
from common.logger import get_logger

log = get_logger(__name__)


@dataclass
class RankedGame:
    """순위 목록에서 뽑아낸 게임 하나."""

    name: str          # 게임 이름 (원문 그대로, 정규화는 나중 단계에서)
    rank: int          # 순위 (1위부터)
    source: str        # 어느 스토어 순위였는지 ("google_play" / "app_store")


# =============================================================================
# 구글플레이 — 매출 상위 게임 (Playwright 필요, JS 렌더링)
# =============================================================================


def fetch_google_play_top_games(max_games: int = 200) -> list[RankedGame]:
    """
    구글플레이 매출 상위 게임 목록을 가져옵니다.

    ❌ 확인 결과: 이 페이지(collection/topgrossing)는 구글의 reCAPTCHA 봇
    차단에 걸립니다. 쿠키 동의창 문제를 해결한 뒤에도 실제 게임 목록이
    아예 안 실려 있었고, 페이지 안에서 reCAPTCHA 배지(grecaptcha-badge)가
    직접 확인됐습니다 — 구글이 자동화된 접속으로 판단해 진짜 콘텐츠를
    안 보여준 것입니다. 대기 시간을 늘리거나 선택자를 바꾸는 수준으로는
    해결이 안 됩니다.

    현재는 이 함수를 호출하면 매번 빈 목록([])을 돌려줍니다. 구글플레이
    쪽 "상위 게임 순위 긁기"는 보류하고, 대신 fetch_app_store_top_games()
    로 기준 명단을 만든 뒤, catalog/compatibility.py의 check_google_play()
    (게임 하나씩 검색하는 방식 — 다른 페이지라 차단 강도가 다를 수 있음)로
    구글플레이 호환 여부를 확인하는 방식을 쓰세요.
    """
    log.warning(
        "[google_play] 순위 페이지가 구글 reCAPTCHA에 막혀 있는 것으로 "
        "확인되어 이 함수는 항상 빈 목록을 돌려줍니다. "
        "앱스토어 순위만으로 기준 명단을 만듭니다."
    )
    return []


def _fetch_google_play_top_games_UNUSED_blocked_by_recaptcha(max_games: int = 200) -> list[RankedGame]:
    """
    ⚠️ 지금은 아무 데서도 호출되지 않습니다 (reCAPTCHA에 막혀서 위
    fetch_google_play_top_games()가 대신 빈 목록을 돌려줍니다).

    나중에 우회 방법을 찾거나, 구글이 정책을 바꾸거나, 다른 진입 경로를
    발견하면 이 함수의 로직을 재사용할 수 있도록 지우지 않고 남겨둡니다.
    """
    url = "https://play.google.com/store/apps/collection/topgrossing?hl=ko&gl=KR"

    with BrowserClient() as browser:
        html = browser.get_rendered_html(
            url, wait_ms=4000, scroll_to_bottom=True,
            dismiss_button_texts=["전체 동의", "모두 동의", "Accept all"],
        )

    if not html:
        log.error("구글플레이 순위 페이지를 가져오지 못했습니다.")
        return []

    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    games: list[RankedGame] = []
    seen_names: set[str] = set()

    for a_tag in soup.select('a[href*="/store/apps/details"]'):
        name = a_tag.get("aria-label") or a_tag.get_text(strip=True)
        name = re.sub(r"\s+", " ", name or "").strip()

        if not name or name in seen_names:
            continue
        seen_names.add(name)

        games.append(RankedGame(name=name, rank=len(games) + 1, source="google_play"))
        if len(games) >= max_games:
            break

    log.info("구글플레이 순위에서 게임 %d개를 모았습니다.", len(games))
    return games


# =============================================================================
# 앱스토어 — 매출 상위 게임 (서버사이드 렌더링, http_client로 충분)
# =============================================================================


def fetch_app_store_top_games(max_games: int = 200) -> list[RankedGame]:
    """
    앱스토어 게임 순위를 가져옵니다.

    ✅ 이 URL(apps.apple.com/kr/iphone/charts/6014)은 이전에 실제로 열어서
    "모든 게임" 섹션에 25개 게임이 정확히 나오는 것까지 확인했습니다.
    (6014는 애플이 '게임' 카테고리에 부여한 고유 번호입니다 — 이 번호
    덕분에 전체 앱이 아니라 게임만 걸러져서 나옵니다)

    ⚠️ 다만 이게 "매출 순위"인지 "무료 인기 순위"인지는 그때 확실히
    구분 못 했습니다. 애플이 이 페이지에서 기본으로 보여주는 차트가
    무료 인기 순위일 가능성이 있습니다. 정확히 매출 기준이 필요하시면
    로컬에서 이 URL을 직접 열어 "매출"/"인기" 탭이 따로 있는지 확인해
    주세요.
    """
    url = "https://apps.apple.com/kr/iphone/charts/6014"

    with HttpClient() as http:
        html = http.get(url)

    if not html:
        log.error("앱스토어 순위 페이지를 가져오지 못했습니다.")
        return []

    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "lxml")
    games: list[RankedGame] = []
    seen_names: set[str] = set()

    # 앱스토어 차트 항목은 보통 앱 상세 링크(/kr/app/.../id숫자) 안에
    # 순위 숫자와 게임 이름이 같이 들어 있습니다.
    for a_tag in soup.select('a[href*="/kr/app/"]'):
        # ⚠️ 실제로 돌려보니 a_tag.get_text()가 "제목+부제목+'보기' 버튼 글자"를
        # 전부 하나로 뭉쳐서 가져오는 문제가 있었습니다(예: "티니핑 매직 매치
        # 퍼즐을 맞추고...보기"). 링크 안에 '제목만 담당하는 요소'가 따로 있을
        # 가능성이 높아서, class 이름에 "title"이 들어간 자식 요소를 먼저
        # 찾아보고, 없으면 기존 방식(전체 텍스트)으로 되돌아갑니다.
        title_el = a_tag.select_one('[class*="title" i]')
        if title_el:
            name = title_el.get_text(strip=True)
        else:
            name = a_tag.get_text(separator=" ", strip=True)

        name = re.sub(r"^\d+\s*", "", name)          # 앞에 붙은 순위 숫자 제거
        name = re.sub(r"보기\s*$", "", name)          # 끝에 붙는 "보기" 버튼 글자 제거
        name = re.sub(r"\s+", " ", name).strip()

        if not name or name in seen_names or len(name) < 2:
            continue
        seen_names.add(name)

        games.append(RankedGame(name=name, rank=len(games) + 1, source="app_store"))
        if len(games) >= max_games:
            break

    log.info("앱스토어 순위에서 게임 %d개를 모았습니다.", len(games))
    return games


def fetch_all_rankings(max_games_per_store: int = 200) -> list[RankedGame]:
    """구글플레이 + 앱스토어 순위를 합쳐서 돌려줍니다. (원스토어/갤럭시는 제외)"""
    result: list[RankedGame] = []
    result.extend(fetch_google_play_top_games(max_games_per_store))
    result.extend(fetch_app_store_top_games(max_games_per_store))
    return result