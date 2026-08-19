import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# 1. .env 파일에서 GCP PostgreSQL 접속 정보 읽기
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")

# 2. 필수 값 검증 (설정이 빠져있으면 즉시 알림)
if not all([DB_HOST, DB_NAME, DB_USER, DB_PASSWORD]):
    raise ValueError(
        "❌ [DB ERROR] .env 파일에 DB_HOST, DB_NAME, DB_USER, DB_PASSWORD 중 누락된 값이 있습니다. "
        "GCP PostgreSQL 접속 정보를 확인해 주세요."
    )

# 3. PostgreSQL 전용 Connection URL 생성
DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"📡 [DB CONNECTING] GCP PostgreSQL로 연결을 시도합니다... (Host: {DB_HOST})")

# 4. SQLAlchemy 엔진 생성 (GCP PostgreSQL 전용 설정)
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # 끊긴 커넥션 감지 및 자동 재연결
    pool_size=10,             # 커넥션 풀 유지 개수
    max_overflow=20,          # 초과 허용 커넥션 수
    connect_args={"connect_timeout": 5} # 5초 내 응답 없으면 타임아웃
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
