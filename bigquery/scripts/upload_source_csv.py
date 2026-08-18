"""
datas/ 의 통합 원본 CSV 2개를 GCS archive/source_csv/ 에 백업 업로드한다.
(BigQuery에는 이미 수동 적재되어 있는 데이터 - 재적재 목적이 아니라 원본 스냅샷 보관용)

대상:
  datas/Total_Benefit_Info_DB.csv
  datas/Total_Platform_Connection_DB.csv
목적지:
  gs://positive-tuner-504502-m5-benefit-csv/archive/source_csv/

사용법:
  python bigquery/scripts/upload_source_csv.py
"""

from pathlib import Path

from google.cloud import storage

ROOT = Path(__file__).resolve().parents[2]
DATAS_DIR = ROOT / "datas"

BUCKET_NAME = "positive-tuner-504502-m5-benefit-csv"
DEST_PREFIX = "archive/source_csv"

FILES = [
    "Total_Benefit_Info_DB.csv",
    "Total_Platform_Connection_DB.csv",
]


def upload_file(bucket: storage.Bucket, filename: str) -> None:
    src = DATAS_DIR / filename  # 업로드할 로컬 원본 CSV의 전체 경로
    blob = bucket.blob(f"{DEST_PREFIX}/{filename}")  # 업로드 대상 GCS 객체(경로) 참조를 생성 (아직 업로드는 안 됨)
    blob.upload_from_filename(src)  # 로컬 파일(src)의 내용을 읽어 blob이 가리키는 GCS 경로로 업로드
    blob.reload()  # 업로드 직후 서버에 재조회해서 size/md5_hash 같은 메타데이터를 blob 객체에 채움
    print(f"업로드 완료: gs://{BUCKET_NAME}/{blob.name} ({blob.size:,} bytes, md5={blob.md5_hash})")  # 결과 확인용 로그 출력


def main() -> None:
    client = storage.Client()  # ADC(gcloud 로그인 자격증명)로 Cloud Storage 클라이언트 생성
    bucket = client.bucket(BUCKET_NAME)  # 대상 버킷에 대한 참조 획득 (존재 여부는 API 호출 시점에 검증됨)
    for filename in FILES:  # 업로드 대상 파일 목록을 순서대로 처리
        upload_file(bucket, filename)  # 파일 하나씩 GCS로 업로드


if __name__ == "__main__":
    main()
