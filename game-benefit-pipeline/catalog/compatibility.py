# -*- coding: utf-8 -*-
"""
catalog/compatibility.py
--------------------------------------------------------------------
"이 게임이 이 스토어에도 있는가?"를 스토어별 검색으로 확인하는 모듈입니다.

순위 수집(rankings.py)과는 완전히 다른 작업입니다 — "전체 목록을 긁는 것"이
아니라 "이미 아는 게임 이름 하나를 검색해서 결과가 있는지만 본다"라서
훨씬 가벼운 작업이고, 그래서 순위 수집이 불가능했던 원스토어도 여기서는
가능합니다.

⚠️ 스토어별 확인 방법:
  - 앱스토어  : 애플 공식 iTunes Search API 사용 (가장 안정적, 크롤링 아님)
  - 구글플레이: 검색 결과 페이지를 Playwright로 렌더링 후 확인
  - 원스토어  : 검색 API 경로(integrateSearch.omp)로 확인.
               ⚠️ 이 경로는 검색으로만 찾았고 실제 응답 형식을 직접 본 적이
               없습니다. 정확한 JSON 구조를 몰라서, "응답 텍스트 안에 게임
               이름이 등장하는지" 방식으로 느슨하게 판별합니다 — 오탐(있는데
               없다고 하거나, 없는데 있다고 하는 경우)이 있을 수 있습니다.
  - 갤럭시 스토어: ❌ 검색 URL을 못 찾았습니다. 아래 check_galaxy_store()는
               항상 None(모름)을 돌려줍니다. 브라우저로 galaxystore.samsung.com
               에서 직접 게임을 검색해보시고, 그때 뜨는 주소창 URL을 알려주시면
               바로 채워 넣겠습니다 (원스토어 쿠폰 페이지를 찾을 때와 같은 방식).

[성능 설계]
게임이 수백 개면 스토어마다 수백 번씩 요청이 나갑니다. 매번 새 연결을 열면
느리고 상대 서버에도 부담이라, HttpClient/BrowserClient를 '세션 하나'로
재사용할 수 있게 모든 check_* 함수가 선택적으로 기존 클라이언트를 받습니다.
(catalog/build_game_matrix.py가 실제로 재사용하는 쪽입니다)
"""

from __future__ import annotations

import json
import urllib.parse
from typing import Optional

from common.browser import BrowserClient
from common.http_client import HttpClient, html_to_text
from common.logger import get_logger
from catalog.normalize import normalize_for_comparison

log = get_logger(__name__)


# =============================================================================
# 앱스토어 — 공식 검색 API (가장 신뢰도 높음)
# =============================================================================


def check_app_store(game_name: str, http: Optional[HttpClient] = None) -> bool:
    """
    애플 공식 iTunes Search API로 게임 존재 여부를 확인합니다.
    문서: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
    """
    query = urllib.parse.quote(game_name)
    url = (
        f"https://itunes.apple.com/search?term={query}"
        f"&country=kr&entity=software&limit=10"
    )

    owns_client = http is None
    http = http or HttpClient()
    try:
        text = http.get(url)
    finally:
        if owns_client:
            http.close()

    if not text:
        log.warning("[app_store] 검색 요청 실패: %s", game_name)
        return False

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        log.warning("[app_store] 응답을 JSON으로 못 읽음: %s", game_name)
        return False

    target = normalize_for_comparison(game_name)
    for item in data.get("results", []):
        track_name = item.get("trackName", "")
        norm_track = normalize_for_comparison(track_name)
        if norm_track == target or (target and target in norm_track):
            return True

    return False


# =============================================================================
# 구글플레이 — 검색 결과 페이지 (Playwright)
# =============================================================================


def check_google_play(game_name: str, browser: Optional[BrowserClient] = None) -> bool:
    """구글플레이에서 게임명을 검색해 결과에 나오는지 확인합니다."""
    query = urllib.parse.quote(game_name)
    url = f"https://play.google.com/store/search?q={query}&c=apps&hl=ko&gl=KR"

    owns_browser = browser is None
    if owns_browser:
        browser = BrowserClient()
        browser.__enter__()

    try:
        html = browser.get_rendered_html(
            url, wait_ms=3000,
            dismiss_button_texts=["전체 동의", "모두 동의", "Accept all"],
        )
    finally:
        if owns_browser:
            browser.__exit__(None, None, None)

    if not html:
        log.warning("[google_play] 검색 페이지 로드 실패: %s", game_name)
        return False

    text = html_to_text(html)
    return normalize_for_comparison(game_name) in normalize_for_comparison(text)


# =============================================================================
# 원스토어 — 검색 API 경로 (⚠️ 응답 형식 미확인, 느슨한 텍스트 매칭)
# =============================================================================


def check_one_store(game_name: str, http: Optional[HttpClient] = None) -> bool:
    """원스토어에서 게임명을 검색해 결과에 나오는지 확인합니다."""
    query = urllib.parse.quote(game_name)
    url = f"https://m.onestore.co.kr/ko-kr/search/integrateSearch.omp?integrateQuery={query}"

    owns_client = http is None
    http = http or HttpClient()
    try:
        text = http.get(url)
    finally:
        if owns_client:
            http.close()

    if not text:
        log.warning("[one_store] 검색 요청 실패: %s", game_name)
        return False

    return normalize_for_comparison(game_name) in normalize_for_comparison(text)


# =============================================================================
# 갤럭시 스토어 — ❌ 아직 검색 경로를 못 찾음
# =============================================================================


def check_galaxy_store(game_name: str) -> Optional[bool]:
    """
    갤럭시 스토어 검색 URL을 못 찾아서, 항상 None(모름)을 돌려줍니다.

    ⚠️ 사용법: galaxystore.samsung.com 에서 직접 게임을 검색해 보시고,
    그때 브라우저 주소창에 뜨는 URL을 알려주시면 이 함수를 완성하겠습니다.
    """
    log.debug("[galaxy_store] 검색 경로 미확인이라 '%s'는 항상 모름(None) 처리됩니다.", game_name)
    return None


def check_all_stores(
    game_name: str,
    shared_http: Optional[HttpClient] = None,
    shared_browser: Optional[BrowserClient] = None,
) -> dict:
    """네 스토어 전부를 확인해서 dict로 돌려줍니다. 세션 재사용을 위해 클라이언트를 받습니다."""
    return {
        "google_play": check_google_play(game_name, browser=shared_browser),
        "one_store": check_one_store(game_name, http=shared_http),
        "galaxy_store": check_galaxy_store(game_name),
        "app_store": check_app_store(game_name, http=shared_http),
    }