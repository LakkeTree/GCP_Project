from pydantic import BaseModel
from typing import List, Optional

# 사용자가 입력하는 조건
class UserConditionInput(BaseModel):
    game_id: str
    target_amount: int            # 결제 예정 금액
    device_os: str                 # ANDROID, IOS
    available_stores: List[str]    # ["GALAXY_STORE", "ONE_STORE", "PLAY_STORE"]
    cards: List[str]               # 보유 카드사 ["SHINHAN", "KB"]
    easypays: List[str]            # 보유 간편결제 ["TOSS", "KAKAO", "NAVER"]
    telecom: Optional[str] = None  # 통신사 "SKT", "KT", "LGU"
    is_first_pay: bool = False     # 첫 결제 여부

# 추천 결과의 단계별 안내 (테크트리)
class RecommendationStep(BaseModel):
    step_number: int
    title: str
    description: str

# 추천 결과 경로 1개
class PathRecommendation(BaseModel):
    rank: int
    store_name: str
    original_price: int
    final_price: int
    total_discount: int
    applied_benefits: List[str]
    steps: List[RecommendationStep]

# 최종 API 응답
class RecommendationResponse(BaseModel):
    game_id: str
    target_amount: int
    recommended_paths: List[PathRecommendation]