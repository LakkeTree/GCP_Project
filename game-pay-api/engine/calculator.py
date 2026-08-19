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
# DB condition_raw_text 및 item_or_event_name 파싱용 통합 등급 키워드 맵
TIER_MAP = {
    "BRONZE": ["브론즈", "BRONZE", "10원당 1PT", "10원당 1.0PT"],
    "SILVER": ["실버", "SILVER", "10원당 1.1PT"],
    "GOLD": ["골드", "GOLD", "10원당 1.3PT"],
    "PLATINUM": ["플래티넘", "PLATINUM", "10원당 1.4PT"],
    "DIAMOND": ["다이아몬드", "DIAMOND", "10원당 1.6PT"],
    "STANDARD": ["일반", "기본", "상시", "STANDARD", "1%"],
    "VIP": ["VIP", "2%"],
    "VVIP": ["VVIP", "3%"],
    "ROYAL_BLUE": ["로열블루", "ROYAL_BLUE", "10%"],
}

def get_store_base_reward(benefit_rows, platform, store_tier=None):
    """
    Database(benefit_info)에 저장되어 있는 스토어 등급별 기본 적립 혜택을 100% 매칭하여 조회합니다.
    """
    # 1. DB에서 해당 스토어(GOOGLE_PLAY, GALAXY_STORE 등)의 등급 적립 카테고리 데이터만 추출
    candidates = [
        r for r in benefit_rows
        if r.get("category") in ("REWARD_STORE", "SUMMARY_STORE_TIER_REWARD_RATES")
        and STORE_PROVIDER_TO_PLATFORM.get(r.get("provider_or_retailer")) == platform
    ]
    
    if not candidates:
        return None

    # 2. 유저가 선택한 등급(store_tier: 예 - DIAMOND, BRONZE, ROYAL_BLUE 등)이 전달된 경우 DB 매칭 실행
    if store_tier:
        tier_str = str(store_tier).upper()
        keywords = TIER_MAP.get(tier_str, [tier_str])

        for cand in candidates:
            # DB의 이벤트명, 상세조건 text를 가져와 대문자로 통합
            text_to_search = f"{cand.get('item_or_event_name', '')} {cand.get('condition_raw_text', '')}".upper()
            
            # DB 데이터 조건문에 매칭 키워드가 들어있는 행(Row)을 찾아 리턴
            if any(kw.upper() in text_to_search for kw in keywords):
                return cand

    # 3. 매칭되는 특별 등급 데이터가 없으면 DB 내 최소 적립률 기본행(브론즈/일반) 적용
    return min(candidates, key=lambda r: r.get("benefit_value", 0))


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

import datetime

import datetime

def filter_eligible_benefits(benefits, compat_index, platform, game, amount,
                             held_methods, is_first_purchase, has_prev_spend=None,
                             has_pre_applied=False, use_game_benefits=True,
                             has_subscription=False):
    eligible = []
    warnings = []

    req_platform = str(platform).upper()
    today_str = datetime.date.today().isoformat()

    for b in benefits:
        # 0. 이벤트 기간 검증
        start_d = str(b.get("start_date") or "").strip()
        end_d = str(b.get("end_date") or "").strip()

        if start_d and start_d not in ("NONE", "null") and start_d > today_str:
            continue
        if end_d and end_d not in ("NONE", "null") and end_d < today_str:
            continue

        # 1. 스토어 등급 기본 적립 제외
        if b.get("category") in ("REWARD_STORE", "SUMMARY_STORE_TIER_REWARD_RATES"):
            continue

        target_p = str(b.get("target_platform") or "").upper()
        provider_code = str(b.get("provider_or_retailer") or "").upper()
        raw_cond_str = str(b.get("condition_raw_text") or "").upper()
        item_event_str = str(b.get("item_or_event_name") or "").upper()
        category_str = str(b.get("category") or "").upper()
        restriction_str = str(b.get("payment_method_restriction") or "").upper()

        # 💡 [핵심] 통신사 결제/멤버십 혜택 필터링 (통신사 체크박스 오프 시 100% 차단)
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
                continue  # 🚫 통신사 옵션 해제 시 배제

        event_name = str(b.get("item_or_event_name") or "").upper()

        # 2. 타 스토어 혜택 교차 유입 차단
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

        # 일반 결제수단 검증
        norm_layer = _normalize_layer(b.get("stacking_layer"))
        if norm_layer != "STORE_COUPON":
            if b.get("category") in ("GIFT_CARD", "VOUCHER_PURCHASE"):
                giftcard_held = any(m in effective_held_methods for m in ["GOOGLE_PLAY_GIFTCARD", "ZEROPIN", "GMARKET", "11STREET", "SSG_COM", "CULTURELAND_CASH", "CULTURELAND_VOUCHER"])
                if not giftcard_held and provider_code not in effective_held_methods:
                    continue
            else:
                # 💡 선택하지 않은 타 제휴 카드가 오버랩되어 계산되는 현상을 막기 위해 완전 일치 검증 적용
                def _is_method_matched(held_set, provider):
                    for h in held_set:
                        if h == provider:
                            return True
                        # 카드사/결제 수단 식별자가 정확히 완전 일치하는 경우만 허용
                        if h.startswith("BNF_CARD_") and h == provider:
                            return True
                    return False

                if not _is_method_matched(effective_held_methods, provider_code):
                    continue
        else:
            provider_platform = STORE_PROVIDER_TO_PLATFORM.get(provider_code, provider_code)
            if provider_platform not in ("ALL", platform):
                continue

        if b.get("requires_pre_app") and not has_pre_applied:
            continue

        # 게임 전용 혜택 검증
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



# =============================================================================
# [공통] 한도 적용
# =============================================================================

# 1. apply_cap 함수 보완 (max_benefit_krw가 0인 경우 제한 없음으로 처리)
def apply_cap(effect, benefit):
    cap = benefit.get("max_benefit_krw")
    if cap is None or cap == 0:  # 0 또는 None일 경우 제한 없음으로 처리
        return effect
    if cap > 0:
        return min(effect, cap)
    if benefit.get("benefit_unit") == "PERCENT":
        return min(effect, FALLBACK_PERCENT_CAP_KRW)
    return effect


# =============================================================================
# [단계 5] 경로 A: 상품권 경로
# =============================================================================

def find_min_overshoot_combo(denominations, target_amount, max_card_qty=3):
    """
    주어진 권종(denominations)으로 target_amount 이상을 만드는 최소 초과 조합을 연산합니다.
    max_card_qty: 조합에 사용할 수 있는 최대 카드 수량 (기본값: 3장)
    """
    if isinstance(denominations, str):
        denominations = [int(x) for x in denominations.split(";") if x.strip().isdigit()]

    if not denominations or target_amount <= 0:
        return None

    # 중복 조합 탐색 (1장부터 max_card_qty장까지)
    best_combo = None
    best_sum = float('inf')

    for k in range(1, max_card_qty + 1):
        for combo in itertools.combinations_with_replacement(denominations, k):
            s = sum(combo)
            if s >= target_amount:
                # 더 적은 금액으로 목표를 달성하거나, 금액이 같다면 수량이 적은 조합 우선
                if s < best_sum or (s == best_sum and len(combo) < len(best_combo)):
                    best_sum = s
                    best_combo = list(combo)
        # 딱 맞는 금액(best_sum == target_amount)을 찾았으면 조기 종료
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

        # 1. condition_raw_text에서 Denominations 파싱 (없는 경우 denomination_list fallback)
        denoms = benefit.get("denomination_list")
        denom_match = re.search(r'Denominations\s*:\s*([0-9;]+)', raw_text, re.IGNORECASE)
        if denom_match:
            parsed_denoms = [int(x) for x in denom_match.group(1).split(";") if x.strip().isdigit()]
            if parsed_denoms:
                denoms = parsed_denoms

        if not denoms:
            continue

        # 2. 수량 한도(max_card_qty) 결정
        # A. condition_raw_text 내 LimitNum: 숫자 파싱
        limit_match = re.search(r'LimitNum\s*:\s*(\d+)', raw_text, re.IGNORECASE)
        
        is_offline = channel_type == "OFFLINE" or any(k in provider_code for k in ["CU", "GS25", "SEVEN", "CONVENIENCE"])

        if is_offline:
            max_qty = 1  # 🚫 오프라인/편의점 경로는 무조건 최대 1장
        elif limit_match and int(limit_match.group(1)) > 0:
            max_qty = int(limit_match.group(1))  # LimitNum 값이 있으면 해당 값 적용
        else:
            max_qty = 3  # 💡 기본 온라인 경로는 최대 3장 마지노선 적용

        # 3. 파싱된 권종과 수량 한도로 최소 조합 탐색
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
        store_coupon, payment_pg, payment_epay, card_issuer = combo
        
        # 1. 결제 수단 중 2개 이상 동시 중첩 차단
        selected_payments = [m for m in (payment_pg, payment_epay, card_issuer) if m is not None]
        if len(selected_payments) > 1:
            continue

        # 💡 [핵심] 쿠폰 혜택 2개 이상 중복 적용 차단 (8월 월간 쿠폰 + 첫 결제 쿠폰 중첩 방지)
        active_benefits = [b for b in combo if b is not None]
        coupon_count = 0
        for b in active_benefits:
            b_cat = str(b.get("category") or "").upper()
            b_layer = _normalize_layer(b.get("stacking_layer"))
            b_title = f"{b.get('item_or_event_name', '')} {b.get('condition_raw_text', '')}"
            
            if b_cat == "COUPON" or b_layer == "STORE_COUPON" or "쿠폰" in b_title or "COUPON" in b_title.upper() or "첫 결제" in b_title or "첫결제" in b_title:
                coupon_count += 1

        if coupon_count > 1:
            continue  # 🚫 쿠폰 2개 이상 동시 적용 차단

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

        if effect <= 0:
            continue

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

    if effect <= 0:
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
                          game="ALL", is_first_purchase=False, top_n=10,
                          store_tier=None, has_prev_spend=None, has_pre_applied=False,
                          use_game_benefits=True, **kwargs):
    compat_index = build_compatibility_index(platform_rows)

    has_subscription_flag = kwargs.get("has_subscription", False)

    eligible, warnings = filter_eligible_benefits(
        benefit_rows, compat_index, platform, game, amount, held_methods, is_first_purchase,
        has_prev_spend=has_prev_spend,
        has_pre_applied=has_pre_applied,
        use_game_benefits=use_game_benefits,
        has_subscription=has_subscription_flag,
    )

    giftcard_benefits = [b for b in eligible if b.get("category") == "GIFT_CARD"]
    voucher_benefits = [b for b in eligible if b.get("category") == "VOUCHER_PURCHASE"]

    # 💡 stacking_layer 정규화 후 비교하여 모든 일반 카드/간편결제 할인 혜택 포함
    payment_benefits = [
        b for b in eligible
        if b.get("category") not in ("GIFT_CARD", "VOUCHER_PURCHASE")
        and _normalize_layer(b.get("stacking_layer")) in PAYMENT_LAYER_ORDER
    ]

    routes = build_giftcard_routes(giftcard_benefits, benefit_rows, held_methods, platform, amount)
    routes += build_voucher_charge_routes(voucher_benefits, platform, amount)
    direct_routes = [calculate_direct_payment_route(c, amount)
                      for c in generate_combinations(payment_benefits)]

    store_reward_benefit = get_store_base_reward(benefit_rows, platform, store_tier)
    all_routes = apply_store_base_reward_with_rules(direct_routes + routes, store_reward_benefit, platform)

    all_routes.sort(key=lambda r: r["net_cost"])

    return {"routes": all_routes[:top_n], "warnings": warnings}