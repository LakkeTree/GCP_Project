import re

import pandas as pd
import requests
from bs4 import BeautifulSoup

from config import COUNTRY, RAW_DIR
from utils.normalize import normalize_game_name


# 한국 App Store "Top Grossing Games"를 추적하는 공개 차트
# Google Play와 마찬가지로 AppBrain의 해당 페이지를 사용한다.
#
# 참고: Apple 공식 RSS(rss.applemarketingtools.com)는 top-free/top-paid만
# 제공하고 top-grossing(매출)은 더 이상 공개 제공하지 않아서 AppBrain을 사용.
# 이 페이지도 requests만으로 전체가 로드됨을 확인했다 (스크롤 불필요).
RANKING_URL = (
    "https://www.appbrain.com/stats/appstore-rankings/"
    f"top_grossing/games/{COUNTRY.lower()}"
)

# App Store Top Grossing 차트는 Google Play(최대 500)보다 깊이가 얕아서
# 국가에 따라 50~100개 안팎만 존재할 수 있다. 상한만 넉넉히 잡아둔다.
TARGET_COUNT = 200

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


def extract_app_store_id(href: str):
    """
    AppBrain의 App Store 상세 링크에서 Apple 앱 ID를 추출한다.

    AppBrain 자체 링크 형태: /appstore/{slug}/ios-{app_id}
    예) /appstore/kingshot/ios-6739554056 -> 6739554056
    """
    if not href:
        return None

    match = re.search(r"/appstore/[^/]+/ios-(\d+)", href)
    if match:
        return match.group(1)

    return None


async def scrape_app_store():
    """
    한국 App Store Top Grossing Games를 수집한다.

    Google Play와 동일한 패턴:
    - raw/app_store.csv에는 rank를 검증용으로 유지
    - 최종 games.csv에는 rank를 넣지 않음 (merger.py가 처리)
    """

    print("\n[App Store] Top Grossing Games 수집 시작")
    print(f"[App Store] URL: {RANKING_URL}")

    resp = requests.get(RANKING_URL, headers=HEADERS, timeout=20)
    resp.raise_for_status()

    print("[App Store] 페이지 접속 완료")

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

                if href and "/appstore/" in href:
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

            app_id = extract_app_store_id(full_url or "")

            results.append(
                {
                    "rank": rank,
                    "game_name": game_name,
                    "app_store_id": app_id,
                    "app_store_url": (
                        f"https://apps.apple.com/{COUNTRY.lower()}/app/id{app_id}"
                        if app_id
                        else None
                    ),
                    "app_store": True,
                }
            )

        except Exception:
            continue

    df = pd.DataFrame(results)

    if df.empty:
        print("[App Store] 데이터를 찾지 못했습니다.")
        return df

    df = (
        df.drop_duplicates(subset=["rank"])
        .sort_values("rank")
        .head(TARGET_COUNT)
    )

    output = RAW_DIR / "app_store.csv"

    df.to_csv(
        output,
        index=False,
        encoding="utf-8-sig",
    )

    print(f"\n[App Store] 최종 {len(df)}개 게임 저장")
    print(f"[App Store] {output}")

    print("\n[App Store] 상위 10개:")
    print(
        df[
            [
                "rank",
                "game_name",
                "app_store_id",
                "app_store"
            ]
        ]
        .head(10)
        .to_string(index=False)
    )

    missing = df["app_store_id"].isna().sum()
    print(f"[App Store] app_store_id 결측치: {missing} / {len(df)}")

    return df