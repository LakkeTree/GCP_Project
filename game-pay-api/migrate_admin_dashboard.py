"""
1회성 마이그레이션 스크립트: 관리자 대시보드 기능에 필요한 컬럼/테이블을 기존 SQLite DB에 추가한다.

Base.metadata.create_all()은 아직 없는 테이블만 새로 만들 뿐, 이미 존재하는 users 테이블에
컬럼(last_login_at)을 추가해주지는 않는다. 그래서 이 스크립트를 한 번 실행해 기존 game_pay.db를
직접 ALTER TABLE 해준다. (신규로 DB 파일을 만드는 경우라면 이 스크립트 없이 서버 기동만으로
Base.metadata.create_all()이 최신 스키마로 테이블을 만들어주므로 실행하지 않아도 된다.)

실행: python migrate_admin_dashboard.py
"""
import sqlite3

from database import DATABASE_URL, Base, engine

DB_PATH = DATABASE_URL.replace("sqlite:///", "")

conn = sqlite3.connect(DB_PATH)
cur = conn.cursor()

cur.execute("PRAGMA table_info(users)")
existing_cols = {row[1] for row in cur.fetchall()}

if "last_login_at" not in existing_cols:
    cur.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME")
    conn.commit()
    print("[OK] users.last_login_at 컬럼 추가 완료")
else:
    print("[SKIP] users.last_login_at 컬럼이 이미 존재합니다")

conn.close()

# user_game_activity_logs는 신규 테이블이므로 create_all로 생성 (이미 있으면 아무 작업 안 함)
Base.metadata.create_all(bind=engine)
print("[OK] user_game_activity_logs 테이블 준비 완료")
