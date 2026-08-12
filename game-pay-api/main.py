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

# 랭킹 데이터 요청 처리 (모든 탭 카테고리 완벽 대응)
# 랭킹 데이터 요청 처리 (프론트엔드 RankCategoryData 타입 규격 적용)
@app.get("/ranks")
def get_game_ranks(category: str = "HOGAENG"):
    titles = {
        "HOGAENG": "🔥 호갱탈출 7일간 검색 순위",
        "GOOGLE": "🤖 구글 플레이 7일간 결제 순위",
        "ONESTORE": "🛍️ 원스토어 7일간 결제 순위",
        "GALAXY": "🌌 갤럭시 스토어 7일간 결제 순위",
        "APPLE": "🍎 앱스토어 7일간 결제 순위"
    }

    default_list = [
        {
            "rank": 1,
            "name": "쿠키런: 킹덤",
            "benefitText": "스토어 15% 쿠폰 + 문화상품권 10% 우회 결제",
            "rankChange": "SAME",
            "rankChangeText": "-",
            "badge": "매출 1위"
        },
        {
            "rank": 2,
            "name": "승리의 여신: 니케",
            "benefitText": "T멤버십 10% 차감 할인 혜택",
            "rankChange": "UP",
            "rankChangeText": "▲2",
            "badge": "인기"
        },
        {
            "rank": 3,
            "name": "메이플스토리M",
            "benefitText": "원스 쿠폰 20% 즉시 적용",
            "rankChange": "DOWN",
            "rankChangeText": "▼1",
            "badge": "상승"
        },
        {
            "rank": 4,
            "name": "오딘: 발할라 라이징",
            "benefitText": "매일 첫 결제 10% 할인",
            "rankChange": "SAME",
            "rankChangeText": "-",
            "badge": "유지"
        },
        {
            "rank": 5,
            "name": "기적의 검",
            "benefitText": "원스 전용 포인트 적립",
            "rankChange": "SAME",
            "rankChangeText": "-",
            "badge": "유지"
        }
    ]
    
    return {
        "title": titles.get(category, "순위 대시보드"),
        "list": default_list  # ✅ 프론트엔드가 요구하는 "list" 키 이름으로 변경
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