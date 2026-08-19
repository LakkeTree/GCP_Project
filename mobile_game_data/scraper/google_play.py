import re

import pandas as pd
import requests
from bs4 import BeautifulSoup

from config import COUNTRY, RAW_DIR
from utils.normalize import normalize_game_name


# 한국 Google Play "Top Grossing Games"를 추적하는 공개 차트
# AppBrain의 해당 페이지를 사용한다.
#
# 참고: 이 페이지는 스크롤/JS 로딩 없이 첫 응답에 1~100위가
# 전부 포함되어 있음을 확인했다 (requests 단독 테스트 100/100 통과).
# 따라서 Playwright/브라우저 자동화 없이 requests + BeautifulSoup만 사용한다.
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
    """
    AppBrain 카드의 텍스트에서
    '게임명 by 개발사' 형태가 있으면 게임명만 추출한다.
    """
    text = normalize_game_name(text)

    if " by " in text:
        text = text.split(" by ", 1)[0].strip()

    return text


def extract_google_play_id(href: str):
    """
    AppBrain의 게임 상세 링크에서 package ID를 추출한다.

    AppBrain 자체 링크 형태: /app/{slug}/{package_id}
    예) /app/whiteout-survival/com.gof.global -> com.gof.global
    """
    if not href:
        return None

    match = re.search(r"/app/[^/]+/([A-Za-z0-9._]+)/?$", href)
    if match:
        return match.group(1)

    match = re.search(r"[?&]id=([A-Za-z0-9._-]+)", href)
    if match:
        return match.group(1)

    match = re.search(
        r"/store/apps/details\?id=([A-Za-z0-9._-]+)",
        href
    )
    if match:
        return match.group(1)

    return None


async def scrape_google_play():
    """
    한국 Google Play Top Grossing Games를 100개까지 수집한다.

    최종 games.csv에는 순위를 넣지 않지만,
    raw/google_play.csv에는 수집 검증을 위해 rank를 유지한다.

    main.py가 async 파이프라인 구조라 함수는 async로 유지하지만,
    내부는 단순 requests 호출 한 번이라 별도 await 지점은 없다.
    """

    print("\n[Google Play] Top Grossing Games 수집 시작")
    print(f"[Google Play] 목표: {TARGET_COUNT}개")
    print(f"[Google Play] URL: {RANKING_URL}")

    resp = requests.get(RANKING_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()

    print("[Google Play] 페이지 접속 완료")

    soup = BeautifulSoup(resp.text, "html.parser")
    rows = soup.select("table tbody tr")

    results = []

    for row in rows:
        try:
            cells = row.find_all("td")

            if len(cells) < 2:
                continue

            rank_match = re.search(
                r"\d+", cells[0].get_text(strip=True)
            )

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
                        f"https://play.google.com/store/apps/"
                        f"details?id={package_name}"
                        if package_name
                        else None
                    ),
                    "google_play": True,
                }
            )

        except Exception:
            continue

    df = pd.DataFrame(results)

    if df.empty:
        print("[Google Play] 데이터를 찾지 못했습니다.")
        return df

    df = (
        df.drop_duplicates(subset=["rank"])
        .sort_values("rank")
        .head(TARGET_COUNT)
    )

    output = RAW_DIR / "google_play.csv"

    df.to_csv(
        output,
        index=False,
        encoding="utf-8-sig",
    )

    print(f"\n[Google Play] 최종 {len(df)}개 게임 저장")
    print(f"[Google Play] {output}")

    print("\n[Google Play] 상위 10개:")
    print(
        df[
            [
                "rank",
                "game_name",
                "google_play_id",
                "google_play"
            ]
        ]
        .head(10)
        .to_string(index=False)
    )

    missing = df["google_play_id"].isna().sum()
    print(f"[Google Play] google_play_id 결측치: {missing} / {len(df)}")

    return df