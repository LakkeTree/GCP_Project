"""스크래퍼 실행을 감싸서 성공/실패 여부를 BigQuery `benefit.crawl_log`
테이블에 기록하는 공용 헬퍼.

5개 도메인(card_data/epay_data/store_data/voucher_data/telecom_data)의
run_all.py가 전부 module.scrape()를 직접 부르는 대신 이 모듈의 run_and_log()를
통해 부른다. 스크래퍼 하나가 끝날 때마다(전체 run_all.py 실행이 끝나기 전에)
즉시 로그 한 행을 적재한다 — 중간에 프로세스가 죽어도(예: Playwright 브라우저
크래시) 그때까지 끝난 스크래퍼들의 로그는 남는다.

run_id는 환경변수 CRAWL_RUN_ID가 있으면 그 값을 쓰고(나중에 Cloud Scheduler가
5개 도메인을 순차 실행할 때 하나의 배치로 묶기 위함), 없으면(로컬 수동 실행)
프로세스 시작 시각 기준으로 이 모듈이 자동 생성한다. trigger_source도
동일하게 환경변수(CRAWL_TRIGGER_SOURCE)로 주입 가능하고 기본값은 MANUAL —
나중에 스케줄러가 SCHEDULED로 설정하면 관리자 페이지에서 수동 테스트 실행과
자동 실행을 구분할 수 있다.

로그 적재 자체가 실패해도(네트워크 문제 등) 크롤링 결과에는 영향을 주지 않는다
— 경고만 출력하고 원래 rows를 그대로 반환한다.
"""

import importlib
import json
import os
import traceback
from datetime import datetime, timezone
from pathlib import Path

from google.cloud import bigquery

PROJECT_ID = "positive-tuner-504502-m5"
DATASET_ID = "benefit"
LOCATION = "asia-northeast3"
TABLE = f"{PROJECT_ID}.{DATASET_ID}.crawl_log"

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "bigquery" / "schemas" / "crawl_log_schema.json"

_RUN_ID = os.environ.get("CRAWL_RUN_ID") or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
_TRIGGER_SOURCE = os.environ.get("CRAWL_TRIGGER_SOURCE", "MANUAL")

_CLIENT: bigquery.Client | None = None
_SCHEMA: list | None = None


def _client() -> bigquery.Client:
    global _CLIENT
    if _CLIENT is None:
        _CLIENT = bigquery.Client(project=PROJECT_ID)
    return _CLIENT


def _schema() -> list:
    global _SCHEMA
    if _SCHEMA is None:
        with SCHEMA_PATH.open(encoding="utf-8") as f:
            fields = json.load(f)
        _SCHEMA = [bigquery.SchemaField(f["name"], f["type"], mode=f["mode"]) for f in fields]
    return _SCHEMA


def _write_log_row(row: dict) -> None:
    try:
        load_job = _client().load_table_from_json(
            [row],
            TABLE,
            job_config=bigquery.LoadJobConfig(
                schema=_schema(),
                write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
            ),
            location=LOCATION,
        )
        load_job.result()
    except Exception as e:
        print(f"[crawl_log] 로그 적재 실패(무시하고 계속 진행): {type(e).__name__}: {e}")


def run_and_log(*, domain: str, scraper_name: str, module_path: str) -> list[dict]:
    """module_path를 import해서 scrape()를 실행하고, 결과와 무관하게 실행 로그를
    crawl_log 테이블에 남긴 뒤 추출된 rows(실패 시 빈 리스트)를 반환한다."""
    started_at = datetime.now(timezone.utc)
    status = "SUCCESS"
    error_type = None
    error_message = None
    provider_or_retailer = None
    source_file = None
    rows: list[dict] = []

    try:
        module = importlib.import_module(module_path)
        provider_or_retailer = getattr(module, "PROVIDER_OR_RETAILER", None)
        source_file = getattr(module, "SOURCE_FILE", None)
        rows = module.scrape()
    except Exception as e:
        status = "FAILED"
        error_type = type(e).__name__
        error_message = "".join(traceback.format_exception_only(type(e), e)).strip()[:2000]

    finished_at = datetime.now(timezone.utc)

    _write_log_row({
        "run_id": _RUN_ID,
        "domain": domain,
        "scraper_name": scraper_name,
        "provider_or_retailer": provider_or_retailer,
        "source_file": source_file,
        "status": status,
        "rows_extracted": len(rows),
        "error_type": error_type,
        "error_message": error_message,
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": (finished_at - started_at).total_seconds(),
        "trigger_source": _TRIGGER_SOURCE,
    })

    if status == "FAILED":
        print(f"[{scraper_name}] 실패: {error_type}: {error_message}")

    return rows
