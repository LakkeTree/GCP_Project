import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from engine.loader import recommend_best_routes

app = FastAPI(title="Optimal Payment Route API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RouteRequest(BaseModel):
    platform: str
    amount: int
    is_first_pay: bool = False
    payment_methods: List[str] = []
    game: str = "COOKIERUN_KINGDOM"
    membership_tier: Optional[str] = "STANDARD"  # 스토어 등급 (BRONZE, GOLD, PLATINUM 등)
    has_subscription: Optional[bool] = False     # 구독 서비스 보유 여부
    has_prev_spend: Optional[bool] = False       # 전월 실적 충족 여부
    has_pre_applied: Optional[bool] = False      # 사전 응모 완료 여부 토글 (True/False)
    use_game_benefits: Optional[bool] = True     # 게임 전용 혜택 포함 여부 토글 (True/False)

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server with BigQuery Data Engine is running"}

# 랭킹 데이터 요청을 처리하는 GET /ranks 엔드포인트 추가
@app.get("/ranks")
def get_game_ranks(category: str = "ALL"):
    return {
        "status": "ok",
        "category": category,
        "data": [
            {"rank": 1, "title": "쿠키런: 킹덤", "badge": "매출 1위", "tip": "원스 수요일 30% 캐시백"},
            {"rank": 2, "title": "승리의 여신: 니케", "badge": "인기", "tip": "T멤버십 10% 차감 할인"},
            {"rank": 3, "title": "메이플스토리M", "badge": "상승", "tip": "원스 쿠폰 20% 즉시 적용"},
            {"rank": 4, "title": "오딘: 발할라 라이징", "badge": "유지", "tip": "매일 첫 결제 10% 할인"},
            {"rank": 5, "title": "기적의 검", "badge": "유지", "tip": "원스 전용 포인트 적립"}
        ]
    }

@app.post("/routes")
def get_optimal_routes(request: RouteRequest):
    held_methods = list(request.payment_methods)

    result = recommend_best_routes(
        platform=request.platform,
        amount=request.amount,
        held_methods=held_methods,
        game=request.game,
        is_first_purchase=request.is_first_pay,
        top_n=10,
        store_tier=request.membership_tier,
        has_prev_spend=request.has_prev_spend,
        has_pre_applied=request.has_pre_applied,
        use_game_benefits=request.use_game_benefits, # 👈 게임 전용 혜택 옵션 전달
        force_refresh=True
    )
    return result