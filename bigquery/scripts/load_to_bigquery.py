"""
정제된 행(dict) 리스트를 BigQuery benefit_info / platform_connection 테이블에 적재한다.

로컬 CLI와 Cloud Run Function 양쪽에서 재사용할 수 있도록, 파일 경로가 아니라
이미 정제된 rows(csv_cleaning.py의 결과물)와 bigquery.Client를 인자로 받는다.

적재 방식 (2026-08-11 확정):
  - benefit_info: 테이블 전체가 아니라, 이번 CSV가 포함하는 source_file 값에
    해당하는 기존 행만 삭제한 뒤 새로 삽입하는 "scoped truncate". 실제 테이블에는
    이 파이프라인이 모르는 다른 팀원의 크롤링 데이터(source_file='test_script' 등)가
    함께 들어있어서, 테이블 전체를 WRITE_TRUNCATE하면 그 행들이 통째로 사라지기
    때문이다. source_file 기준으로 범위를 좁히면 그 데이터를 건드리지 않는다.
  - platform_connection: 이 테이블은 이 파이프라인이 유일한 출처이므로(다른 출처
    데이터 혼재 없음) 테이블 전체를 WRITE_TRUNCATE한다.
"""

import json
from pathlib import Path

from google.cloud import bigquery

PROJECT_ID = "positive-tuner-504502-m5"
DATASET_ID = "benefit"
LOCATION = "asia-northeast3"

SCHEMAS_DIR = Path(__file__).resolve().parents[1] / "schemas"

BENEFIT_INFO_TABLE = f"{PROJECT_ID}.{DATASET_ID}.benefit_info"
PLATFORM_CONNECTION_TABLE = f"{PROJECT_ID}.{DATASET_ID}.platform_connection"


def _load_schema(filename: str) -> list:
    """bigquery/schemas/*.json을 bigquery.SchemaField 리스트로 변환한다."""
    with (SCHEMAS_DIR / filename).open(encoding="utf-8") as f:
        fields = json.load(f)
    return [
        bigquery.SchemaField(f["name"], f["type"], mode=f["mode"])
        for f in fields
    ]


def load_benefit_info(client: bigquery.Client, rows: list) -> int:
    """
    benefit_info 테이블에서 이번 CSV의 source_file 값에 해당하는 기존 행만 지우고
    새 rows를 적재한다. rows에 없는 source_file(다른 출처 데이터)은 건드리지 않는다.
    """
    if not rows:
        raise ValueError("적재할 benefit_info 행이 없음")

    source_files = sorted({r["source_file"] for r in rows})

    delete_job = client.query(
        f"DELETE FROM `{BENEFIT_INFO_TABLE}` WHERE source_file IN UNNEST(@source_files)",
        job_config=bigquery.QueryJobConfig(
            query_parameters=[
                bigquery.ArrayQueryParameter("source_files", "STRING", source_files),
            ]
        ),
        location=LOCATION,
    )
    delete_job.result()

    load_job = client.load_table_from_json(
        rows,
        BENEFIT_INFO_TABLE,
        job_config=bigquery.LoadJobConfig(
            schema=_load_schema("benefit_info_schema.json"),
            write_disposition=bigquery.WriteDisposition.WRITE_APPEND,
        ),
        location=LOCATION,
    )
    load_job.result()
    return len(rows)


def load_platform_connection(client: bigquery.Client, rows: list) -> int:
    """platform_connection 테이블 전체를 새 rows로 교체한다."""
    if not rows:
        raise ValueError("적재할 platform_connection 행이 없음")

    load_job = client.load_table_from_json(
        rows,
        PLATFORM_CONNECTION_TABLE,
        job_config=bigquery.LoadJobConfig(
            schema=_load_schema("platform_connection_schema.json"),
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
        ),
        location=LOCATION,
    )
    load_job.result()
    return len(rows)
