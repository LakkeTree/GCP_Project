# 관리자 대시보드 기능 변경 정리

이 문서는 "사이트 총 이용자 수 / 활성 사용자 수 / 유저별 선호 게임 랭킹"을 보여주는 관리자 대시보드(`/admin`) 기능을 추가하면서 기존 코드 대비 어떤 파일이 어떻게 바뀌었는지 정리한 것입니다. 팀원 브랜치 병합 전 리뷰용으로 사용하세요.

## 왜 추가했나

기존에는 로그인/게임 검색/결제 경로 계산 기능은 있었지만, "얼마나 많은 사람이 쓰고 있는지", "그중 실제로 활동하는 사람은 몇 명인지", "유저별로 어떤 게임을 좋아하는지"를 볼 수 있는 화면이 없었습니다. 이를 위해 로그인 시점과 게임 검색/결제 계산 행동을 서버에 기록하고, 관리자 권한(`ROLE_ADMIN`)을 가진 계정만 집계 결과를 볼 수 있는 `/admin` 페이지를 추가했습니다.

## 신규 파일

| 파일 | 내용 |
|---|---|
| `game-pay-api/migrate_admin_dashboard.py` | 1회성 DB 마이그레이션 스크립트. 기존 `users` 테이블에 `last_login_at` 컬럼을 추가하고(`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`), 신규 테이블 `user_game_activity_logs`를 생성한다. `database.py`가 가리키는 DB(현재는 GCP Cloud SQL PostgreSQL)에 그대로 연결되므로, Cloud SQL 접속이 가능한 환경에서 최초 1회 실행해야 한다. |
| `fe-app/src/pages/AdminDashboardPage.tsx` | 관리자 대시보드 화면. 총 가입자 수, 일간/주간/월간 활성 사용자(DAU/WAU/MAU) 카드와 유저별 로그(가입일, 최근 로그인, 활성 여부, 선호 게임 Top3 랭킹) 테이블을 보여준다. 로그인 안 했거나 `ROLE_ADMIN`이 아니면 안내 화면만 뜨고 API를 호출하지 않는다. |

## 수정 파일

### `game-pay-api/models.py`
- `UserModel`에 `last_login_at` 컬럼 추가 (`DateTime(timezone=True)`, nullable, 인덱스) — 활성 사용자 집계 기준값
- 신규 테이블 모델 `UserGameActivityLogModel` 추가 (`user_id`, `game_name`, `event_type`("SEARCH"/"ROUTE_CALC"), `created_at`) — 유저별 게임 이용 로그, 선호 게임 랭킹 산출용

### `game-pay-api/auth.py`
- `_touch_last_login(user, db)` 헬퍼 추가: 로그인(토큰 검증) 성공 시마다 `last_login_at`을 갱신. 매 요청마다 DB 쓰기가 발생하지 않도록 5분 간격으로만 갱신
  - Postgres(`timestamptz`)가 timezone-aware 값을 돌려주는 것과 달리 `datetime.utcnow()`는 naive라서 뺄셈 시 `TypeError`가 나는 문제가 있어, `datetime.now(timezone.utc)`로 통일하고 과거 naive 값이 섞여 있어도 안전하게 처리하도록 방어 코드 추가
- `require_admin(current_user)` 의존성 추가: `role != "ROLE_ADMIN"`이면 403 반환. 관리자 전용 API를 보호하는 용도
- `verify_google_token_and_get_user()` 내부(더미 토큰 분기, 구글 로그인 분기 양쪽 모두)에서 `_touch_last_login()` 호출

### `game-pay-api/main.py`
- `POST /routes` (결제 경로 계산): 선택적 인증(`verify_google_token_optional`) 추가. 로그인 유저가 게임을 지정해 계산을 돌리면 `UserGameActivityLogModel`에 `event_type="ROUTE_CALC"`로 기록
- `POST /games/search-log` (게임 검색 카운트): 동일하게 선택적 인증 추가, 로그인 유저면 `event_type="SEARCH"`로 기록 (익명 검색은 기존처럼 `GameRequestLogModel`에만 집계)
- 신규 `GET /admin/stats/summary`: 총 가입자 수, DAU/WAU/MAU(각각 `last_login_at` 기준 1일/7일/30일 이내) 반환. `require_admin` 필요
- 신규 `GET /admin/users`: 유저 목록(가입일, 최근 로그인, 최근 7일 활성 여부)과 유저별 게임 이용 로그를 집계한 선호 게임 Top3를 함께 반환. 이용 로그가 없는 유저는 본인이 등록한 즐겨찾기 게임으로 대체 표시. `limit`/`offset` 페이지네이션 지원. `require_admin` 필요
- 위 두 엔드포인트에서도 `datetime.utcnow()` → `datetime.now(timezone.utc)`로 통일 (같은 naive/aware 버그 예방)

### `fe-app/src/App.tsx`
- `/admin` 라우트 추가, `AdminDashboardPage` 임포트

### `fe-app/src/api/routeApi.ts`
- `/routes` 호출 시 `localStorage`의 `google_token`이 있으면 `Authorization: Bearer <token>` 헤더를 함께 전송하도록 수정 (기존엔 토큰을 안 실어 보내서 로그인 유저의 결제 계산 행동이 서버에서 익명으로만 잡혔음)

### `fe-app/src/pages/SearchResultPage.tsx`
- 게임 검색 시 `/games/search-log` 호출에도 동일하게 `google_token`이 있으면 `Authorization` 헤더 포함

## 관리자 권한 부여 방식

`ROLE_ADMIN` 승격은 셀프서비스 API를 일부러 만들지 않았습니다 (권한 상승 방지). 구글 로그인으로 계정이 생성된 뒤, DB에서 직접 `role` 값을 `ROLE_ADMIN`으로 바꿔줘야 합니다. 자세한 절차는 `README.md`의 "관리자 대시보드 실행 방법" 참고.

## 작업 중 발견/수정한 이슈

- **timezone 버그**: SQLite 개발 DB로 만들었던 초기 버전은 naive datetime끼리 비교했지만, 실제 운영 DB가 Postgres(`timestamptz`)로 전환되면서 aware datetime과 naive datetime을 빼는 `TypeError`가 발생해 `/user/profile`, `/admin/*`가 전부 500 에러를 냈음 → `auth.py`, `main.py`의 관련 로직을 `datetime.now(timezone.utc)` 기준으로 통일해 해결
- **AdminDashboardPage.tsx 로딩 무한 대기**: API 호출이 실패해도 로딩 상태(`guard`)를 빠져나오지 못해 "불러오는 중..."이 계속 뜨던 버그를 수정 — 실패 시에도 에러 배너를 보여주는 상태로 전환하도록 처리

---

## 2차 변경: 크롤링 데이터 신선도 모니터링 ("데이터 모니터링" 탭)

### 배경 (PRD 최종 라운드 요구사항)
관리자 대시보드에 유저 모니터링(가입자·DAU/WAU/MAU·활성 유저 목록)은 있었지만, "혜택 데이터가 최신 상태인지"를 확인할 방법이 없었다는 지적. 크롤링이 성공했는지, 마지막 갱신이 언제인지, 어느 도메인이 실패했는지 보여주는 화면이 없으면 데이터가 오래돼도 아무도 알아채지 못한다는 문제였음.

### 기획 문서와 실제 구현의 차이 (확인 필요)
`docs/최종 SRS.md`에는 로그 테이블을 **PostgreSQL**에 `crawl_status_log`라는 이름으로 두라고 되어 있으나, 실제로 팀원이 구현한 것은 **BigQuery** `positive-tuner-504502-m5.benefit.crawl_log` 테이블이다. 이번 작업은 실제 BigQuery 테이블에 직접 쿼리해 스키마를 확인하고(2026-08-19 기준 42 rows, 도메인: `card_data`/`epay_data`/`store_data`/`telecom_data`/`voucher_data`) 그 실물 스키마를 기준으로 구현했다. SRS 문서는 실제 구현에 맞게 팀과 함께 업데이트가 필요하다.

`crawl_log` 실제 컬럼: `run_id`, `domain`, `scraper_name`, `provider_or_retailer`, `source_file`, `status`(`SUCCESS`/`FAILED`), `rows_extracted`, `error_type`, `error_message`, `started_at`, `finished_at`, `duration_seconds`, `trigger_source`.

### 수정 파일

#### `game-pay-api/main.py`
- 신규 `GET /admin/data-status`: BigQuery `crawl_log`을 조회해
  - 도메인별 **최근 실행 1건**(상태, 스크래퍼명, 수집 건수, 에러 사유, 마지막 실행 시각, 마지막 실행 이후 경과 시간)
  - **최근 100건 실행 이력** 목록
  을 함께 반환. `STALE_THRESHOLD_HOURS = 24` 기준으로 각 도메인에 `is_stale` 플래그를 계산해서 내려줌 (마지막 실행이 24시간 이상 지났으면 `true`)
  - `require_admin` 게이트 동일 적용. BigQuery 클라이언트는 기존 `engine.loader.get_client()` 재사용

#### `fe-app/src/pages/AdminDashboardPage.tsx`
- 상단에 "유저 모니터링" / "데이터 모니터링" 탭 전환 UI 추가 (기존엔 탭 없이 단일 화면이었음). stale 도메인이 하나라도 있으면 "데이터 모니터링" 탭에 빨간 점 표시
- "데이터 모니터링" 탭은 처음 클릭할 때만 `/admin/data-status`를 호출하는 지연 로딩 방식 (관리자가 안 열어보면 BigQuery 쿼리 비용 발생 안 함)
- 도메인별 카드: 도메인명, 마지막 실행 경과 시간, 성공/실패 배지, 수집 건수, 실패 시 에러 메시지, 24시간 초과 시 "갱신 필요" 경고 배지
- 최근 크롤링 실행 이력 테이블: 도메인/스크래퍼/상태/수집건수/실행시각/소요시간

### 검증
로컬 샌드박스에서 실제 GCP BigQuery `crawl_log` 테이블에 직접 연결해 `GET /admin/data-status` 엔드포인트를 end-to-end로 테스트 완료. 응답 스키마와 각 도메인의 `is_stale` 계산이 정상 동작함을 확인.

---

## 3차 변경: 헤더에 관리자 대시보드 진입 버튼 추가

### 배경
관리자 페이지는 URL에 `/admin`을 직접 입력해야만 접근 가능했음. 관리자 계정으로 로그인했을 때 계정 버튼 옆에서 바로 이동할 수 있게 해달라는 요청.

### 수정 파일

#### `game-pay-api/main.py`
- `GET /user/profile` 응답에 `role` 필드 추가 (기존엔 안 내려주고 있었음)

#### `fe-app/src/components/Header.tsx`
- `fetchUserProfile()`에서 `role`을 받아 `user` 상태에 저장
- 로그인 상태 + `role === 'ROLE_ADMIN'`일 때만, 프로필 버튼 왼쪽에 "관리자 대시보드" 버튼을 표시하고 `/admin`으로 링크. 일반 유저에게는 보이지 않음

---

## 4차 변경: 팀원 브랜치 merge로 유실된 관리자 기능 재융합

### 배경
`develop` 브랜치를 다시 merge하면서 관리자 대시보드 관련 코드(`auth.py`, `models.py`, `main.py`의 관리자 로직, `Header.tsx`의 role/버튼)가 또 사라졌음. merge 전 백업해둔 파일과 현재(merge 후) 파일을 비교해서, **팀원이 그 사이 추가한 개선사항은 그대로 두고 관리자 기능만 다시 얹는 방식**으로 복원.

### 함께 보존된 팀원 측 개선사항 (건드리지 않음)
- `models.py`: `GameSearchLogModel`(검색 로그 전용 테이블) 신설
- `main.py`: `/ranks`가 하드코딩 대신 `GameSearchLogModel` 기반 실시간 집계로 동작(+ `fallback_rank` 폴백), `/payments` 쿼리가 `UNION` + 윈도우 함수로 개선
- `Header.tsx`: 로고가 이미지+글자 조합으로 교체, 프로필 조회 중 스켈레톤 로더(`isAuthLoading`) 추가, 신규 유저 자동 가입(POST 업서트) 흐름 추가
- `AdminDashboardPage.tsx`, `App.tsx`, `fe-app/src/api/routeApi.ts`는 이번 merge로 손상되지 않아 그대로 유지

### 이번에 다시 얹은 것
- `auth.py`: 끝부분에 병합 사고로 `database.py` 전체 내용이 잘못 붙어있던 것을 제거, `_touch_last_login`/`require_admin` 재적용
- `models.py`: `UserModel.last_login_at`, `UserGameActivityLogModel` 재적용
- `main.py`: 중복 import 블록 정리, `/user/profile`에 `role` 추가, `/routes`·`/games/search-log`에 유저별 활동 로그 적재 재적용(팀원의 `GameSearchLogModel` 로직은 유지), `/admin/stats/summary`·`/admin/users`·`/admin/data-status` 3개 엔드포인트 재적용
- `Header.tsx`: `role` 상태 저장(정상 로그인 + 자동가입 두 경로 모두), 관리자 버튼 재적용
- `SearchResultPage.tsx`: 검색 로그 요청에 `Authorization` 헤더 재적용 (이 파일은 팀원 쪽에서 `filter.X` 구조로 이미 리팩터링되어 있어, 그 구조는 그대로 두고 헤더만 추가)

### 검증
SQLite로 우회한 end-to-end 테스트로 `/user/profile`(role 포함), `/routes`(로그 적재), `/games/search-log`, `/admin/stats/summary`, `/admin/users`(유저별 top_games 집계 확인), 403 처리까지 전부 정상 동작 확인. `/admin/data-status`는 실제 BigQuery `crawl_log`에 재접속해 정상 응답 확인. 프론트는 `tsc -b` 통과(기존부터 있던 `GameRankPage.tsx`의 무관한 에러 제외).
