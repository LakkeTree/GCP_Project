# 소프트웨어 요구사항 명세서 (SRS) — 최종본

모바일 게임 결제 혜택 통합 비교 및 최적 결제경로 추천 서비스

문서 버전: v1.0 (Final) | 작성일: 2026-08-19
기준 문서: 최종 PRD v1.0, 2차 SRS(v0.2), GCP_Project 저장소 코드 감사(2026-08-19, `game-pay-api`, `fe-app`, `game-benefit-pipeline` 전수 조사)

**개정 노트 (2차 SRS v0.2 → 최종 v1.0)**: 저장소 구조 변경(백엔드가 `game-pay-api/` 하나로 통합, 루트/`bigquery/`/`mobile_game_data/`의 동명 파일은 별개 스크립트임을 명시)을 반영했다. `database.py`가 SQLite에서 PostgreSQL(Cloud SQL)로 전환된 것을 확인해 SR-10, NFR-7을 갱신했다. 관리자 대시보드(유저 모니터링) 관련 API(`GET /admin/stats/summary`, `GET /admin/users`)가 신규 구현되어 SR-16을 전면 재작성했다. 계산 로직 검증(SR-18), 데이터 모니터링(SR-19), 게임 파이프라인 자동화(SR-20), 배포(SR-21) 4개 절을 신규 추가했다. NFR-11~14 보안 항목은 여전히 미해결로 재확인되어 "배포 게이트"로 격상했다.

---

## 1. 서론

### 1.1 목적

본 문서는 최종 PRD(v1.0)에서 정의한 요구사항을, 실제 시스템(`game-pay-api` FastAPI 백엔드, `fe-app` React 프론트엔드, 5개 도메인 크롤러 + `game-benefit-pipeline`, PostgreSQL(Cloud SQL) + BigQuery 데이터 계층, Cloud Run 배포 대상)이 무엇을 어떻게 만족해야 하는지 기술 수준의 요구사항으로 구체화한다.

### 1.2 범위

본 SRS는 2차 SRS가 다룬 신규 기능(PRD FR-9~FR-15)과 기존 핵심 로직(1차 PRD FR-1~FR-8)에 더해, 최종 라운드 신규 기능(PRD FR-16~FR-19)을 포함한다.

다음은 범위에서 제외한다: 유료 결제/구독 BM, 다국어 지원, 전체 게임 확장, Cloud Scheduler 기반의 완전 자동(정기) 크롤링 트리거, `impression_log` 기반 CTR(%) 산출.

### 1.3 용어 정의

2차 SRS 1.3절의 용어를 그대로 유지하며, 다음을 추가한다.

| 용어 | 정의 |
| :---- | :---- |
| 데이터 모니터링 | 크롤링·파이프라인의 성공/실패, 최근 수집 시각을 관리자가 확인하는 기능 |
| 크롤링 로그(crawl_status_log) | 도메인별 파이프라인 실행 이력을 기록하는 테이블 |
| Go-Live Blocker | 기능 완성도와 무관하게 실배포 이전 반드시 해소해야 하는 보안·안정성 결함 |

### 1.4 참조 문서

* 최종 PRD v1.0 (2026-08-19)
* 2차 프로토타입 SRS v0.2 (2026-08-18)
* 1차 프로토타입 PRD/SRS
* GCP_Project 저장소 코드 감사 보고서(2026-08-19)

---

## 2. 전체 설명

### 2.1 시스템 조망 (최종 아키텍처)

```
[1] 5개 도메인 크롤러                    [1'] 게임 목록 파이프라인
card_data / store_data / epay_data /      game-benefit-pipeline/catalog
voucher_data / telecom_data               (rankings → normalize → compatibility
(21개 스크레이퍼, Playwright+Gemini)        → build_game_matrix)
        │ GCS 업로드 → Cloud Function        │ ★최종 라운드: BigQuery 자동 업서트 추가(SR-20)
        │ → BigQuery 자동 반영                │
        ▼                                    ▼
              BigQuery (asia-northeast3)
   benefit_info · platform_connection · game_info
   (+ 신규 예정: crawl_status_log는 BigQuery가 아닌 PostgreSQL에 둠, 2.5절 참조)
                        │ 읽기 전용
                        ▼
        game-pay-api (FastAPI, gunicorn+uvicorn, Cloud Run 배포 대상)
   engine/loader.py      : BigQuery 캐시 로딩(10분 TTL)
   engine/calculator.py  : 혜택 필터링·중복 적용·경로 계산 (★ route_id 발급, SR-18)
   auth.py                : Google OAuth 검증 + 관리자 권한(require_admin)
   database.py (PostgreSQL / Cloud SQL, SQLAlchemy) :
        users, user_game_activity_logs, game_request_logs,
        outbound_click_logs, crawl_status_log(신규)
                        │
                        ▼
        fe-app (React + TypeScript, Vite, Cloud Run/정적 호스팅 배포 대상)
   일반 사용자 3단계 플로우 + AdminDashboardPage(/admin, 유저+데이터 모니터링)
```

### 2.2 배포 현황 (최종)

| 구성 요소 | 2차 SRS(2026-08-18) 상태 | **최종 상태(2026-08-19 착수 시점)** | 최종 목표 |
| :---- | :---- | :---- | :---- |
| GCS/Cloud Function/BigQuery | 실제 GCP 배포 완료 | 동일 | 유지 |
| game-pay-api | 로컬 uvicorn만 | 로컬 gunicorn+uvicorn(2 워커)만, Dockerfile 존재 | **Cloud Run 배포**(SR-21) |
| fe-app | 로컬 Vite dev만 | 동일, `API_BASE` 하드코딩(`127.0.0.1:8000`) | **정적/Cloud Run 배포 + 빌드타임 환경변수화**(SR-21) |
| 사용자 저장소 | SQLite(WAL) | **PostgreSQL(Cloud SQL) 전환 완료** | 유지, SQLite 잔재 파일 정리(비필수) |

### 2.3 사용자 클래스

2차 SRS 2.3절의 비회원/회원 정의를 유지하며, 관리자 클래스를 아래와 같이 구체화한다.

* **관리자(Admin)**: `users.role = 'ROLE_ADMIN'`인 사용자. Google OAuth 로그인 후 `require_admin` 의존성 검사를 통과해야 `/admin/*` API에 접근 가능(auth.py:148-157). 유저 모니터링(가입자/DAU/WAU/MAU, 유저 목록)은 구현 완료. 데이터 모니터링(크롤링 상태)은 최종 라운드 신규 구현(SR-19).

### 2.4 운영 환경

2차 SRS 2.4절과 동일하되, 데이터 계층을 다음과 같이 갱신한다.
* 사용자/로그 데이터: **PostgreSQL(Cloud SQL, `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD` 환경변수 필수)**. SQLite 폴백 없음(`database.py`가 필수값 미설정 시 기동 실패하도록 구현).
* 배포: Cloud Run(백엔드), 정적 호스팅 또는 Cloud Run(프론트).

### 2.5 설계·구현 제약

* BigQuery는 SQL JOIN 없이 애플리케이션 레이어에서 필터링하는 구조를 유지한다(loader.py). 이는 데이터 규모가 수백~수천 행일 때만 유효하며, 게임 목록 자동화(SR-20)로 행 수가 급증할 경우 재검토가 필요하다.
* `crawl_status_log`는 BigQuery가 아닌 **PostgreSQL(Cloud SQL)**에 둔다. 크롤링 이력은 트랜잭션성 쓰기가 빈번하고 관리자 대시보드가 실시간에 가깝게 조회해야 하므로, 이미 애플리케이션이 사용 중인 관계형 DB에 두는 것이 BigQuery 스트리밍 삽입 비용/지연보다 합리적이다.
* `game-benefit-pipeline/catalog`와 `mobile_game_data/`가 유사 목적의 파이프라인으로 공존한다. 최종본은 전자를 공식 파이프라인으로 채택하며, 후자는 참조하지 않는다(PRD §10).

### 2.6 가정과 의존성

2차 SRS 2.6절의 가정(GCP 프로젝트 `positive-tuner-504502-m5`, Gemini API, `GOOGLE_CLIENT_ID` 등)을 유지한다. 다음을 추가한다.
* Cloud SQL 인스턴스(현재 `.env`의 `DB_HOST` 공인 IP)가 배포 환경에서도 동일하게 접근 가능해야 한다. Cloud Run에서는 Cloud SQL Auth Proxy 또는 Private IP 연결 방식 채택을 전제한다.
* 배포 환경변수(`DEBUG=False` 포함)가 CI/CD 또는 Cloud Run 서비스 설정에 올바르게 주입된다고 가정한다.

---

## 3. 외부 인터페이스 요구사항

### 3.1 사용자 인터페이스

2차 SRS 3.1절과 동일. 관리자 화면은 `AdminDashboardPage.tsx`(295줄, `/admin` 라우트)로 이미 구현되어 있으며, 최종 라운드에서 "데이터 모니터링" 탭이 추가된다(SR-19).

### 3.2 API 인터페이스 (최종 갱신)

2차 SRS 3.2절의 엔드포인트 목록에 다음을 추가/갱신한다.

| 메소드 | 경로 | 인증 | 목적 | 상태 |
| :-- | :---- | :---- | :---- | :---- |
| GET | /admin/stats/summary | 관리자 | 총 가입자/DAU/WAU/MAU | **구현됨**(main.py:510-535) |
| GET | /admin/users | 관리자 | 가입일·최근 로그인·활성여부·선호게임 Top3, 페이지네이션 | **구현됨**(main.py:538-609) |
| GET | /admin/data-status | 관리자 | 도메인별 크롤링 상태·최근 수집 시각·건수 | **신규 요구사항**(SR-19) |
| POST | /routes | 불필요 | 핵심 계산. **응답에 `route_id` 필드 추가 필요**(현재 부재) | **부분구현 → 최종 필수 보완**(SR-18) |
| POST | /events/outbound-click | 선택(비회원 허용) | 클릭 로그 적재. `route_id` 필수 파라미터 수신 | 백엔드 구현됨, `route_id` 발급원이 없어 계약 미완성 → SR-18 |

**POST /routes 최종 응답 스키마 변경(안)**

```json
{
  "routes": [
    {
      "route_id": "r_9f1c2a...",
      "route_type": "DIRECT_PAYMENT",
      "base_amount": 50000,
      "steps": [ ... ],
      "final_paid_amount": 45000,
      "...": "..."
    }
  ],
  "warnings": []
}
```

`route_id`는 요청 파라미터(게임/금액/보유수단 조합)와 계산 결과(step 조합)를 결합한 해시 또는 UUID로 서버에서 생성하며, 동일 요청·동일 결과에 대해 매 호출마다 새로 발급해도 무방하다(클릭 시점까지만 유효하면 됨). 영속적 재현성이 필요하지 않으므로 DB 저장 없이 계산 시점에 생성한다.

**GET /admin/data-status 응답(안)**

```json
{
  "status": "ok",
  "data": [
    {
      "domain": "CARD",
      "last_run_at": "2026-08-19T02:00:00+09:00",
      "last_status": "SUCCESS",
      "record_count": 41,
      "is_stale": false
    }
  ]
}
```

### 3.3 데이터베이스 인터페이스

BigQuery 3테이블(`benefit_info`, `platform_connection`, `game_info`) 구조는 2차 SRS 3.3절과 동일. PostgreSQL(Cloud SQL) 테이블은 다음과 같이 갱신한다.

| 테이블 | 용도 | 최종 상태 |
| :---- | :---- | :---- |
| users | 회원 프로필, `role` 컬럼(기본 ROLE_USER) | 구현됨, PostgreSQL 전환 완료 |
| user_game_activity_logs | 유저 검색/계산 요청 활동 로그(SEARCH/ROUTE_CALC) | 구현됨, 관리자 대시보드가 소비 |
| game_request_logs | 게임 추가 요청 로그 | 구현됨(백엔드), 프론트 미연동(FR-12) |
| outbound_click_logs | 클릭 로그 | 구현됨(백엔드), route_id 계약 보완 필요(SR-18) |
| **crawl_status_log** (신규) | 크롤링/파이프라인 실행 이력 | **최종 라운드 신규 구현**(SR-19, SR-20) |

---

## 4. 시스템 기능 요구사항

*기존 SR-9~SR-17은 2차 SRS와 동일 번호를 유지하며, 코드 감사로 확인된 최신 상태만 갱신한다. SR-18~SR-21은 신규.*

### SR-9. 로컬 임시 저장 (변경 없음, 여전히 미해결)

SR-9.1~9.4는 2차 SRS와 동일하게 유지된다. **SR-9.3(Opt-in 동의 UI)는 여전히 미구현**이며 최종 라운드 필수 완료 항목이다. SR-9.5(로그인 시 로컬↔서버 병합 확인)도 미구현 상태 유지.

### SR-10. 계정 기반 프로필 저장 (★ 저장소 변경)

SR-10.1~10.5는 2차 SRS와 동일하되, 다음을 갱신한다.
* **SR-10.6(신규)**: 시스템은 사용자 프로필·로그 데이터를 PostgreSQL(Cloud SQL)에 저장해야 하며, 다중 프로세스/다중 리비전(Cloud Run 오토스케일링) 환경에서도 동시 쓰기 충돌 없이 동작해야 한다. `[구현: database.py, SQLAlchemy + PostgreSQL]`
* SR-10.2의 개발용 인증 우회 이슈는 해소되지 않았다: `auth.py`에 `IS_DEBUG` 가드가 추가되어 `DEBUG=False`일 때는 401을 반환하도록 코드가 개선되었으나, **현재 `.env`의 `DEBUG=True` 값 자체가 위험**하다. 이는 코드 결함이 아니라 배포 설정 문제이므로 NFR-12(§6.2)와 SR-21(배포)에서 다룬다.

### SR-11. Dual-Track 추천 (★ 최종 확정)

* SR-11.1, SR-11.2는 2차 SRS와 동일하되, "탭 UI"가 아닌 **"기본 통합 최적가 카드 + 플랫폼 선택 시 모달 비교"** 구조로 최종 확정한다. `[구현: SearchResultPage.tsx]`
* SR-11.3(플랫폼 이동 필요성 명시)은 미구현 상태 유지, 최종 라운드 선택 과제(P2)로 분류한다.

### SR-12. 게임 확장 및 추가 요청

SR-12.1(구현됨), SR-12.2(미구현 → **최종 라운드 필수**), SR-12.3(백엔드 구현됨, 프론트 미연동 → **최종 라운드 필수**)은 2차 SRS와 동일하게 유지하되, 완료 목표를 이번 라운드로 명시한다.

### SR-13. 아웃바운드 클릭 트래킹 (★ API 계약 보완)

* SR-13.1: 시스템은 `[구매하기]` 클릭 시 클릭 시각·선택된 `route_id`·절약 금액을 로그에 적재해야 한다. **`route_id`는 SR-18에서 `POST /routes` 응답에 신규 포함되는 값을 그대로 사용한다.**
* SR-13.2, SR-13.3은 2차 SRS와 동일(1,000ms 이내 비동기 전송, CTR 별도 집계는 보류).
* 최종 라운드는 프론트엔드 연동(클릭 이벤트 → API 호출)까지 완료해야 SR-13이 충족된 것으로 간주한다.

### SR-14. 자동 크롤러 및 실시간 상태 표기

* SR-14.1(구현됨), SR-14.2(자동 스케줄링 미구현, 3차 과제로 재확인 — 이번 라운드는 범위 밖), SR-14.3(부분구현)은 2차 SRS와 동일.
* **SR-14.4(신규)**: 게임 목록 파이프라인(`game-benefit-pipeline/catalog`)은 결제수단 크롤러와 동일하게 실행 결과를 BigQuery `game_info`에 자동 업서트해야 한다. `[요구사항, SR-20과 연계]`

### SR-15. 표준 UI 컴포넌트 (변경 없음, 구현됨)

### SR-16. 관리자 기능 (★ 전면 재작성 — 대부분 구현됨으로 확인)

2차 SRS는 SR-16을 "미구현"으로 기술했으나, 코드 감사 결과 유저 모니터링은 이미 구현되어 있다.

* **SR-16.1 (갱신, 구현됨)**: 시스템은 관리자가 총 가입자 수, DAU/WAU/MAU를 조회할 수 있는 인터페이스를 제공해야 한다. `[구현: GET /admin/stats/summary, main.py:510-535]`
* **SR-16.2 (갱신, 구현됨)**: 시스템은 관리자가 유저 목록(가입일, 최근 로그인, 활성 여부, 선호 게임 Top3)을 페이지네이션으로 조회할 수 있어야 한다. `[구현: GET /admin/users, main.py:538-609]`
* **SR-16.3 (구현됨, 유지)**: 관리자 권한은 `users.role = ROLE_ADMIN` 여부로 인가한다. `[구현: require_admin, auth.py:148-157]`
* **SR-16.4 (신규, 미구현 → 최종 필수)**: 시스템은 관리자가 게임 요청 로그(`game_request_logs`) 건수를 조회할 수 있는 인터페이스를 제공해야 한다. (2차 SR-16.1이 의도했던 기능이나 `GET /ranks`는 목적이 다르므로 별도 API로 신설)
* **SR-16.5 (2차 SR-16.2 대응, 미구현)**: `review_status` 컬럼 자체가 아직 `benefit_info` 스키마에 존재하지 않으므로, 승인/반려 인터페이스 논의는 시기상조다. 3차 과제로 이관.

### SR-17. 오류/예외 처리 요구사항 (변경 없음, 대부분 미해결)

2차 SRS의 SR-17.1~17.7은 코드 감사 결과 동일하게 미해결 상태다. 이 중 **SR-17.4(서버 예외 원문 노출)**는 §6.2 NFR-14와 함께 **배포 게이트**로 격상한다. 나머지(SR-17.1, 17.2, 17.3, 17.5, 17.6, 17.7)는 최종 라운드 P2로, 시간이 허용하는 범위에서 처리한다.

### SR-18. 계산 로직 검증 및 결과 추적 (신규, PRD FR-16 대응)

* SR-18.1 시스템은 `POST /routes`가 반환하는 모든 route 객체에 고유한 `route_id`(문자열)를 부여해야 한다. `[요구사항, engine/calculator.py의 recommend_best_routes() 반환값 확장]`
* SR-18.2 시스템은 사전 정의된 10~20개 대조 시나리오(게임×금액×보유 결제수단 조합)에 대해 자동화된 테스트를 통해 계산 결과가 수기 계산 기준값과 100% 일치함을 검증할 수 있어야 한다. `[요구사항, pytest 기반 신규 테스트 스위트]`
* SR-18.3 QA는 대표 시나리오 1건 이상에 대해 실제 외부 결제 페이지로 이동하여 표시된 할인 조건이 계산 결과와 일치하는지 수동으로 확인하고 그 결과를 기록해야 한다. `[수동 QA 절차, 자동화 대상 아님]`

### SR-19. 관리자 데이터 모니터링 (신규, PRD FR-17 대응)

* SR-19.1 시스템은 도메인(card/store/epay/voucher/telecom/game)별 최근 크롤링 실행 시각, 성공/실패 여부, 수집 건수를 `crawl_status_log`에 기록해야 한다.
* SR-19.2 시스템은 관리자에게 `GET /admin/data-status`를 통해 위 정보를 제공해야 한다.
* SR-19.3 시스템은 마지막 성공 시각 기준 24시간을 초과한 도메인을 `is_stale=true`로 표시해야 하며, 관리자 대시보드는 이를 시각적으로 구분해야 한다.

### SR-20. 게임 목록 자동 수집·반영 파이프라인 (신규, PRD FR-18 대응)

* SR-20.1 시스템(`game-benefit-pipeline/catalog/build_game_matrix.py`)은 CSV 파일 저장에 더해, 결제수단 크롤러(`common/bq_client.py`)와 동일한 방식으로 BigQuery `game_info`에 자동 MERGE 업서트를 수행해야 한다.
* SR-20.2 시스템은 파이프라인 실행 시작/종료 시각, 성공/실패, 반영 건수를 `crawl_status_log`(domain=GAME)에 기록해야 한다(SR-19와 연계).
* SR-20.3 신뢰도가 검증되지 않은 필드(예: 갤럭시스토어 지원 여부)는 `null` 또는 별도 플래그로 저장해야 하며, `GET /games` 응답에서 이를 구분해 노출해야 한다.

### SR-21. 프로덕션 배포 (신규, PRD FR-19 대응)

* SR-21.1 `game-pay-api`는 기존 `Dockerfile`(gunicorn+uvicorn, `$PORT` 사용)을 기반으로 Cloud Run 서비스로 배포되어야 한다.
* SR-21.2 배포 시 환경변수 `DEBUG`는 반드시 `False`로 설정되어야 하며, Cloud SQL 접속 정보(`DB_HOST` 등)는 Cloud Run 배포 환경에서도 유효해야 한다(Cloud SQL Auth Proxy 또는 Private IP 연결 전제).
* SR-21.3 `fe-app`은 빌드 시점에 `API_BASE`를 배포된 백엔드 URL로 주입하여 정적 호스팅 또는 Cloud Run으로 배포되어야 한다.
* SR-21.4 배포는 §6.2에 정의된 NFR-11~14(CORS, 인증 우회, 예외 노출, Rate Limiting)가 모두 해소된 이후에만 수행되어야 한다.

---

## 5. 데이터 요구사항

### 5.1 crawl_status_log 스키마 (신규, PostgreSQL)

| 필드 | 타입 | 설명 |
| :---- | :---- | :---- |
| id | SERIAL (PK) | |
| domain | VARCHAR | CARD / STORE / EPAY / VOUCHER / TELECOM / GAME |
| started_at | TIMESTAMPTZ | 실행 시작 |
| finished_at | TIMESTAMPTZ (nullable) | 실행 종료(미완료 시 NULL) |
| status | VARCHAR | SUCCESS / FAILED / PARTIAL / RUNNING |
| record_count | INTEGER | 수집/반영 건수 |
| error_message | TEXT (nullable) | 실패 요약(원문은 별도 로그 파일 참조) |

### 5.2 benefit_info / game_info (기존 유지, 갱신 사항만)

`review_status` 컬럼은 2차 SRS가 도입을 제안했으나 코드 감사 결과 **아직 스키마에 존재하지 않는다**. 이번 라운드에서는 도입하지 않으며, SR-16.5와 함께 3차 과제로 명시적으로 이관한다.

### 5.3 데이터 무결성 원칙 (변경 없음)

2차 SRS 5.3절의 원칙(benefit_id 전역 유일, PII 미저장)을 유지한다.

---

## 6. 비기능 요구사항

### 6.1 성능

NFR-1(`POST /routes` P95 3초 이내)은 유지한다. NFR-2, NFR-3(BigQuery 캐시, 클라이언트 재사용)도 구현 상태 유지. **NFR-1의 실측은 Cloud Run 배포(SR-21) 이후에만 의미가 있으므로, 배포 완료 후 1회 이상 부하 시나리오로 측정하여 기록한다.**

### 6.2 보안 (★ 배포 게이트로 격상)

| ID | 내용 | 현재 상태 | 최종 처리 |
| :-- | :---- | :---- | :---- |
| NFR-4 | PII 미수집·미저장 | 유지 | 변화 없음 |
| NFR-5 | 최소 권한 OAuth 스코프 | 유지 | 변화 없음 |
| NFR-6 | SQL 인젝션 방지(파라미터 바인딩) | 유지 | 변화 없음 |
| **NFR-11** | CORS 명시적 화이트리스트 | **미해결** — `main.py:39-45`, `allow_origins=["*"]`+`allow_credentials=True` 동시 사용 그대로 | **배포 전 필수 수정**(SR-21.4) |
| **NFR-12** | 인증 우회 경로 제거 | **부분 개선, 실질 미해결** — `auth.py`에 `IS_DEBUG` 가드 추가로 코드는 개선되었으나 `.env`의 `DEBUG=True`가 유지되는 한 우회 활성 | **배포 환경변수 `DEBUG=False` 강제**(SR-21.2), 배포 파이프라인에서 자동 검증 |
| **NFR-13** | Rate Limiting | **미구현** — `requirements.txt`에 관련 미들웨어 없음 | 미인증 엔드포인트(`/games/request`, `/games/search-log`)에 최소 구현 |
| **NFR-14** | 서버 예외 원문 비노출 | **미해결** — `main.py`의 다수 엔드포인트가 `detail=f"...{str(e)}"` 패턴 사용 | 클라이언트 응답 일반화, 서버 로그로 상세 분리 |

**최종 결론**: NFR-11~14 4개 항목은 이번 라운드의 다른 모든 기능 요구사항(SR-18~21)과 별개로, **Cloud Run 배포(SR-21.4) 이전에 반드시 해소되어야 하는 선행 조건**이다.

### 6.3 신뢰성 / 가용성 (★ 갱신)

* **NFR-7 (갱신)**: 시스템은 PostgreSQL(Cloud SQL)을 사용해야 하며, Cloud Run의 다중 리비전/오토스케일링 환경에서도 동시 쓰기 충돌 없이 동작해야 한다. `[구현: database.py가 SQLite 폴백 없이 PostgreSQL만 지원하도록 전환됨]` — 2차 SRS가 지적했던 "SQLite 다중 프로세스 쓰기 취약점"은 **해소됨**.
* NFR-8(크롤링 실패 격리)은 유지, 게임 파이프라인에도 동일 원칙 적용(SR-20.2).

### 6.4 유지보수성

NFR-9, NFR-10은 유지. `game-benefit-pipeline`과 `mobile_game_data`의 중복은 유지보수성 저해 요인으로 §2.5에 기록했으며, 실제 코드 정리는 3차 과제다.

---

## 7. 추적성 매트릭스 (최종)

| PRD FR | SRS 요구사항 | 구현 위치 | 최종 상태 |
| :---- | :---- | :---- | :---- |
| FR-9 | SR-9.1~9.5 | fe-app hooks/pages | 부분구현, Opt-in UI 최종 라운드 필수 |
| FR-10 | SR-10.1~10.6 | auth.py, database.py | 구현됨(PostgreSQL 전환 완료), DEBUG 설정 배포 게이트 |
| FR-11 | SR-11.1~11.3 | SearchResultPage.tsx | 모달 UI로 최종 확정 |
| FR-12 | SR-12.1~12.3 | main.py, models.py | 백엔드 구현, 프론트 연동 최종 라운드 필수 |
| FR-13 | SR-13.1~13.3 | main.py, models.py | 백엔드 구현, route_id(SR-18) 이후 프론트 연동 필수 |
| FR-14 | SR-14.1~14.4 | card_data 등, game-benefit-pipeline | 결제수단 완료, 게임(SR-20) 최종 라운드 목표 |
| FR-15 | SR-15.1~15.2 | fe-app 전반 | 구현됨 |
| FR-16 | SR-18.1~18.3 | calculator.py, main.py, 신규 테스트 | **최종 라운드 신규** |
| FR-17 | SR-19.1~19.3 | 신규 admin API, AdminDashboardPage.tsx | **최종 라운드 신규**(유저 모니터링은 기존 SR-16으로 이미 구현) |
| FR-18 | SR-20.1~20.3 | game-benefit-pipeline | **최종 라운드 신규** |
| FR-19 | SR-21.1~21.4 | Dockerfile, 배포 설정 | **최종 라운드 신규** |
| (보안) | NFR-11~14 | main.py, auth.py | **배포 게이트, 최우선 처리** |

---

## 8. 부록: 배포 전 최종 체크리스트

발표 시연을 위한 Cloud Run 배포는 아래 항목이 모두 완료된 이후에만 진행한다.

- [ ] `POST /routes` 응답에 `route_id` 포함 확인 (SR-18.1)
- [ ] 회귀 테스트 스위트(10~20 시나리오) 전량 통과 (SR-18.2)
- [ ] `GET /admin/data-status` 및 데이터 모니터링 화면 동작 확인 (SR-19)
- [ ] `game-benefit-pipeline` 실행 시 BigQuery `game_info` 자동 반영 확인 (SR-20.1)
- [ ] CORS 허용 출처를 배포 프론트엔드 도메인으로 제한 (NFR-11)
- [ ] 배포 환경변수 `DEBUG=False` 확인, 우회 토큰 401 응답 재현 테스트 (NFR-12)
- [ ] 서버 예외 원문 비노출 확인 (NFR-14)
- [ ] 미인증 엔드포인트 Rate Limiting 동작 확인 (NFR-13)
- [ ] Cloud SQL 접속(Cloud Run ↔ Cloud SQL) 정상 확인 (SR-21.2)
- [ ] 프론트엔드 `API_BASE`가 배포 URL로 정상 주입되었는지 확인 (SR-21.3)
- [ ] 외부 네트워크에서 전체 사용자 플로우 스모크 테스트 1회 이상 수행 (AC-19.1)

## 부록 2: 알려진 기술부채 (3차 이후 처리)

* `mobile_game_data/`와 `game-benefit-pipeline/catalog/` 파이프라인 이원화 정리
* `game-pay-api/game_pay.db`(SQLite 잔재 파일) 삭제
* Cloud Scheduler 등을 통한 크롤링 완전 자동(정기) 트리거화
* `impression_log` 도입을 통한 CTR(%) 계측
* `benefit_info`/`game_info`에 대한 `review_status` 기반 데이터 승인 워크플로 도입
* SR-17(오류/예외 처리) 항목 중 배포 게이트에 포함되지 않은 잔여 항목(SR-17.1, 17.2, 17.3, 17.5, 17.6, 17.7)
* WCAG 2.1 AA 수준 접근성 고도화
