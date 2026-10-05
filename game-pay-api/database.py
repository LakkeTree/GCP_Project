import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

# 1. Cloud Run 환경변수 우선 읽기 (기본값 설정으로 ValueError 차단)
DB_HOST = os.getenv("DB_HOST", "")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME", "postgres")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# 특수문자 포함 대비 패스워드 인코딩
encoded_password = quote_plus(DB_PASSWORD)

# 2. Connection URL 생성 (드라이버 명시 및 유닉스 소켓/TCP 자동 분기)
if DB_HOST and DB_HOST.startswith("/cloudsql/"):
    # Cloud Run 유닉스 소켓 접속
    DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{encoded_password}@/{DB_NAME}?host={DB_HOST}"
else:
    # 로컬 IP 접속 (DB_HOST가 없으면 localhost 바라봄)
    host_target = DB_HOST if DB_HOST else "127.0.0.1"
    DATABASE_URL = f"postgresql+psycopg2://{DB_USER}:{encoded_password}@{host_target}:{DB_PORT}/{DB_NAME}"

print(f"📡 [DB CONNECTING] 연결 시도 Target URL Host: {DB_HOST}")

# 3. SQLAlchemy 엔진 생성 (타임아웃 및 안정성 강화)
try:
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,       # 연결 끊김 자동 감지
        pool_size=5,              # 커넥션 수
        max_overflow=10,
        connect_args={"connect_timeout": 10}
    )
except Exception as e:
    print(f"⚠️ [Engine Error] 엔진 생성 중 경고: {e}")
    # Fallback 기본 엔진 생성
    engine = create_engine("sqlite:///:memory:")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()