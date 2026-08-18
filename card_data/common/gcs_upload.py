"""card_data/ 결과 CSV를 GCS incoming/에 업로드한다.

(bigquery/scripts/upload_source_csv.py와 동일한 업로드 패턴을 재사용)
"""

from pathlib import Path

from google.cloud import storage

BUCKET_NAME = "positive-tuner-504502-m5-benefit-csv"
DEST_PREFIX = "incoming"


def upload_to_incoming(local_path: Path, dest_filename: str) -> None:
    client = storage.Client()
    bucket = client.bucket(BUCKET_NAME)
    blob = bucket.blob(f"{DEST_PREFIX}/{dest_filename}")
    blob.upload_from_filename(str(local_path))
    blob.reload()
    print(f"업로드 완료: gs://{BUCKET_NAME}/{blob.name} ({blob.size:,} bytes)")
