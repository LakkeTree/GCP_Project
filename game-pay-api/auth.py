import os
from datetime import datetime, timedelta
from typing import Optional

import cachecontrol
import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session

from database import get_db
from models import UserModel

load_dotenv()

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

# Google 공개키(certs) 조회용 Request를 모듈 레벨에서 하나만 만들어 재사용한다.
# CacheControl로 감싸서 Google 응답의 Cache-Control 헤더를 존중해 캐싱하므로,
# 인증서가 실제로 바뀌기 전까지는(보통 하루 단위) 매 로그인 요청마다 구글 서버로
# 왕복하지 않는다 (google-auth의 id_token 모듈 docstring이 공식 권장하는 방식).
_cached_session = cachecontrol.CacheControl(requests.Session())
_google_auth_request = google_requests.Request(session=_cached_session)

# 관리자 대시보드 활성 사용자(DAU/WAU/MAU) 집계용 last_login_at 갱신 주기.
# 매 인증 요청마다 DB 쓰기가 발생하지 않도록 5분 단위로만 갱신한다.
_LAST_LOGIN_THROTTLE = timedelta(minutes=5)


def _touch_last_login(user: UserModel, db: Session) -> None:
    now = datetime.utcnow()
    if not user.last_login_at or (now - user.last_login_at) > _LAST_LOGIN_THROTTLE:
        user.last_login_at = now
        db.commit()


def verify_google_token_and_get_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> UserModel:
    """Google OAuth 토큰 검증 후 회원 조회 및 신규 생성(Upsert)"""
    token = credentials.credentials # + 테스트용

    # =========================================================================
    # [개발/테스트 전용] 토큰 자리에 'usr_001', 'usr_002' 등 더미 유저 ID를 직접 넣으면
    # 구글 통신을 건너뛰고 DB에서 즉시 해당 더미 유저를 조회합니다.
    # =========================================================================
    if token.startswith("usr_"):
        user = db.query(UserModel).filter(UserModel.user_id == token).first()
        if user:
            _touch_last_login(user, db)
            return user
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"테스트용 더미 유저({token})를 DB에서 찾을 수 없습니다."
        )                # +테스트용
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버에 GOOGLE_CLIENT_ID 환경변수가 설정되지 않았습니다.",
        )

    token = credentials.credentials
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

        # 1. DB에서 계정 조회
        user = db.query(UserModel).filter(
            UserModel.provider == "GOOGLE",
            UserModel.provider_id == full_provider_id
        ).first()

        # 2. 신규 유저 자동 등록
        if not user:
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

        _touch_last_login(user, db)
        return user

    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google 토큰 인증 실패: {str(e)}",
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