import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# 로컬 파일 형태의 SQLite DB 생성 (모든 ORM 모델과 100% 호환)
DATABASE_URL = "sqlite:///./game_pay.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}  # SQLite 쓰레드 공유 설정
)


@event.listens_for(engine, "connect")
def _set_sqlite_wal(dbapi_connection, connection_record):
    """WAL 모드로 전환해 읽기와 쓰기를 분리한다. 기본(rollback journal) 모드는 쓰기 중
    읽기까지 막히는데, WAL은 그 잠금 경합을 없애준다 — gunicorn -w 2가 같은 game_pay.db
    파일을 프로세스 2개가 동시에 접근하는 지금 구조에서 특히 중요하다."""
    dbapi_connection.execute("PRAGMA journal_mode=WAL")


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()