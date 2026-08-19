from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, UniqueConstraint
from sqlalchemy.sql import func
from database import Base


class UserModel(Base):
    __tablename__ = "users"

    user_id = Column(String(50), primary_key=True, index=True)
    email = Column(String(100), nullable=False, unique=True, index=True)
    nickname = Column(String(50), nullable=False)
    
    # 소셜 계정 전용 기본 비밀번호 상숫값
    password = Column(String(100), nullable=False, default="OAUTH_NO_PASSWORD")
    
    provider = Column(String(20), nullable=False)  # GOOGLE, KAKAO
    provider_id = Column(String(100), nullable=False)
    
    role = Column(String(20), default="ROLE_USER")
    is_first_pay = Column(Boolean, default=False)
    membership_tier = Column(String(30), default="GENERAL")
    telecom = Column(String(20), default="NONE")
    use_t_membership = Column(Boolean, default=False)
    
    # 운영 DB(CSV)와 동일한 세미콜론(;) 구분 문자열 저장 컬럼
    held_epay = Column(Text, default="NONE")
    has_naver_plus = Column(Boolean, default=False)
    has_toss_prime = Column(Boolean, default=False)
    has_card = Column(Boolean, default=False)
    held_cards = Column(Text, default="NONE")
    held_vouchers = Column(Text, default="NONE")
    
    preferred_store = Column(String(30), default="NONE")
    galaxy_store_tier = Column(String(30), default="NONE")
    favorite_games = Column(Text, default="NONE")

    # DB 타임스탬프
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # 관리자 대시보드 활성 사용자(DAU/WAU/MAU) 집계용: 인증 토큰 검증(로그인) 시점마다 갱신
    last_login_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # 소셜 제공자 + 고유 ID 유니크 제약조건

    __table_args__ = (
        UniqueConstraint('provider', 'provider_id', name='_provider_user_uc'),
    )


# 2차 PRD FR-12: 미지원 게임 요청 로그
class GameRequestLogModel(Base):
    __tablename__ = "game_request_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    query = Column(String(100), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now())


# 2차 PRD FR-13: 아웃바운드 클릭 트래킹 로그
class OutboundClickLogModel(Base):
    __tablename__ = "outbound_click_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=True)  # 비회원일 경우 "ANONYMOUS"
    selected_route_id = Column(String(100), nullable=False)
    saved_amount = Column(Integer, default=0)
    clicked_at = Column(DateTime(timezone=True), server_default=func.now())

    # [신규] 2차 PRD: 검색 카운트 수집 로그
class GameSearchLogModel(Base):
    __tablename__ = "game_search_logs"  # PostgreSQL에 별도로 생길 테이블명

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_name = Column(String(100), nullable=False, index=True)
    searched_at = Column(DateTime(timezone=True), server_default=func.now())


# 관리자 대시보드: 로그인 유저의 게임 검색/경로계산 행동 로그 (유저별 선호 게임 랭킹 산출용)
class UserGameActivityLogModel(Base):
    __tablename__ = "user_game_activity_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False, index=True)
    game_name = Column(String(100), nullable=False)
    event_type = Column(String(20), nullable=False)  # SEARCH, ROUTE_CALC
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)