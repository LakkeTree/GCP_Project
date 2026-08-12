# -*- coding: utf-8 -*-
"""
common/gcs_client.py
--------------------------------------------------------------------
크롤링 결과 CSV를 Google Cloud Storage 버킷에 업로드하는 모듈입니다.

[초보자 설명: 이 파이프라인의 새 흐름]
예전에는 크롤러가 정제된 데이터를 BigQuery에 직접 저장했습니다.
지금은 팀 결정으로 이 방식이 바뀌어, 크롤러는 BigQuery를 전혀 건드리지 않고
대신 CSV 파일을 만들어서 GCS 버킷의 incoming/ 폴더에 올려두기만 합니다.
그 이후(검증 → processed/로 이동 → BigQuery 적재 등)는 이 파이프라인
바깥의 별도 절차로 처리됩니다.

버킷 구조 (GCP 콘솔에서 이미 만들어져 있음):
    positive-tuner-504502-m5-benefit-csv/
    ├── incoming/     <- 크롤러가 새로 만든 CSV를 여기에 올립니다 (이 모듈의 역할)
    ├── processed/    <- (이 파이프라인 밖에서) 정상 처리된 파일이 옮겨지는 곳
    ├── quarantine/   <- (이 파이프라인 밖에서) 검증 실패한 파일이 옮겨지는 곳
    └── archive/      <- (이 파이프라인 밖에서) 오래된 파일 보관

[인증 방식]
    BigQuery와 동일합니다. 로컬 개발 중이면:
        gcloud auth application-default login
    이 명령 한 번이면 별도 키 파일 없이 인증됩니다.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from google.cloud import storage

from common.config import get_settings
from common.logger import get_logger

log = get_logger(__name__)


class GcsClient:
    """GCS 버킷에 파일을 업로드하는 클래스."""

    def __init__(self):
        self.settings = get_settings()
        self.client = storage.Client(project=self.settings.gcp_project_id)
        self.bucket = self.client.bucket(self.settings.gcs_bucket_name)

    def upload_file(self, local_path: str | Path, prefix: Optional[str] = None) -> str:
        """
        로컬 파일 하나를 버킷에 올립니다.

        Args:
            local_path: 올릴 로컬 파일 경로 (예: CSV 파일)
            prefix: 버킷 안의 폴더. 기본값은 설정의 incoming 폴더
                    (예: "incoming/"). 끝에 슬래시가 없으면 자동으로 붙입니다.

        Returns:
            업로드된 객체의 gs:// 경로. 예) "gs://버킷이름/incoming/one_store_20260811.csv"
        """
        local_path = Path(local_path)
        if not local_path.exists():
            raise FileNotFoundError(f"업로드할 파일이 없습니다: {local_path}")

        folder = prefix if prefix is not None else self.settings.gcs_incoming_prefix
        if folder and not folder.endswith("/"):
            folder += "/"

        blob_name = f"{folder}{local_path.name}"
        blob = self.bucket.blob(blob_name)

        log.info("GCS 업로드 중: %s -> gs://%s/%s",
                 local_path, self.settings.gcs_bucket_name, blob_name)
        blob.upload_from_filename(str(local_path), content_type="text/csv")

        gs_uri = f"gs://{self.settings.gcs_bucket_name}/{blob_name}"
        log.info("업로드 완료: %s", gs_uri)
        return gs_uri

    def download_text(self, filename: str, prefix: Optional[str] = None) -> Optional[str]:
        """
        버킷에 이미 같은 이름의 파일이 있으면 그 내용을 문자열로 가져옵니다.
        없으면 None을 돌려줍니다(에러가 아닙니다 — "처음 올리는 파일"이라는 뜻).

        [초보자 설명: 왜 필요한가?]
        크롤러 여러 개가 같은 파일명(Total_Benefit_Info_DB.csv)으로 올리는데,
        그 사이에 처리기(handle-csv-upload)가 파일을 옮겨가지 않으면 나중에
        올린 게 앞의 것을 덮어써서 데이터가 사라집니다. 그래서 새로 올리기
        전에 "혹시 이미 있는 내용이 있나?"를 먼저 확인해서, 있으면 합쳐서
        올리기 위해 이 함수를 씁니다.
        """
        folder = prefix if prefix is not None else self.settings.gcs_incoming_prefix
        if folder and not folder.endswith("/"):
            folder += "/"

        blob_name = f"{folder}{filename}"
        blob = self.bucket.blob(blob_name)

        if not blob.exists():
            return None

        log.info("기존 파일 발견, 내려받는 중: gs://%s/%s", self.settings.gcs_bucket_name, blob_name)
        return blob.download_as_text(encoding="utf-8-sig")

    def upload_csv_content(self, content: str, filename: str, prefix: Optional[str] = None) -> str:
        """
        로컬 파일을 거치지 않고, 메모리에 있는 CSV 문자열을 바로 업로드합니다.
        (임시 파일을 안 만들어도 되니 더 간단합니다)

        Args:
            content: CSV 파일 내용 전체 (문자열)
            filename: 버킷에 저장될 파일 이름. 예) "one_store_20260811_143022.csv"
            prefix: 버킷 안의 폴더. 기본값은 incoming 폴더.

        Returns:
            업로드된 객체의 gs:// 경로.
        """
        folder = prefix if prefix is not None else self.settings.gcs_incoming_prefix
        if folder and not folder.endswith("/"):
            folder += "/"

        blob_name = f"{folder}{filename}"
        blob = self.bucket.blob(blob_name)

        log.info("GCS 업로드 중(메모리): -> gs://%s/%s", self.settings.gcs_bucket_name, blob_name)
        # utf-8-sig: 엑셀에서 한글이 안 깨지도록 BOM을 포함합니다 (csv_export.py와 동일한 이유).
        blob.upload_from_string(content.encode("utf-8-sig"), content_type="text/csv")

        gs_uri = f"gs://{self.settings.gcs_bucket_name}/{blob_name}"
        log.info("업로드 완료: %s", gs_uri)
        return gs_uri