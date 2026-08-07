import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

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
    # ★ 신규: 스토어 멤버십 등급. 현재 데이터는 구글플레이만 등급이 나뉘어 있고,
    #   실제 값은 한글 등급명("브론즈"/"실버"/"골드"/"플래티넘"/"다이아몬드")이어야
    #   engine 쪽에서 매칭된다. 프론트에서 등급을 모르면 그냥 안 보내면 된다
    #   (None -> 보장되는 최저 등급이 자동 적용됨).
    membership_tier: Optional[str] = None
    # ★ 신규: 전월실적 조건 충족 여부. 3단계로 취급된다.
    #   None(필드 자체를 안 보냄) = 모름 -> 경고와 함께 포함(기존 동작)
    #   True  = 충족 확인 -> 경고 없이 포함
    #   False = 미충족 확인 -> 계산에서 제외
    has_prev_spend: Optional[bool] = None
    # ⚠ has_subscription(네이버플러스/T멤버십 구독 등)은 이번에 추가하지 않았다.
    #   현재 BigQuery 데이터에 구독 관련 혜택이 0건이라, 지금 추가해봐도 계산에
    #   전혀 반영되지 않는 죽은 필드가 된다. 데이터팀이 구독 혜택 데이터를
    #   추가하면 그때 필드와 engine 쪽 로직을 함께 추가하는 게 맞다.

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
        top_n=10,
        store_tier=request.membership_tier,
        has_prev_spend=request.has_prev_spend,
        # ★ force_refresh는 여기서 매 요청마다 True로 고정하지 않는다.
        #   그러면 캐싱이 사실상 무력화되어(10분 TTL 무의미), 사용자가 몰릴 때
        #   매번 BigQuery를 직접 때려서 응답 지연/과금 증가로 이어질 수 있다.
        #   "DB 방금 갱신했으니 즉시 반영하고 싶다"는 요구는 아래 관리자 전용
        #   엔드포인트(/admin/refresh-cache)로 따로 분리했다.
    )
    return result


@app.post("/admin/refresh-cache")
def refresh_cache():
    """
    운영자가 BigQuery 데이터를 갱신한 직후, 캐시가 10분 지나기를 기다리지 않고
    즉시 반영하고 싶을 때 1회성으로 호출하는 관리자 전용 엔드포인트.
    /routes에 force_refresh=True를 상시로 박아두는 대신 이렇게 분리해서,
    일반 사용자 요청은 계속 캐시를 타면서도 필요할 때만 강제 갱신할 수 있게 한다.
    """
    from engine.loader import load_data
    benefit_rows, platform_rows = load_data(force_refresh=True)
    return {
        "status": "refreshed",
        "benefit_rows": len(benefit_rows),
        "platform_rows": len(platform_rows),
    }