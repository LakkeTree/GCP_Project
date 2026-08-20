# 게임 혜택 크롤링 파이프라인 — 공통 모듈

게임 스토어/게임사 공지에서 결제 혜택을 수집 → Gemini로 정제 → BigQuery 저장하는 파이프라인입니다.
이번 단계에서 **공통 모듈(`common/`) + 시드 적재 + 테스트 스크립트**를 완성했습니다.

제공해 주신 실데이터로 검증을 마쳤습니다.

| 검증 항목 | 결과 |
|---|---|
| `benefit_info.jsonl` 스키마 통과 | **108 / 108건** |
| `platform_connection.jsonl` 스키마 통과 | **80 / 80건** |
| 정규화로 인한 데이터 손상 | 없음 (이중 공백 → 단일 공백만) |

---

## 1. 폴더 구조

```
game-benefit-pipeline/
├── common/
│   ├── config.py        .env 설정 로드
│   ├── schema.py        ★ 31개 필드 데이터 모델 + 코드 체계 (프로젝트의 기준)
│   ├── ai_client.py     Gemini 호출 → 구조화된 JSON
│   ├── bq_client.py     BigQuery 업서트(MERGE) + 계산엔진용 조회
│   ├── dedupe.py        benefit_id 생성 + 변경 감지
│   ├── http_client.py   재시도/대기 포함 HTTP 요청
│   └── logger.py        통일된 로그
├── crawlers/
│   └── base.py          ★ 모든 크롤러의 부모 클래스
├── scripts/
│   ├── seed_bigquery.py ★ 보내주신 jsonl → BigQuery 최초 적재
│   ├── test_gemini.py   Gemini 연동 테스트
│   └── test_bigquery.py BigQuery 연동 테스트
├── data/seed/           시드 jsonl (동봉되어 있습니다)
├── .env.example
└── requirements.txt
```

---

## 2. 설치

```bash
cd game-benefit-pipeline

# 가상환경 (프로젝트 전용 파이썬 공간)
python -m venv .venv
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # Mac/Linux

pip install -r requirements.txt
```

### Gemini API 키 발급
https://aistudio.google.com/apikey → **Create API key** → 기존 GCP 프로젝트 선택

### `.env` 만들기
```bash
cp .env.example .env      # Windows: copy .env.example .env
```
프로젝트 ID는 이미 채워 두었습니다. `GEMINI_API_KEY`만 넣으면 됩니다.
`DRY_RUN=true`는 처음엔 그대로 두세요.

### GCP 인증
```bash
gcloud auth application-default login
```
서비스 계정 키(JSON)는 **아직 만들지 마세요.** 로컬 개발 단계에서는 위 명령 하나로 충분하고,
키 파일은 유출 위험이 있어 Cloud Run에 배포할 때 만드는 편이 안전합니다.

---

## 3. 실행 순서

### ① Gemini 테스트 (BigQuery를 건드리지 않아 안전)
```bash
python -m scripts.test_gemini
```
샘플 페이지에서 혜택이 추출되고, **"서버 점검 안내"와 "사전예약"은 결과에서 빠져야** 정상입니다.
혜택이 아닌 공지를 걸러내는지 보는 것이 이 테스트의 핵심입니다.

### ② 시드 데이터 검증 (쓰지 않고 확인만)
```bash
python -m scripts.seed_bigquery --check-only
```

### ③ 시드 데이터 적재
`.env`에서 `DRY_RUN=false`로 바꾼 뒤:
```bash
python -m scripts.seed_bigquery
```
`benefit_info` 108건과 `platform_connection` 80건이 올라갑니다.
여러 번 실행해도 중복이 생기지 않습니다.

### ④ BigQuery 업서트 동작 확인
```bash
python -m scripts.test_bigquery
```
**4단계(중복 방지)가 가장 중요합니다.** 같은 데이터를 두 번 넣어도 행 수가 늘지 않아야
매일 크롤링해도 데이터가 안 불어납니다.

---

## 4. 설계에서 알아 두실 점

### benefit_id 를 두 종류로 나눴습니다

| 구분 | 형식 | 예시 |
|---|---|---|
| 직접 정리하신 시드 | 순번 (그대로 보존) | `BNF_0001` |
| 크롤러 자동 수집 | 계산된 해시 | `BNF_AUTO_ONE_STORE_3F9A2B71` |

크롤러가 순번을 쓰면 여러 크롤러가 동시에 돌 때 번호가 충돌합니다.
접두어를 나누면 문제가 생겼을 때 자동 수집분만 골라 지울 수 있습니다.

```sql
DELETE FROM benefit_info WHERE benefit_id LIKE 'BNF_AUTO_%';
```

크롤러용 ID는 `제공처 + 이벤트명 + 플랫폼 + 게임 + 중첩계층 + 시작일`을 해시해 만듭니다.
**종료일은 일부러 뺐습니다** — 이벤트가 연장될 때 새 혜택으로 잡히면 안 되기 때문입니다.
**중첩계층은 넣었습니다** — 이름이 같아도 카드사 혜택과 간편결제 혜택은 계산상 다른 항목이라서입니다.

### `max_benefit_krw` 의 0 과 null 을 구분합니다

`calculator.py`가 이 둘을 다르게 처리하고 있어서, 스키마와 AI 프롬프트 양쪽에서 구분을 강제했습니다.

- `null` = 진짜 무제한
- `0` = 한도 정보가 구조화되지 않음 (`FALLBACK_PERCENT_CAP_KRW` 적용 대상)

빈 값을 자동으로 0으로 채우는 흔한 처리를 넣었다면 계산 결과가 조용히 달라졌을 겁니다.

### 날짜 파티셔닝을 쓰지 않았습니다

실데이터 108건 중 **95건이 `end_date = NULL`(상시 혜택)** 입니다.
날짜로 파티션을 나누면 대부분이 NULL 파티션 한 곳에 몰려 효과가 없습니다.
대신 `target_platform / target_game / category / stacking_layer` 클러스터링을 걸었습니다.

같은 이유로 `fetch_all_benefits()`는 날짜로 거르지 않습니다.
`end_date >= 오늘 OR end_date IS NULL` 조건만 씁니다. 날짜로 걸렀다면 상시 혜택 95건이
전부 사라져 계산엔진이 망가졌을 겁니다.

### 표기가 흔들려도 같은 코드로 모입니다

`schema.py`의 `CODE_ALIASES` 덕분에 "원스토어", "one-store", "ONESTORE"가 모두 `ONE_STORE`가 됩니다.
`calculator.py`의 `STORE_PROVIDER_TO_PLATFORM` 매핑이 실패해 혜택이 조용히 누락되는 것을 막습니다.

### AI가 실수해도 전체가 죽지 않습니다

10건 중 1건이 검증에 실패하면 그 1건만 로그를 남기고 버린 뒤 나머지 9건을 저장합니다.

---

## 5. GCP 연결 정보 (캡처로 확인 완료)

캡처 확인 결과 데이터셋 이름은 `benefit`이며(제가 이전에 `game_benefit`으로 잘못 적어뒀던 것을
바로잡았습니다), `benefit_info`/`platform_connection` 테이블이 이미 만들어져 있습니다.
`.env.example`에 실제 값을 반영해 두었으니 `GEMINI_API_KEY`만 채우면 됩니다.

```
GCP_PROJECT_ID=positive-tuner-504502-m5
BQ_DATASET=benefit
BQ_LOCATION=asia-northeast3    # loader.py 기본값과 일치. 다르면 콘솔 데이터셋 '세부정보'에서 확인하세요.
```

리전만 캡처로는 직접 확인이 안 됩니다. `loader.py`가 `asia-northeast3`를 기본값으로 쓰고 있고
이미 정상 동작 중이라 하셨으니 이 값으로 맞췄지만, BigQuery 콘솔 > 데이터셋 클릭 > '세부정보' 탭에서
한 번 더 확인해 보시는 걸 권합니다. 리전이 다르면 `Dataset ... was not found in location ...` 에러가 납니다.

서비스 계정 키는 배포(Cloud Run) 전까지는 만들지 않으셔도 됩니다.
로컬에서는 `gcloud auth application-default login` 하나로 충분합니다.

---

## 6. `engine/` — 팀에서 새로 올려주신 최신 버전으로 교체함

지난 대화에서 `has_pre_applied`/`use_game_benefits` 미연결 버그를 제가 직접 고쳐 드렸는데,
그 이후 **팀에서 이미 같은 문제를 자체적으로 고친 새 버전**을 올려주셨습니다.
제 임시 패치는 버리고 **새로 받은 버전으로 `engine/`을 교체**했습니다 — 아래 3번 항목에서
비교해 드리지만, 결론적으로 새 버전이 기능적으로 더 앞서 있어 그대로 채택하는 게 맞습니다.

실데이터로 다시 검증했습니다:
```
기존 방식 호출 OK, 경로 5개 (net_cost 134,640원 ~ 137,610원)
main.py 형태(+예상 밖 force_refresh 인자까지) 호출 OK, 경로 10개
```

`main.py`는 그대로 두셔도 됩니다 — 이미 두 값을 보내고 있었으니 이제 정상적으로 받아집니다.

> **참고**: `engine/loader.py`(계산엔진용, `list_rows().to_dataframe()` 방식)와
> `common/bq_client.py`의 `fetch_all_benefits()`(파이프라인 테스트용, SQL 방식)는
> 같은 두 테이블을 읽는 별개의 코드입니다. API 서버는 `engine/loader.py`만 씁니다.
> `common/bq_client.py` 쪽 조회 함수는 크롤링 파이프라인을 테스트할 때 쓰시면 됩니다.

---

## 6. 다음 단계: 크롤러

`BaseCrawler`를 상속하고 `fetch_pages()` 하나만 구현하면 됩니다.
AI 정제·중복 제거·BigQuery 저장은 부모 클래스가 처리합니다.

```python
from crawlers.base import BaseCrawler, PageContent
from common.http_client import html_to_text

class OneStoreCrawler(BaseCrawler):
    source_name = "one_store"
    context_hint = "원스토어 이벤트 목록 페이지입니다."

    def fetch_pages(self):
        url = "https://실제-이벤트-URL"
        html = self.http.get(url)
        if html:
            yield PageContent(url=url, text=html_to_text(html, "div.event-list"))
```

크롤러를 만들려면 **크롤링 대상 실제 URL**이 필요합니다.
페이지 구조를 봐야 어느 영역을 뽑을지(위의 `div.event-list` 부분) 정확히 지정할 수 있습니다.

### 최종 디렉토리
'''
game-benefit-pipeline/
├── common/                     # 모든 크롤러가 공유하는 공통 모듈
│   ├── __init__.py
│   ├── config.py               # .env 로드, 프로젝트ID/데이터셋명 등 설정 관리
│   ├── schema.py               # BenefitInfo 데이터 모델(Pydantic) + 코드 체계 Enum
│   ├── ai_client.py            # Gemini(google-genai) 래퍼: 원문 텍스트 → 정형 JSON
│   ├── bq_client.py            # BigQuery 적재(MERGE 업서트) + 테이블 자동 생성
│   ├── http_client.py          # 재시도/타임아웃/User-Agent 포함 HTTP 요청기
│   ├── browser.py              # Playwright 래퍼 (JS 렌더링 필요한 사이트용)
│   ├── dedupe.py               # benefit_id 생성 규칙 + 내용 해시로 변경 감지
│   └── logger.py               # 통일된 로그 포맷
├── crawlers/
│   ├── base.py                 # BaseCrawler 추상 클래스 (모든 크롤러가 상속)
│   ├── one_store.py
│   ├── galaxy_store.py
│   ├── google_play.py
│   └── app_store.py
├── catalog/                    # Top50 게임 마스터 + 플랫폼 호환 매트릭스
│   ├── game_master.py
│   └── platform_matrix.py
├── scripts/
│   ├── test_gemini.py          # 공통 모듈 단위 테스트용
│   ├── test_bigquery.py
│   └── run_once.py             # 전체 파이프라인 1회 실행
├── data/samples/               # 샘플 jsonl 보관
├── .env.example
├── requirements.txt
└── README.md
'''

### 사용법
'''
전체 크롤러 실행 → GCS incoming/ 에 실제 업로드
python -m scripts.run_all

GCS에 안 올리고 결과만 미리 확인
python -m scripts.run_all --dry-run

로컬에도 눈으로 확인할 CSV를 남기고 싶으면 (GCS 업로드와 별개)
python -m scripts.run_all --local-csv
'''

