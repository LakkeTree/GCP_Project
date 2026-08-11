# -*- coding: utf-8 -*-
"""
common/bq_client.py
--------------------------------------------------------------------
BigQuery 적재/조회를 담당하는 모듈입니다.
benefit_info(혜택) 와 platform_connection(플랫폼 호환성) 두 테이블을 다룹니다.

[초보자 설명: 왜 그냥 INSERT 하면 안 되나?]
크롤러는 매일 돕니다. 어제 넣은 혜택을 오늘 또 INSERT 하면 데이터가 계속 불어납니다.
우리가 원하는 동작은 이렇습니다.
  - 처음 보는 혜택(benefit_id)  -> INSERT
  - 이미 있는데 내용이 바뀜      -> UPDATE
  - 이미 있고 내용도 같음        -> 아무것도 안 함
이걸 '업서트(UPSERT)'라 하고, BigQuery 에서는 MERGE 문으로 구현합니다.

[동작 순서]
  1. 이번 수집분을 임시 테이블(_staging)에 통째로 씁니다.
  2. MERGE 로 본 테이블과 비교해 넣거나 고칩니다.
  3. 임시 테이블은 다음 실행 때 덮어써지므로 그냥 둡니다.
"""

from __future__ import annotations

from typing import Iterable, Optional

from google.api_core import exceptions as gcp_exceptions
from google.cloud import bigquery

from common.config import get_settings
from common.logger import get_logger
from common.schema import BenefitInfo, PlatformConnection

log = get_logger(__name__)


# =============================================================================
# benefit_info 테이블 설계도 (실데이터 31필드 + 운영용 5필드 = 36필드)
# =============================================================================
# NULLABLE = 비어 있어도 됨 / REQUIRED = 반드시 값이 있어야 함 / REPEATED = 배열
# benefit_id 외에는 모두 NULLABLE 로 둡니다. 운영 중 스키마를 넓히기 쉽기 때문입니다.

BENEFIT_SCHEMA: list[bigquery.SchemaField] = [
    # --- 식별 ---
    bigquery.SchemaField("benefit_id", "STRING", mode="REQUIRED", description="혜택 고유 ID"),
    bigquery.SchemaField("source_file", "STRING", mode="NULLABLE", description="원본 출처 파일/크롤러"),
    # --- 분류 ---
    bigquery.SchemaField("category", "STRING", mode="NULLABLE", description="혜택 대분류"),
    bigquery.SchemaField("provider_or_retailer", "STRING", mode="NULLABLE", description="제공 주체"),
    bigquery.SchemaField("item_or_event_name", "STRING", mode="NULLABLE", description="이벤트명"),
    bigquery.SchemaField("target_platform", "STRING", mode="NULLABLE", description="적용 플랫폼"),
    bigquery.SchemaField("target_game", "STRING", mode="NULLABLE", description="적용 게임"),
    bigquery.SchemaField("channel_type", "STRING", mode="NULLABLE", description="결제 채널"),
    # --- 혜택 수치 ---
    bigquery.SchemaField("benefit_type", "STRING", mode="NULLABLE", description="혜택 성격"),
    # ⚠️ FLOAT(FLOAT64)가 아니라 NUMERIC입니다. 기존 benefit_info 테이블은
    # BigQuery 콘솔에서 CSV를 직접 업로드해 만들어졌고, 그때 스키마 자동감지가
    # 소수점 있는 숫자 컬럼을 NUMERIC으로 추론했습니다. FLOAT로 선언하면 MERGE 시
    # "FLOAT64를 NUMERIC 컬럼에 넣을 수 없다"는 오류가 납니다(암시적 변환이
    # NUMERIC→FLOAT64 방향만 허용되고 반대는 안 됨). 기존 테이블 타입에 맞췄습니다.
    bigquery.SchemaField("benefit_value", "NUMERIC", mode="NULLABLE", description="혜택 수치"),
    bigquery.SchemaField("benefit_unit", "STRING", mode="NULLABLE", description="수치 단위"),
    bigquery.SchemaField("min_spend_krw", "INTEGER", mode="NULLABLE", description="최소 결제금액"),
    bigquery.SchemaField("max_benefit_krw", "INTEGER", mode="NULLABLE", description="최대 혜택 한도"),
    bigquery.SchemaField("min_prev_month_spend_krw", "INTEGER", mode="NULLABLE", description="전월 실적 요구액"),
    # --- 조건 ---
    bigquery.SchemaField("condition_type", "STRING", mode="NULLABLE", description="조건 종류"),
    bigquery.SchemaField("is_first_purchase", "BOOLEAN", mode="NULLABLE", description="첫 결제 한정"),
    bigquery.SchemaField("requires_pre_app", "BOOLEAN", mode="NULLABLE", description="사전 응모 필요"),
    bigquery.SchemaField("payment_method_restriction", "STRING", mode="NULLABLE", description="결제수단 제한"),
    bigquery.SchemaField("user_segment", "STRING", mode="NULLABLE", description="대상 사용자군"),
    # --- 중첩·지급 ---
    bigquery.SchemaField("stacking_layer", "STRING", mode="NULLABLE", description="중첩 계층"),
    bigquery.SchemaField("spend_exclusion_type", "STRING", mode="NULLABLE", description="실적 제외 유형"),
    bigquery.SchemaField("disbursement_type", "STRING", mode="NULLABLE", description="지급 방식"),
    bigquery.SchemaField("payment_route_type", "STRING", mode="NULLABLE", description="결제 경로 유형"),
    # --- 플래그 ---
    bigquery.SchemaField("is_first_come_first_served", "BOOLEAN", mode="NULLABLE", description="선착순"),
    bigquery.SchemaField("is_tiered_limit", "BOOLEAN", mode="NULLABLE", description="구간별 차등 한도"),
    bigquery.SchemaField("is_probabilistic", "BOOLEAN", mode="NULLABLE", description="확률형"),
    # --- 기타 ---
    # REPEATED = 배열. denomination_list 는 [5000, 10000, ...] 형태입니다.
    bigquery.SchemaField("denomination_list", "INTEGER", mode="REPEATED", description="권종 목록(원)"),
    bigquery.SchemaField("start_date", "DATE", mode="NULLABLE", description="시작일(상시면 NULL)"),
    bigquery.SchemaField("end_date", "DATE", mode="NULLABLE", description="종료일(상시면 NULL)"),
    bigquery.SchemaField("condition_raw_text", "STRING", mode="NULLABLE", description="조건 원문"),
    bigquery.SchemaField("source_url", "STRING", mode="NULLABLE", description="원문 URL"),
    # --- 파이프라인 운영용 추가 컬럼 ---
    bigquery.SchemaField("content_hash", "STRING", mode="NULLABLE", description="변경 감지용 해시"),
    bigquery.SchemaField("crawled_at", "TIMESTAMP", mode="NULLABLE", description="최초 수집 시각"),
    bigquery.SchemaField("updated_at", "TIMESTAMP", mode="NULLABLE", description="마지막 갱신 시각"),
    bigquery.SchemaField("is_active", "BOOLEAN", mode="NULLABLE", description="오늘 기준 유효 여부"),
]

# platform_connection 테이블 설계도
PLATFORM_SCHEMA: list[bigquery.SchemaField] = [
    bigquery.SchemaField("payment_method", "STRING", mode="REQUIRED", description="결제수단 코드"),
    bigquery.SchemaField("platform", "STRING", mode="REQUIRED", description="플랫폼 코드"),
    bigquery.SchemaField("is_supported", "BOOLEAN", mode="NULLABLE", description="지원 여부"),
    bigquery.SchemaField("note", "STRING", mode="NULLABLE", description="비고"),
]

# MERGE 시 갱신할 컬럼. benefit_id(키)와 crawled_at(최초 발견 시각)은 보존합니다.
_BENEFIT_UPDATE_COLUMNS = [
    f.name for f in BENEFIT_SCHEMA if f.name not in ("benefit_id", "crawled_at")
]


class BigQueryClient:
    """BigQuery 저장/조회 담당."""

    def __init__(self):
        self.settings = get_settings()
        self.client = bigquery.Client(
            project=self.settings.gcp_project_id,
            location=self.settings.bq_location,
        )
        self.dataset_id = f"{self.settings.gcp_project_id}.{self.settings.bq_dataset}"
        self.benefit_fqn = self.settings.bq_table_fqn
        self.benefit_staging_fqn = self.settings.bq_staging_table_fqn
        self.platform_fqn = self.settings.bq_platform_table_fqn

    # ------------------------------------------------------------------
    # 1) 데이터셋 / 테이블 준비
    # ------------------------------------------------------------------
    def ensure_dataset(self) -> None:
        """데이터셋이 없으면 만듭니다."""
        try:
            ds = self.client.get_dataset(self.dataset_id)
            log.info("데이터셋 확인 완료: %s (리전=%s)", self.dataset_id, ds.location)
        except gcp_exceptions.NotFound:
            dataset = bigquery.Dataset(self.dataset_id)
            dataset.location = self.settings.bq_location
            dataset.description = "게임 결제 혜택 크롤링 데이터"
            self.client.create_dataset(dataset)
            log.info("데이터셋을 새로 만들었습니다: %s (%s)",
                     self.dataset_id, self.settings.bq_location)

    def _ensure_table(
        self,
        table_fqn: str,
        schema: list[bigquery.SchemaField],
        clustering: Optional[list[str]] = None,
    ) -> None:
        """
        테이블이 없으면 만들고, 이미 있으면 '빠진 컬럼만' 추가합니다.

        [초보자 설명]
        이미 benefit_info 테이블을 쓰고 계시다면 운영용 컬럼(content_hash 등)이 없을 겁니다.
        이 함수가 기존 테이블을 지우지 않고 부족한 컬럼만 붙여 줍니다.
        BigQuery 는 NULLABLE 컬럼 추가를 안전하게 지원하므로 기존 데이터는 그대로 보존됩니다.
        """
        try:
            table = self.client.get_table(table_fqn)
            existing = {f.name for f in table.schema}
            missing = [f for f in schema if f.name not in existing]

            if missing:
                table.schema = list(table.schema) + missing
                self.client.update_table(table, ["schema"])
                log.info("[%s] 컬럼 %d개 추가: %s",
                         table_fqn.split(".")[-1], len(missing),
                         ", ".join(f.name for f in missing))
            else:
                log.info("[%s] 스키마 일치 확인", table_fqn.split(".")[-1])

        except gcp_exceptions.NotFound:
            table = bigquery.Table(table_fqn, schema=schema)
            if clustering:
                # 클러스터링: 자주 필터링하는 컬럼을 지정하면 조회가 싸고 빨라집니다.
                # ⚠️ 파티셔닝은 쓰지 않습니다. 실데이터 108건 중 95건이 end_date=NULL
                #    (상시 혜택)이라 날짜 파티션이 사실상 의미가 없기 때문입니다.
                table.clustering_fields = clustering
            self.client.create_table(table)
            log.info("[%s] 테이블을 새로 만들었습니다", table_fqn.split(".")[-1])

    def setup(self) -> None:
        """데이터셋과 두 테이블을 한 번에 준비합니다."""
        self.ensure_dataset()
        self._ensure_table(
            self.benefit_fqn,
            BENEFIT_SCHEMA,
            clustering=["target_platform", "target_game", "category", "stacking_layer"],
        )
        self._ensure_table(
            self.platform_fqn,
            PLATFORM_SCHEMA,
            clustering=["platform", "payment_method"],
        )

    # ------------------------------------------------------------------
    # 2) 혜택 업서트 (핵심 기능)
    # ------------------------------------------------------------------
    def upsert_benefits(self, items: Iterable[BenefitInfo]) -> dict:
        """
        혜택 목록을 업서트합니다.

        Returns:
            {"received": 받은 건수, "affected": 실제 추가/갱신된 건수}
        """
        rows = [item.to_bq_row() for item in items]

        if not rows:
            log.info("저장할 데이터가 없습니다.")
            return {"received": 0, "affected": 0}

        # DRY_RUN 이면 실제로 쓰지 않고 미리보기만 합니다.
        if self.settings.dry_run:
            log.warning("=== DRY_RUN: BigQuery 에 쓰지 않습니다 ===")
            for row in rows[:5]:
                log.info("  [미리보기] %s | %s | %s %s",
                         row["benefit_id"], row["item_or_event_name"],
                         row["benefit_value"], row["benefit_unit"])
            if len(rows) > 5:
                log.info("  ... 외 %d건", len(rows) - 5)
            return {"received": len(rows), "affected": 0}

        # --- 1단계: 임시 테이블에 적재 ---
        job_config = bigquery.LoadJobConfig(
            schema=BENEFIT_SCHEMA,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        log.info("임시 테이블에 %d건 적재 중...", len(rows))
        load_job = self.client.load_table_from_json(
            rows, self.benefit_staging_fqn, job_config=job_config
        )
        load_job.result()
        if load_job.errors:
            raise RuntimeError(f"BigQuery 적재 실패: {load_job.errors}")

        # --- 2단계: MERGE ---
        update_clause = ",\n            ".join(
            f"T.{c} = S.{c}" for c in _BENEFIT_UPDATE_COLUMNS
        )
        cols = ", ".join(f.name for f in BENEFIT_SCHEMA)
        vals = ", ".join(f"S.{f.name}" for f in BENEFIT_SCHEMA)

        merge_sql = f"""
        MERGE `{self.benefit_fqn}` AS T
        USING (
            -- 임시 테이블에 같은 benefit_id 가 여럿이면 MERGE 가 에러를 냅니다.
            -- 여기서 id 당 1건(가장 최근)만 남깁니다.
            SELECT * EXCEPT(rn) FROM (
                SELECT *, ROW_NUMBER() OVER (
                    PARTITION BY benefit_id ORDER BY updated_at DESC
                ) AS rn
                FROM `{self.benefit_staging_fqn}`
            ) WHERE rn = 1
        ) AS S
        ON T.benefit_id = S.benefit_id

        -- 내용이 바뀐 경우에만 갱신합니다.
        -- IS DISTINCT FROM 을 쓰는 이유: 한쪽이 NULL 이어도 != 와 달리 정상 비교됩니다.
        WHEN MATCHED AND T.content_hash IS DISTINCT FROM S.content_hash THEN
          UPDATE SET
            {update_clause}

        WHEN NOT MATCHED THEN
          INSERT ({cols})
          VALUES ({vals})
        """

        log.info("MERGE 실행 중...")
        query_job = self.client.query(merge_sql)
        query_job.result()
        affected = query_job.num_dml_affected_rows or 0
        log.info("MERGE 완료: 수집 %d건 중 %d건 추가/갱신", len(rows), affected)

        return {"received": len(rows), "affected": affected}

    # ------------------------------------------------------------------
    # 3) 플랫폼 호환성 적재
    # ------------------------------------------------------------------
    def replace_platform_connections(self, items: Iterable[PlatformConnection]) -> int:
        """
        플랫폼 호환성 표를 통째로 교체합니다.

        [왜 업서트가 아니라 전체 교체인가?]
        이 표는 (결제수단 × 플랫폼) 조합 20×4=80칸의 작은 격자입니다.
        '지원 -> 미지원'으로 바뀐 항목뿐 아니라 '아예 사라진 조합'도 반영해야 정확한데,
        전체 교체가 가장 단순하고 실수가 없습니다. 데이터가 작아서 비용도 무시할 수준입니다.
        """
        rows = [item.to_bq_row() for item in items]
        if not rows:
            log.info("플랫폼 호환성 데이터가 비어 있어 건너뜁니다.")
            return 0

        if self.settings.dry_run:
            log.warning("=== DRY_RUN: platform_connection 을 쓰지 않습니다 (%d건) ===", len(rows))
            return 0

        job_config = bigquery.LoadJobConfig(
            schema=PLATFORM_SCHEMA,
            write_disposition=bigquery.WriteDisposition.WRITE_TRUNCATE,
            source_format=bigquery.SourceFormat.NEWLINE_DELIMITED_JSON,
        )
        job = self.client.load_table_from_json(rows, self.platform_fqn, job_config=job_config)
        job.result()
        if job.errors:
            raise RuntimeError(f"platform_connection 적재 실패: {job.errors}")

        log.info("platform_connection %d건으로 교체 완료", len(rows))
        return len(rows)

    # ------------------------------------------------------------------
    # 4) 조회 (계산엔진이 사용)
    # ------------------------------------------------------------------
    def fetch_all_benefits(self) -> list[dict]:
        """
        계산엔진(calculator.py)에 넘길 혜택 전체를 가져옵니다.

        ⚠️ 날짜 필터를 여기서 걸지 않습니다.
           실데이터 108건 중 95건이 start_date/end_date 가 NULL(상시 혜택)이라
           날짜로 거르면 대부분이 사라져 계산이 망가집니다.
           대신 '기간이 있는데 이미 끝난 것'만 제외합니다.
        """
        sql = f"""
        SELECT *
        FROM `{self.benefit_fqn}`
        WHERE end_date IS NULL
           OR end_date >= CURRENT_DATE('Asia/Seoul')
        """
        rows = [dict(r) for r in self.client.query(sql).result()]

        # BigQuery 의 DATE 타입은 파이썬 date 객체로 옵니다.
        # calculator.py 는 문자열을 기대하므로 문자열로 바꿔 줍니다.
        for row in rows:
            for key in ("start_date", "end_date"):
                if row.get(key) is not None:
                    row[key] = row[key].isoformat()
        return rows

    def fetch_platform_connections(self) -> list[dict]:
        """계산엔진에 넘길 플랫폼 호환성 전체를 가져옵니다."""
        sql = f"SELECT payment_method, platform, is_supported, note FROM `{self.platform_fqn}`"
        return [dict(r) for r in self.client.query(sql).result()]

    def count_rows(self, table_fqn: Optional[str] = None) -> int:
        """테이블 행 수를 셉니다. (테스트용)"""
        target = table_fqn or self.benefit_fqn
        sql = f"SELECT COUNT(*) AS cnt FROM `{target}`"
        for row in self.client.query(sql).result():
            return int(row["cnt"])
        return 0