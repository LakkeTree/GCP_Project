from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.schemas import UserConditionInput, RecommendationResponse
from app.calculator import calculate_best_paths

app = FastAPI(title="Mobile Game Payment Recommender API")

# 프론트엔드 통신을 위한 CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 개발 중에는 전체 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 시연용 더미 혜택 데이터
MOCK_BENEFITS = [
    {
        "id": "b1",
        "store": "GALAXY_STORE",
        "name": "갤스 첫 결제 30% 쿠폰",
        "type": "RATE",
        "discount_rate": 0.3,
        "max_discount": 10000,
        "min_amount": 10000,
        "description": "갤럭시스토어 첫 결제 대상 30% 할인 쿠폰"
    },
    {
        "id": "b2",
        "store": "ONE_STORE",
        "name": "원스토어 수요일 20% 페이백",
        "type": "RATE",
        "discount_rate": 0.2,
        "max_discount": 20000,
        "min_amount": 5000,
        "description": "결제 금액의 20%를 원스토어 포인트로 적립"
    }
]

@app.get("/")
def read_root():
    return {"message": "Game Payment Recommendation Server is Running"}

@app.post("/api/v1/recommend", response_model=RecommendationResponse)
def get_recommendation(user_input: UserConditionInput):
    recommendations = calculate_best_paths(user_input, MOCK_BENEFITS)
    return RecommendationResponse(
        game_id=user_input.game_id,
        target_amount=user_input.target_amount,
        recommended_paths=recommendations
    )