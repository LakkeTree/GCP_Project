# GCP_Project

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
