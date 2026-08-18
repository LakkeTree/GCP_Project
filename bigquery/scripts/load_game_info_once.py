"""
datas/Total_Game_Info_DB.csv를 정제해 BigQuery game_info 테이블에 적재하는 1회성 스크립트.

game_info는 크롤링 파이프라인과 연결 계획이 없고 GCS incoming/ 자동화 대상도 아니므로,
Cloud Run Function(main.py)이 아니라 이 로컬 스크립트로 직접 적재한다.
테이블 전체를 WRITE_TRUNCATE하므로 재실행해도 안전하다(항상 CSV 기준 최신 상태로 교체).

사용법:
  python bigquery/scripts/load_game_info_once.py
"""

import sys

from google.cloud import bigquery

from load_to_bigquery import LOCATION, PROJECT_ID, load_game_info
from local_csv_to_jsonl import clean_game_info


def main() -> None:
    try:
        rows = clean_game_info()
    except ValueError as e:
        print(f"\n[오류] 정제 실패: {e}", file=sys.stderr)
        sys.exit(1)

    client = bigquery.Client(project=PROJECT_ID, location=LOCATION)
    loaded_count = load_game_info(client, rows)
    print(f"\n[완료] game_info 테이블 적재: {loaded_count}행")


if __name__ == "__main__":
    main()
