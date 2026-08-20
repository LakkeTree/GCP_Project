"""
스크롤(Playwright) 없이 requests만으로도 100개가 전부 파싱되는지 확인하는 테스트 스크립트.

사용법:
1. 프로젝트 루트(main.py와 같은 위치)에 이 파일을 둔다.
2. requirements: pip install requests beautifulsoup4
3. python test_requests_scrape.py 로 실행.

결과에서 "발견된 행" 수와 "최종 파싱된 게임 수"가 100에 가깝게 나오면,
스크롤 로직 없이 requests 기반으로 전환해도 된다는 뜻입니다.
"""

import re

import pandas as pd
import requests
from bs4 import BeautifulSoup

from config import COUNTRY, RAW_DIR
from utils.normalize import normalize_game_name


RANKING_URL = (
    "https://www.appbrain.com/stats/google-play-rankings/"
    f"top_grossing/game/{COUNTRY.lower()}"
)

TARGET_COUNT = 100

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}


def clean_app_name(text: str) -> str:
    text = normalize_game_name(text)
    if " by " in text:
        text = text.split(" by ", 1)[0].strip()
    return text


def extract_google_play_id(href: str):
    if not href:
        return None

    match = re.search(r"/app/[^/]+/([A-Za-z0-9._]+)/?$", href)
    if match:
        return match.group(1)

    match = re.search(r"[?&]id=([A-Za-z0-9._-]+)", href)
    if match:
        return match.group(1)

    match = re.search(r"/store/apps/details\?id=([A-Za-z0-9._-]+)", href)
    if match:
        return match.group(1)

    return None


def scrape_google_play_requests():
    print("\n[requests 테스트] 시작")
    print(f"[requests 테스트] URL: {RANKING_URL}")

    resp = requests.get(RANKING_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    rows = soup.select("table tbody tr")
    print(f"[requests 테스트] 발견된 <tr> 행: {len(rows)}개")

    results = []

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 2:
            continue

        rank_match = re.search(r"\d+", cells[0].get_text(strip=True))
        if not rank_match:
            continue
        rank = int(rank_match.group())

        app_link = None
        app_name = None

        for a in row.find_all("a"):
            href = a.get("href")
            text = a.get_text(strip=True)
            if not text:
                continue
            if href and "/app/" in href:
                app_link = href
                app_name = text
                break

        if not app_name:
            continue

        game_name = clean_app_name(app_name)
        if not game_name:
            continue

        full_url = None
        if app_link:
            full_url = (
                "https://www.appbrain.com" + app_link
                if app_link.startswith("/")
                else app_link
            )

        package_name = extract_google_play_id(full_url or "")

        results.append(
            {
                "rank": rank,
                "game_name": game_name,
                "google_play_id": package_name,
                "google_play_url": (
                    f"https://play.google.com/store/apps/details?id={package_name}"
                    if package_name
                    else None
                ),
            }
        )

    df = (
        pd.DataFrame(results)
        .drop_duplicates(subset=["rank"])
        .sort_values("rank")
        .head(TARGET_COUNT)
    )

    print(f"[requests 테스트] 최종 파싱된 게임 수: {len(df)} / {TARGET_COUNT}")
    print("\n[requests 테스트] 상위 10개:")
    print(df.head(10).to_string(index=False))

    print(
        f"\n[requests 테스트] google_play_id 결측치: "
        f"{df['google_play_id'].isna().sum()} / {len(df)}"
    )

    return df


if __name__ == "__main__":
    scrape_google_play_requests()
