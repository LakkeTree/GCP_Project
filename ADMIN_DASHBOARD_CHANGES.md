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
