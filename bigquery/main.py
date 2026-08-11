"""
GCS incoming/ 업로드 이벤트를 받아 CSV를 검증/정제하고 BigQuery에 적재하는
Cloud Run Function(Gen2, Eventarc Storage 트리거) 진입점.

트리거: google.cloud.storage.object.v1.finalized (버킷: positive-tuner-504502-m5-benefit-csv)
Eventarc GCS 트리거는 오브젝트 경로 접두사로 필터링할 수 없으므로, incoming/ 여부는
이 함수 안에서 직접 판별한다.

파일명 → 대상 테이블 매핑 (두 CSV는 서로 다른 테이블로 가는 독립적인 적재라
쌍으로 기다리지 않고 파일명 기준으로 각각 처리한다):
  Total_Benefit_Info_DB.csv        → benefit_info (source_file 기준 scoped delete + append)
  Total_Platform_Connection_DB.csv → platform_connection (전체 truncate)
그 외 파일명은 검증 없이 바로 quarantine/로 이동한다.

배포 시 --source=bigquery (이 파일이 있는 디렉터리)를 통째로 올려야 한다.
scripts/의 load_to_bigquery.py가 스키마를 schemas/*.json에서 상대경로로 읽기
때문에, scripts/만 배포하면 schemas/가 빠져서 런타임에 파일을 못 찾는다.
"""

import csv
import datetime
import io

import functions_framework
from google.cloud import bigquery, storage

from scripts.csv_cleaning import clean_benefit_info_rows, clean_platform_connection_rows
from scripts.load_to_bigquery import load_benefit_info, load_platform_connection

INCOMING_PREFIX = "incoming/"
PROCESSED_PREFIX = "processed/"
QUARANTINE_PREFIX = "quarantine/"

TARGETS = {
    "Total_Benefit_Info_DB.csv": (clean_benefit_info_rows, load_benefit_info),
    "Total_Platform_Connection_DB.csv": (clean_platform_connection_rows, load_platform_connection),
}


@functions_framework.cloud_event
def handle_csv_upload(cloud_event):
    """Eventarc가 전달한 GCS finalize 이벤트 하나를 처리한다."""
    data = cloud_event.data
    bucket_name = data["bucket"]
    object_name = data["name"]

    if not object_name.startswith(INCOMING_PREFIX):
        print(f"[skip] incoming/ 밖의 이벤트라 무시: {object_name}")
        return

    filename = object_name.split("/")[-1]
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    source_blob = bucket.blob(object_name)
    stamp = datetime.datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")

    target = TARGETS.get(filename)
    if target is None:
        _quarantine(bucket, source_blob, filename, stamp, f"알 수 없는 파일명: {filename}")
        return
    clean_fn, load_fn = target

    try:
        text = source_blob.download_as_text(encoding="utf-8-sig")
        rows = list(csv.DictReader(io.StringIO(text)))
        cleaned = clean_fn(rows)
    except (ValueError, KeyError) as e:
        _quarantine(bucket, source_blob, filename, stamp, f"정제 실패 (필수 컬럼 누락 또는 형식 오류): {e}")
        return

    try:
        bq_client = bigquery.Client()
        loaded_count = load_fn(bq_client, cleaned)
    except Exception as e:
        _quarantine(bucket, source_blob, filename, stamp, f"BigQuery 적재 실패: {e}")
        return

    dest_name = f"{PROCESSED_PREFIX}{stamp}_{filename}"
    bucket.copy_blob(source_blob, bucket, dest_name)
    source_blob.delete()
    print(f"[완료] {object_name} → {dest_name} ({loaded_count}행 적재)")


def _quarantine(bucket, source_blob, filename, stamp, reason):
    """실패한 오브젝트를 quarantine/으로 옮기고 사유를 같은 이름의 .reason.txt로 남긴다."""
    dest_name = f"{QUARANTINE_PREFIX}{stamp}_{filename}"
    bucket.copy_blob(source_blob, bucket, dest_name)
    source_blob.delete()

    log_name = f"{dest_name}.reason.txt"
    bucket.blob(log_name).upload_from_string(reason, content_type="text/plain")
    print(f"[격리] {filename} → {dest_name}: {reason}")
