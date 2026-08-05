from fastapi import FastAPI
from pydantic import BaseModel
from typing import List

app = FastAPI()

# 프론트엔드에서 받아올 데이터 구조 정의
class RouteRequest(BaseModel):
    platform: str
    amount: int
    is_first_pay: bool = False
    payment_methods: List[str] = []

# 1. 헬스 체크용 (서버가 살아있는지 확인)
@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server is running"}

# 2. 메인 엔드포인트 (가짜 데이터 반환)
@app.post("/routes")
def get_optimal_routes(request: RouteRequest):
    # 팀원 4가 테스트할 수 있도록 전달할 가짜(Dummy) 결과 데이터
    return [
        {
            "rank": 1,
            "final_amount": request.amount - 5000,
            "total_discount": 5000,
            "steps": [
                {
                    "step": 1,
                    "layer": "GIFT_CARD",
                    "name": "구글 기프트카드 10% 할인 구매",
                    "benefit_desc": "5,000원 할인"
                }
            ]
        }
    ]