"""store_data/scrapers/의 스토어(자체 발행 혜택) 스크래퍼를 실행해 결과를 하나의
CSV로 합쳐 GCS incoming/에 업로드한다.

스크래퍼 하나만 지정해서 실행하면 그 소스(source_file)만 갱신된다 —
BigQuery 적재 쪽이 CSV 안의 source_file 값 단위로 scoped delete + append 하기
때문 (bigquery/scripts/load_to_bigquery.py 참고).

사용법 (repo 루트에서, -m으로 패키지 실행):
  python -m store_data.run_all                # 전체 스토어 소스 실행
  python -m store_data.run_all one_store       # 원스토어만 실행
"""

import importlib
import sys
from pathlib import Path

from dotenv import load_dotenv

from card_data.common import normalize
from card_data.common.gcs_upload import upload_to_incoming

load_dotenv()

OUTPUT_PATH = Path(__file__).resolve().parent / "output" / "Store_Benefit_Info_DB.csv"
DEST_FILENAME = "Store_Benefit_Info_DB.csv"

SCRAPERS = {
    "one_store": "store_data.scrapers.one_store",
    "google_play": "store_data.scrapers.google_play",
    "google_play_tier": "store_data.scrapers.google_play_tier",
    "galaxy_store_tier": "store_data.scrapers.galaxy_store_tier",
    "galaxy_store": "store_data.scrapers.galaxy_store",
}


def main() -> None:
    targets = sys.argv[1:] or list(SCRAPERS.keys())
    all_rows = []
    for name in targets:
        module = importlib.import_module(SCRAPERS[name])
        print(f"[{name}] 크롤링 시작")
        rows = module.scrape()
        print(f"[{name}] {len(rows)}건 추출")
        all_rows.extend(rows)

    all_rows = normalize.dedupe_rows(all_rows)
    normalize.write_csv(all_rows, OUTPUT_PATH)
    print(f"로컬 CSV 저장: {OUTPUT_PATH} ({len(all_rows)}행)")

    upload_to_incoming(OUTPUT_PATH, DEST_FILENAME)


if __name__ == "__main__":
    main()
