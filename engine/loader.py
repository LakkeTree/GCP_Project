"""
===============================================================================
BigQuery 데이터 로더 (v6) — v5 계산 엔진과 BigQuery를 연결하는 어댑터
===============================================================================

[v6 최초 버전 대비 변경 사항 — DATA_USAGE_GUIDE.md 반영]

1. ★ location 버그 수정
   가이드에서 명확히 경고한 문제: location="asia-northeast3"을 안 넣으면
   "Dataset ... was not found in location ..." 에러가 난다.
   v6 최초 버전은 client.query()를 쓰면서 이 파라미터를 빠뜨렸었다(실제 프로젝트
   정보가 없어 테스트로는 못 잡아낸 버그). 이번에 고쳤다.

2. SQL 쿼리(client.query) -> list_rows 방식으로 전환
   가이드가 "방법 A"로 추천한 client.list_rows().to_dataframe() 방식을 채택했다.
   이유: 데이터가 186행뿐이라 SQL로 필터링해서 받을 필요가 없고(전체를 캐싱해서
   v5 안에서 파이썬으로 필터링하는 게 이미 우리 구조), SQL 문법 없이 더 단순하다.

3. 실제 접속 정보 반영
   프로젝트/데이터셋/테이블 이름을 가이드에 명시된 실제 값으로 기본값을 채웠다.
   (환경변수로 덮어쓸 수 있는 구조는 유지 — 나중에 dev/prod 데이터셋을 나누게 되면 유용)

===============================================================================
[인증 방식 — 가이드 그대로]
  - 로컬 개발: gcloud auth application-default login (추천, 키 파일 관리 불필요)
  - 서비스 계정 키 사용 시: 환경변수 GOOGLE_APPLICATION_CREDENTIALS 에 키 경로 지정
  - Cloud Run 배포 시: 별도 설정 없이 서비스 계정으로 자동 인증
===============================================================================
"""

import os
import time
import datetime
from decimal import Decimal

from google.cloud import bigquery

# v5의 계산 함수들을 그대로 가져와서 쓴다 (수정 없이 재사용).
from GCP_Project.engine.calculator import recommend_best_routes as _recommend_best_routes_core


# =============================================================================
# [설정값] — DATA_USAGE_GUIDE.md 0번 항목의 실제 접속 정보를 기본값으로 사용
# =============================================================================
PROJECT_ID = os.environ.get("BQ_PROJECT_ID", "positive-tuner-504502-m5")
DATASET_ID = os.environ.get("BQ_DATASET_ID", "benefit")
LOCATION = os.environ.get("BQ_LOCATION", "asia-northeast3")  # ★ 이게 없으면 에러 남 (가이드 경고사항)
BENEFIT_TABLE = os.environ.get("BQ_BENEFIT_TABLE", "benefit_info")
PLATFORM_TABLE = os.environ.get("BQ_PLATFORM_TABLE", "platform_connection")

# 캐시 유지 시간(초). 가이드에도 "요청마다 새로 불러오면 지연 생기니 캐싱 권장"이라고
# 명시되어 있다 — 우리가 앞서 설계한 방향과 동일하다.
CACHE_TTL_SECONDS = int(os.environ.get("BQ_CACHE_TTL_SECONDS", 600))  # 기본 10분


# =============================================================================
# [내부 캐시 저장소]
# =============================================================================
_cache = {
    "benefit_rows": None,
    "platform_rows": None,
    "loaded_at": 0,
}


# =============================================================================
# [BigQuery 값 -> 파이썬 값 정리]
# =============================================================================

def _clean_bq_value(value):
    """
    NUMERIC 타입은 Decimal로 온다(가이드 '주의사항'에도 명시됨).
    Decimal과 float를 섞어 연산하면 TypeError가 나므로 미리 float로 바꾼다.
    pandas의 NaT/NaN(빈 값)도 파이썬 None으로 통일해서 v5의 None 체크와 맞춘다.
    """
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime.date, datetime.datetime)):
        return value.isoformat()
    # pandas가 빈 값을 NaN/NaT로 줄 때가 있다. float('nan')은 None이 아니라서
    # v5의 `if cap is None:` 같은 체크를 그냥 통과 못하고 이상값 취급될 수 있다.
    try:
        import math
        if isinstance(value, float) and math.isnan(value):
            return None
    except TypeError:
        pass
    return value


def _row_to_dict(row):
    """pandas DataFrame의 한 행(Series)을 정리된 딕셔너리로 바꾼다."""
    return {key: _clean_bq_value(value) for key, value in row.items()}


# =============================================================================
# [BigQuery 조회] — 가이드의 [방법 A] 그대로 채택
# =============================================================================

def _get_client():
    """BigQuery 클라이언트를 만든다. location을 명시해 리전 불일치 에러를 예방한다."""
    return bigquery.Client(project=PROJECT_ID, location=LOCATION)


def _fetch_table_as_dicts(client, table_name):
    """
    테이블 전체를 읽어와 딕셔너리 리스트로 반환한다.
    가이드 예시(client.list_rows(...).to_dataframe())를 그대로 따르되,
    이후 dict 리스트로 변환해 v5가 기대하는 입력 형태로 맞춘다.
    """
    table_id = f"{PROJECT_ID}.{DATASET_ID}.{table_name}"
    df = client.list_rows(table_id).to_dataframe()
    return [_row_to_dict(row) for _, row in df.iterrows()]


def load_data(force_refresh=False):
    """
    BigQuery에서 혜택/호환성 데이터를 가져온다. 캐시가 유효하면 재조회하지 않는다.
    force_refresh=True 로 호출하면 캐시를 무시하고 강제로 새로 조회한다.
    """
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


# =============================================================================
# [진입점] 팀원3(API 서버)이 실제로 호출할 함수
# =============================================================================

def recommend_best_routes(platform, amount, held_methods,
                          game="COOKIERUN_KINGDOM", is_first_purchase=False, top_n=3):
    """
    API 서버 코드에서는 이렇게만 호출하면 된다:
        from bigquery_loader import recommend_best_routes
        result = recommend_best_routes("GOOGLE_PLAY", 149000, ["ZEROPIN", "KAKAO_PAY"])
    """
    benefit_rows, platform_rows = load_data()
    return _recommend_best_routes_core(
        benefit_rows, platform_rows, platform, amount, held_methods,
        game=game, is_first_purchase=is_first_purchase, top_n=top_n,
    )


# =============================================================================
# 실행 및 검증
# =============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("BigQuery 연동 계산 엔진 (v6) 연결 테스트")
    print("=" * 70)
    print(f"프로젝트: {PROJECT_ID}")
    print(f"데이터셋: {DATASET_ID}")
    print(f"리전: {LOCATION}")
    print(f"테이블: {BENEFIT_TABLE}, {PLATFORM_TABLE}")
    print()

    result = recommend_best_routes(
        platform="GOOGLE_PLAY", amount=149000,
        held_methods=["ZEROPIN", "GMARKET", "KAKAO_PAY", "SAMSUNG_CARD"],
    )
    for rank, r in enumerate(result["routes"], 1):
        print(f"{rank}위 {r['route_type']} net_cost={r['net_cost']:,}원")
