import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.gzip import GZipMiddleware
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from google.cloud import bigquery

# -----------------------------------------------------------------------------
# 1. 내부 모듈 Import (인증, DB, 모델)
# -----------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))

from auth import require_admin, verify_google_token_and_get_user, verify_google_token_optional
from database import Base, engine, get_db
from engine.loader import get_client, recommend_best_routes
from models import GameRequestLogModel, OutboundClickLogModel, UserGameActivityLogModel, UserModel

# 신규 테이블(user_game_activity_logs 등)은 이미 있는 테이블은 건드리지 않고 없는 것만 생성한다
Base.metadata.create_all(bind=engine)

PROJECT_ID = os.getenv("GCP_PROJECT_ID", "positive-tuner-504502-m5")
DATASET_ID = os.getenv("BIGQUERY_DATASET_ID", "benefit")

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
# 2. 데이터 변환 헬퍼 함수 (DB ↔ 프론트엔드)
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
# 3. Pydantic DTO
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

# -----------------------------------------------------------------------------
# 4. API 엔드포인트
# -----------------------------------------------------------------------------

@app.get("/")
def health_check():
    return {"status": "ok", "message": "API Server connected with BigQuery & DB"}


@app.get("/ranks")
def get_game_ranks(category: str = "HOGAENG"):
    default_list = [
        {"rank": 1, "name": "쿠키런: 킹덤", "benefitText": "스토어 15% 쿠폰 + 문화상품권 10% 우회 결제", "rankChange": "SAME", "rankChangeText": "-", "badge": "매출 1위"},
        {"rank": 2, "name": "승리의 여신: 니케", "benefitText": "T멤버십 10% 차감 할인 혜택", "rankChange": "UP", "rankChangeText": "▲2", "badge": "인기"},
        {"rank": 3, "name": "메이플스토리M", "benefitText": "원스 쿠폰 20% 즉시 적용", "rankChange": "DOWN", "rankChangeText": "▼1", "badge": "상승"},
        {"rank": 4, "name": "오딘: 발할라 라이징", "benefitText": "매일 첫 결제 10% 할인", "rankChange": "SAME", "rankChangeText": "-", "badge": "유지"},
        {"rank": 5, "name": "기적의 검", "benefitText": "원스 전용 포인트 적립", "rankChange": "SAME", "rankChangeText": "-", "badge": "유지"},
    ]
    return {"title": "실시간 순위 대시보드", "list": default_list}


# [BigQuery] game_info 테이블 파라미터 기반 안전 조회
@app.get("/games", summary="BigQuery game_info 실시간 연동")
def get_supported_games(search: Optional[str] = None):
    try:
        client = get_client()
        
        # SQL Injection 방지를 위한 Parameterized Query 준비
        query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.game_info`"
        job_config = bigquery.QueryJobConfig()

        if search:
            search_param = f"%{search.strip().lower()}%"
            query += " WHERE LOWER(game_name) LIKE @search OR LOWER(company) LIKE @search"
            job_config.query_parameters = [
                bigquery.ScalarQueryParameter("search", "STRING", search_param)
            ]

        query_job = client.query(query, job_config=job_config)
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

        return {"status": "ok", "total_count": len(games_list), "data": games_list}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BigQuery game_info DB 연동 실패: {str(e)}"
        )


# [최저가 추천 연산 API]
@app.post("/routes", summary="최적 결제 경로 계산")
def get_optimal_routes(
    request: RouteRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db),
):
    try:
        result = recommend_best_routes(
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

        # 관리자 대시보드용 유저별 게임 이용 로그 (로그인 유저만 적재)
        if current_user and request.game and request.game != "ALL":
            db.add(UserGameActivityLogModel(
                user_id=current_user.user_id,
                game_name=request.game,
                event_type="ROUTE_CALC",
            ))
            db.commit()

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"계산 엔진 처리 오류: {str(e)}")


class GameSearchLogRequest(BaseModel):
    game_name: str


# [게임 검색 로그] 관리자 대시보드 유저별 선호 게임 랭킹 산출용
@app.post("/games/search-log", summary="게임 검색 카운트 수집")
def log_game_search(
    req: GameSearchLogRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db),
):
    game_name = req.game_name.strip()
    if not game_name:
        return {"status": "ignored"}

    try:
        log_entry = GameRequestLogModel(query=game_name)
        db.add(log_entry)

        if current_user:
            db.add(UserGameActivityLogModel(
                user_id=current_user.user_id,
                game_name=game_name,
                event_type="SEARCH",
            ))

        db.commit()
        return {"status": "success", "message": f"'{game_name}' 검색 기록 완료"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"검색 로그 적재 실패: {str(e)}")


# [미지원 게임 추가 요청 Log]
@app.post("/games/request")
def request_game_addition(req: GameRequest, db: Session = Depends(get_db)):
    try:
        log_entry = GameRequestLogModel(query=req.query)
        db.add(log_entry)
        db.commit()
        return {"status": "success", "message": f"'{req.query}' 게임 요청 적재 완료"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"로그 적재 실패: {str(e)}")


# [아웃바운드 클릭 Log]
@app.post("/events/outbound-click")
def track_outbound_click(
    req: OutboundClickRequest,
    current_user: Optional[UserModel] = Depends(verify_google_token_optional),
    db: Session = Depends(get_db)
):
    try:
        user_id_val = current_user.user_id if current_user else "ANONYMOUS"
        log_entry = OutboundClickLogModel(
            user_id=user_id_val,
            selected_route_id=req.route_id,
            saved_amount=req.saved_amount
        )
        db.add(log_entry)
        db.commit()
        return {"status": "success", "message": "클릭 트래킹 적재 완료"}
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"트래킹 로그 적재 실패: {str(e)}")


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
    try:
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
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"프로필 저장 실패: {str(e)}")


# 🔑 [회원 탈퇴 API]
@app.delete("/user/withdraw", summary="[회원] 회원 탈퇴 및 DB 영구 파기")
def withdraw_user(
    current_user: UserModel = Depends(verify_google_token_and_get_user),
    db: Session = Depends(get_db)
):
    try:
        db.delete(current_user)
        db.commit()
        return {
            "status": "success",
            "message": "회원 탈퇴가 완료되어 계정 정보가 DB에서 파기되었습니다.",
        }
    except SQLAlchemyError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"회원 탈퇴 처리 실패: {str(e)}")


# [BigQuery 조회를 위한 혜택 데이터 API]
@app.get("/benefits", summary="BigQuery benefit_info_staging 조회")
def get_bigquery_benefits(table: str = "benefit_info_staging"):
    # 🔒 테이블 이름 SQL Injection 방지를 위한 White-List 검증
    ALLOWED_TABLES = ["benefit_info_staging", "benefit_info", "game_info"]
    if table not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail="허용되지 않은 테이블 요청입니다.")

    try:
        client = get_client()
        df = client.query(f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.{table}`").to_dataframe().fillna("")
        records = df.to_dict(orient="records")
        return {"status": "success", "total_count": len(records), "data": records}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BigQuery 데이터 조회 실패: {str(e)}")


# [공통] BigQuery platform_connection & benefit_info 연동 결제 수단 API
@app.get("/payments", summary="지원 결제 수단 및 세부 혜택 목록 동적 조회")
def get_supported_payment_methods():
    try:
        client = get_client()
        query = f"""
            SELECT
                p.payment_method,
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
            FROM `{PROJECT_ID}.{DATASET_ID}.platform_connection` p
            LEFT JOIN `{PROJECT_ID}.{DATASET_ID}.benefit_info` b
              ON p.payment_method = b.provider_or_retailer
        """
        df = client.query(query).to_dataframe().fillna("")

        STORE_NAME_MAP = {
            "GOOGLE_PLAY": "구글",
            "ONE_STORE": "원스",
            "GALAXY_STORE": "갤스",
            "APP_STORE": "앱스토어"
        }

        def determine_category(method: str, cat: str) -> tuple:
            method_upper = method.upper()
            if any(k in method_upper for k in ["PAY", "NAVER", "KAKAO", "TOSS", "SAMSUNG_PAY", "PAYCO", "APPLE_PAY"]):
                return "PAY", "간편결제", "💸"
            elif any(k in method_upper for k in ["SKT", "KT", "LGU", "CARRIER"]):
                return "CARRIER", "통신사", "📶"
            elif any(k in method_upper for k in ["CARD", "SHINHAN", "SAMSUNG", "KB", "NH", "HANA"]):
                return "CARD", "신용/체크카드", "💳"
            elif any(k in method_upper for k in ["CULTURELAND", "VOUCHER", "GIFTCARD", "BOOKNLIFE", "ZEROPIN"]):
                return "VOUCHER", "상품권 우회", "🎟️"
            return "PAY", "기타", "💸"

        methods_map = {}
        for idx, row in df.iterrows():
            m_code = str(row.get("payment_method") or "").strip()
            platform = str(row.get("platform") or "").strip()
            is_supported = str(row.get("is_supported")).strip().lower() in ["true", "1", "t", "y"]
            note = str(row.get("note") or "").strip()
            category_raw = str(row.get("category") or "").strip()
            event_name = str(row.get("item_or_event_name") or "").strip()
            condition_text = str(row.get("condition_raw_text") or "").strip()
            icon_url = str(row.get("payment_method_icon_url") or "").strip()

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

            benefit_id = str(row.get("benefit_id") or "").strip()
            if condition_text or event_name or note:
                b_item = {
                    "benefit_id": benefit_id or f"BNF_{len(methods_map[m_code]['benefits'])+1}",
                    "title": event_name or f"{m_code} 기본 혜택",
                    "condition": condition_text or note or "상세 조건은 스토어 이벤트 페이지 참고",
                    "benefit_type": str(row.get("benefit_type") or "DISCOUNT").strip(),
                    "benefit_value": str(row.get("benefit_value") or "0").strip(),
                    "benefit_unit": str(row.get("benefit_unit") or "PERCENT").strip(),
                    "target_game": str(row.get("target_game") or "ALL").strip(),
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
                "stores": stores_list if stores_list else ["구글"]
            })

        return {"status": "ok", "total_count": len(result_list), "data": result_list}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BigQuery 결제수단 데이터 조회 실패: {str(e)}"
        )


# -----------------------------------------------------------------------------
# 관리자 대시보드 API (UserModel.role == "ROLE_ADMIN" 회원만 접근 가능)
# -----------------------------------------------------------------------------

@app.get("/admin/stats/summary", summary="[관리자] 총 이용자 수 & 활성 사용자 수 통계")
def get_admin_stats_summary(
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_users = db.query(func.count(UserModel.user_id)).scalar() or 0

    now = datetime.now(timezone.utc)
    dau_cutoff = now - timedelta(days=1)
    wau_cutoff = now - timedelta(days=7)
    mau_cutoff = now - timedelta(days=30)

    active_daily = db.query(func.count(UserModel.user_id)).filter(UserModel.last_login_at >= dau_cutoff).scalar() or 0
    active_weekly = db.query(func.count(UserModel.user_id)).filter(UserModel.last_login_at >= wau_cutoff).scalar() or 0
    active_monthly = db.query(func.count(UserModel.user_id)).filter(UserModel.last_login_at >= mau_cutoff).scalar() or 0

    return {
        "status": "success",
        "data": {
            "total_users": total_users,
            "active_users_daily": active_daily,
            "active_users_weekly": active_weekly,
            "active_users_monthly": active_monthly,
            "generated_at": now.isoformat(),
        },
    }


@app.get("/admin/users", summary="[관리자] 유저 로그 모니터링 테이블 (가입일/최근 로그인/선호 게임 랭킹)")
def get_admin_user_logs(
    limit: int = 50,
    offset: int = 0,
    current_admin: UserModel = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_count = db.query(func.count(UserModel.user_id)).scalar() or 0
    users = (
        db.query(UserModel)
        .order_by(UserModel.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    user_ids = [u.user_id for u in users]

    games_by_user: dict[str, list[dict]] = {}
    if user_ids:
        activity_rows = (
            db.query(
                UserGameActivityLogModel.user_id,
                UserGameActivityLogModel.game_name,
                func.count(UserGameActivityLogModel.id).label("play_count"),
            )
            .filter(UserGameActivityLogModel.user_id.in_(user_ids))
            .group_by(UserGameActivityLogModel.user_id, UserGameActivityLogModel.game_name)
            .order_by(UserGameActivityLogModel.user_id, func.count(UserGameActivityLogModel.id).desc())
            .all()
        )
        for uid, game_name, play_count in activity_rows:
            bucket = games_by_user.setdefault(uid, [])
            if len(bucket) < 3:
                bucket.append({"game_name": game_name, "play_count": play_count})

    now = datetime.now(timezone.utc)
    user_rows = []
    for u in users:
        top_games = games_by_user.get(u.user_id)
        if not top_games:
            top_games = [
                {"game_name": g, "play_count": 0}
                for g in parse_db_list(u.favorite_games)[:3]
            ]

        # Postgres(timestamptz)는 timezone-aware 값을 돌려주지만, 예전 SQLite 데이터가 섞여있으면
        # naive일 수 있어 UTC로 간주해 맞춰준다 (naive - aware는 TypeError).
        last_login = u.last_login_at
        if last_login and last_login.tzinfo is None:
            last_login = last_login.replace(tzinfo=timezone.utc)

        user_rows.append({
            "user_id": u.user_id,
            "email": u.email,
            "nickname": u.nickname,
            "provider": u.provider,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
            "is_active_7d": bool(last_login and (now - last_login) <= timedelta(days=7)),
            "top_games": top_games,
        })

    return {
        "status": "success",
        "data": {
            "total_count": total_count,
            "limit": limit,
            "offset": offset,
            "users": user_rows,
        },
    }