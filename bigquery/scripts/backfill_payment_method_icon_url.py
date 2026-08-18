"""
benefit_info.payment_method_icon_url 컬럼을 provider_or_retailer 기준으로
백필하는 1회성 로컬 스크립트 (load_game_info_once.py와 같은 패턴).

ALTER TABLE로 컬럼을 먼저 추가한 뒤 실행한다. UPDATE ... FROM UNNEST(...)로
한 번에 처리하며, 이미 채워진 값도 그대로 덮어써 재실행해도 안전하다(멱등).

사용법:
  python bigquery/scripts/backfill_payment_method_icon_url.py
"""

from google.cloud import bigquery

from load_to_bigquery import BENEFIT_INFO_TABLE, LOCATION, PROJECT_ID
from payment_method_icons import PAYMENT_METHOD_ICON_URLS


def main() -> None:
    client = bigquery.Client(project=PROJECT_ID, location=LOCATION)

    # ARRAY<STRUCT> 쿼리 파라미터는 python 클라이언트에서 타입 지정이
    # 번거로워서(STRUCT 서브필드 타입을 별도 객체로 선언해야 함), 대신 코드
    # 15개에 대해 각각 단순 UPDATE ... WHERE provider_or_retailer = @code를
    # 반복 실행한다. 값은 전부 우리 딕셔너리에서 온 신뢰 가능한 상수이고,
    # 그래도 SQL 인젝션 걱정 없이 쿼리 파라미터로 바인딩한다.
    total_updated = 0
    for code, icon_url in PAYMENT_METHOD_ICON_URLS.items():
        sql = f"""
        UPDATE `{BENEFIT_INFO_TABLE}`
        SET payment_method_icon_url = @icon_url
        WHERE provider_or_retailer = @code
        """
        job = client.query(
            sql,
            job_config=bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("code", "STRING", code),
                    bigquery.ScalarQueryParameter("icon_url", "STRING", icon_url),
                ]
            ),
            location=LOCATION,
        )
        job.result()
        total_updated += job.num_dml_affected_rows
        print(f"  {code:25s} -> {job.num_dml_affected_rows}행 갱신")

    print(f"[완료] payment_method_icon_url 백필: 총 {total_updated}행 갱신")

    # provider_or_retailer 별로 icon_url이 실제로 잘 채워졌는지 바로 눈으로
    # 확인할 수 있도록 재조회 결과를 출력한다.
    check_sql = f"""
    SELECT provider_or_retailer, payment_method_icon_url, COUNT(*) AS c
    FROM `{BENEFIT_INFO_TABLE}`
    GROUP BY 1, 2
    ORDER BY 1
    """
    print("\n[검증] provider_or_retailer 별 icon_url 채움 여부:")
    for row in client.query(check_sql, location=LOCATION).result():
        icon = row.payment_method_icon_url or "NULL"
        print(f"  {row.provider_or_retailer:25s} {icon[:60]:60s} ({row.c}행)")


if __name__ == "__main__":
    main()
