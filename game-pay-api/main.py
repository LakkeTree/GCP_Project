import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List

# 상위 폴더(GCP_Project)를 sys.path에 추가하여 옆 동네인 'engine' 폴더를 모듈로 인식하게 함
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

# engine/loader.py에서 recommend_best_routes 함수 불러오기
from engine.loader import recommend_best_routes

app = FastAPI(title="Optimal Payment Route API")

# 프론트엔드 연동용 CORS 설정
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

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server with BigQuery Data Engine is running"}

@app.post("/routes")
def get_optimal_routes(request: RouteRequest):
    result = recommend_best_routes(
        platform=request.platform,
        amount=request.amount,
        held_methods=request.payment_methods,
        game=request.game,
        is_first_purchase=request.is_first_pay,
        top_n=10
    )
    return result