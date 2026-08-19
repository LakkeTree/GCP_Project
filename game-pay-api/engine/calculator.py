"""
===============================================================================
계산 엔진 v12 — 갤럭시스토어 등급 매칭 오버랩 및 페이 멤버십 연동 완전 교정
===============================================================================
"""
import datetime
import itertools
import re

PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
CALCULABLE_TYPES = {"DISCOUNT", "REWARD", "CASHBACK", "FEE"}
EXCLUDED_DISBURSEMENT = {"INFO_ONLY"}

UNREALISTIC_DISCOUNT_PERCENT_THRESHOLD = 100
FALLBACK_PERCENT_CAP_KRW = 10000

STORE_PROVIDER_TO_PLATFORM = {
    "GOOGLE_PLAY_STORE": "GOOGLE_PLAY",
    "GOOGLE_PLAY": "GOOGLE_PLAY",
    "ONE_STORE": "ONE_STORE",
    "GALAXY_STORE": "GALAXY_STORE",
    "APP_STORE": "APP_STORE",
}


def get_store_base_reward(benefit_rows, platform, store_tier=None):
    candidates = [
        r for r in benefit_rows
        if r.get("category") in ("REWARD_STORE", "SUMMARY_STORE_TIER_REWARD_RATES")
        and STORE_PROVIDER_TO_PLATFORM.get(r.get("provider_or_retailer")) == platform
    ]
    
    if not candidates:
        return None

    tier_str = str(store_tier or "STANDARD").upper()

    # 💡 [등급 오매칭 방지] 유저가 선택한 명확한 등급별 1:1 정밀 매칭
    if tier_str == "ROYAL_BLUE":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "로열블루" in text or "ROYAL_BLUE" in text or "ROYALBLUE" in text:
                return cand

    elif tier_str == "PRESTIGE":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "프레스티지" in text or "PRESTIGE" in text:
                return cand

    elif tier_str == "VVIP":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "VVIP" in text:
                return cand

    elif tier_str == "VIP":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "VIP" in text and "VVIP" not in text:
                return cand

    elif tier_str == "STAR":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "스타" in text or "STAR" in text:
                return cand

    elif tier_str == "DIAMOND":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "다이아몬드" in text or "DIAMOND" in text:
                return cand

    elif tier_str == "PLATINUM":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "플래티넘" in text or "PLATINUM" in text:
                return cand

    elif tier_str == "GOLD":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "골드" in text or "GOLD" in text:
                return cand

    elif tier_str == "SILVER":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "실버" in text or "SILVER" in text:
                return cand

    elif tier_str == "BRONZE":
        for cand in candidates:
            text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            if "브론즈" in text or "BRONZE" in text:
                return cand

    # 💡 STANDARD(기본/상시) 선택 시 상위 등급 행을 전면 제외한 최저 기본 적립 행 반환
    default_candidates = []
    for cand in candidates:
        text = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
        if not any(kw in text for kw in ["로열블루", "ROYAL_BLUE", "프레스티지", "PRESTIGE", "VVIP", "VIP", "스타", "STAR"]):
            default_candidates.append(cand)

    if default_candidates:
        return min(default_candidates, key=lambda r: r.get("benefit_value", 0))

    return min(candidates, key=lambda r: r.get("benefit_value", 0))


def _normalize_game_string(s):
    if not s or str(s).strip().upper() == "ALL":
        return "ALL"
    cleaned = re.sub(r'[^A-Za-z0-9가-힣]', '', str(s))
    return cleaned.upper()


def _normalize_layer(layer_str):
    if not layer_str:
        return "STORE_COUPON"
    l = str(layer_str).upper().strip()
    if l in ("STORE_COUPON", "COUPON", "STORE"):
        return "STORE_COUPON"
    if l in ("PAYMENT_PG", "PG", "CARRIER", "TELECOM"):
        return "PAYMENT_PG"
    if l in ("PAYMENT_E_PAY", "E_PAY", "PAY", "E_PAYMENT"):
        return "PAYMENT_E_PAY"
    if l in ("CARD_ISSUER", "CARD", "CARD_DISCOUNT"):
        return "CARD_ISSUER"
    return l


def build_compatibility_index(platform_rows):
    return {
        (row["payment_method"], row["platform"]): row["is_supported"]
        for row in platform_rows
    }


def is_method_supported(compat_index, payment_method, platform):
    return compat_index.get((payment_method, platform), True)


def is_provider_matched(held_methods, provider_code):
    """💡 페이 수단 패밀리 매칭 함수 (네이버, 토스, 카카오, 삼성, 애플)"""
    p_code = str(provider_code).upper().strip()
    
    if p_code in held_methods:
        return True
        
    for h in held_methods:
        h_upper = str(h).upper().strip()
        if h_upper == p_code:
            return True
            
        if h_upper in ("NAVER_PAY", "NAVER") and ("NAVER" in p_code or "네이버" in p_code):
            return True
            
        if h_upper in ("TOSS_PAY", "TOSS") and ("TOSS" in p_code or "토스" in p_code):
            return True
            
        if h_upper in ("KAKAO_PAY", "KAKAO") and ("KAKAO" in p_code or "카카오" in p_code):
            return True

        if h_upper in ("SAMSUNG_PAY", "SAMSUNG") and ("SAMSUNG" in p_code or "삼성" in p_code):
            return True

        if h_upper in ("APPLE_PAY", "APPLE") and ("APPLE" in p_code or "애플" in p_code):
            return True

        if h_upper.startswith("BNF_CARD_") and h_upper == p_code:
            return True
            
    return False


def filter_eligible_benefits(benefits, compat_index, platform, game, amount,
                             held_methods, is_first_purchase, has_prev_spend=None,
                             has_pre_applied=False, use_game_benefits=True,
                             has_subscription=False, use_naver_membership=False,
                             use_toss_prime=False, store_tier=None):
    eligible = []
    warnings = []

    req_platform = str(platform).upper()
    today_str = datetime.date.today().isoformat()

    for b in benefits:
        provider_code = str(b.get("provider_or_retailer") or "").upper()
        event_name = str(b.get("item_or_event_name") or "").upper()
        raw_cond_str = str(b.get("condition_raw_text") or "").upper()
        full_text = f"{event_name} {raw_cond_str} {provider_code}"

        # 1. 네이버플러스 멤버십 체크 해제 시 제외
        is_naver_membership_benefit = any(kw in full_text for kw in ["네이버플러스", "네이버 플러스", "NAVER_PLUS", "NAVER PLUS"]) or ("NAVER" in provider_code and "멤버십" in full_text)
        if is_naver_membership_benefit and not use_naver_membership:
            continue

        # 2. 토스프라임 체크 해제 시 제외
        is_toss_prime_benefit = any(kw in full_text for kw in ["토스프라임", "토스 프라임", "TOSS_PRIME", "TOSS PRIME"]) or ("TOSS" in provider_code and "프라임" in full_text)
        if is_toss_prime_benefit and not use_toss_prime:
            continue

        # 3. 갤럭시 스토어 멤버십 등급 정밀 검증
        if req_platform == "GALAXY_STORE" or "GALAXY" in provider_code or "삼성전자 멤버십" in full_text:
            current_g_tier = str(store_tier or "STANDARD").upper()

            requires_royal_blue = any(kw in full_text for kw in ["로열블루", "ROYAL_BLUE", "ROYALBLUE"])
            requires_prestige   = any(kw in full_text for kw in ["프레스티지", "PRESTIGE"])
            requires_vvip       = "VVIP" in full_text
            requires_vip        = "VIP" in full_text and not requires_vvip
            requires_star       = any(kw in full_text for kw in ["스타 등급", "STAR 등급", "STAR_TIER", "스타등급"])

            if requires_royal_blue and "ROYAL" not in current_g_tier:
                continue
            if requires_prestige and "PRESTIGE" not in current_g_tier:
                continue
            if requires_vvip and "VVIP" not in current_g_tier:
                continue
            if requires_vip and current_g_tier not in ("VIP", "VVIP", "ROYAL_BLUE", "PRESTIGE"):
                continue
            if requires_star and current_g_tier not in ("STAR", "VIP", "VVIP", "ROYAL_BLUE", "PRESTIGE"):
                continue

        # 4. 구글 플레이 포인트 등급 정밀 검증
        if req_platform == "GOOGLE_PLAY" or "GOOGLE" in provider_code:
            current_gp_tier = str(store_tier or "BRONZE").upper()

            requires_diamond  = any(kw in full_text for kw in ["다이아몬드", "DIAMOND"])
            requires_platinum = any(kw in full_text for kw in ["플래티넘", "PLATINUM"])
            requires_gold     = any(kw in full_text for kw in ["골드", "GOLD"])
            requires_silver   = any(kw in full_text for kw in ["실버", "SILVER"])

            if requires_diamond and "DIAMOND" not in current_gp_tier:
                continue
            if requires_platinum and current_gp_tier not in ("PLATINUM", "DIAMOND"):
                continue
            if requires_gold and current_gp_tier not in ("GOLD", "PLATINUM", "DIAMOND"):
                continue
            if requires_silver and current_gp_tier not in ("SILVER", "GOLD", "PLATINUM", "DIAMOND"):
                continue

        # 5. 이벤트 기간 검증
        start_d = str(b.get("start_date") or "").strip()
        end_d = str(b.get("end_date") or "").strip()

        if start_d and start_d not in ("NONE", "null") and start_d > today_str:
            continue
        if end_d and end_d not in ("NONE", "null") and end_d < today_str:
            continue

        # 6. 스토어 등급 기본 적립 제외 (별도 계산)
        if b.get("category") in ("REWARD_STORE", "SUMMARY_STORE_TIER_REWARD_RATES"):
            continue

        target_p = str(b.get("target_platform") or "").upper()
        item_event_str = event_name
        category_str = str(b.get("category") or "").upper()
        restriction_str = str(b.get("payment_method_restriction") or "").upper()

        # 통신사 결제/멤버십 혜택 필터링
        TELECOM_KEYWORDS = ["휴대폰결제", "휴대폰 결제", "소액결제", "통신사결제", "통신사 결제", "SKT", "KT", "LGU", "통신사", "T멤버십", "T_MEMBERSHIP", "TELECOM"]
        requires_telecom = (
            restriction_str == "PHONE_BILLING_ONLY" or
            "BILLING" in category_str or
            "BILLING" in provider_code or
            "TELECOM" in category_str or
            "TELECOM" in provider_code or
            "T_MEMBERSHIP" in provider_code or
            any(kw in raw_cond_str or kw in item_event_str or kw in provider_code for kw in TELECOM_KEYWORDS) or
            provider_code in ("SKT", "KT", "LGU_PLUS", "TELECOM_DISCOUNT", "SKT_TELECOM", "KT_TELECOM", "LGU_TELECOM", "T_MEMBERSHIP", "TELECOM")
        )

        if requires_telecom:
            telecom_keys = {"TELECOM_DISCOUNT", "SKT", "KT", "LGU_PLUS", "SKT_TELECOM", "KT_TELECOM", "LGU_TELECOM", "TELECOM", "T_MEMBERSHIP"}
            has_telecom_held = any(m in telecom_keys for m in held_methods)
            if not has_telecom_held or not has_subscription:
                continue

        # 타 스토어 혜택 교차 유입 차단
        if req_platform == "GOOGLE_PLAY":
            if any(k in target_p or k in provider_code or k in event_name for k in ["ONE_STORE", "ONESTORE", "원스토어", "T_MEMBERSHIP", "T멤버십", "GALAXY", "갤스", "APP_STORE"]):
                continue
        elif req_platform == "ONE_STORE":
            if any(k in target_p or k in provider_code or k in event_name for k in ["GOOGLE_PLAY", "GOOGLE", "GALAXY", "갤스", "APP_STORE"]):
                continue
        elif req_platform == "GALAXY_STORE":
            if any(k in target_p or k in provider_code or k in event_name for k in ["GOOGLE_PLAY", "GOOGLE", "ONE_STORE", "ONESTORE", "원스토어", "T_MEMBERSHIP", "T멤버십", "APP_STORE"]):
                continue
        elif req_platform == "APP_STORE":
            if any(k in target_p or k in provider_code or k in event_name for k in ["GOOGLE_PLAY", "GOOGLE", "ONE_STORE", "ONESTORE", "원스토어", "T_MEMBERSHIP", "T멤버십", "GALAXY", "갤스"]):
                continue

        if b["benefit_type"] not in CALCULABLE_TYPES:
            continue
        if b["disbursement_type"] in EXCLUDED_DISBURSEMENT:
            continue
        if b["is_probabilistic"]:
            continue
        if b["benefit_type"] == "DISCOUNT" and b["benefit_unit"] == "PERCENT" and \
           b["benefit_value"] >= UNREALISTIC_DISCOUNT_PERCENT_THRESHOLD:
            continue
        if b["target_platform"] != "ALL" and b["target_platform"] != platform:
            continue

        effective_held_methods = set(held_methods) | {platform, "GOOGLE_PLAY", "ONE_STORE", "GALAXY_STORE", "APP_STORE"}

        norm_layer = _normalize_layer(b.get("stacking_layer"))
        if norm_layer != "STORE_COUPON":
            if b.get("category") in ("GIFT_CARD", "VOUCHER_PURCHASE"):
                giftcard_held = any(m in effective_held_methods for m in ["GOOGLE_PLAY_GIFTCARD", "ZEROPIN", "GMARKET", "11STREET", "SSG_COM", "CULTURELAND_CASH", "CULTURELAND_VOUCHER"])
                if not giftcard_held and provider_code not in effective_held_methods:
                    continue
            else:
                # 💡 패밀리 매칭 함수 사용
                if not is_provider_matched(effective_held_methods, provider_code):
                    continue
        else:
            provider_platform = STORE_PROVIDER_TO_PLATFORM.get(provider_code, provider_code)
            if provider_platform not in ("ALL", platform):
                continue

        if b.get("requires_pre_app") and not has_pre_applied:
            continue

        b_target_raw = str(b.get("target_game") or "ALL").strip()
        req_game_norm = _normalize_game_string(game)

        prefix_match = re.match(r'^(NOT|EXCEPT|EXCLUDE)\s*:\s*(.*)$', b_target_raw, re.IGNORECASE)
        if prefix_match:
            excluded_games = [g.strip() for g in re.split(r'[,;/]', prefix_match.group(2)) if g.strip()]
            is_excluded = False
            for ex_game in excluded_games:
                ex_norm = _normalize_game_string(ex_game)
                if ex_norm and (ex_norm == req_game_norm or ex_norm in req_game_norm or req_game_norm in ex_norm):
                    is_excluded = True
                    break
            if is_excluded:
                continue
        else:
            b_target_norm = _normalize_game_string(b_target_raw)
            if not use_game_benefits:
                if b_target_norm != "ALL":
                    continue
            else:
                if b_target_norm != "ALL":
                    allowed_games = [g.strip() for g in re.split(r'[,;/]', b_target_raw) if g.strip()]
                    is_matched = False
                    for app_game in allowed_games:
                        app_norm = _normalize_game_string(app_game)
                        if app_norm and (app_norm == req_game_norm or app_norm in req_game_norm or req_game_norm in app_norm):
                            is_matched = True
                            break
                    if not is_matched:
                        continue

        if amount < b["min_spend_krw"]:
            continue
        if b["is_first_purchase"] and not is_first_purchase:
            continue

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
    cap = benefit.get("max_benefit_krw")
    if cap is None or cap == 0:
        return effect
    if cap > 0:
        return min(effect, cap)
    if benefit.get("benefit_unit") == "PERCENT":
        return min(effect, FALLBACK_PERCENT_CAP_KRW)
    return effect


def find_min_overshoot_combo(denominations, target_amount, max_card_qty=3):
    if isinstance(denominations, str):
        denominations = [int(x) for x in denominations.split(";") if x.strip().isdigit()]

    if not denominations or target_amount <= 0:
        return None

    best_combo = None
    best_sum = float('inf')

    for k in range(1, max_card_qty + 1):
        for combo in itertools.combinations_with_replacement(denominations, k):
            s = sum(combo)
            if s >= target_amount:
                if s < best_sum or (s == best_sum and len(combo) < len(best_combo)):
                    best_sum = s
                    best_combo = list(combo)
        if best_combo is not None and best_sum == target_amount:
            break

    if best_combo is not None:
        return best_sum, best_combo
    return None


def build_giftcard_routes(giftcard_benefits, all_benefits, held_methods, platform, target_amount):
    routes = []

    for benefit in giftcard_benefits:
        raw_text = str(benefit.get("condition_raw_text") or "")
        provider_code = str(benefit.get("provider_or_retailer") or "").upper()
        channel_type = str(benefit.get("channel_type") or "").upper()

        denoms = benefit.get("denomination_list")
        denom_match = re.search(r'Denominations\s*:\s*([0-9;]+)', raw_text, re.IGNORECASE)
        if denom_match:
            parsed_denoms = [int(x) for x in denom_match.group(1).split(";") if x.strip().isdigit()]
            if parsed_denoms:
                denoms = parsed_denoms

        if not denoms:
            continue

        limit_match = re.search(r'LimitNum\s*:\s*(\d+)', raw_text, re.IGNORECASE)
        is_offline = channel_type == "OFFLINE" or any(k in provider_code for k in ["CU", "GS25", "SEVEN", "CONVENIENCE"])

        if is_offline:
            max_qty = 1
        elif limit_match and int(limit_match.group(1)) > 0:
            max_qty = int(limit_match.group(1))
        else:
            max_qty = 3

        result = find_min_overshoot_combo(denoms, target_amount, max_card_qty=max_qty)
        if result is None:
            continue

        face_total, combo = result
        btype = benefit.get("benefit_type")
        bunit = benefit.get("benefit_unit")
        bvalue = benefit.get("benefit_value", 0)

        if bunit == "PERCENT":
            effect = face_total * bvalue / 100
        else:
            effect = bvalue

        effect = round(apply_cap(effect, benefit))

        if btype == "DISCOUNT":
            actual_spent = face_total - effect
            reward_amount = 0
        elif btype in ("REWARD", "CASHBACK"):
            actual_spent = face_total
            reward_amount = effect
        else:
            actual_spent = face_total
            reward_amount = 0

        leftover = face_total - target_amount
        net_cost = actual_spent - leftover - reward_amount

        steps = [{
            "benefit_id": benefit.get("benefit_id"),
            "provider": benefit.get("provider_or_retailer"),
            "layer": "GIFT_CARD",
            "type": btype,
            "applied_amount": effect,
            "giftcard_combo": combo,
            "giftcard_face_total": face_total,
            "item_or_event_name": benefit.get("item_or_event_name", ""),
            "condition_raw_text": benefit.get("condition_raw_text", ""),
            "target_game": benefit.get("target_game", "ALL"),
        }]

        routes.append({
            "route_type": "GIFT_CARD",
            "base_amount": target_amount,
            "steps": steps,
            "final_paid_amount": actual_spent,
            "payment_method_reward_total": reward_amount,
            "store_reward_total": 0,
            "reward_total": reward_amount,
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
            "payment_method_reward_total": 0,
            "store_reward_total": 0,
            "reward_total": 0,
            "fee_total": fee_amount,
            "leftover_balance": 0,
            "net_cost": paid,
        })

    return routes


def generate_combinations(benefits):
    by_layer = {layer: [] for layer in PAYMENT_LAYER_ORDER}
    for b in benefits:
        norm_l = _normalize_layer(b.get("stacking_layer"))
        if norm_l in by_layer:
            by_layer[norm_l].append(b)

    choices = [[None] + by_layer[layer] for layer in PAYMENT_LAYER_ORDER]
    all_combos = list(itertools.product(*choices))

    valid_combos = []
    for combo in all_combos:
        store_coupon, payment_pg, payment_epay, card_issuer = combo
        
        selected_payments = [m for m in (payment_pg, payment_epay, card_issuer) if m is not None]
        if len(selected_payments) > 1:
            continue

        active_benefits = [b for b in combo if b is not None]
        coupon_count = 0
        for b in active_benefits:
            b_cat = str(b.get("category") or "").upper()
            b_layer = _normalize_layer(b.get("stacking_layer"))
            b_title = f"{b.get('item_or_event_name', '')} {b.get('condition_raw_text', '')}"
            
            if b_cat == "COUPON" or b_layer == "STORE_COUPON" or "쿠폰" in b_title or "COUPON" in b_title.upper() or "첫 결제" in b_title or "첫결제" in b_title:
                coupon_count += 1

        if coupon_count > 1:
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

        if effect <= 0:
            continue

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
        "payment_method_reward_total": reward_total,
        "store_reward_total": 0,
        "reward_total": reward_total,
        "fee_total": fee_total,
        "leftover_balance": 0,
        "net_cost": final_paid - reward_total,
    }


def apply_store_base_reward(route, store_reward_benefit):
    if store_reward_benefit is None:
        return route

    base = route["final_paid_amount"]
    if store_reward_benefit["benefit_unit"] == "PERCENT":
        effect = base * store_reward_benefit["benefit_value"] / 100
    else:
        effect = store_reward_benefit["benefit_value"]
    effect = round(apply_cap(effect, store_reward_benefit))

    if effect <= 0:
        return route    

    route["store_reward_total"] += effect
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


def apply_store_base_reward_with_rules(routes, store_reward_benefit, platform):
    updated_routes = []
    for r in routes:
        is_direct = (r.get("route_type") == "DIRECT_PAYMENT")

        has_voucher = any(
            s.get("provider") in ("CULTURELAND_VOUCHER", "CULTURELAND_CASH", "BOOKNLIFE_VOUCHER", "BOOKNLIFE_CASH")
            or s.get("layer") == "VOUCHER_CONVERSION_FEE"
            for s in r["steps"]
        )
        is_galaxy = (platform == "GALAXY_STORE")

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
                          game="ALL", is_first_purchase=False, top_n=10,
                          store_tier=None, has_prev_spend=None, has_pre_applied=False,
                          use_game_benefits=True, **kwargs):
    compat_index = build_compatibility_index(platform_rows)

    has_subscription_flag = kwargs.get("has_subscription", False)
    use_naver_membership = kwargs.get("use_naver_membership", False)
    use_toss_prime = kwargs.get("use_toss_prime", False)

    eligible, warnings = filter_eligible_benefits(
        benefit_rows, compat_index, platform, game, amount, held_methods, is_first_purchase,
        has_prev_spend=has_prev_spend,
        has_pre_applied=has_pre_applied,
        use_game_benefits=use_game_benefits,
        has_subscription=has_subscription_flag,
        use_naver_membership=use_naver_membership,
        use_toss_prime=use_toss_prime,
        store_tier=store_tier,
    )

    giftcard_benefits = [b for b in eligible if b.get("category") == "GIFT_CARD"]
    voucher_benefits = [b for b in eligible if b.get("category") == "VOUCHER_PURCHASE"]

    payment_benefits = [
        b for b in eligible
        if b.get("category") not in ("GIFT_CARD", "VOUCHER_PURCHASE")
        and _normalize_layer(b.get("stacking_layer")) in PAYMENT_LAYER_ORDER
    ]

    routes = build_giftcard_routes(giftcard_benefits, benefit_rows, held_methods, platform, amount)
    routes += build_voucher_charge_routes(voucher_benefits, platform, amount)
    direct_routes = [calculate_direct_payment_route(c, amount) for c in generate_combinations(payment_benefits)]

    store_reward_benefit = get_store_base_reward(benefit_rows, platform, store_tier)
    all_routes = apply_store_base_reward_with_rules(direct_routes + routes, store_reward_benefit, platform)

    all_routes.sort(key=lambda r: r["net_cost"])

    return {"routes": all_routes[:top_n], "warnings": warnings}