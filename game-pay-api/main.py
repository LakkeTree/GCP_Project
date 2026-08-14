import json
import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, field_validator

from database import get_db, engine, Base
from models import UserModel, GameRequestLogModel, OutboundClickLogModel
from auth import verify_google_token_and_get_user, verify_google_token_optional
#from constants import SUPPORTED_GAMES, VALID_PAYMENT_METHODS
#from engine.loader import recommend_best_routes

# 임시 테스트용 더미 상숫값 (에러 방지용) # ⚠️ 현재 테스트용 임시 더미 상숫값 (주석 해제 시 아래 2줄은 삭제 또는 주석 처리)
SUPPORTED_GAMES = {
    "COOKIERUN_KINGDOM": "쿠키런: 킹덤",
    "GENSHIN_IMPACT": "원신",
    "HONKAI_STAR_RAIL": "붕괴: 스타레일"  # 테스트를 위해 2~3개 더 넣어두시면 편리합니다.
}
VALID_PAYMENT_METHODS = {
    "KB_CARD", "SHINHAN_CARD", "SAMSUNG_CARD", "KAKAO_PAY", "NAVER_PAY", "SKT"
}

# DB 테이블 생성
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Optimal Payment Route API",
    description="Cloud SQL 및 Google OAuth 연동 결제 경로 추천 API",
    version="2.2.0",
)

# CORS 설정
raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 데이터 직렬화 헬퍼 함수 (DB 세미콜론 문자열 ↔ 프론트엔드 JSON 배열)
# -----------------------------------------------------------------------------
def parse_db_list(val: Optional[str]) -> List[str]:
    """DB에 저장된 세미콜론(;) 구분 문자열이나 JSON 문자열을 List[str]로 파싱"""
    if not val or val == "NONE":
        return []
    val_str = str(val).strip()
    if val_str.startswith("["):
        try:
            res = json.loads(val_str)
            return res if isinstance(res, list) else []
        except Exception:
            pass
    return [x.strip() for x in val_str.split(";") if x.strip() and x.strip() != "NONE"]


def to_db_string(val_list: Optional[List[str]]) -> str:
    """List[str]를 DB 저장용 세미콜론(;) 구분 문자열로 변환"""
    if not val_list:
        return "NONE"
    clean_list = [str(x).strip() for x in val_list if str(x).strip() and str(x).strip() != "NONE"]
    return ";".join(clean_list) if clean_list else "NONE"


# -----------------------------------------------------------------------------
# DTO (Pydantic 스키마)
# -----------------------------------------------------------------------------
class RouteRequest(BaseModel):
    platform: str = Field("ALL", description="스토어 플랫폼 (ALL, GOOGLE_PLAY, ONE_STORE, GALAXY_STORE 등)")
    amount: int = Field(..., gt=0, le=10_000_000, description="결제 예정 금액")
    is_first_pay: bool = Field(False, description="첫 결제 여부")
    payment_methods: List[str] = Field(default_factory=list, description="보유 결제 수단 코드")
    game: str = Field("COOKIERUN_KINGDOM", description="게임 ID")
    membership_tier: Optional[str] = Field("GENERAL", description="스토어 멤버십 등급")
    has_prev_spend: Optional[bool] = Field(False, description="전월 실적 충족 여부")
    has_pre_applied: Optional[bool] = Field(False, description="사전 응모 완료 여부")
    use_game_benefits: Optional[bool] = Field(True, description="게임 전용 혜택 사용 여부")

    @field_validator("payment_methods")
    @classmethod
    def validate_payment_methods(cls, v: List[str]) -> List[str]:
        if not v:
            return []
        sanitized = []
        for method in v:
            clean_method = method.strip().upper()
            if clean_method in VALID_PAYMENT_METHODS:
                sanitized.append(clean_method)
        return sanitized


class GameRequest(BaseModel):
    query: str = Field(..., description="유저가 검색한 미지원 게임명")


class OutboundClickRequest(BaseModel):
    route_id: str = Field(..., description="선택한 결제 경로 ID")
    saved_amount: int = Field(0, description="절감 예상 금액")


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    telecom: Optional[str] = "NONE"
    use_t_membership: Optional[bool] = False
    held_epay: List[str] = []
    has_naver_plus: Optional[bool] = False
    has_toss_prime: Optional[bool] = False
    has_card: Optional[bool] = False
    held_cards: List[str] = []
    held_vouchers: List[str] = []
    preferred_store: Optional[str] = "NONE"
    galaxy_store_tier: Optional[str] = "NONE"
    favorite_games: List[str] = []


# -----------------------------------------------------------------------------
# API 엔드포인트
# -----------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server connected with Cloud SQL PostgreSQL"}


@app.get("/games/supported", summary="지원하는 TOP 50 게임 목록 조회 (FR-12)")
def get_supported_games():
    return {"status": "success", "data": SUPPORTED_GAMES}


@app.post("/routes", summary="최적 결제 경로 연산 (Dual-Track 추천 연동)")
def get_optimal_routes(request: RouteRequest):
    # 지원 게임 여부 검증 (FR-12)
    is_supported = request.game in SUPPORTED_GAMES
    if not is_supported:
        return {
            "status": "warning",
            "is_supported": False,
            "message": f"'{request.game}'은(는) 아직 지원하지 않는 게임입니다. 미지원 게임 추가 요청을 등록해 주세요.",
            "routes": []
        }

    #try:
    #   result = recommend_best_routes(
    #        platform=request.platform,
    #        amount=request.amount,
    #        held_methods=request.payment_methods,
    #        game=request.game,
    #        is_first_purchase=request.is_first_pay,
    #        top_n=10,
    #        store_tier=request.membership_tier,
    #        has_prev_spend=request.has_prev_spend,
    #        has_pre_applied=request.has_pre_applied,
    #        use_game_benefits=request.use_game_benefits,
    #        force_refresh=False,  
    #   )
    #   return {
    #       "status": "success",
    #        "is_supported": True,
    #        "data": result
    #    }
    #except Exception as e:
    #    raise HTTPException(
    #       status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
    #        detail=f"계산 엔진 처리 중 오류가 발생했습니다: {str(e)}",
    #   )

    # ⚠️ 계산 엔진 연동 전 임시 더미 응답 (추후 위 주석 해제 시 아래 return은 삭제)
    return {
        "status": "success",
        "is_supported": True,
        "message": "[테스트용] 계산 엔진 준비 전 임시 더미 응답입니다.",
        "data": [
            {
                "route_id": "dummy_route_1",
                "store": "ONE_STORE",
                "final_amount": 8000,
                "saved_amount": 2000
            }
        ]
    } 

@app.post("/games/request", summary="미지원 게임 추가 요청 등록 (FR-12)")
def request_game_addition(req: GameRequest, db: Session = Depends(get_db)):
    log_entry = GameRequestLogModel(query=req.query)
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": f"'{req.query}' 게임 추가 요청이 적재되었습니다."}


@app.post("/events/outbound-click", summary="추천 결과 결제 링크 클릭 트래킹 (FR-13)")
def track_outbound_click(
    req: OutboundClickRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db)
):
    user_id_val = current_user.user_id if current_user else "ANONYMOUS"
    log_entry = OutboundClickLogModel(
        user_id=user_id_val,
        selected_route_id=req.route_id,
        saved_amount=req.saved_amount
    )
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": "클릭 트래킹 데이터가 적재되었습니다."}


@app.get("/user/profile", summary="[회원] 내 프로필 조회 (FR-10)")
def get_user_profile(current_user: UserModel = Depends(verify_google_token_and_get_user)):
    return {
        "status": "success",
        "data": {
            "user_id": current_user.user_id,
            "email": current_user.email,
            "nickname": current_user.nickname,
            "provider": current_user.provider,
            "telecom": current_user.telecom,
            "use_t_membership": current_user.use_t_membership,
            "held_epay": parse_db_list(current_user.held_epay),
            "has_naver_plus": current_user.has_naver_plus,
            "has_toss_prime": current_user.has_toss_prime,
            "has_card": current_user.has_card,
            "held_cards": parse_db_list(current_user.held_cards),
            "held_vouchers": parse_db_list(current_user.held_vouchers),
            "preferred_store": current_user.preferred_store,
            "galaxy_store_tier": current_user.galaxy_store_tier,
            "favorite_games": parse_db_list(current_user.favorite_games)
        }
    }


@app.post("/user/profile", summary="[회원] 보유 혜택 자산 프로필 업데이트 (FR-10)")
def update_user_profile(
    req: ProfileUpdateRequest,
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db)
):
    if req.nickname:
        current_user.nickname = req.nickname
    current_user.telecom = req.telecom
    current_user.use_t_membership = req.use_t_membership
    current_user.held_epay = to_db_string(req.held_epay)
    current_user.has_naver_plus = req.has_naver_plus
    current_user.has_toss_prime = req.has_toss_prime
    current_user.has_card = req.has_card
    current_user.held_cards = to_db_string(req.held_cards)
    current_user.held_vouchers = to_db_string(req.held_vouchers)
    current_user.preferred_store = req.preferred_store
    current_user.galaxy_store_tier = req.galaxy_store_tier
    current_user.favorite_games = to_db_string(req.favorite_games)

    db.commit()
    db.refresh(current_user)
    return {"status": "success", "message": "유저 혜택 자산 프로필이 성공적으로 업데이트되었습니다."}


@app.delete("/user/withdraw", summary="[회원] 회원 탈퇴 및 DB 영구 파기 (AC-10.3)")
def withdraw_user(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return {"status": "success", "message": "회원 탈퇴가 완료되어 계정 정보가 DB에서 파기되었습니다."}