import json
import os
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy.orm import Session

# -----------------------------------------------------------------------------
# 1. 내부 모듈 Import (인증, DB, 모델)
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from auth import verify_google_token_and_get_user, verify_google_token_optional
from database import Base, engine, get_db
from engine.loader import get_client, recommend_best_routes
from models import GameRequestLogModel, OutboundClickLogModel, UserModel

# -----------------------------------------------------------------------------
# 2. 초기 설정 및 SQLite DB 테이블 생성
# -----------------------------------------------------------------------------
Base.metadata.create_all(bind=engine)

PROJECT_ID = "positive-tuner-504502-m5"
DATASET_ID = "benefit"

app = FastAPI(
    title="Optimal Payment Route API",
    description="BigQuery & Google OAuth 로그인 통합 API",
    version="3.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=500)

# -----------------------------------------------------------------------------
# 3. 데이터 변환 헬퍼 함수 (DB ↔ 프론트엔드)
# -----------------------------------------------------------------------------
def parse_db_list(val: Optional[str]) -> List[str]:
    if not val or val == "NONE":
        return []
    val_str = str(val).strip()
    if val_str.startswith("["):
        try:
            res = json.loads(val_str)
            return res if isinstance(res, list) else []
        except Exception:
            pass
    return [x.strip() for x in val_str.split(";") if x.strip() and x.strip() != "NONE"]


def to_db_string(val_list: Optional[List[str]]) -> str:
    if not val_list:
        return "NONE"
    clean_list = [str(x).strip() for x in val_list if str(x).strip() and str(x).strip() != "NONE"]
    return ";".join(clean_list) if clean_list else "NONE"

# -----------------------------------------------------------------------------
# 4. Pydantic DTO
# -----------------------------------------------------------------------------
class RouteRequest(BaseModel):
    platform: str = Field("ALL")
    amount: int = Field(..., gt=0, le=10_000_000)
    is_first_pay: bool = Field(False)
    payment_methods: List[str] = Field(default_factory=list)
    game: str = Field("COOKIERUN_KINGDOM")
    membership_tier: Optional[str] = Field("GENERAL")
    has_prev_spend: Optional[bool] = Field(False)
    has_pre_applied: Optional[bool] = Field(False)
    use_game_benefits: Optional[bool] = Field(True)

    @field_validator("platform")
    @classmethod
    def clean_platform(cls, v: str) -> str:
        return v.strip().upper() if v else "ALL"

    @field_validator("payment_methods")
    @classmethod
    def clean_payment_methods(cls, v: List[str]) -> List[str]:
        return [str(m).strip().upper() for m in v if str(m).strip() and str(m).strip() != "NONE"]


class GameRequest(BaseModel):
    query: str


class OutboundClickRequest(BaseModel):
    route_id: str
    saved_amount: int = 0


class ProfileUpdateRequest(BaseModel):
    nickname: Optional[str] = None
    telecom: Optional[str] = "NONE"
    use_t_membership: Optional[bool] = False
    held_epay: List[str] = []
    has_naver_plus: Optional[bool] = False
    has_toss_prime: Optional[bool] = False
    has_card: Optional[bool] = False
    held_cards: List[str] = []
    held_vouchers: List[str] = []
    preferred_store: Optional[str] = "NONE"
    galaxy_store_tier: Optional[str] = "NONE"
    favorite_games: List[str] = []


class GameSearchLogRequest(BaseModel):
    game_name: str

# -----------------------------------------------------------------------------
# 5. API 엔드포인트
# -----------------------------------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server connected with BigQuery & DB"}


# [BigQuery] game_info 테이블 조회
@app.get("/games", summary="BigQuery game_info 실시간 연동")
def get_supported_games(search: Optional[str] = None):
    try:
        client = get_client()
        query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.game_info`"
        query_job = client.query(query)
        rows = query_job.result()

        games_list = []
        for row in rows:
            game_name = str(row.get("game_name") or "").strip()
            if not game_name:
                continue

            genre_tags_raw = str(row.get("genre_tags") or "").strip()
            tags = [t.strip() for t in genre_tags_raw.split(";") if t.strip()]

            stores = []
            def is_true(val):
                return str(val).strip().upper() in ["TRUE", "1", "T", "Y"]

            if is_true(row.get("is_google_play")): stores.append("구글")
            if is_true(row.get("is_one_store")): stores.append("원스")
            if is_true(row.get("is_galaxy_store")): stores.append("갤스")
            if is_true(row.get("is_app_store")): stores.append("앱스토어")

            games_list.append({
                "id": str(row.get("game_id") or "").strip(),
                "name": game_name,
                "company": str(row.get("company") or "").strip(),
                "genre_tags": tags if tags else ["인기"],
                "main_genre": tags[0] if tags else "기타",
                "description": str(row.get("description") or "").strip(),
                "icon_url": str(row.get("icon_url") or "").strip(),
                "stores": stores if stores else ["구글"],
            })

        if search:
            query_str = search.lower().strip()
            games_list = [g for g in games_list if query_str in g["name"].lower() or query_str in g["company"].lower()]

        return {"status": "ok", "total_count": len(games_list), "data": games_list}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BigQuery game_info DB 연동 실패: {str(e)}"
        )


# [최저가 추천 연산 API]
@app.post("/routes", summary="최적 결제 경로 계산")
def get_optimal_routes(request: RouteRequest):
    try:
        return recommend_best_routes(
            platform=request.platform,
            amount=request.amount,
            held_methods=list(request.payment_methods),
            game=request.game,
            is_first_purchase=request.is_first_pay,
            top_n=10,
            store_tier=request.membership_tier,
            has_prev_spend=request.has_prev_spend,
            has_pre_applied=request.has_pre_applied,
            use_game_benefits=request.use_game_benefits,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계산 엔진 처리 오류: {str(e)}")


# [미지원 게임 추가 요청 Log]
@app.post("/games/request")
def request_game_addition(req: GameRequest, db: Session = Depends(get_db)):
    log_entry = GameRequestLogModel(query=req.query)
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": f"'{req.query}' 게임 요청 적재 완료"}


# [아웃바운드 클릭 Log]
@app.post("/events/outbound-click")
def track_outbound_click(
    req: OutboundClickRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db)
):
    user_id_val = current_user.user_id if current_user else "ANONYMOUS"
    log_entry = OutboundClickLogModel(
        user_id=user_id_val,
        selected_route_id=req.route_id,
        saved_amount=req.saved_amount
    )
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": "클릭 트래킹 적재 완료"}


# 🔑 [회원 로그인/프로필 API]
@app.get("/user/profile", summary="[회원] 내 프로필 조회")
def get_user_profile(current_user: UserModel = Depends(verify_google_token_and_get_user)):
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


# 🔑 [회원 프로필 저장 API]
@app.post("/user/profile", summary="[회원] 보유 혜택 자산 프로필 업데이트")
def update_user_profile(
    req: ProfileUpdateRequest,
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db)
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
    return {"status": "success", "message": "프로필 업데이트 완료"}


# 🔑 [회원 탈퇴 API]
@app.delete("/user/withdraw", summary="[회원] 회원 탈퇴 및 DB 영구 파기")
def withdraw_user(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db)
):
    db.delete(current_user)
    db.commit()
    return {
        "status": "success",
        "message": "회원 탈퇴가 완료되어 계정 정보가 DB에서 파기되었습니다.",
    }


# [BigQuery 조회를 위한 혜택 데이터 API]
@app.get("/benefits", summary="BigQuery benefit_info_staging 조회")
def get_bigquery_benefits(table: str = "benefit_info_staging"):
    try:
        client = get_client()
        df = client.query(f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{table}`").to_dataframe().fillna("")
        records = df.to_dict(orient="records")
        return {"status": "success", "total_count": len(records), "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BigQuery 데이터 조회 실패: {str(e)}")


# main.py 파일의 /payments 엔드포인트 전체 교체

@app.get("/payments", summary="지원 결제 수단 및 세부 혜택 목록 동적 조회")
def get_supported_payment_methods():
    try:
        client = get_client()
        query = f"""
            SELECT
                COALESCE(NULLIF(p.payment_method, ''), b.provider_or_retailer) AS payment_method,
                p.platform,
                p.is_supported,
                p.note,
                b.benefit_id,
                b.category,
                b.item_or_event_name,
                b.condition_raw_text,
                b.benefit_type,
                b.benefit_value,
                b.benefit_unit,
                b.target_game,
                b.payment_method_icon_url
            FROM `{PROJECT_ID}.{DATASET_ID}.benefit_info` b
            FULL OUTER JOIN `{PROJECT_ID}.{DATASET_ID}.platform_connection` p
              ON b.provider_or_retailer = p.payment_method
        """
        query_job = client.query(query)
        rows = list(query_job.result())

        STORE_NAME_MAP = {
            "GOOGLE_PLAY": "구글",
            "ONE_STORE": "원스",
            "GALAXY_STORE": "갤스",
            "APP_STORE": "앱스토어"
        }

        # main.py 내부 determine_category 함수 수정

# main.py 파일 내 determine_category 함수 교체

        def determine_category(method: str, cat: str) -> tuple:
            m_up = (method or "").upper()
            c_up = (cat or "").upper()

            # 1. 상품권 / 기프트카드류 우선 판별
            voucher_keywords = [
                "GIFTCARD", "GIFT", "VOUCHER", "CULTURELAND", "BOOKNLIFE", 
                "ZEROPIN", "11STREET", "GMARKET", "SSG", "CONVENIENCE", "CU_"
            ]
            if any(k in m_up for k in voucher_keywords):
                return "VOUCHER", "상품권 우회", "🎟️"

            # 2. 간편결제 (삼성페이 포함)
            pay_keywords = ["PAY", "SAMSUNG_PAY", "NAVER", "KAKAO", "TOSS", "PAYCO", "APPLE_PAY"]
            if any(k in m_up for k in pay_keywords):
                return "PAY", "간편결제", "💸"

            # 3. 제휴 카드
            card_keywords = ["CARD", "SHINHAN", "KB", "NH", "HANA", "HYUNDAI", "LOTTE", "BC", "SAMSUNG_CARD", "KOOKMIN", "NONGHYUP"]
            if "CARD" in c_up or any(k in m_up for k in card_keywords):
                return "CARD", "제휴 카드", "💳"

            # 4. 통신사
            if any(k in m_up for k in ["SKT", "KT", "LGU", "CARRIER"]):
                return "CARRIER", "통신사", "📶"

            return "PAY", "기타", "💸"

        methods_map = {}
        for row in rows:
            # Row 객체 안전 디코딩 (dict 또는 Row 접근 호환)
            r = dict(row) if hasattr(row, 'keys') else row
            
            m_code = str(r.get("payment_method") or "").strip()
            platform = str(r.get("platform") or "").strip()
            is_supported_val = r.get("is_supported")
            is_supported = str(is_supported_val).strip().lower() in ["true", "1", "t", "y"] if is_supported_val is not None else False
            note = str(r.get("note") or "").strip()
            category_raw = str(r.get("category") or "").strip()
            event_name = str(r.get("item_or_event_name") or "").strip()
            condition_text = str(r.get("condition_raw_text") or "").strip()
            icon_url = str(r.get("payment_method_icon_url") or "").strip()

            if not m_code:
                continue

            if m_code not in methods_map:
                cat_id, tag_name, icon_emoji = determine_category(m_code, category_raw)
                methods_map[m_code] = {
                    "id": len(methods_map) + 1,
                    "code": m_code,
                    "name": m_code.replace("_", " "),
                    "icon": icon_emoji,
                    "icon_url": icon_url,
                    "category": cat_id,
                    "tag": tag_name,
                    "stores": set(),
                    "benefits": []
                }

            if is_supported and platform in STORE_NAME_MAP:
                methods_map[m_code]["stores"].add(STORE_NAME_MAP[platform])

            benefit_id = str(r.get("benefit_id") or "").strip()
            if condition_text or event_name or note:
                b_item = {
                    "benefit_id": benefit_id or f"BNF_{len(methods_map[m_code]['benefits'])+1}",
                    "title": event_name or f"{m_code} 기본 혜택",
                    "condition": condition_text or note or "상세 조건은 스토어 이벤트 페이지 참고",
                    "benefit_type": str(r.get("benefit_type") or "DISCOUNT").strip(),
                    "benefit_value": str(r.get("benefit_value") or "0").strip(),
                    "benefit_unit": str(r.get("benefit_unit") or "PERCENT").strip(),
                    "target_game": str(r.get("target_game") or "ALL").strip(),
                }
                if not any(existing["condition"] == b_item["condition"] for existing in methods_map[m_code]["benefits"]):
                    methods_map[m_code]["benefits"].append(b_item)

        result_list = []
        for item in methods_map.values():
            stores_list = list(item["stores"])
            result_list.append({
                "id": item["id"],
                "code": item["code"],
                "name": item["name"],
                "icon": item["icon"],
                "icon_url": item["icon_url"],
                "category": item["category"],
                "tag": item["tag"],
                "benefit_count": len(item["benefits"]),
                "benefits": item["benefits"],
                "stores": stores_list if stores_list else ["구글", "원스", "갤스", "앱스토어"]
            })

        return {"status": "ok", "total_count": len(result_list), "data": result_list}

    except Exception as e:
        import traceback
        print("=== /payments 백엔드 에러 발생 상세 ===")
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BigQuery 결제수단 데이터 조회 실패: {str(e)}"
        )


@app.post("/games/search-log", summary="게임 검색 카운트 수집")
def log_game_search(req: GameSearchLogRequest, db: Session = Depends(get_db)):
    game_name = req.game_name.strip()
    if not game_name:
        return {"status": "ignored"}
    
    log_entry = GameRequestLogModel(query=game_name)
    db.add(log_entry)
    db.commit()
    return {"status": "success", "message": f"'{game_name}' 검색 카운트 기록 완료"}


@app.get("/ranks", summary="실시간 인기 검색 게임 랭킹 TOP 20")
def get_game_ranks(category: str = "HOGAENG", db: Session = Depends(get_db)):
    try:
        from sqlalchemy import func
        results = (
            db.query(GameRequestLogModel.query, func.count(GameRequestLogModel.id).label("search_count"))
            .group_by(GameRequestLogModel.query)
            .order_by(func.count(GameRequestLogModel.id).desc())
            .limit(20)
            .all()
        )

        rank_list = []
        for idx, row in enumerate(results):
            g_name = row[0]
            count = row[1]
            rank_list.append({
                "rank": idx + 1,
                "name": g_name,
                "benefitText": f"최근 누적 검색 {count}회",
                "searchCount": count,
                "rankChange": "SAME",
                "rankChangeText": "-",
                "badge": "1위" if idx == 0 else ("인기" if idx < 3 else None)
            })

        # main.py 내부 487~489번째 줄 부근 수정

        if not rank_list:
            from fallback_rank import FALLBACK_HOGAENG_RANK_DATA  # 💡 파일명 변경에 맞게 수정
            return FALLBACK_HOGAENG_RANK_DATA

        return {
            "title": "🔥 호갱탈출 최근 7일간 인기 검색 순위",
            "list": rank_list
        }
    except Exception as e:
        return {
            "title": "🔥 호갱탈출 최근 7일간 인기 검색 순위",
            "list": [
                {"rank": 1, "name": "쿠키런: 킹덤", "benefitText": "최근 7일 검색 1위", "rankChange": "SAME", "rankChangeText": "-", "badge": "1위"},
                {"rank": 2, "name": "리니지M", "benefitText": "인기 검색 게임", "rankChange": "UP", "rankChangeText": "▲1", "badge": "인기"},
                {"rank": 3, "name": "오딘: 발할라 라이징", "benefitText": "검색량 급상승", "rankChange": "UP", "rankChangeText": "▲2", "badge": "상승"},
            ]
        }