# -*- coding: utf-8 -*-
"""
catalog/build_game_matrix.py
--------------------------------------------------------------------
전체 과정을 순서대로 실행하는 메인 스크립트입니다.

  1단계) 구글플레이 + 앱스토어 순위에서 게임명을 모읍니다 (rankings.py)
  2단계) 스토어 간 중복 표기를 정리해 유니크한 게임 목록을 만듭니다 (normalize.py)
  3단계) 게임마다 4개 스토어(구글플레이/원스토어/갤럭시/앱스토어)에서
         검색해 호환 여부를 확인합니다 (compatibility.py)
  4단계) game_name, google_play, one_store, galaxy_store, app_store
         5개 컬럼짜리 CSV로 저장합니다.

[실행 방법]
    # 먼저 소규모로 테스트 (게임 5개만, 몇 분 안에 끝남)
    python -m catalog.build_game_matrix --limit 5

    # 전체 실행 (게임이 많으면 스토어 검색 특성상 꽤 오래 걸립니다.
    # 구글플레이는 Playwright로 게임마다 브라우저 페이지를 새로 열어야
    # 해서 특히 느립니다 — 게임 300개 기준 최소 20~30분 예상)
    python -m catalog.build_game_matrix

⚠️ 갤럭시 스토어 검색 경로를 아직 못 찾아서, galaxy_store 컬럼은 지금은
항상 빈 값(모름)으로 나옵니다. compatibility.py의 check_galaxy_store()가
완성되면 자동으로 채워집니다.
"""

from __future__ import annotations

import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path

from common.browser import BrowserClient
from common.config import PROJECT_ROOT
from common.http_client import HttpClient
from common.logger import get_logger
from catalog.compatibility import check_all_stores
from catalog.normalize import dedupe_game_names
from catalog.rankings import fetch_all_rankings

log = get_logger("build_game_matrix")

CSV_COLUMNS = ["game_name", "google_play", "one_store", "galaxy_store", "app_store"]


def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def main() -> int:
    parser = argparse.ArgumentParser(description="게임×스토어 호환성 매트릭스를 만듭니다.")
    parser.add_argument(
        "--limit", type=int, default=None,
        help="테스트용. 상위 N개 게임만 처리합니다. 안 주면 전체를 처리합니다.",
    )
    parser.add_argument(
        "--max-per-store", type=int, default=200,
        help="구글플레이/앱스토어 각각에서 순위를 몇 위까지 모을지 (기본 200)",
    )
    parser.add_argument(
        "--output", default=None,
        help="저장할 CSV 경로. 안 주면 data/output/에 시각을 붙여 자동 생성.",
    )
    args = parser.parse_args()

    print("\n🚀 게임×스토어 호환성 매트릭스 생성을 시작합니다.")

    # ------------------------------------------------------------------
    print_header("1단계 | 순위 수집 (구글플레이 + 앱스토어)")
    ranked = fetch_all_rankings(max_games_per_store=args.max_per_store)

    if not ranked:
        print("❌ 순위를 하나도 못 가져왔습니다. catalog/rankings.py 의 URL/선택자를 확인하세요.")
        return 1

    by_store: dict[str, int] = {}
    for r in ranked:
        by_store[r.source] = by_store.get(r.source, 0) + 1
    print(f"  수집된 원본 항목: {len(ranked)}건")
    for store, count in by_store.items():
        print(f"    - {store}: {count}건")

    # ------------------------------------------------------------------
    print_header("2단계 | 중복 게임명 정리")
    all_names = [r.name for r in ranked]
    unique_names = dedupe_game_names(all_names)
    print(f"  {len(all_names)}건 → 중복 제거 후 {len(unique_names)}개 게임")

    if args.limit:
        unique_names = unique_names[: args.limit]
        print(f"  --limit {args.limit} 적용: {len(unique_names)}개만 처리합니다.")

    # ------------------------------------------------------------------
    print_header("3단계 | 스토어별 호환성 확인")
    print(f"  게임 {len(unique_names)}개 × 4개 스토어 검색을 시작합니다...")
    print("  (구글플레이는 Playwright로 게임마다 페이지를 새로 열어서 느립니다)")

    rows: list[dict] = []

    # 연결을 세션 하나로 재사용합니다 (매번 새로 열면 느리고 서버 부담도 큽니다).
    with HttpClient() as shared_http, BrowserClient() as shared_browser:
        for i, name in enumerate(unique_names, start=1):
            result = check_all_stores(
                name, shared_http=shared_http, shared_browser=shared_browser
            )
            rows.append({"game_name": name, **result})

            flags = " ".join(
                f"{store}={'O' if v else ('?' if v is None else 'X')}"
                for store, v in result.items()
            )
            print(f"  [{i}/{len(unique_names)}] {name}  |  {flags}")

    # ------------------------------------------------------------------
    print_header("4단계 | CSV 저장")

    if args.output:
        out_path = Path(args.output)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = PROJECT_ROOT / "data" / "output" / f"game_platform_matrix_{timestamp}.csv"

    out_path.parent.mkdir(parents=True, exist_ok=True)

    # utf-8-sig: 윈도우 엑셀에서 한글이 안 깨지도록 BOM을 포함합니다.
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        writer.writeheader()
        for row in rows:
            # None(모름)은 빈 칸으로, True/False는 그대로 씁니다.
            clean_row = {k: ("" if v is None else v) for k, v in row.items()}
            writer.writerow(clean_row)

    print(f"  저장 완료: {out_path}")
    print(f"  총 {len(rows)}개 게임")

    # --- 요약 통계 ---
    print("\n  --- 스토어별 호환 건수 ---")
    for store in ["google_play", "one_store", "galaxy_store", "app_store"]:
        true_count = sum(1 for r in rows if r[store] is True)
        false_count = sum(1 for r in rows if r[store] is False)
        none_count = sum(1 for r in rows if r[store] is None)
        print(f"  {store:14} 가능={true_count:4} / 불가={false_count:4} / 모름={none_count:4}")

    print_header("완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
