"""
===============================================================================
계산 엔진 v12 — develop(v11) + 경태님(v5) 통합 버전
===============================================================================

develop 브랜치와 경태님 개인 브랜치가 각자 다른 문제를 고친 채로 갈라져 있어
두 기능을 모두 살려 하나로 합쳤다. 병합 시 실제 benefit_info 데이터로 재검증한
근거는 아래와 같다.

develop에서 가져온 것:
  - 기프트카드 DISCOUNT/REWARD 분리 계산 + 스토어 적립 중첩 규칙
    (build_giftcard_routes, apply_store_base_reward_with_rules)
  - 문화상품권(컬쳐랜드 등) 보유 여부를 상품권류 결제수단 그룹으로 우회 인식
    (filter_eligible_benefits의 GIFT_CARD/VOUCHER_PURCHASE 분기)
  - 간편결제(PAYMENT_PG/PAYMENT_E_PAY)와 카드사(CARD_ISSUER) 동시 중첩 금지
    (generate_combinations)
  - 스토어 등급 매칭을 TIER_MAP 키워드 기반으로 처리. 경태님 버전의 "Cond:" 뒤
    문자열 완전일치 방식은 실제 데이터의 "Cond: 기본 (상시) / -" 같은 표기에서
    등급명만으로는 매칭이 안 되는 경우가 있어 채택하지 않았다.
  - requires_pre_app/has_pre_applied, use_game_benefits 옵션 필터

경태님 브랜치에서 가져온 것 (develop 병합 시 발견된 회귀를 되돌림):
  - DISCOUNT+PERCENT 100% 이상만 "포인트로 결제"로 판정해 제외하는 규칙.
    develop은 payment_method_restriction=="POINT_ONLY" 문자열로 되돌아가 있었는데,
    실제 데이터를 확인해보니 삼성페이 첫결제 혜택(BNF_0006, 5,000원 정액 할인)도
    POINT_ONLY로 표기되어 있어 이 기준을 쓰면 삼성페이 자체가 다시 통째로
    제외된다(경태님이 이미 한 번 겪고 고친 버그). 100% 이상 PERCENT 할인은
    수학적으로 불가능하므로 "이미 보유한 포인트로 전액 결제"를 뜻할 수밖에 없다는
    기준이 더 정확하다.
  - 적립을 payment_method_reward_total/store_reward_total로 분리 반환하는 필드.
  - denomination_list 방어 처리: 문자열이 오면 세미콜론으로 파싱하되, 없거나
    비정상 값이면 조용히 제외한다(없는 권종을 임의 기본값으로 지어내지 않는다).
===============================================================================
"""
import itertools
import re

PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
CALCULABLE_TYPES = {"DISCOUNT", "REWARD", "CASHBACK", "FEE"}
EXCLUDED_DISBURSEMENT = {"INFO_ONLY"}

# DISCOUNT+PERCENT인데 값이 이 기준 이상이면 "포인트/잔액으로 전액 결제"로 간주해 제외한다.
# (payment_method_restriction=="POINT_ONLY" 문자열 기준은 정상 할인까지 걸러내는
#  부작용이 있어 쓰지 않는다 — 상단 모듈 docstring 참고)
UNREALISTIC_DISCOUNT_PERCENT_THRESHOLD = 100

# max_benefit_krw == 0 은 "한도 정보가 구조화되지 않음"을 뜻한다. 진짜 무제한은
# null(None)로 따로 표기되므로 둘을 구분해서 처리한다.
FALLBACK_PERCENT_CAP_KRW = 10000

# 스토어 자체 쿠폰의 provider_or_retailer 값 -> 실제 플랫폼 코드 매핑.
# 데이터 표기 방식이 통일되어 있지 않아 명시적 매핑표로 안전하게 비교한다.
STORE_PROVIDER_TO_PLATFORM = {
    "GOOGLE_PLAY_STORE": "GOOGLE_PLAY",
    "GOOGLE_PLAY": "GOOGLE_PLAY",
    "ONE_STORE": "ONE_STORE",
    "GALAXY_STORE": "GALAXY_STORE",
    "APP_STORE": "APP_STORE",
}

# 스토어 등급 매칭용 키워드 사전. 한글/영문 표기가 섞여 들어올 수 있어
# (프론트는 한글, 데이터는 "Cond: 브론즈 / ..." 형태 등) 양쪽 다 등록해둔다.
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


# =============================================================================
# [호환성 검증] platform_connection 데이터로 "이 플랫폼에서 쓸 수 있는 수단인지" 확인
# =============================================================================
def _normalize_game_string(s):
    """게임명의 언더바, 공백, 특수문자를 제거하고 대문자로 정규화"""
    if not s or str(s).strip().upper() == "ALL":
        return "ALL"
    cleaned = re.sub(r'[^A-Za-z0-9가-힣]', '', str(s))
    return cleaned.upper()

# [추가] DB의 다양한 stacking_layer 표기를 표준 레이어로 변환
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
    # 호환성 DB에 없는 조합(예: 카드사명 자체)은 '알 수 없음'이므로 True(허용)로 처리한다.
    return compat_index.get((payment_method, platform), True)


# =============================================================================
# [단계 3] 자격 필터링
# =============================================================================

def filter_eligible_benefits(benefits, compat_index, platform, game, amount,
                             held_methods, is_first_purchase, has_prev_spend=None,
                             has_pre_applied=False, use_game_benefits=True):
    """
    has_prev_spend: None=모름(경고와 함께 포함), True=충족(경고 없이 포함),
                    False=미충족(제외).
    has_pre_applied: 사전 응모를 완료했는지. requires_pre_app 혜택은 이게 True여야 포함.
    use_game_benefits: False면 target_game이 특정 게임 전용인 혜택 자체를 배제한다.

    반환값: (통과한 혜택 리스트, 유저가 직접 확인해야 하는 조건 경고 리스트)
    """
    eligible = []
    warnings = []

    for b in benefits:
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

        # 보유 결제수단 검증. STORE_COUPON 계층은 provider_or_retailer에 "결제수단"이
        # 아니라 "스토어 이름"이 들어있어 별도 처리한다. GIFT_CARD/VOUCHER_PURCHASE는
        # 문화상품권 등 우회 보유 수단(컬쳐랜드 캐시/상품권, 각종 상품권 판매처)을
        # 갖고 있어도 적용 가능하다.
        # 스토어 관련 제공자(GOOGLE_PLAY, ONE_STORE 등)는 자동으로 보유 수단으로 인정
        effective_held_methods = set(held_methods) | {platform, "GOOGLE_PLAY", "ONE_STORE", "GALAXY_STORE", "APP_STORE"}
        
        provider_code = str(b.get("provider_or_retailer") or "").upper()
        
        # 보유 결제수단 검증 (유연 유효 매칭)
        norm_layer = _normalize_layer(b.get("stacking_layer"))
        if norm_layer != "STORE_COUPON":
            if b.get("category") in ("GIFT_CARD", "VOUCHER_PURCHASE"):
                giftcard_held = any(m in effective_held_methods for m in ["GOOGLE_PLAY_GIFTCARD", "ZEROPIN", "GMARKET", "11STREET", "SSG_COM", "CULTURELAND_CASH", "CULTURELAND_VOUCHER"])
                if not giftcard_held and provider_code not in effective_held_methods:
                    continue
            else:
                # 결제수단 코드 상호 포함 여부 검사 (예: NAVER_PAY <-> NAVER)
                is_held = any(
                    m in provider_code or provider_code in m 
                    for m in effective_held_methods
                )
                if not is_held:
                    continue
        else:
            provider_platform = STORE_PROVIDER_TO_PLATFORM.get(provider_code, provider_code)
            if provider_platform not in ("ALL", platform):
                continue

        if b.get("requires_pre_app") and not has_pre_applied:
            continue

        # ✅ 새로 넣을 코드 (121개 전체 게임 100% 동적 매칭)
        b_target_norm = _normalize_game_string(b.get("target_game"))
        req_game_norm = _normalize_game_string(game)

        if not use_game_benefits:
            # 게임 전용 혜택 옵션을 끈 경우: 공통(ALL) 혜택만 포함
            if b_target_norm != "ALL":
                continue
        else:
            # 게임 전용 혜택 옵션을 켠 경우: DB의 target_game이 ALL이 아닐 때 동적 대조
            if b_target_norm != "ALL":
                # 특수문자/공백/언더바가 제거된 정규화 문자열 간 순수 동적 매칭 (완전일치 또는 부분포함)
                is_matched = (
                    b_target_norm == req_game_norm or
                    b_target_norm in req_game_norm or
                    req_game_norm in b_target_norm
                )
                if not is_matched:
                    continue

        if amount < b["min_spend_krw"]:
            continue
        if b["is_first_purchase"] and not is_first_purchase:
            continue

        # 누적 실적 조건이 텍스트에만 있고 구조화 안 된 경우, 검증 불가로 보고 제외한다.
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


# =============================================================================
# [공통] 한도 적용
# =============================================================================

def apply_cap(effect, benefit):
    cap = benefit["max_benefit_krw"]
    if cap is None:
        return effect
    if cap > 0:
        return min(effect, cap)
    if benefit["benefit_unit"] == "PERCENT":
        return min(effect, FALLBACK_PERCENT_CAP_KRW)
    return effect


# =============================================================================
# [단계 5] 경로 A: 상품권 경로
# =============================================================================

def find_min_overshoot_combo(denominations, target_amount):
    """
    동전 교환 문제: 주어진 권종으로 target_amount 이상을 최소 초과로 만든다.
    denomination_list가 문자열("5000;10000")로 들어오는 경우를 대비해 파싱하되,
    권종 정보가 아예 없거나 비정상 값이면 없는 권종을 지어내지 않고 조용히 제외한다.
    반환값: (총 액면가, 사용 권종 리스트) 또는 불가능 시 None
    """
    if isinstance(denominations, str):
        denominations = [int(x) for x in denominations.split(";") if x.strip().isdigit()]

    if not denominations or target_amount <= 0:
        return None
    if not isinstance(denominations, (list, tuple)):
        return None

    UNIT = 1000
    if any(d % UNIT != 0 for d in denominations):
        UNIT = 1
    denom_units = [d // UNIT for d in denominations]
    target_units = -(-target_amount // UNIT)   # 올림 나눗셈
    upper_bound = target_units + max(denom_units)

    # reachable[s] = 금액 s를 만드는 권종 조합 (못 만들면 None)
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
    """
    상품권 제공처마다 독립적으로 경로를 하나씩 만든다.
    할인(DISCOUNT)과 적립(CASHBACK/REWARD)을 분리 계산한다: 할인은 결제액 자체를
    낮추지만, 적립은 액면가 그대로 지출하고 별도로 되돌려받는 금액이기 때문이다
    (예: 편의점 상품권 캐시백은 정가를 그대로 내고 나중에 페이백으로 돌려받는다).
    """
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

        if btype == "DISCOUNT":
            spent = face_total - effect
            reward = 0
        elif btype in ("REWARD", "CASHBACK"):
            spent = face_total
            reward = effect
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
        net_cost = spent - leftover - reward   # 체감가 = 실제 지출액 - 잔액 - 적립금액

        routes.append({
            "route_type": "GIFT_CARD",
            "base_amount": target_amount,
            "steps": steps,
            "final_paid_amount": spent,
            "payment_method_reward_total": 0,
            "store_reward_total": 0,
            "reward_total": reward,
            "fee_total": 0,
            "leftover_balance": leftover,
            "net_cost": net_cost,
        })

    return routes


# =============================================================================
# [신규] 문화상품권 등 "자유 충전형" 상품권 경로 (VOUCHER_PURCHASE 카테고리)
# =============================================================================

def build_voucher_charge_routes(voucher_benefits, platform, target_amount):
    """
    컬쳐랜드/북앤라이프 등 문화상품권 경로. GIFT_CARD와 달리 정해진 권종이 없어
    필요한 금액만큼 정확히 충전 가능하고(잔액 항상 0), 대신 충전한 캐시를 플랫폼
    결제수단으로 바꾸는 "전환" 단계가 추가로 있으며 전환 시 수수료가 붙는다.

    payment_route_type으로 두 단계를 구분한다:
      GIFTCODE_CHARGE     -> ①단계: 상품권을 사서 캐시로 충전 (할인 있음)
      INDIRECT_CONVERSION -> ②단계: 그 캐시를 플랫폼 결제수단으로 전환 (수수료)
    """
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


# =============================================================================
# [단계 6] 경로 B: 직접결제 경로
# =============================================================================

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
        # PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
        store_coupon, payment_pg, payment_epay, card_issuer = combo
        has_pay = (payment_pg is not None or payment_epay is not None)
        has_card = (card_issuer is not None)
        if has_pay and has_card:
            continue
        valid_combos.append(combo)

    return valid_combos


def calculate_direct_payment_route(combo, base_amount):
    """스토어쿠폰 -> PG -> 카드사 순서로 직전 단계 잔액 기준 누적 계산."""
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
            # 적립이 결제 금액을 초과할 수 없다는 상식적 상한을 DISCOUNT와 동일하게 적용한다.
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
        # 적립을 "결제수단(카드/PG) 적립"과 "스토어 적립"으로 분리해서 반환한다.
        # 이 함수 시점에는 아직 스토어 적립이 안 붙었으므로 store_reward_total=0으로
        # 시작하고, apply_store_base_reward()에서 그 필드만 별도로 채운다.
        "payment_method_reward_total": reward_total,
        "store_reward_total": 0,
        "reward_total": reward_total,   # = payment_method_reward_total + store_reward_total
        "fee_total": fee_total,
        "leftover_balance": 0,
        "net_cost": final_paid - reward_total,
    }


# =============================================================================
# [신규] 스토어 자체 기본 적립 (SUMMARY_STORE_TIER_REWARD_RATES 반영)
# =============================================================================

def get_store_base_reward(benefit_rows, platform, store_tier=None):
    """
    해당 플랫폼의 등급별 기본 적립 정보를 찾는다. 결제수단과 무관하게 스토어
    계정에 자동으로 붙는 적립이라 filter_eligible_benefits()의 일반 필터링을
    거치지 않고 별도 경로로 조회한다.

    store_tier: 유저 등급 문자열(예: "골드", "GOLD"). TIER_MAP으로 한글/영문 표기를
                모두 대응한다. 모르면(None) 모두가 보장받는 가장 낮은 적립률을 쓴다.
    """
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
        # 지정한 등급명을 못 찾으면 아래 기본값 로직으로 넘어간다.

    return min(candidates, key=lambda r: r["benefit_value"])


def apply_store_base_reward(route, store_reward_benefit):
    """경로 하나에 스토어 기본 적립을 추가로 반영한다."""
    if store_reward_benefit is None:
        return route

    base = route["final_paid_amount"]
    if store_reward_benefit["benefit_unit"] == "PERCENT":
        effect = base * store_reward_benefit["benefit_value"] / 100
    else:
        effect = store_reward_benefit["benefit_value"]
    effect = round(apply_cap(effect, store_reward_benefit))

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
    """
    경로 타입별로 스토어 적립 중첩 가능 여부를 판정해서 적용한다.
      1. 직접결제 경로(DIRECT_PAYMENT): 항상 적용
      2. 기프트카드 경로(GIFT_CARD): 갤럭시 스토어 또는 문화상품권 결제가 아닐 때만 적용
         (갤럭시 스토어 적립은 결제수단 연동형이라 상품권 결제 경로와 데이터상
          호환이 확인되지 않아 보수적으로 제외한다)
    """
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


# =============================================================================
# [진입점] API 서버가 호출할 단일 함수
# =============================================================================

def recommend_best_routes(benefit_rows, platform_rows, platform, amount, held_methods,
                          game="COOKIERUN_KINGDOM", is_first_purchase=False, top_n=10,
                          store_tier=None, has_prev_spend=None, has_pre_applied=False,
                          use_game_benefits=True, **kwargs):
    """
    반환값: {"routes": [...], "warnings": [...]} 형태의 딕셔너리 (그대로 JSON 변환 가능)
    """
    compat_index = build_compatibility_index(platform_rows)

    eligible, warnings = filter_eligible_benefits(
        benefit_rows, compat_index, platform, game, amount, held_methods, is_first_purchase,
        has_prev_spend=has_prev_spend,
        has_pre_applied=has_pre_applied,
        use_game_benefits=use_game_benefits,
    )

    # stacking_layer가 아니라 category로 판정한다: 정제 후에도 GIFT_CARD 일부가
    # CARD_ISSUER로 잘못 표기된 상태이기 때문이다.
    giftcard_benefits = [b for b in eligible if b["category"] == "GIFT_CARD"]
    voucher_benefits = [b for b in eligible if b["category"] == "VOUCHER_PURCHASE"]
    payment_benefits = [
        b for b in eligible
        if b["category"] not in ("GIFT_CARD", "VOUCHER_PURCHASE") and b["stacking_layer"] in PAYMENT_LAYER_ORDER
    ]

    # 경로 A(고정권종 상품권) + 경로 A'(자유충전형 문화상품권) + 경로 B(직접결제)
    routes = build_giftcard_routes(giftcard_benefits, benefit_rows, held_methods, platform, amount)
    routes += build_voucher_charge_routes(voucher_benefits, platform, amount)
    direct_routes = [calculate_direct_payment_route(c, amount)
                      for c in generate_combinations(payment_benefits)]

    # 스토어 기본 적립을 규칙에 따라 중첩 적용
    store_reward_benefit = get_store_base_reward(benefit_rows, platform, store_tier)
    all_routes = apply_store_base_reward_with_rules(direct_routes + routes, store_reward_benefit, platform)

    all_routes.sort(key=lambda r: r["net_cost"])

    return {"routes": all_routes[:top_n], "warnings": warnings}
