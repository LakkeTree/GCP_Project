# 호갱 탈출 — 모바일 게이머를 위한 실시간 최저가 네비게이션

모바일 게임 인앱결제에 적용 가능한 혜택(스토어·카드·간편결제·상품권·통신사)을 모아,
사용자 조건에 맞는 **최저 실부담금 결제 경로**를 계산해 보여주는 웹 서비스입니다.

- 스택: React + TypeScript / FastAPI (Cloud Run) / BigQuery + Cloud SQL(PostgreSQL) / Playwright + Gemini
- 데이터 수집: 5개 도메인, 스크래퍼 27개 ([card_data/](card_data/), [store_data/](store_data/), [epay_data/](epay_data/), [voucher_data/](voucher_data/), [telecom_data/](telecom_data/))
- 적재 파이프라인: Cloud Scheduler → Cloud Run Job / GCE VM → GCS → Cloud Function → BigQuery

## 결정과 근거

구현하면서 실제로 고민이 갈렸던 지점만 모았습니다. "무엇을 썼는가"보다 **"왜 그쪽을 택했는가"**에 초점을 맞췄습니다.

| # | 결정 | 한 줄 근거 |
|---|---|---|
| 1 | 테이블 전체 교체 대신 `source_file` 단위 scoped delete | 같은 테이블을 쓰는 다른 사람의 데이터를 지우지 않기 위해 |
| 2 | 실패한 CSV는 사유 로그와 함께 격리(quarantine) | 깨진 데이터가 BigQuery에 들어가는 것보다 적재 실패가 낫기 때문 |
| 3 | Cloud Function 배포 단위를 폴더 전체로 | 코드만 올리면 스키마 파일이 빠져서 전량 격리됨 |
| 4 | 트리거 경로 필터링을 코드에서 처리 | Eventarc GCS 트리거에 prefix 필터가 없음 |
| 5 | 사이트별 DOM 파서 대신 Gemini 구조화 추출 | 27개 사이트의 HTML 변경을 전부 따라갈 수 없음 |
| 6 | 봇 차단되는 6개만 headed VM으로 분리 | 전부 VM으로 돌리는 비용보다 예외만 떼는 쪽이 저렴함 |
| 7 | `benefit_id` 해시 재료에서 종료일 제외 | 이벤트 기간 연장을 새 혜택으로 오인하지 않기 위해 |
| 8 | 크롤링 로그를 스크래퍼 단위로 즉시 적재 | 프로세스가 중간에 죽어도 어디까지 됐는지 남아야 함 |
| 9 | enum 값은 원본을 베끼지 않고 계산 로직으로 재검증 | enum 하나가 "이 혜택을 누가 받을 수 있는가"를 결정함 |
| 10 | BigQuery와 PostgreSQL 역할 분리 | 분석용 조회와 운영용 트랜잭션의 요구가 다름 |
| 11 | 배포 인증은 서비스 계정 키 대신 WIF | 레포에 장기 크리덴셜을 두지 않기 위해 |
| 12 | DB 연결에 실패해도 서버는 뜨게 | DB 지연이 배포 실패로 번지지 않게 하기 위해 |

### 데이터 적재 — "잘못 들어가는 것보다 안 들어가는 게 낫다"

**1. 테이블 전체 교체 대신 `source_file` 단위 scoped delete**

새 CSV는 증분이 아니라 전체 교체본이라, 처음에는 `WRITE_TRUNCATE`로 테이블을 통째로 갈아끼우려 했습니다.
그런데 실제 `benefit_info` 테이블에는 같은 프로젝트의 다른 팀원이 직접 넣은 행들이 섞여 있었고,
테이블 전체를 truncate하면 그 데이터가 통째로 사라진다는 것을 적재 전에 발견했습니다.

그래서 **이번 CSV가 포함하는 `source_file` 값에 해당하는 행만 지우고 append하는 방식**으로 범위를 좁혔습니다
([bigquery/scripts/load_to_bigquery.py](bigquery/scripts/load_to_bigquery.py)).

```sql
DELETE FROM benefit_info WHERE source_file IN UNNEST(@source_files)
-- 이후 Load Job은 WRITE_APPEND
```

이 결정은 의도하지 않은 이득으로 돌아왔습니다. `source_file`을 카드사·스토어 단위로 쪼개 두었기 때문에
**스크래퍼 하나만 다시 돌려도 그 출처의 행만 안전하게 갱신**됩니다.
여러 도메인 결과를 한 CSV에 합쳐 올려도 scoped delete가 `source_file`마다 독립적으로 동작합니다.

**2. 실패한 CSV는 사유 로그와 함께 격리(quarantine)**

적재가 실패했을 때 재시도하거나 무시하는 대신, 파일을 `quarantine/`으로 옮기고
같은 이름의 `.reason.txt`에 실패 사유를 남기도록 했습니다 ([bigquery/main.py](bigquery/main.py)).
혜택 데이터는 금액 계산에 바로 쓰이므로, **부분적으로 깨진 데이터가 들어가는 것이 적재 실패보다 위험**하다고 판단했습니다.

이 경로를 실제로 테스트하다 버그를 하나 찾았습니다. 처음에는 `except ValueError`만 잡고 있었는데,
필수 컬럼이 **아예 없는** CSV는 `KeyError`를 던져서 격리도 못 하고 함수가 그냥 죽었습니다.
`except (ValueError, KeyError)`로 고치고 같은 CSV로 재검증했습니다.
성공 경로만 테스트했다면 끝까지 몰랐을 버그입니다.

**3. Cloud Function 배포 단위를 폴더 전체로**

처음엔 코드가 있는 `bigquery/scripts/`만 배포했습니다. 그런데 올라가는 CSV가 **전부 격리**됐습니다.
원인은 `scripts/` 바깥의 `schemas/*.json`이 배포 패키지에 포함되지 않아 런타임에 스키마를 못 찾은 것이었습니다.

`main.py`와 `requirements.txt`를 [bigquery/](bigquery/) 루트로 올리고 폴더 전체를 배포하는 쪽으로 바꿨습니다.
스키마 파일을 복사해 두는 방법도 있었지만, **코드와 스키마의 상대 경로를 하나로 유지하면
로컬 스크립트와 클라우드 함수가 같은 경로 로직으로 동작**하기 때문에 중복을 만들지 않는 쪽을 택했습니다.

**4. 트리거 경로 필터링을 코드에서 처리**

`incoming/`에 올라온 파일만 처리하고 싶었지만, **Eventarc의 GCS 트리거는 오브젝트 경로 접두사로 필터링할 수 없고
버킷 전체 단위로만 걸립니다.** 처리 후 파일을 `processed/`로 옮기는 동작 자체가 다시 트리거를 발생시키는 구조였습니다.

트리거를 쪼개거나 버킷을 분리하는 대신, 함수 진입부에서 `incoming/` 접두사가 아니면 즉시 반환하도록 했습니다.
재귀 트리거는 발생하지만 그 자리에서 끊기고, 버킷 하나로 전체 흐름(`incoming/` → `processed/` / `quarantine/`)이 유지됩니다.

### 데이터 수집 — 27개 사이트를 유지 가능한 수준으로

**5. 사이트별 DOM 파서 대신 Gemini 구조화 추출**

혜택은 카드사·스토어·간편결제·상품권·통신사 5개 도메인에 흩어져 있고, 표기 방식이 사이트마다 다릅니다.
사이트별 선택자를 하드코딩하면 스크래퍼 27개의 HTML 변경을 전부 따라가야 합니다.

그래서 **DOM 파싱은 "본문 텍스트를 긁는" 수준까지만 하고, 구조화는 Gemini에 맡겼습니다**
([card_data/common/ai_extract.py](card_data/common/ai_extract.py)).
다만 LLM 출력을 그대로 신뢰하지는 않았습니다. `response_schema`와 Pydantic Enum으로
`category`/`target_platform`/`benefit_type`은 **기존 데이터에서 실제로 관측된 값만** 허용하고,
모바일 게임 결제와 무관한 혜택은 빈 리스트를 반환하도록 했습니다.
덕분에 새 도메인을 붙일 때 공통 모듈을 건드리지 않고 `scrapers/`에 파일 하나만 추가하면 됩니다.

> 참고로 이 과정에서 `google-genai` SDK 버그([#1763](https://github.com/googleapis/python-genai/issues/1763))를 만났습니다.
> `genai.Client()`를 매 호출마다 새로 만들어 체이닝하면 요청 도중 내부 커넥션이 조기 종료됩니다.
> 모듈 전역 싱글턴으로 캐싱해 해결했습니다.

**6. 봇 차단되는 6개만 headed VM으로 분리**

Cloud Run Job으로 전체 크롤링을 돌렸더니 일부 사이트가 실패했습니다.
처음엔 렌더링 타이밍 문제로 보고 대기 시간을 늘렸지만, 로그를 보니 **차단 페이지가 반환되고 있었습니다** —
타이밍이 아니라 headless Chromium 탐지였습니다.

전체를 headed 환경으로 옮기는 대신, **차단되는 6개 스크래퍼만 Xvfb + headed GCE VM으로 떼어냈습니다**
([vm_crawl_entrypoint.py](vm_crawl_entrypoint.py)). 나머지는 그대로 Cloud Run Job에서 돌아갑니다.
두 경로가 같은 GCS 파일명을 쓰면 동시 업로드 시 서로를 덮어쓰기 때문에, VM 쪽은 `_vm` 접미사 파일명을 쓰도록 분리했습니다.

여기서 한 가지는 **포기하는 쪽으로 결정했습니다.** `samsung.com` 계열은 VM에서도 동일하게 실패했고,
Cloud Run이든 GCE든 Google 호스팅 ASN 자체를 차단하는 것으로 보였습니다.
우회를 더 시도하는 대신 기존 수집분을 `source_file='legacy_manual_db'`로 재태깅해 수동 관리 데이터로 남겼습니다.
**자동화가 안 되는 구간을 "자동화된 척" 두지 않는 것**이 더 안전하다고 봤습니다.

**7. `benefit_id` 해시 재료에서 종료일 제외**

크롤링 결과는 매주 다시 들어오므로 같은 혜택을 같은 ID로 식별해야 합니다.
ID를 혜택 내용 해시로 채번하면서, **종료일은 해시 재료에서 의도적으로 뺐습니다**
([card_data/common/normalize.py](card_data/common/normalize.py)).
종료일을 넣으면 **이벤트 기간이 연장될 때마다 같은 혜택이 새 ID로 중복 생성**되기 때문입니다.

**8. 크롤링 로그를 스크래퍼 단위로 즉시 적재**

운영 중에 가장 알고 싶은 것은 "어제 크롤링이 다 돌았는가"입니다.
전체 실행이 끝난 뒤 한 번에 로그를 쓰면, Playwright 브라우저가 중간에 크래시할 때 아무 기록도 남지 않습니다.
그래서 **스크래퍼 하나가 끝날 때마다 즉시 한 행씩** `crawl_log`에 적재합니다
([card_data/common/crawl_log.py](card_data/common/crawl_log.py)).

같은 모듈에서 두 가지를 더 챙겼습니다.

- **로그 적재 실패가 크롤링을 깨지 않습니다.** 로그는 부가 기능이므로 실패 시 경고만 출력하고 수집 결과를 그대로 반환합니다.
- **`run_id`는 KST 기준 날짜입니다.** 5개 도메인이 각자 독립된 Cloud Run Job으로 실행되는데,
  날짜를 run_id로 쓰면 **오케스트레이터 없이도 같은 날 실행분이 자동으로 한 배치로 묶입니다.**
  `trigger_source`로 스케줄 실행과 수동 테스트 실행을 구분해 관리자 대시보드에서 분리해 봅니다.

### 계산 엔진과 운영

**9. enum 값은 원본을 베끼지 않고 계산 로직으로 재검증**

통신사 크롤러를 다른 브랜치에서 포팅할 때, 원본은 통신사 제휴 혜택에 `stacking_layer=STORE_COUPON`을 쓰고 있었습니다.
그대로 가져오려다 [game-pay-api/engine/calculator.py](game-pay-api/engine/calculator.py)의 `filter_eligible_benefits()`를 직접 읽어봤는데,
`STORE_COUPON`이면서 제공처가 스토어 목록에 없으면 **보유 결제수단 검사를 건너뛰고 무조건 통과시키는 분기**가 있었습니다.
"스토어 자체 쿠폰"을 위해 만든 분기였기 때문에, 여기에 통신사명을 넣으면
**그 사용자가 실제로 해당 통신사 가입자인지 전혀 확인하지 않고 혜택을 추천**하게 됩니다.

`stacking_layer=PAYMENT_PG`로 바꿔 보유 결제수단에 통신사가 있어야만 통과하는 분기를 타도록 수정했습니다.
`stacking_layer`/`category` 같은 필드는 **표기가 아니라 계산 엔진이 문자열로 비교하는 실행 파라미터**라서,
이후로는 새 도메인을 추가할 때 해당 값이 계산 로직에서 어떻게 쓰이는지 먼저 확인한 다음 정하는 것을 규칙으로 삼았습니다.

**10. BigQuery와 PostgreSQL 역할 분리**

혜택 데이터는 주기적으로 대량 교체되고 전량 스캔·집계 위주로 읽히므로 BigQuery에,
사용자 계정과 활동 로그는 건당 읽기/쓰기와 트랜잭션이 필요하므로 Cloud SQL(PostgreSQL)에 두었습니다.
대신 API가 요청마다 BigQuery를 조회하면 비용과 지연이 붙으므로,
[game-pay-api/engine/loader.py](game-pay-api/engine/loader.py)에서 혜택 데이터를 **10분 TTL로 프로세스 내 캐싱**합니다
(`BQ_CACHE_TTL_SECONDS`로 조정 가능, `force_refresh`로 우회 가능).

**11. 배포 인증은 서비스 계정 키 대신 WIF**

GitHub Actions에서 Cloud Run으로 배포하면서 서비스 계정 키 JSON을 secret으로 넣는 방식을 쓰지 않았습니다.
**Workload Identity Federation**으로 OIDC 토큰을 교환해 인증하므로, 레포와 CI에 **만료되지 않는 크리덴셜이 남지 않습니다**
([.github/workflows/deploy-backend.yml](.github/workflows/deploy-backend.yml)).
DB 비밀번호와 Gemini 키도 환경변수 대신 Secret Manager에서 주입합니다.

**12. DB 연결에 실패해도 서버는 뜨게**

초기에는 시작 시점에 `Base.metadata.create_all()`을 그냥 호출했는데,
Cloud SQL 연결이 늦으면 **컨테이너가 기동 중에 죽어서 Cloud Run 배포 자체가 실패**했습니다.
이 호출을 try/except로 감싸 경고만 남기고 포트를 먼저 열도록 바꿨습니다 ([game-pay-api/main.py](game-pay-api/main.py)).
DB 연결은 실제 요청 처리 시점에 다시 시도되므로, **일시적인 DB 지연이 배포 실패로 번지지 않습니다.**


## 알고 있는 한계

결정만 적어 두면 안 풀린 문제가 가려지므로, 현재 알고 있는 한계도 같이 남깁니다.

**데이터**

- 갤럭시스토어처럼 **플랫폼 자체에 게임별 이벤트 공식 데이터가 없는** 스토어가 있습니다. 공식 블로그·SNS를 수집 대상에 추가하는 방향으로 보완하려 합니다.
- `samsung.com` 계열(간편결제·스토어 등급)은 Google 호스팅 IP 차단으로 자동 수집이 불가해, `source_file='legacy_manual_db'`로 **수동 관리 중**입니다 (결정 #6 참고).
- SKT 이벤트 게시판은 기술적으로 막힌 것이 아니라, 결제 기간이 좁은 일회성 이벤트가 많아 **"지금도 유효한 혜택인가"를 안정적으로 판단할 방법이 없어** 의도적으로 스코프에서 제외했습니다. 재시도할 경우 쓸 수 있는 목록 API와 상세 URL 패턴은 조사해 기록해 두었습니다.
- 혜택 조건은 사람이 읽는 자연어 원문이라, 정규식과 키워드 매칭으로 구조화합니다. 사이트가 **표현 방식을 바꾸면 조건을 놓칠 수 있습니다.**

**미구현**

- 게임 목록 수집 파이프라인 — 주기적으로 변동되는 게임 목록은 아직 수동입니다. 혜택 데이터와 같은 구조로 만들면 될 것으로 봅니다.
- 재방문·체류를 유도하는 BM 요소

## 관리자 대시보드 실행 방법

`/admin` 페이지에서 총 가입자 수, 활성 사용자 수(DAU/WAU/MAU), 유저별 선호 게임 랭킹을 확인할 수 있습니다. 로컬에서 확인하려면 아래 순서대로 진행하세요. (변경 내역은 `ADMIN_DASHBOARD_CHANGES.md` 참고)

### 1. 준비물

- `game-pay-api/`에서 실행 가능한 Python 가상환경 + `pip install -r requirements.txt`
- 루트 `.env`에 `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`(Cloud SQL), `GOOGLE_CLIENT_ID` 설정
- Cloud SQL 인스턴스에 접속 가능한 네트워크 (GCP 콘솔 → SQL → 연결 → 승인된 네트워크에 현재 공인 IP 등록, 또는 Cloud SQL Auth Proxy 사용)
- BigQuery/GCS 접근용 GCP 인증: `gcloud auth application-default login` 1회 실행 (또는 `.env`의 `GOOGLE_APPLICATION_CREDENTIALS`에 서비스 계정 키 지정)

### 2. DB 마이그레이션 (최초 1회)

```bash
cd game-pay-api
python migrate_admin_dashboard.py
```
`users.last_login_at` 컬럼과 `user_game_activity_logs` 테이블을 생성합니다. Cloud SQL 접속이 안 되면 타임아웃 에러가 나니, 위 "승인된 네트워크"/Proxy 설정부터 확인하세요.

### 3. 서버 실행

```bash
# 백엔드
cd game-pay-api
uvicorn main:app --reload --port 8000

# 프론트 (새 터미널)
cd fe-app
npm run dev
```
프론트가 `http://localhost:5173`가 아닌 다른 포트로 뜨면(포트 충돌 시 자동으로 바뀜), Google Cloud Console의 OAuth 클라이언트 ID 설정에서 "승인된 JavaScript 원본"에 그 포트를 추가해야 구글 로그인이 됩니다.

### 4. 로그인 및 관리자 권한 부여

1. 프론트에서 구글 로그인 1회 (계정이 `users` 테이블에 자동 생성됨)
2. `game-pay-api/`에서 해당 계정을 관리자로 승격:
   ```bash
   python -c "
   from database import SessionLocal
   from models import UserModel
   db = SessionLocal()
   u = db.query(UserModel).filter(UserModel.email=='본인이메일@gmail.com').first()
   u.role = 'ROLE_ADMIN'
   db.commit()
   print('done:', u.user_id, u.role)
   "
   ```
   (셀프서비스 승격 API는 권한 상승 방지를 위해 의도적으로 제공하지 않습니다)
3. 브라우저에서 로그아웃 후 재로그인 (권한 변경을 반영한 새 토큰을 받기 위함)

### 5. 데이터 쌓고 확인

로그인한 상태로 게임 검색 몇 번, `/search-result`에서 최저가 계산 1~2번 실행하면 `user_game_activity_logs`에 기록이 쌓입니다. 이후 `http://localhost:5173/admin` 접속 시:

- 총 가입자 수 / DAU / WAU / MAU 카드
- 유저별 가입일 / 최근 로그인 / 활성 여부(7일) / 선호 게임 Top3 랭킹 테이블

이 보이면 정상입니다. "관리자 권한이 필요합니다"가 뜨면 4번 단계(권한 부여 + 재로그인)를 확인하세요.

### 참고: Google ID 토큰 만료

구글 로그인 토큰은 발급 후 약 1시간 뒤 만료됩니다. 오래 켜둔 세션에서 API가 갑자기 401을 내면 로그아웃 후 재로그인하면 됩니다.
