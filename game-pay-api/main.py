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
    membership_tier: Optional[str] = "STANDARD"  # 👈 신규: 스토어 등급 (BRONZE, GOLD, PLATINUM 등)
    has_subscription: Optional[bool] = False     # 👈 신규: 구독 서비스 보유 여부
    has_prev_spend: Optional[bool] = False       # 👈 신규: 전월 실적 충족 여부

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server with BigQuery Data Engine is running"}

@app.post("/routes")
def get_optimal_routes(request: RouteRequest):
    # 특화 카드 및 구독 수단 추가 처리
    held_methods = list(request.payment_methods)

    result = recommend_best_routes(
        platform=request.platform,
        amount=request.amount,
        held_methods=held_methods,
        game=request.game,
        is_first_purchase=request.is_first_pay,
        top_n=10,                                  # 👈 10위까지 연산 출력
        store_tier=request.membership_tier,       # 👈 스토어 등급 반영
        force_refresh=True                         # 👈 DB 업데이트 즉시 반영을 위한 강제 캐시 갱신
    )
    return result


