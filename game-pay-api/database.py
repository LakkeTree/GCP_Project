import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")

# 필수 환경변수 누락 검증
if not all([DB_USER, DB_PASSWORD, DB_NAME]):
    raise ValueError("DB 접속에 필요한 환경변수(DB_USER, DB_PASSWORD, DB_NAME)가 설정되지 않았습니다.")

# 비밀번호에 특수문자가 있어도 안전하게 변환
SAFE_PASSWORD = quote_plus(DB_PASSWORD)

# PostgreSQL 드라이버 명시 (psycopg2)
DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{SAFE_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()