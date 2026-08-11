# -*- coding: utf-8 -*-
"""
common/config.py
--------------------------------------------------------------------
.env 파일에 적어 둔 설정값들을 파이썬에서 쓸 수 있게 읽어오는 모듈입니다.

[초보자 설명]
API 키나 프로젝트 ID 같은 값을 코드 안에 직접 적으면(하드코딩) 위험합니다.
GitHub에 올리는 순간 남에게 노출되기 때문입니다.
그래서 이런 값들은 .env 라는 별도 파일에 적어 두고, 코드는 그 파일에서 읽어옵니다.

[사용법]
    from common.config import get_settings
    settings = get_settings()
    print(settings.gcp_project_id)
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

# 이 파일(config.py)의 위치를 기준으로 프로젝트 최상위 폴더를 찾습니다.
# common/config.py -> common -> game-benefit-pipeline
PROJECT_ROOT = Path(__file__).resolve().parent.parent

# 프로젝트 최상위의 .env 파일을 읽어서 os.environ 에 채워 넣습니다.
load_dotenv(PROJECT_ROOT / ".env")


def _get_bool(key: str, default: bool = False) -> bool:
    """환경변수를 True/False 로 변환합니다. ('true', '1', 'yes' 를 True로 인식)"""
    raw = os.getenv(key)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("true", "1", "yes", "y")


def _get_int(key: str, default: int) -> int:
    """환경변수를 정수로 변환합니다. 값이 이상하면 기본값을 씁니다."""
    raw = os.getenv(key)
    try:
        return int(str(raw).strip())
    except (TypeError, ValueError):
        return default


def _get_float(key: str, default: float) -> float:
    """환경변수를 실수로 변환합니다."""
    raw = os.getenv(key)
    try:
        return float(str(raw).strip())
    except (TypeError, ValueError):
        return default


def _get_str(key: str, default: str = "") -> str:
    """환경변수를 문자열로 가져옵니다. 앞뒤 공백은 제거합니다."""
    raw = os.getenv(key)
    if raw is None:
        return default
    return raw.strip()


@dataclass(frozen=True)
class Settings:
    """
    프로젝트 전체에서 공유하는 설정값 묶음입니다.
    frozen=True 는 '한 번 만들면 값을 못 바꾼다'는 뜻으로, 실수로 설정이 바뀌는 걸 막아줍니다.
    """

    # --- Gemini ---
    use_vertexai: bool
    gemini_api_key: str
    vertex_location: str
    gemini_model: str
    max_input_chars: int
    gemini_max_output_tokens: int

    # --- BigQuery (seed_bigquery.py, test_bigquery.py, expire_benefits.py 같은
    #     수동 스크립트가 아직 사용합니다. 크롤러의 자동 저장 경로에서는 더 이상
    #     쓰이지 않습니다 — 크롤러는 이제 common/gcs_client.py로 GCS에 CSV를 올립니다) ---
    gcp_project_id: str
    bq_dataset: str
    bq_table: str
    bq_platform_table: str
    bq_location: str
    google_application_credentials: str

    # --- GCS (크롤러가 CSV를 올리는 곳) ---
    gcs_bucket_name: str
    gcs_incoming_prefix: str

    # --- 크롤러 공통 ---
    crawl_delay_sec: float
    http_timeout_sec: int
    log_level: str
    dry_run: bool

    # ------------------------------------------------------------------
    # 편의 속성 (property = 함수처럼 계산되지만 변수처럼 쓰는 것)
    # ------------------------------------------------------------------
    @property
    def bq_table_fqn(self) -> str:
        """혜택 테이블 전체 경로. 예: `my-project.game_benefit.benefit_info`"""
        return f"{self.gcp_project_id}.{self.bq_dataset}.{self.bq_table}"

    @property
    def bq_platform_table_fqn(self) -> str:
        """호환 매트릭스 테이블 전체 경로."""
        return f"{self.gcp_project_id}.{self.bq_dataset}.{self.bq_platform_table}"

    @property
    def bq_staging_table_fqn(self) -> str:
        """업서트(있으면 수정/없으면 추가)를 위한 임시 테이블 경로."""
        return f"{self.gcp_project_id}.{self.bq_dataset}.{self.bq_table}_staging"

    def validate(self) -> list[str]:
        """
        설정이 제대로 채워졌는지 점검하고, 문제가 있으면 그 목록을 돌려줍니다.
        (에러를 바로 터뜨리지 않고 목록으로 돌려주는 이유: 여러 문제를 한 번에 알려주기 위함)
        """
        problems: list[str] = []

        if not self.gcp_project_id or "여기에" in self.gcp_project_id:
            problems.append("GCP_PROJECT_ID 가 비어 있습니다. .env 파일을 확인하세요.")

        if self.use_vertexai:
            # Vertex AI 방식일 때는 API 키가 필요 없고, 대신 프로젝트/리전이 필요합니다.
            if not self.vertex_location:
                problems.append("VERTEX_LOCATION 이 비어 있습니다. (예: us-central1)")
        else:
            # AI Studio 방식일 때는 API 키가 반드시 필요합니다.
            if not self.gemini_api_key or "여기에" in self.gemini_api_key:
                problems.append(
                    "GEMINI_API_KEY 가 비어 있습니다. "
                    "https://aistudio.google.com/apikey 에서 발급받아 .env에 넣으세요."
                )

        if not self.bq_dataset:
            problems.append("BQ_DATASET 이 비어 있습니다.")
        if not self.bq_table:
            problems.append("BQ_TABLE 이 비어 있습니다.")
        if not self.bq_platform_table:
            problems.append("BQ_PLATFORM_TABLE 이 비어 있습니다.")

        return problems


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """
    설정을 읽어옵니다.
    @lru_cache 덕분에 프로그램 실행 중 몇 번을 호출해도 실제 읽기는 딱 한 번만 일어납니다.
    """
    settings = Settings(
        # Gemini
        use_vertexai=_get_bool("USE_VERTEXAI", False),
        gemini_api_key=_get_str("GEMINI_API_KEY"),
        vertex_location=_get_str("VERTEX_LOCATION", "us-central1"),
        gemini_model=_get_str("GEMINI_MODEL", "gemini-2.5-flash"),
        max_input_chars=_get_int("MAX_INPUT_CHARS", 60000),
        # 혜택이 많은 페이지(예: 게임 20개 이상 나열된 쿠폰 목록)는 응답이 길어져서
        # 기본값이 너무 낮으면 배열 중간에서 잘립니다. 넉넉하게 잡아둡니다.
        gemini_max_output_tokens=_get_int("GEMINI_MAX_OUTPUT_TOKENS", 32768),
        # BigQuery
        gcp_project_id=_get_str("GCP_PROJECT_ID"),
        bq_dataset=_get_str("BQ_DATASET", "benefit"),
        bq_table=_get_str("BQ_TABLE", "benefit_info"),
        bq_platform_table=_get_str("BQ_PLATFORM_TABLE", "platform_connection"),
        # GCS: 버킷 이름 기본값은 실제 만들어져 있는 버킷 이름으로 맞춰뒀습니다.
        gcs_bucket_name=_get_str("GCS_BUCKET_NAME", "positive-tuner-504502-m5-benefit-csv"),
        gcs_incoming_prefix=_get_str("GCS_INCOMING_PREFIX", "incoming/"),
        bq_location=_get_str("BQ_LOCATION", "asia-northeast3"),
        google_application_credentials=_get_str("GOOGLE_APPLICATION_CREDENTIALS"),
        # 크롤러
        crawl_delay_sec=_get_float("CRAWL_DELAY_SEC", 1.5),
        http_timeout_sec=_get_int("HTTP_TIMEOUT_SEC", 20),
        log_level=_get_str("LOG_LEVEL", "INFO").upper(),
        dry_run=_get_bool("DRY_RUN", False),
    )

    # 서비스 계정 키 경로가 .env에 적혀 있다면, 구글 라이브러리가 인식하는
    # 표준 환경변수 자리에 넣어 줍니다. (이렇게 하면 인증이 자동으로 처리됩니다)
    if settings.google_application_credentials:
        os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials

    return settings
