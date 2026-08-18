import os
from typing import Optional

import cachecontrol
import requests
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError  # 👈 [추가] DB 예외 처리용

from database import get_db
from models import UserModel

load_dotenv()

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")

_cached_session = cachecontrol.CacheControl(requests.Session())
_google_auth_request = google_requests.Request(session=_cached_session)


def verify_google_token_and_get_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
    db: Session = Depends(get_db)
) -> UserModel:
    """Google OAuth 토큰 검증 후 회원 조회 및 신규 생성(Upsert)"""
    token = credentials.credentials

    print(f"👉 [DEBUG] 전달받은 토큰 값: '{token}'")

    # 1. 더미 유저 테스트 우회 로직
    if token.startswith("usr_"):
        user = db.query(UserModel).filter(UserModel.user_id == token).first()
        if user:
            print("✅ [DEBUG] 더미 유저 조회 성공!")
            return user
        print("❌ [DEBUG] DB에 해당 usr_ ID가 존재하지 않음!")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"테스트용 더미 유저({token})를 DB에서 찾을 수 없습니다."
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

        # GCP DB에서 회원 조회
        user = db.query(UserModel).filter(
            (UserModel.user_id == user_id_val) | 
            ((UserModel.provider == "GOOGLE") & (UserModel.provider_id == full_provider_id))
        ).first()

        # GCP DB에 회원 정보가 없으면 신규 가입 진행
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
                db.commit()      # 👈 GCP PostgreSQL에 저장 수행!
                db.refresh(user)
                print(f"🎉 [GCP DB] 신규 구글 회원 저장 완료: {user_id_val}")
            except IntegrityError:
                # 동시 요청 등으로 인해 이미 생성된 경우 롤백 후 재조회
                db.rollback()
                user = db.query(UserModel).filter(UserModel.user_id == user_id_val).first()

        return user

    except ValueError as e:
        print(f"❌ [DEBUG] 구글 토큰 검증 실패: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Google 토큰 인증 실패: {str(e)}",
        )


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