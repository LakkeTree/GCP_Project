"""
===============================================================================
계산 엔진 v11 — 기프트카드 할인 + 스토어 적립 중첩 연산 완벽 반영 버전
===============================================================================
"""

import itertools

PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
CALCULABLE_TYPES = {"DISCOUNT", "REWARD", "CASHBACK", "FEE"}
EXCLUDED_DISBURSEMENT = {"INFO_ONLY"}
EXCLUDED_RESTRICTION_FOR_DISCOUNT_ONLY = {"POINT_ONLY"}

FALLBACK_PERCENT_CAP_KRW = 10000

STORE_PROVIDER_TO_PLATFORM = {
    "GOOGLE_PLAY_STORE": "GOOGLE_PLAY",
    "GOOGLE_PLAY": "GOOGLE_PLAY",
    "ONE_STORE": "ONE_STORE",
    "GALAXY_STORE": "GALAXY_STORE",
    "APP_STORE": "APP_STORE",
}

TIER_MAP = {
    "BRONZE": ["브론즈", "BRONZE"],
    "SILVER": ["실버", "SILVER"],
    "GOLD": ["골드", "GOLD"],
    "PLATINUM": ["플래티넘", "PLATINUM"],
    "DIAMOND": ["다이아몬드", "DIAMOND"],
    "STANDARD": ["기본", "상시", "STANDARD"],
    "PRESTIGE": ["프레스티지", "PRESTIGE"],
    "ROYAL_BLUE": ["로열블루", "ROYAL_BLUE"],
}


def build_compatibility_index(platform_rows):
    return {
        (row["payment_method"], row["platform"]): row["is_supported"]
        for row in platform_rows
    }


def is_method_supported(compat_index, payment_method, platform):
    return compat_index.get((payment_method, platform), True)


def filter_eligible_benefits(benefits, compat_index, platform, game, amount,
                             held_methods, is_first_purchase, has_prev_spend=None,
                             has_pre_applied=False, use_game_benefits=True):
    eligible = []
    warnings = []

    for b in benefits:
        if b["benefit_type"] not in CALCULABLE_TYPES:
            continue
        if b["disbursement_type"] in EXCLUDED_DISBURSEMENT:
            continue
        if b["is_probabilistic"]:
            continue
        if b["benefit_type"] == "DISCOUNT" and \
           b["payment_method_restriction"] in EXCLUDED_RESTRICTION_FOR_DISCOUNT_ONLY:
            continue
        if b["target_platform"] != "ALL" and b["target_platform"] != platform:
            continue

        # 보유 결제수단 검증 (기프트카드/상품권은 우회 보유 수단 연동)
        if b["stacking_layer"] != "STORE_COUPON":
            if b["category"] in ("GIFT_CARD", "VOUCHER_PURCHASE"):
                giftcard_held = any(m in held_methods for m in ["GOOGLE_PLAY_GIFTCARD", "ZEROPIN", "GMARKET", "11STREET", "SSG_COM", "CULTURELAND_CASH", "CULTURELAND_VOUCHER"])
                if not giftcard_held and b["provider_or_retailer"] not in held_methods:
                    continue
            elif b["provider_or_retailer"] not in held_methods:
                continue
        else:
            provider_platform = STORE_PROVIDER_TO_PLATFORM.get(b["provider_or_retailer"])
            if provider_platform is not None and provider_platform != platform:
                continue

        # 사전 응모 조건 검증
        if b.get("requires_pre_app") and not has_pre_applied:
            continue

        # 게임 전용 혜택 옵션 필터링
        if not use_game_benefits:
            if b["target_game"] != "ALL":
                continue
        else:
            if b["target_game"] != "ALL" and b["target_game"] != game:
                continue

        if amount < b["min_spend_krw"]:
            continue
        if b["is_first_purchase"] and not is_first_purchase:
            continue

        # 구조화되지 않은 누적 실적 조건 제외
        UNSTRUCTURED_THRESHOLD_KEYWORDS = ("월간 누적", "연간 누적", "전월 누적")
        text = b.get("condition_raw_text") or ""
        if b["min_prev_month_spend_krw"] is None and \
           any(kw in text for kw in UNSTRUCTURED_THRESHOLD_KEYWORDS):
            continue

        if b["min_prev_month_spend_krw"] and has_prev_spend is False:
            continue

        if not is_method_supported(compat_index, b["provider_or_retailer"], platform):
            continue

        notes = []
        if b["min_prev_month_spend_krw"] and has_prev_spend is not True:
            notes.append(f"전월실적 {b['min_prev_month_spend_krw']:,}원 이상 필요")
        if b["requires_pre_app"]:
            notes.append("사전 응모 필요")
        if b["user_segment"] == "VIP_MEMBER":
            notes.append("특정 등급 회원 전용")
        if b["is_first_come_first_served"]:
            notes.append("선착순 (조기 마감 가능)")
        if notes:
            warnings.append({"benefit_id": b["benefit_id"],
                             "provider": b["provider_or_retailer"],
                             "conditions": notes})

        eligible.append(b)

    return eligible, warnings


def apply_cap(effect, benefit):
    cap = benefit["max_benefit_krw"]
    if cap is None:
        return effect
    if cap > 0:
        return min(effect, cap)
    if benefit["benefit_unit"] == "PERCENT":
        return min(effect, FALLBACK_PERCENT_CAP_KRW)
    return effect


def find_min_overshoot_combo(denominations, target_amount):
    if isinstance(denominations, str):
        denominations = [int(x) for x in denominations.split(";") if x.strip().isdigit()]
    elif not denominations or not isinstance(denominations, (list, tuple)):
        denominations = [5000, 10000, 30000, 50000, 100000]

    if target_amount <= 0:
        return None

    UNIT = 1000
    if any(d % UNIT != 0 for d in denominations):
        UNIT = 1
    denom_units = [d // UNIT for d in denominations]
    target_units = -(-target_amount // UNIT)
    upper_bound = target_units + max(denom_units)

    reachable = [None] * (upper_bound + 1)
    reachable[0] = []
    for s in range(1, upper_bound + 1):
        for d in denom_units:
            if d <= s and reachable[s - d] is not None:
                candidate = reachable[s - d] + [d]
                if reachable[s] is None or len(candidate) < len(reachable[s]):
                    reachable[s] = candidate

    for s in range(target_units, upper_bound + 1):
        if reachable[s] is not None:
            return s * UNIT, [d * UNIT for d in reachable[s]]
    return None


def build_giftcard_routes(giftcard_benefits, all_benefits, held_methods, platform, target_amount):
    routes = []

    for benefit in giftcard_benefits:
        result = find_min_overshoot_combo(benefit.get("denomination_list"), target_amount)
        if result is None:
            continue
        face_total, combo = result

        btype = benefit["benefit_type"]
        if benefit["benefit_unit"] == "PERCENT":
            effect = face_total * benefit["benefit_value"] / 100
        else:
            effect = benefit["benefit_value"]
        effect = round(apply_cap(effect, benefit))

        # 👈 [핵심 수정] 할인(DISCOUNT)과 적립(CASHBACK/REWARD) 분리 계산
        if btype == "DISCOUNT":
            spent = face_total - effect
            reward = 0
        elif btype in ("REWARD", "CASHBACK"):
            spent = face_total   # 편의점 현금 지출은 정가 55,000원 그대로
            reward = effect      # 5,500원은 페이백 적립금으로 처리
        else:
            spent = face_total
            reward = 0

        steps = [{
            "benefit_id": benefit["benefit_id"],
            "provider": benefit["provider_or_retailer"],
            "layer": "GIFT_CARD",
            "type": btype,
            "applied_amount": effect,
            "giftcard_combo": combo,
            "giftcard_face_total": face_total,
            "item_or_event_name": benefit.get("item_or_event_name", ""),
            "condition_raw_text": benefit.get("condition_raw_text", ""),
            "target_game": benefit.get("target_game", "ALL"),
        }]

        leftover = face_total - target_amount
        net_cost = spent - leftover - reward  # 체감가 = 실제 지출액 - 적립금액

        routes.append({
            "route_type": "GIFT_CARD",
            "base_amount": target_amount,
            "steps": steps,
            "final_paid_amount": spent,
            "reward_total": reward,
            "fee_total": 0,
            "leftover_balance": leftover,
            "net_cost": net_cost,
        })

    return routes


def build_voucher_charge_routes(voucher_benefits, platform, target_amount):
    charge_rows = [
        b for b in voucher_benefits
        if b["payment_route_type"] == "GIFTCODE_CHARGE" and b["benefit_type"] == "DISCOUNT"
    ]
    conversion_rows = [
        b for b in voucher_benefits
        if b["payment_route_type"] == "INDIRECT_CONVERSION" and b["benefit_type"] == "FEE"
    ]

    routes = []
    for charge in charge_rows:
        cash_provider = charge["provider_or_retailer"].replace("_VOUCHER", "_CASH")

        matched_fee = next(
            (f for f in conversion_rows
             if f["provider_or_retailer"] == cash_provider and f["target_platform"] == platform),
            None
        )
        if matched_fee is None:
            continue

        fee_rate = matched_fee["benefit_value"] / 100
        discount_rate = charge["benefit_value"] / 100
        if fee_rate >= 1:
            continue

        cash_needed = target_amount / (1 - fee_rate)
        paid = round(cash_needed * (1 - discount_rate))
        charge_discount_amount = round(cash_needed - paid)
        fee_amount = round(cash_needed - target_amount)

        routes.append({
            "route_type": "GIFT_CARD",
            "base_amount": target_amount,
            "steps": [
                {
                    "benefit_id": charge["benefit_id"],
                    "provider": charge["provider_or_retailer"],
                    "layer": "GIFT_CARD",
                    "type": "DISCOUNT",
                    "applied_amount": charge_discount_amount,
                    "giftcard_combo": [round(cash_needed)],
                    "giftcard_face_total": round(cash_needed),
                    "item_or_event_name": charge.get("item_or_event_name", ""),
                    "condition_raw_text": charge.get("condition_raw_text", ""),
                    "target_game": charge.get("target_game", "ALL"),
                },
                {
                    "benefit_id": matched_fee["benefit_id"],
                    "provider": matched_fee["provider_or_retailer"],
                    "layer": "VOUCHER_CONVERSION_FEE",
                    "type": "FEE",
                    "applied_amount": fee_amount,
                    "item_or_event_name": matched_fee.get("item_or_event_name", ""),
                    "condition_raw_text": matched_fee.get("condition_raw_text", ""),
                    "target_game": matched_fee.get("target_game", "ALL"),
                },
            ],
            "final_paid_amount": paid,
            "reward_total": 0,
            "fee_total": fee_amount,
            "leftover_balance": 0,
            "net_cost": paid,
        })

    return routes


def generate_combinations(benefits):
    """
    계층별로 '적용/미적용' 모든 경우의 수를 생성하되,
    [간편결제/통신사 (PAYMENT_E_PAY / PAYMENT_PG)]와 [카드사 자체 혜택 (CARD_ISSUER)]은
    단일 결제 시 동시 적용이 불가능하므로 둘 중 하나만 선택되도록 상호 배타 규칙을 적용한다.
    """
    by_layer = {layer: [] for layer in PAYMENT_LAYER_ORDER}
    for b in benefits:
        if b["stacking_layer"] in by_layer:
            by_layer[b["stacking_layer"]].append(b)
            
    choices = [[None] + by_layer[layer] for layer in PAYMENT_LAYER_ORDER]
    all_combos = list(itertools.product(*choices))
    
    valid_combos = []
    for combo in all_combos:
        # PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
        store_coupon, payment_pg, payment_epay, card_issuer = combo
        
        has_pay = (payment_pg is not None or payment_epay is not None)
        has_card = (card_issuer is not None)
        
        # 👈 [핵심 제약 규칙] 간편결제(페이/통신사)와 카드사 혜택은 동시 중첩 불가!
        if has_pay and has_card:
            continue
            
        valid_combos.append(combo)
        
    return valid_combos


def calculate_direct_payment_route(combo, base_amount):
    remaining = base_amount
    reward_total = 0
    fee_total = 0
    steps = []

    for layer_name, benefit in zip(PAYMENT_LAYER_ORDER, combo):
        if benefit is None:
            continue

        if benefit["benefit_unit"] == "PERCENT":
            effect = remaining * benefit["benefit_value"] / 100
        else:
            effect = benefit["benefit_value"]
        effect = apply_cap(effect, benefit)

        btype = benefit["benefit_type"]
        if btype == "DISCOUNT":
            effect = round(min(effect, remaining))
            remaining -= effect
        elif btype in ("REWARD", "CASHBACK"):
            effect = round(min(effect, remaining))
            reward_total += effect
        elif btype == "FEE":
            effect = round(effect)
            fee_total += effect

        steps.append({
            "benefit_id": benefit["benefit_id"],
            "provider": benefit["provider_or_retailer"],
            "layer": layer_name,
            "type": btype,
            "applied_amount": effect,
            "remaining_after": remaining,
            "item_or_event_name": benefit.get("item_or_event_name", ""),
            "condition_raw_text": benefit.get("condition_raw_text", ""),
            "target_game": benefit.get("target_game", "ALL"),
        })

    final_paid = remaining + fee_total
    return {
        "route_type": "DIRECT_PAYMENT",
        "base_amount": base_amount,
        "steps": steps,
        "final_paid_amount": final_paid,
        "reward_total": reward_total,
        "fee_total": fee_total,
        "leftover_balance": 0,
        "net_cost": final_paid - reward_total,
    }


def get_store_base_reward(benefit_rows, platform, store_tier=None):
    candidates = [
        r for r in benefit_rows
        if r["category"] in ("REWARD_STORE", "SUMMARY_STORE_TIER_REWARD_RATES")
        and STORE_PROVIDER_TO_PLATFORM.get(r["provider_or_retailer"]) == platform
    ]
    if not candidates:
        return None

    if store_tier:
        tier_str = str(store_tier).upper()
        search_keywords = TIER_MAP.get(tier_str, [tier_str])
        
        for cand in candidates:
            text_to_search = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}"
            if any(kw in text_to_search for kw in search_keywords):
                return cand

    return min(candidates, key=lambda r: r["benefit_value"])


def apply_store_base_reward(route, store_reward_benefit):
    if store_reward_benefit is None:
        return route

    base = route["final_paid_amount"]
    if store_reward_benefit["benefit_unit"] == "PERCENT":
        effect = base * store_reward_benefit["benefit_value"] / 100
    else:
        effect = store_reward_benefit["benefit_value"]
    effect = round(apply_cap(effect, store_reward_benefit))

    route["reward_total"] += effect
    route["net_cost"] -= effect
    route["steps"].append({
        "benefit_id": store_reward_benefit["benefit_id"],
        "provider": store_reward_benefit["provider_or_retailer"],
        "layer": "STORE_BASE_REWARD",
        "type": "REWARD",
        "applied_amount": effect,
        "item_or_event_name": store_reward_benefit.get("item_or_event_name", ""),
        "condition_raw_text": store_reward_benefit.get("condition_raw_text", ""),
        "target_game": store_reward_benefit.get("target_game", "ALL"),
    })
    return route


# ★ 핵심 연산: 기프트카드 + 스토어 적립 중첩 규칙 적용 함수
def apply_store_base_reward_with_rules(routes, store_reward_benefit, platform):
    updated_routes = []
    for r in routes:
        is_direct = (r.get("route_type") == "DIRECT_PAYMENT")
        
        # 문화상품권(CULTURELAND / BOOKNLIFE) 사용 경로 여부 체크
        has_voucher = any(
            s.get("provider") in ("CULTURELAND_VOUCHER", "CULTURELAND_CASH", "BOOKNLIFE_VOUCHER", "BOOKNLIFE_CASH")
            or s.get("layer") == "VOUCHER_CONVERSION_FEE"
            for s in r["steps"]
        )
        
        is_galaxy = (platform == "GALAXY_STORE")
        
        # 적립 적용 가능 여부 판정:
        # 1. 직접 결제: 항상 적용
        # 2. 기프트카드 결제: 갤럭시 스토어 및 문화상품권이 아닐 때만 중첩 적용
        can_apply = False
        if is_direct:
            can_apply = True
        elif r.get("route_type") == "GIFT_CARD":
            if not is_galaxy and not has_voucher:
                can_apply = True
                
        if can_apply and store_reward_benefit is not None:
            r = apply_store_base_reward(r, store_reward_benefit)
            
        updated_routes.append(r)
    return updated_routes


def recommend_best_routes(benefit_rows, platform_rows, platform, amount, held_methods,
                          game="COOKIERUN_KINGDOM", is_first_purchase=False, top_n=10,
                          store_tier=None, has_prev_spend=None, has_pre_applied=False,
                          use_game_benefits=True, **kwargs):
    compat_index = build_compatibility_index(platform_rows)

    eligible, warnings = filter_eligible_benefits(
        benefit_rows, compat_index, platform, game, amount, held_methods, is_first_purchase,
        has_prev_spend=has_prev_spend,
        has_pre_applied=has_pre_applied,
        use_game_benefits=use_game_benefits
    )

    giftcard_benefits = [b for b in eligible if b["category"] == "GIFT_CARD"]
    voucher_benefits = [b for b in eligible if b["category"] == "VOUCHER_PURCHASE"]
    payment_benefits = [
        b for b in eligible
        if b["category"] not in ("GIFT_CARD", "VOUCHER_PURCHASE") and b["stacking_layer"] in PAYMENT_LAYER_ORDER
    ]

    # 1. 고정권종 기프트카드 및 문화상품권 경로 생성
    routes = build_giftcard_routes(
        giftcard_benefits, benefit_rows, held_methods, platform, amount
    )
    routes += build_voucher_charge_routes(voucher_benefits, platform, amount)
    
    # 2. 직접 결제 경로 생성
    direct_routes = [calculate_direct_payment_route(c, amount)
                      for c in generate_combinations(payment_benefits)]

    # 3. 스토어 기본 적립 혜택 정보 조회 (Google Play Points / 갤스 적립 등)
    store_reward_benefit = get_store_base_reward(benefit_rows, platform, store_tier)

    # 4. 👈 [수정] 기프트카드 경로 및 직접 결제 경로 모두에 스토어 적립 중첩 적용
    all_routes = []
    
    # (A) 직접 결제 경로는 스토어 적립 무조건 적용
    for r in direct_routes:
        all_routes.append(apply_store_base_reward(r, store_reward_benefit))

    # (B) 기프트카드 경로: 갤럭시 스토어 및 문화상품권이 아닌 경우 스토어 적립 중첩 적용
    for r in routes:
        has_voucher = any(
            s.get("provider") in ("CULTURELAND_VOUCHER", "CULTURELAND_CASH", "BOOKNLIFE_VOUCHER", "BOOKNLIFE_CASH")
            or s.get("layer") == "VOUCHER_CONVERSION_FEE"
            for s in r["steps"]
        )
        if platform != "GALAXY_STORE" and not has_voucher and store_reward_benefit is not None:
            r = apply_store_base_reward(r, store_reward_benefit)
        all_routes.append(r)

    # 5. 최종 체감가 기준 정렬
    all_routes.sort(key=lambda r: r["net_cost"])

    return {"routes": all_routes[:top_n], "warnings": warnings}