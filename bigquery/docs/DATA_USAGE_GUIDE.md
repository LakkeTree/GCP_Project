# BigQuery 데이터 사용법 명세서 (계산엔진 팀 전달용)

대상: 계산 엔진(추천 로직) 담당 팀원
목적: BigQuery에 적재된 결제수단/혜택 데이터를 계산 로직에서 불러다 쓰는 방법 안내

이 문서는 데이터를 가져오는 방법을 **[방법 A] SQL을 몰라도 되는 파이썬 코드 방식**과 **[방법 B] SQL 쿼리를 쓰는 방식**, 두 가지로 나눠서 설명합니다. 아래 "0·1"은 두 방법 모두에 공통으로 필요한 사전 정보이고, 실제 사용법은 방법 A 또는 방법 B 중 편한 것 하나만 읽으면 됩니다.

---

## 0. 접속 정보 및 사전 준비 (공통)

| 항목 | 값 |
|---|---|
| GCP 프로젝트 ID | `positive-tuner-504502-m5` |
| 데이터셋 | `benefit` |
| 데이터셋 위치(location) | `asia-northeast3` (서울) |
| 테이블 1 | `platform_connection` (80행) — 결제수단 x 플랫폼 지원 여부 |
| 테이블 2 | `benefit_info` (106행) — 결제수단/혜택 상세 정보 |

전체 경로: `positive-tuner-504502-m5.benefit.platform_connection`, `positive-tuner-504502-m5.benefit.benefit_info`

```bash
pip install google-cloud-bigquery pandas db-dtypes
```

인증은 아래 둘 중 하나만 하면 됩니다.
- **로컬 개발용 (추천)**: `gcloud auth application-default login` 실행 후 브라우저 로그인. 키 파일 관리 불필요.
- **서비스 계정 키 사용 시**: 키 JSON 파일 발급받아 환경변수 지정
  ```powershell
  $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
  ```

---

## 1. 테이블 구조 요약 (공통)

### 1.1 `platform_connection` — 결제수단 x 플랫폼 지원 여부

| 컬럼 | 타입 | 설명 |
|---|---|---|
| `payment_method` | STRING | 결제수단 코드 (20종, 아래 참고) |
| `platform` | STRING | `GOOGLE_PLAY`, `APP_STORE`, `GALAXY_STORE`, `ONE_STORE` |
| `is_supported` | BOOLEAN | 해당 플랫폼에서 결제수단 지원 여부 |
| `note` | STRING (NULLABLE) | 부가 설명, 대부분 빈 값 |

`payment_method` 실제 값(20종): `APPLE_GIFTCARD`, `APPLE_PAY`, `CREDIT_CHECK_CARD`, `CULTURELAND_CASH`, `CULTURELAND_PAYMENT`, `GALAXY_STORE_GIFTCARD`, `GOOGLE_PLAY_GIFTCARD`, `KAKAO_PAY`, `KCP_BANK_ACCOUNT`, `KT`, `LGU_PLUS`, `NAVER_PAY`, `ONESTORE_GIFTCARD`, `PAYCO`, `QUICK_BANK_TRANSFER`, `SAMSUNG_PAY`, `SKT`, `STORE_MEMBERSHIP_REWARD`, `TELECOM_DISCOUNT`, `TOSS_PAY`

### 1.2 `benefit_info` — 혜택 상세 (32개 컬럼)

계산 로직에서 특히 자주 쓰게 될 컬럼:

| 컬럼 | 타입 | 실제 값 / 의미 |
|---|---|---|
| `benefit_id` | STRING | 고유 ID (예: `BNF_0001`), 유니크 |
| `category` | STRING | `CARD`, `E_PAYMENT`, `GIFT_CARD`, `TELECOM`, `GAME_EVENT_CARD`, `GAME_EVENT_E_PAYMENT`, `GAME_EVENT_STORE`, `SUMMARY_*` (5종) |
| `provider_or_retailer` | STRING | 카드사/페이사/통신사/판매처 코드 (35종, 예: `SHINHAN_CARD`, `KAKAO_PAY`, `SKT`, `GALAXY_STORE`) |
| `target_platform` | STRING | `ALL`, `GOOGLE_PLAY`, `APP_STORE`, `GALAXY_STORE`, `ONE_STORE` |
| `target_game` | STRING | `ALL` 또는 `COOKIERUN_KINGDOM` (현재는 게임 1종만 있음) |
| `channel_type` | STRING | `IN_APP`, `ONLINE`, `OFFLINE` |
| `benefit_type` | STRING | `DISCOUNT`, `REWARD`, `CASHBACK`, `FEE` |
| `benefit_value` | NUMERIC | 혜택 수치 (소수 가능) |
| `benefit_unit` | STRING | `PERCENT` 또는 `KRW` — `benefit_value` 해석 기준 |
| `min_spend_krw` | INTEGER | 혜택 적용 최소 결제금액 |
| `max_benefit_krw` | INTEGER (NULLABLE) | 혜택 한도, 한도 없으면 NULL |
| `min_prev_month_spend_krw` | INTEGER (NULLABLE) | 전월 실적 조건, 없으면 NULL |
| `condition_type` | STRING | `GENERAL`, `FIRST_PURCHASE`, `PREV_SPEND_REQUIRED`, `MEMBERSHIP_TIER`, `PRE_REGISTRATION`, `CONVERSION_FEE` |
| `is_first_purchase` | BOOLEAN | 첫 결제 한정 여부 |
| `payment_method_restriction` | STRING | `NONE`, `CARD_ONLY`, `CASH_ONLY`, `POINT_ONLY` |
| `stacking_layer` | STRING | `PAYMENT_PG`, `CARD_ISSUER`, `STORE_COUPON`, `GIFT_CARD` — 중복 적용 가능 여부 판단 시 사용 |
| `denomination_list` | INTEGER **REPEATED**(배열) | 상품권 권종 목록. Python에서는 자동으로 `list`로 들어옴 |
| `start_date` / `end_date` | DATE (NULLABLE) | 상시 혜택이면 NULL |

나머지 필드(`is_tiered_limit`, `is_probabilistic`, `disbursement_type` 등)는 `bigquery/schemas/benefit_info_schema.json` 원본 참고.

---

## [방법 A] 파이썬 코드만으로 사용하기 (SQL 몰라도 됨)

데이터가 186행뿐이라, **테이블을 통째로 읽어와서 pandas로 필터링**하는 방식을 추천합니다. SQL 문법을 하나도 몰라도 됩니다.

```python
from google.cloud import bigquery

client = bigquery.Client(project="positive-tuner-504502-m5")

benefit_df = client.list_rows(
    "positive-tuner-504502-m5.benefit.benefit_info"
).to_dataframe()

platform_df = client.list_rows(
    "positive-tuner-504502-m5.benefit.platform_connection"
).to_dataframe()

# 예: 쿠키런 킹덤 + 갤럭시스토어 대상 혜택만 필터링
target = benefit_df[
    (benefit_df["target_game"].isin(["ALL", "COOKIERUN_KINGDOM"]))
    & (benefit_df["target_platform"].isin(["ALL", "GALAXY_STORE"]))
    & (benefit_df["provider_or_retailer"].isin(["SHINHAN_CARD", "KAKAO_PAY"]))  # 보유 카드/페이
]

# 예: 갤럭시스토어에서 지원되는 결제수단만 필터링
supported = platform_df[
    (platform_df["platform"] == "GALAXY_STORE") & (platform_df["is_supported"])
]["payment_method"].tolist()
```

**주의사항**
- `benefit_value`(NUMERIC)는 `Decimal` 타입으로 들어오므로 계산 전 `float()` 변환 필요.
- `denomination_list`는 이미 Python `list`로 들어옵니다 (예: `[5000, 10000, 30000]`).
- 매번 새로 불러오면 앱 요청마다 지연이 생기므로, 계산엔진 시작 시 한 번만 읽어 메모리에 캐싱해두고 재사용하는 걸 권장합니다.

---

## [방법 B] SQL 쿼리로 사용하기

특정 조건만 딱 걸러서 필요한 행만 받고 싶을 때 사용합니다. 사용자 입력값(카드 목록 등)은 반드시 파라미터 바인딩으로 넘겨서 SQL 인젝션을 피하세요.

```python
from google.cloud import bigquery

client = bigquery.Client(project="positive-tuner-504502-m5")

sql = """
SELECT *
FROM `positive-tuner-504502-m5.benefit.benefit_info`
WHERE target_game IN ('ALL', @game)
  AND target_platform IN ('ALL', @platform)
  AND provider_or_retailer IN UNNEST(@providers)
  AND min_spend_krw <= @amount
"""

job_config = bigquery.QueryJobConfig(
    query_parameters=[
        bigquery.ScalarQueryParameter("game", "STRING", "COOKIERUN_KINGDOM"),
        bigquery.ScalarQueryParameter("platform", "STRING", "GALAXY_STORE"),
        bigquery.ArrayQueryParameter("providers", "STRING", ["SHINHAN_CARD", "KAKAO_PAY"]),
        bigquery.ScalarQueryParameter("amount", "INT64", 30000),
    ]
)

df = client.query(sql, job_config=job_config, location="asia-northeast3").to_dataframe()
```

두 테이블을 함께 조회할 때(JOIN 예시 — 특정 플랫폼에서 지원되는 결제수단의 혜택만 조회):

```sql
SELECT b.*
FROM `positive-tuner-504502-m5.benefit.benefit_info` AS b
JOIN `positive-tuner-504502-m5.benefit.platform_connection` AS p
  ON b.provider_or_retailer = p.payment_method
  AND b.target_platform = p.platform
WHERE p.is_supported = TRUE
```

`location="asia-northeast3"`을 빠뜨리면 `Dataset ... was not found in location ...` 에러가 납니다. Python 클라이언트로 쿼리할 땐 항상 이 파라미터를 넣어주세요.

---

## 방법 A vs 방법 B, 뭘 써야 하나

| 상황 | 추천 방식 |
|---|---|
| 매번 전체 데이터를 받아서 로직 안에서 자유롭게 필터링하고 싶다 | 방법 A (Python, `list_rows`) |
| 특정 조건에 맞는 소량만 정확히 받고 싶다, SQL이 익숙하다 | 방법 B (SQL) |
| 두 테이블을 조인해서 받고 싶다 | 방법 B (SQL, JOIN) |

현재 데이터 규모(186행)에서는 두 방식 다 속도 차이가 거의 없습니다. 편한 쪽으로 선택하면 됩니다.
