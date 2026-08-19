"""
1회성 마이그레이션 스크립트: 관리자 대시보드 기능에 필요한 컬럼/테이블을 추가한다.

Base.metadata.create_all()은 아직 없는 테이블만 새로 만들 뿐, 이미 존재하는 users 테이블에
컬럼(last_login_at)을 추가해주지는 않는다. 그래서 이 스크립트를 한 번 실행해 기존 DB에
직접 ALTER TABLE 해준다. database.py가 가리키는 DB에 그대로 붙으므로 (현재는 GCP Cloud SQL
PostgreSQL) 로컬에서 Cloud SQL에 접속 가능한 환경(같은 VPC/인증 프록시 등)에서 실행해야 한다.

실행: python migrate_admin_dashboard.py
"""
from sqlalchemy import text

from database import Base, engine

with engine.begin() as conn:
    conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ"
    ))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS ix_users_last_login_at ON users (last_login_at)"
    ))
print("[OK] users.last_login_at 컬럼 준비 완료")

# user_game_activity_logs는 신규 테이블이므로 create_all로 생성 (이미 있으면 아무 작업 안 함)
Base.metadata.create_all(bind=engine)
print("[OK] user_game_activity_logs 테이블 준비 완료")
