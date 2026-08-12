import sys
from pathlib import Path
from enum import Enum
from typing import List, Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# -----------------------------------------------------------------------------
# 1. 경로 설정 및 엔진 로더 불러오기
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from engine.loader import recommend_best_routes

# -----------------------------------------------------------------------------
# 2. FastAPI 앱 생성 및 CORS 설정
# -----------------------------------------------------------------------------
app = FastAPI(
    title="Optimal Payment Route API",
    description="2차 프로토타입 - 보안 유효성 검증이 적용된 결제 경로 추천 API",
    version="2.0.0"
)

origins = [
    "http://localhost:5173",   # Vite, Vue 기본 포트,
    "http://127.0.0.1:5173",
]

# 로컬 개발 환경을 위한 CORS 허용 (추후 실제 배포 시에는 특정 웹 도메인만 허용하도록 변경)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 3. 보안 화이트리스트 및 데이터 허용 범위 정의 (PRD 규격 준수)
# -----------------------------------------------------------------------------

# [보안 1] 허용된 스토어 플랫폼 목록 (지정된 4개 스토어 외 입력 시 자동 차단)
class SupportedPlatform(str, Enum):
    GOOGLE_PLAY = "GOOGLE_PLAY"
    ONE_STORE = "ONE_STORE"
    GALAXY_STORE = "GALAXY_STORE"
    APP_STORE = "APP_STORE"

# [보안 2] 허용된 보유 결제 수단 화이트리스트 (계산 엔진에서 인식 가능한 수단만 허용)
VALID_PAYMENT_METHODS = {
    # 카드사
    "KB_CARD", "SHINHAN_CARD", "SAMSUNG_CARD", "HYUNDAI_CARD", "LOTTE_CARD",
    "WOORI_CARD", "NH_CARD", "BC_CARD",
    # 간편결제
    "KAKAO_PAY", "NAVER_PAY", "TOSS_PAY", "PAYCO",
    # 기프트카드 및 상품권
    "GOOGLE_PLAY_GIFTCARD", "ZEROPIN", "GMARKET", "11STREET", "SSG_COM",
    "CULTURELAND_CASH", "CULTURELAND_VOUCHER", "BOOKNLIFE_CASH", "BOOKNLIFE_VOUCHER",
    # 통신사
    "SKT", "KT", "LGU_PLUS"
}

# -----------------------------------------------------------------------------
# 4. API Request 모델 (Pydantic 보안 유효성 검증 적용)
# -----------------------------------------------------------------------------
class RouteRequest(BaseModel):
    # 플랫폼: SupportedPlatform Enum으로 정의된 4가지 값만 허용
    platform: SupportedPlatform = Field(
        ...,
        description="스토어 플랫폼 (GOOGLE_PLAY, ONE_STORE, GALAXY_STORE, APP_STORE)"
    )
    
    # 결제 금액: gt=0 (0원 초과 필수), le=10_000_000 (1천만원 이하 제한)
    amount: int = Field(
        ...,
        gt=0,
        le=10_000_000,
        description="결제 예정 금액 (0원 초과, 10,000,000원 이하만 허용)"
    )
    
    is_first_pay: bool = Field(False, description="첫 결제 여부")
    payment_methods: List[str] = Field([], description="보유 결제 수단 코드 리스트")
    game: str = Field("COOKIERUN_KINGDOM", description="게임 ID")
    membership_tier: Optional[str] = Field("STANDARD", description="스토어 멤버십 등급")
    has_subscription: Optional[bool] = Field(False, description="구독 서비스 보유 여부")
    has_prev_spend: Optional[bool] = Field(False, description="전월 실적 충족 여부")
    has_pre_applied: Optional[bool] = Field(False, description="사전 응모 완료 여부")
    use_game_benefits: Optional[bool] = Field(True, description="게임 전용 혜택 포함 여부")

    # [보안 3] 결제 수단 화이트리스트 변조 검사 파이프라인
    @field_validator("payment_methods")
    @classmethod
    def validate_payment_methods(cls, v: List[str]) -> List[str]:
        if not v:
            return []
        sanitized_methods = []
        for method in v:
            clean_method = method.strip().upper()
            if clean_method in VALID_PAYMENT_METHODS:
                sanitized_methods.append(clean_method)
        return sanitized_methods

# -----------------------------------------------------------------------------
# 5. API 엔드포인트 구현
# -----------------------------------------------------------------------------
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "API Server with BigQuery Data Engine & Input Validation is running"
    }

@app.post("/routes")
def get_optimal_routes(request: RouteRequest):
    try:
        # Pydantic을 거쳐 안전성이 검증된 데이터만 계산 엔진으로 전달
        result = recommend_best_routes(
            platform=request.platform.value,
            amount=request.amount,
            held_methods=request.payment_methods,
            game=request.game,
            is_first_purchase=request.is_first_pay,
            top_n=10,
            store_tier=request.membership_tier,
            has_prev_spend=request.has_prev_spend,
            has_pre_applied=request.has_pre_applied,
            use_game_benefits=request.use_game_benefits,
            force_refresh=False
        )
        return result
    except Exception as e:
        # 예외 발생 시 서버 내부 에러 반환
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계산 엔진 처리 중 오류가 발생했습니다: {str(e)}"
        )