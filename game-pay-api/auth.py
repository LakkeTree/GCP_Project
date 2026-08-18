import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import cachecontrol
import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from database import get_db
from models import UserModel

load_dotenv()

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
# 🔑 디버그 모드(개발 환경)에서만 usr_ 더미 로그인 우회 허용
IS_DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "t")

# Google 공개키(certs) 조회용 Request
_cached_session = cachecontrol.CacheControl(requests.Session())
_google_auth_request = google_requests.Request(session=_cached_session)

# 관리자 대시보드 활성 사용자(DAU/WAU/MAU) 집계용 last_login_at 갱신 주기.
# 매 인증 요청마다 DB 쓰기가 발생하지 않도록 5분 단위로만 갱신한다.
_LAST_LOGIN_THROTTLE = timedelta(minutes=5)


def _touch_last_login(user: UserModel, db: Session) -> None:
    now = datetime.now(timezone.utc)
    # Postgres(timestamptz)는 timezone-aware 값을 돌려주지만, SQLite로 개발하던 시절 값이 섞여있을 수 있어
    # naive 값이면 UTC로 간주해 aware로 맞춰준다 (naive - aware는 TypeError가 나기 때문).
    last_login = user.last_login_at
    if last_login and last_login.tzinfo is None:
        last_login = last_login.replace(tzinfo=timezone.utc)
    if not last_login or (now - last_login) > _LAST_LOGIN_THROTTLE:
        user.last_login_at = now
        db.commit()


def verify_google_token_and_get_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> UserModel:
    """Google OAuth 토큰 검증 후 회원 조회 및 신규 생성(Upsert)"""
    token = credentials.credentials

    # 1. 더미 유저 우회 로직 (개발/테스트 환경 전용 보안 가드)
    if token.startswith("usr_"):
        if not IS_DEBUG:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="운영 환경에서는 테스트용 더미 토큰 사용이 금지되어 있습니다."
            )
        try:
            user = db.query(UserModel).filter(UserModel.user_id == token).first()
            if user:
                _touch_last_login(user, db)
                return user
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"테스트용 더미 유저({token})를 DB에서 찾을 수 없습니다."
            )
        except SQLAlchemyError as e:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=f"데이터베이스 연결 실패: {str(e)}"
            )

    # 2. 구글 OAuth 토큰 검증 및 DB 저장 로직
    try:
        id_info = id_token.verify_oauth2_token(
            token,
            _google_auth_request,
            GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10,
        )

        provider_id_val: Optional[str] = id_info.get("sub")
        email_val: Optional[str] = id_info.get("email")
        name_val: str = id_info.get("name", "구글유저")

        if not provider_id_val or not email_val:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="유효하지 않은 Google 계정 정보입니다.",
            )

        full_provider_id = f"google_{provider_id_val}"
        user_id_val = f"usr_g_{provider_id_val}"

        # DB에서 기존 회원 조회
        user = db.query(UserModel).filter(
            (UserModel.user_id == user_id_val) | 
            ((UserModel.provider == "GOOGLE") & (UserModel.provider_id == full_provider_id))
        ).first()

        # GCP DB에 회원 정보가 없으면 신규 가입 진행 (Upsert)
        if not user:
            try:
                user = UserModel(
                    user_id=user_id_val,
                    email=email_val,
                    nickname=name_val,
                    password="OAUTH_NO_PASSWORD",
                    provider="GOOGLE",
                    provider_id=full_provider_id,
                    role="ROLE_USER",
                    is_first_pay=False,
                    membership_tier="GENERAL",
                    held_epay="NONE",
                    held_cards="NONE",
                    held_vouchers="NONE",
                    favorite_games="NONE"
                )
                db.add(user)
                db.commit()
                db.refresh(user)
                print(f"🎉 [GCP DB] 신규 구글 회원 저장 완료: {user_id_val}")
            except IntegrityError:
                # 동시 요청 등으로 인한 중복 데이터 처리 시 롤백 후 재조회
                db.rollback()
                user = db.query(UserModel).filter(UserModel.user_id == user_id_val).first()

        _touch_last_login(user, db)
        return user

    except ValueError as e:
        print(f"❌ [DEBUG] 구글 토큰 검증 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google 토큰 인증 실패: {str(e)}",
        )
    except SQLAlchemyError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"GCP 데이터베이스 접속 오류 (네트워크/방화벽 상태 확인 필요): {str(e)}"
        )


def require_admin(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
) -> UserModel:
    """관리자 전용 API 접근 제어. UserModel.role == 'ROLE_ADMIN'인 회원만 통과시킨다."""
    if current_user.role != "ROLE_ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다.",
        )
    return current_user


def verify_google_token_optional(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security),
    db: Session = Depends(get_db)
) -> Optional[UserModel]:
    """비회원(익명) 요청 허용을 위한 선택적 토큰 검증 헬퍼"""
    if not credentials:
        return None
    try:
        return verify_google_token_and_get_user(credentials, db)
    except HTTPException:
        return None