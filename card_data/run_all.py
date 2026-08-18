"""card_data/scrapers/의 카드사 스크래퍼를 실행해 결과를 하나의 CSV로 합쳐
GCS incoming/에 업로드한다.

카드사 하나만 지정해서 실행하면 그 카드사(source_file)만 갱신된다 —
BigQuery 적재 쪽이 CSV 안의 source_file 값 단위로 scoped delete + append 하기
때문 (bigquery/scripts/load_to_bigquery.py 참고).

사용법 (repo 루트에서, -m으로 패키지 실행):
  python -m card_data.run_all           # 전체 카드사 실행
  python -m card_data.run_all kb        # KB국민카드만 실행
"""

import importlib
import sys
from pathlib import Path

from dotenv import load_dotenv

from card_data.common import normalize
from card_data.common.gcs_upload import upload_to_incoming

load_dotenv()

OUTPUT_PATH = Path(__file__).resolve().parent / "output" / "Card_Benefit_Info_DB.csv"
DEST_FILENAME = "Card_Benefit_Info_DB.csv"

SCRAPERS = {
    "kb": "card_data.scrapers.kb",
    "samsung": "card_data.scrapers.samsung",
    "hana": "card_data.scrapers.hana",
    "shinhan": "card_data.scrapers.shinhan",
    "nh": "card_data.scrapers.nh",
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
