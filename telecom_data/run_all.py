"""telecom_data/scrapers/의 통신사(SKT/KT/LG U+) 스크래퍼를 실행해 결과를 하나의
CSV로 합쳐 GCS incoming/에 업로드한다.

스크래퍼 하나만 지정해서 실행하면 그 소스(source_file)만 갱신된다 — 다른
도메인 run_all.py와 동일한 이유(bigquery/main.py의 TARGETS 참고).

사용법 (repo 루트에서, -m으로 패키지 실행):
  python -m telecom_data.run_all                     # 전체 통신사 소스 실행
  python -m telecom_data.run_all skt_billing_membership  # 하나만 실행
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

from card_data.common import normalize
from card_data.common.crawl_log import run_and_log
from card_data.common.gcs_upload import upload_to_incoming

load_dotenv()

DOMAIN = "telecom_data"
OUTPUT_PATH = Path(__file__).resolve().parent / "output" / "Telecom_Benefit_Info_DB.csv"
# lgu_event_board는 headless 봇 차단 때문에 이 run_all(Cloud Run Job)이 아니라
# Xvfb+headed GCE VM에서 별도로 돌린다 — 그쪽은 같은 GCS 목적지에 동시 업로드하면
# 서로 덮어쓸 수 있어 DEST_FILENAME_OVERRIDE로 다른 파일명을 쓴다
# (bigquery/main.py의 TARGETS에 그 파일명이 등록돼 있어야 함).
DEST_FILENAME = os.environ.get("DEST_FILENAME_OVERRIDE") or "Telecom_Benefit_Info_DB.csv"

SCRAPERS = {
    "skt_billing_membership": "telecom_data.scrapers.skt_billing_membership",
    "skt_onestore_membership": "telecom_data.scrapers.skt_onestore_membership",
    "kt_onestore_membership": "telecom_data.scrapers.kt_onestore_membership",
    "kt_billing_plus": "telecom_data.scrapers.kt_billing_plus",
    "lgu_onestore_membership": "telecom_data.scrapers.lgu_onestore_membership",
    "lgu_event_board": "telecom_data.scrapers.lgu_event_board",
}


def main() -> None:
    targets = sys.argv[1:] or list(SCRAPERS.keys())
    all_rows = []
    for name in targets:
        print(f"[{name}] 크롤링 시작")
        rows = run_and_log(domain=DOMAIN, scraper_name=name, module_path=SCRAPERS[name])
        print(f"[{name}] {len(rows)}건 추출")
        all_rows.extend(rows)

    all_rows = normalize.dedupe_rows(all_rows)
    normalize.write_csv(all_rows, OUTPUT_PATH)
    print(f"로컬 CSV 저장: {OUTPUT_PATH} ({len(all_rows)}행)")

    upload_to_incoming(OUTPUT_PATH, DEST_FILENAME)


if __name__ == "__main__":
    main()
