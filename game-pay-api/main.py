# (상단 Import 및 DTO 선언 부분 동일)

# [BigQuery] game_info 테이블 안전하게 조회
@app.get("/games", summary="BigQuery game_info 실시간 연동")
def get_supported_games(search: Optional[str] = None):
    try:
        client = get_client()
        query = f"SELECT * FROM `{PROJECT_ID}.{DATASET_ID}.game_info`"
        
        # 검색어가 있을 경우 파라미터화된 SQL Injection 방지 조치
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
            detail=f"BigQuery 연동 실패: {str(e)}"
        )


# [미지원 게임 추가 요청 Log]
@app.post("/games/request")
def request_game_addition(req: GameRequest, db: Session = Depends(get_db)):
    try:
        log_entry = GameRequestLogModel(query=req.query)
        db.add(log_entry)
        db.commit()
        return {"status": "success", "message": f"'{req.query}' 게임 요청 적재 완료"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"로그 적재 실패: {str(e)}")


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
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"프로필 저장 실패: {str(e)}")