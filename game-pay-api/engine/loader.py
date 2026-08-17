"""
===============================================================================
BigQuery 데이터 로더 (v10) — BigQuery 최신 4개 테이블 연동 버전
===============================================================================
"""

import os
import time
import datetime
from decimal import Decimal
import pandas as pd

from google.cloud import bigquery
from .calculator import recommend_best_routes as _recommend_best_routes_core

PROJECT_ID = os.environ.get("BQ_PROJECT_ID", "positive-tuner-504502-m5")
DATASET_ID = os.environ.get("BQ_DATASET_ID", "benefit")
LOCATION = os.environ.get("BQ_LOCATION", "asia-northeast3")

# engine/loader.py 상단 테이블 설정 수정
BENEFIT_TABLE = os.environ.get("BQ_BENEFIT_TABLE", "benefit_info") # benefit_info_staging -> benefit_info로 변경

PLATFORM_TABLE = os.environ.get("BQ_PLATFORM_TABLE", "platform_connection")

CACHE_TTL_SECONDS = int(os.environ.get("BQ_CACHE_TTL_SECONDS", 600))  # 10분 캐시

_cache = {
    "benefit_rows": None,
    "platform_rows": None,
    "loaded_at": 0,
}


def _clean_bq_value(value):
    if value is None:
        return None
    if hasattr(value, "tolist"):
        return value.tolist()
    if isinstance(value, (list, tuple)):
        return list(value)
    try:
        if pd.isna(value):
            return None
    except (ValueError, TypeError):
        pass
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    return value


def _row_to_dict(row):
    return {key: _clean_bq_value(value) for key, value in row.items()}


def _get_client():
    return bigquery.Client(project=PROJECT_ID, location=LOCATION)


def _fetch_table_as_dicts(client, table_name):
    table_id = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
    df = client.list_rows(table_id).to_dataframe()
    return [_row_to_dict(row) for _, row in df.iterrows()]


def load_data(force_refresh=False):
    now = time.time()
    cache_is_fresh = (
        _cache["benefit_rows"] is not None
        and (now - _cache["loaded_at"]) < CACHE_TTL_SECONDS
    )

    if not force_refresh and cache_is_fresh:
        return _cache["benefit_rows"], _cache["platform_rows"]

    client = _get_client()
    benefit_rows = _fetch_table_as_dicts(client, BENEFIT_TABLE)
    platform_rows = _fetch_table_as_dicts(client, PLATFORM_TABLE)

    _cache["benefit_rows"] = benefit_rows
    _cache["platform_rows"] = platform_rows
    _cache["loaded_at"] = now

    return benefit_rows, platform_rows


def recommend_best_routes(platform, amount, held_methods,
                          game="ALL", is_first_purchase=False, top_n=10,
                          store_tier=None, has_prev_spend=None, has_pre_applied=False,
                          use_game_benefits=True, force_refresh=False, **kwargs):
    benefit_rows, platform_rows = load_data(force_refresh=force_refresh)
    return _recommend_best_routes_core(
        benefit_rows=benefit_rows,
        platform_rows=platform_rows,
        platform=platform,
        amount=amount,
        held_methods=held_methods,
        game=game,
        is_first_purchase=is_first_purchase,
        top_n=top_n,
        store_tier=store_tier,
        has_prev_spend=has_prev_spend,
        has_pre_applied=has_pre_applied,
        use_game_benefits=use_game_benefits,
        **kwargs
    )