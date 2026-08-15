import sys
from pathlib import Path
from typing import List, Optional
from io import StringIO
import pandas as pd
<<<<<<< Updated upstream
=======
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from google.cloud import bigquery, storage
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
>>>>>>> Stashed changes

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.cloud import storage

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
    membership_tier: Optional[str] = "STANDARD"
    has_subscription: Optional[bool] = False
    has_prev_spend: Optional[bool] = False
    has_pre_applied: Optional[bool] = False
    use_game_benefits: Optional[bool] = True

BUCKET_NAME = "game-csv-bucket"

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server is running"}

# 1. 404 에러 방지용 랭킹 API
@app.get("/ranks")
def get_game_ranks(category: str = "HOGAENG"):
    default_list = [
        {"rank": 1, "name": "쿠키런: 킹덤", "benefitText": "스토어 15% 쿠폰 + 문화상품권 10% 우회 결제", "rankChange": "SAME", "rankChangeText": "-", "badge": "매출 1위"},
        {"rank": 2, "name": "승리의 여신: 니케", "benefitText": "T멤버십 10% 차감 할인 혜택", "rankChange": "UP", "rankChangeText": "▲2", "badge": "인기"},
        {"rank": 3, "name": "메이플스토리M", "benefitText": "원스 쿠폰 20% 즉시 적용", "rankChange": "DOWN", "rankChangeText": "▼1", "badge": "상승"},
        {"rank": 4, "name": "오딘: 발할라 라이징", "benefitText": "매일 첫 결제 10% 할인", "rankChange": "SAME", "rankChangeText": "-", "badge": "유지"},
        {"rank": 5, "name": "기적의 검", "benefitText": "원스 전용 포인트 적립", "rankChange": "SAME", "rankChangeText": "-", "badge": "유지"}
    ]
    return {"title": "실시간 순위 대시보드", "list": default_list}

# 2. 최저가 계산 API
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
        use_game_benefits=request.use_game_benefits,
        force_refresh=True
    )
    return result

# 3. GCS 데이터 연동 & 디버그 자동 복구 API
@app.get("/games")
def get_supported_games(search: Optional[str] = None):
    try:
        # GCP Project ID 및 버킷 지정
        client = storage.Client(project="positive-tuner-504502-m5")
        bucket = client.bucket(BUCKET_NAME)
        
        # 💡 영문 파일명 'games.csv' 직접 지정해서 가져오기
        blob = bucket.blob("2026-0813-games.csv")
        
        if not blob.exists():
            print("❌ GCS 버킷에 'games.csv' 파일이 없습니다.")
            return {"status": "error", "message": "games.csv 파일이 없습니다.", "data": []}

        # CSV 파일 읽기
        csv_data = blob.download_as_text(encoding='utf-8-sig')
        df = pd.read_csv(StringIO(csv_data)).fillna('')
        df.columns = df.columns.str.replace('\ufeff', '', regex=True).str.strip()

        games_list = []
        for idx, row in df.iterrows():
            game_id = str(row.get('game_id') or f"GAME_{idx+1}").strip()
            game_name = str(row.get('game_name') or row.get('name') or '').strip()
            company = str(row.get('company') or '').strip()
            genre_tags_raw = str(row.get('genre_tags') or '').strip()
            description = str(row.get('description') or '').strip()
            icon_url = str(row.get('icon_url') or '').strip()

            if not game_name:
                continue

            tags = [t.strip() for t in genre_tags_raw.split(';') if t.strip()]

            stores = []
            def check_true(val):
                return str(val).strip().upper() in ['TRUE', '1', 'T', 'Y']

            if check_true(row.get('is_google_play')): stores.append('구글')
            if check_true(row.get('is_one_store')): stores.append('원스')
            if check_true(row.get('is_galaxy_store')): stores.append('갤스')
            if check_true(row.get('is_app_store')): stores.append('앱스토어')

            if not stores:
                stores = ['구글']

            games_list.append({
                "id": game_id,
                "name": game_name,
                "company": company if company else "인기 게임사",
                "genre_tags": tags if tags else ["인기"],
                "main_genre": tags[0] if tags else "기타",
                "description": description if description else f"{game_name} 실시간 최저가 연산 지원",
                "icon_url": icon_url,
                "stores": stores
            })

        print(f"✅ [games.csv 수집 완료]: 총 {len(games_list)}개 게임 연동 성공")

        if search:
            query = search.lower()
            games_list = [g for g in games_list if query in g['name'].lower() or query in g['company'].lower()]

        return {
            "status": "ok",
            "total_count": len(games_list),
            "data": games_list
        }

    except Exception as e:
        print(f"❌ GCS 데이터 로드 오류: {e}")
<<<<<<< Updated upstream
        return {"status": "error", "message": str(e), "data": []}
=======
        return {"status": "error", "message": str(e), "data": []}


# [핵심] 최저가 계산 추천 API (알고리즘 연동 - 프론트엔드 직접 반환 복원)
@app.post("/routes", summary="최적 결제 경로 계산 (엔진 직접 연동)")
def get_optimal_routes(request: RouteRequest):
    try:
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
            use_game_benefits=request.use_game_benefits,
            force_refresh=True,
        )
        # 💡 프론트엔드 호환성을 위해 result 객체를 직접 반환합니다.
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"계산 엔진 처리 중 오류가 발생했습니다: {str(e)}",
        )


# [DB 연동] 미지원 게임 신청 적재 API (복원)
@app.post("/games/request", summary="미지원 게임 추가 요청 등록")
def request_game_addition(req: GameRequest, db: Session = Depends(get_db)):
    log_entry = GameRequestLogModel(query=req.query)
    db.add(log_entry)
    db.commit()
    return {
        "status": "success",
        "message": f"'{req.query}' 게임 추가 요청이 Cloud SQL DB에 적재되었습니다.",
    }


# [DB 연동] 결제 링크 클릭 로그 적재 API (복원)
@app.post("/events/outbound-click", summary="추천 결과 결제 링크 클릭 트래킹")
def track_outbound_click(
    req: OutboundClickRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db),
):
    user_id_val = current_user.user_id if current_user else "ANONYMOUS"
    log_entry = OutboundClickLogModel(
        user_id=user_id_val,
        selected_route_id=req.route_id,
        saved_amount=req.saved_amount,
    )
    db.add(log_entry)
    db.commit()
    return {
        "status": "success",
        "message": "클릭 트래킹 데이터가 Cloud SQL DB에 적재되었습니다.",
    }


# [회원] 구글 소셜 로그인 기반 프로필 조회
@app.get("/user/profile", summary="[회원] 내 프로필 조회")
def get_user_profile(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
):
    return {
        "status": "success",
        "data": {
            "user_id": current_user.user_id,
            "email": current_user.email,
            "nickname": current_user.nickname,
            "provider": current_user.provider,
            "telecom": current_user.telecom,
            "use_t_membership": getattr(current_user, "use_t_membership", False),
            "held_epay": parse_db_list(current_user.held_epay),
            "has_naver_plus": current_user.has_naver_plus,
            "has_toss_prime": current_user.has_toss_prime,
            "has_card": current_user.has_card,
            "held_cards": parse_db_list(current_user.held_cards),
            "held_vouchers": parse_db_list(current_user.held_vouchers),
            "preferred_store": current_user.preferred_store,
            "galaxy_store_tier": current_user.galaxy_store_tier,
            "favorite_games": parse_db_list(current_user.favorite_games),
        },
    }


# [회원] 내 프로필/카드/혜택 자산 업데이트
@app.post("/user/profile", summary="[회원] 보유 혜택 자산 프로필 업데이트")
def update_user_profile(
    req: ProfileUpdateRequest,
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db),
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
    return {
        "status": "success",
        "message": "유저 혜택 자산 프로필이 Cloud SQL DB에 성공적으로 업데이트되었습니다.",
    }


# [회원] 탈퇴 및 DB 삭제
@app.delete("/user/withdraw", summary="[회원] 회원 탈퇴 및 DB 영구 파기")
def withdraw_user(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return {
        "status": "success",
        "message": "회원 탈퇴가 완료되어 계정 정보가 DB에서 파기되었습니다.",
    }

# -----------------------------------------------------------------------------
# 6. GCP BigQuery Benefit 데이터 로드 및 조회 API
# -----------------------------------------------------------------------------
PROJECT_ID = "positive-tuner-504502-m5"
DATASET_ID = "benefit"


def fetch_benefits_from_bigquery(table_name: str = "benefit_events"):
    try:
        client = bigquery.Client(project=PROJECT_ID)
        query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{table_name}`"
        query_job = client.query(query)
        df = query_job.to_dataframe()
        return df.fillna("")
    except Exception as e:
        print(f"❌ BigQuery benefit 로드 실패: {e}")
        return None


@app.get("/benefits", summary="BigQuery benefit 데이터세트 조회")
def get_bigquery_benefits(table: str = "benefit_events"):
    df = fetch_benefits_from_bigquery(table_name=table)
    if df is None:
        raise HTTPException(
            status_code=500, detail="BigQuery benefit 데이터를 불러오지 못했습니다."
        )

    records = df.to_dict(orient="records")
    return {
        "status": "success",
        "total_count": len(records),
        "data": records,
    }
>>>>>>> Stashed changes
