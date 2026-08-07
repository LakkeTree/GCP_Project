"""
===============================================================================
계산 엔진 v5 — 팀원1의 정제 데이터(benefit_info.jsonl / BigQuery) 호환 버전
===============================================================================

[v4 대비 무엇이 바뀌었나]

1. 문자열 파싱 코드 전부 제거
   v4는 CSV의 모든 값이 문자열이라 to_int_or_none(), parse_denominations(),
   '=="TRUE"' 같은 변환 코드가 필요했다. 팀원1의 clean_csv_for_bq.py가 이미
   타입 변환을 끝냈으므로(benefit_value=float, min_spend_krw=int,
   is_probabilistic=bool, denomination_list=list) 그 코드가 전부 불필요해졌다.
   -> normalize_benefit() 함수 자체가 사라지고, 데이터를 그대로 쓴다.

2. 신규 컬럼 4개를 필터 조건에 추가
   정제 스키마에 새로 정리된 아래 컬럼들을 자격 판정에 반영한다.
     - target_game               : 쿠키런 전용 혜택 10건을 정확히 구분
     - min_prev_month_spend_krw  : 전월 실적 조건 20건 (비회원이라 검증 불가 -> 경고 표시)
     - requires_pre_app          : 사전 응모 필요 7건 (미응모 시 못 받음 -> 경고 표시)
     - user_segment              : VIP_MEMBER 등 세그먼트 조건 24건

3. 호환성 DB(platform_connection.jsonl) 연동 추가
   "이 결제수단이 이 플랫폼에서 애초에 쓸 수 있는가"를 사전 검증한다.
   v4까지는 이 파일을 아예 안 썼는데, 실제로는 지원하지 않는 결제수단으로
   경로를 추천하면 유저가 결제 자체를 못 하므로 반드시 필요하다.

4. 유지된 것: category 기준 상품권 판정 (★ 중요)
   정제 후에도 category=GIFT_CARD 9건의 stacking_layer가 여전히 CARD_ISSUER로
   잘못 표기되어 있음을 데이터로 확인했다(팀원1의 UPDATE SQL 미반영 상태).
   따라서 v3~v4에서 쓰던 category 기준 우회 로직을 그대로 유지한다.

[데이터 소스]
  benefit_info.jsonl        : 혜택 마스터 106행
  platform_connection.jsonl : 결제수단×플랫폼 지원 여부 80행
  (BigQuery에서 조회할 경우에도 동일한 딕셔너리 구조이므로 코드 수정 없이 동작한다)
===============================================================================
"""

import itertools


# =============================================================================
# 상수
# =============================================================================
# v6: 데이터 재생성 후 간편결제/통신사 혜택의 stacking_layer 명칭이
# "PAYMENT_PG" -> "PAYMENT_E_PAY" 로 바뀐 것이 확인됨(팀원 분석, 실제 조회로 검증됨).
# 목록에 없는 계층은 자격 필터를 통과해도 조합 생성 단계에서 조용히 제외되므로,
# 이름이 바뀔 때마다 여기 추가해줘야 한다. PAYMENT_PG는 혹시 남아있는 이전 데이터와의
# 호환을 위해 지우지 않고 그대로 둔다(데이터에 없으면 그냥 빈 슬롯이 되어 무해하다).
PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "PAYMENT_E_PAY", "CARD_ISSUER"]
CALCULABLE_TYPES = {"DISCOUNT", "REWARD", "CASHBACK", "FEE"}
EXCLUDED_DISBURSEMENT = {"INFO_ONLY"}
# ★ v6 수정: "POINT_ONLY"를 무조건 제외하던 규칙을 DISCOUNT 타입에만 한정한다.
# 이유: payment_method_restriction="POINT_ONLY"가 두 가지 다른 뜻으로 쓰이고 있었다.
#   1) DISCOUNT 타입일 때: "포인트로 결제해야 적용됨" -> 내 돈(포인트)으로 내는 것이라
#      할인이 아니다. 예: 신한포인트 100% 즉시 차감. 이건 계속 제외해야 한다.
#   2) REWARD/CASHBACK 타입일 때: "적립이 포인트 형태로 지급됨" -> 이건 지극히
#      정상적인 적립이다(네이버페이 3% 적립, 페이코 기본 적립 등). 제외하면 안 된다.
# 팀원 분석에서 이 규칙을 통째로 지우는 안(EXCLUDED_RESTRICTION = set())을 제안했지만,
# 그러면 1)번 케이스(포인트 결제)가 다시 할인으로 잘못 계산되는 예전 버그가 되살아난다.
# 그래서 "무조건 제외" 대신 "DISCOUNT 타입일 때만 제외"로 더 좁혀서 두 문제를 동시에 푼다.
EXCLUDED_RESTRICTION_FOR_DISCOUNT_ONLY = {"POINT_ONLY"}

# max_benefit_krw == 0 은 "한도 정보가 구조화되지 않음"을 뜻한다(정제 후에도 84건 그대로).
# 진짜 무제한은 null(None)로 따로 표기되어 있으므로 둘을 구분해서 처리한다.
FALLBACK_PERCENT_CAP_KRW = 10000

# 스토어 자체 쿠폰의 provider_or_retailer 값 -> 실제 플랫폼 코드 매핑.
# 데이터 표기 방식이 통일되어 있지 않아(GOOGLE_PLAY_STORE처럼 "_STORE"가 붙는 경우와,
# ONE_STORE/GALAXY_STORE처럼 이미 스토어 코드 자체가 플랫폼 코드인 경우가 섞여 있다)
# 명시적 매핑표로 안전하게 비교한다. STORE_COUPON 계층에만 사용한다.
STORE_PROVIDER_TO_PLATFORM = {
    "GOOGLE_PLAY_STORE": "GOOGLE_PLAY",
    "GOOGLE_PLAY": "GOOGLE_PLAY",
    "ONE_STORE": "ONE_STORE",
    "GALAXY_STORE": "GALAXY_STORE",
    "APP_STORE": "APP_STORE",
}


# =============================================================================
# [호환성 검증] platform_connection 데이터로 "이 플랫폼에서 쓸 수 있는 수단인지" 확인
# =============================================================================

def build_compatibility_index(platform_rows):
    """
    호환성 데이터를 빠르게 조회할 수 있는 딕셔너리로 만든다.
    {(payment_method, platform): is_supported} 형태의 조회표를 반환한다.

    리스트를 매번 처음부터 훑으면 느리므로, 조회 키를 미리 만들어두는 방식이다.
    (데이터가 80행이라 지금은 속도 차이가 없지만, 코드 의도를 명확히 하는 효과가 있다)
    """
    return {
        (row["payment_method"], row["platform"]): row["is_supported"]
        for row in platform_rows
    }


def is_method_supported(compat_index, payment_method, platform):
    """
    해당 결제수단이 해당 플랫폼에서 지원되는지 확인한다.

    호환성 DB에 아예 없는 조합(예: SHINHAN_CARD처럼 카드사명은 호환성DB에 없음)은
    '알 수 없음'이므로 True(허용)로 처리한다. 여기서 False를 반환하면
    카드사 혜택 31건이 통째로 사라져버리기 때문이다.
    """
    return compat_index.get((payment_method, platform), True)


# =============================================================================
# [단계 3] 자격 필터링
# =============================================================================

def filter_eligible_benefits(benefits, compat_index, platform, game, amount,
                             held_methods, is_first_purchase):
    """
    정제된 혜택 데이터에서 유저 조건에 맞는 것만 남긴다.
    v4의 8개 조건에 신규 컬럼 기반 조건 3개를 추가했다.

    반환값: (통과한 혜택 리스트, 주의가 필요한 혜택 정보 리스트)
      두 번째 값은 "적용은 되지만 유저가 직접 확인해야 하는 조건"을 담는다.
      (전월실적/사전응모는 비회원 서비스라 시스템이 검증할 수 없기 때문)
    """
    eligible = []
    warnings = []

    for b in benefits:
        # --- 기존 조건 (v4와 동일) ---
        if b["benefit_type"] not in CALCULABLE_TYPES:
            continue
        if b["disbursement_type"] in EXCLUDED_DISBURSEMENT:
            continue
        if b["is_probabilistic"]:            # 이제 문자열 비교가 아니라 진짜 bool이다
            continue
        # POINT_ONLY 제외는 DISCOUNT 타입일 때만 적용한다(위 상수 설명 참고).
        # REWARD/CASHBACK인데 POINT_ONLY인 경우(=적립을 포인트로 받는 정상 케이스)는 통과시킨다.
        if b["benefit_type"] == "DISCOUNT" and \
           b["payment_method_restriction"] in EXCLUDED_RESTRICTION_FOR_DISCOUNT_ONLY:
            continue
        if b["target_platform"] != "ALL" and b["target_platform"] != platform:
            continue
        # 보유 결제수단(held_methods) 체크는 STORE_COUPON 계층에는 적용하지 않는다.
        #   STORE_COUPON 계층 혜택(BNF_0017/0018/0021/0024/0105/0106 등)은
        #   provider_or_retailer 필드에 "결제수단"이 아니라 "스토어 이름"(ONE_STORE,
        #   GALAXY_STORE, GOOGLE_PLAY_STORE 등)이 들어있다. 이런 쿠폰은 유저가 그
        #   스토어에서 "결제수단으로 보유"하는 게 아니라, 해당 플랫폼에서 구매하면
        #   누구나 자동으로 받는 쿠폰이다.
        if b["stacking_layer"] != "STORE_COUPON":
            if b["provider_or_retailer"] not in held_methods:
                continue
        else:
            # STORE_COUPON 계층은 target_platform 필드가 일부 행에서 부정확하다
            # (예: BNF_0105/0106은 provider_or_retailer=ONE_STORE인데
            #  target_platform=ALL로 잘못 표기됨). provider_or_retailer를 실제
            # 플랫폼 코드로 변환해 다시 한 번 검증한다.
            provider_platform = STORE_PROVIDER_TO_PLATFORM.get(b["provider_or_retailer"])
            if provider_platform is not None and provider_platform != platform:
                continue
        if amount < b["min_spend_krw"]:      # 이제 int라 형변환 불필요
            continue
        if b["is_first_purchase"] and not is_first_purchase:
            continue

        # --- 신규 조건 1: 게임 일치 여부 (target_game) ---
        # 쿠키런 전용 혜택 10건을 다른 게임 계산에 섞지 않기 위해 필요하다.
        if b["target_game"] != "ALL" and b["target_game"] != game:
            continue

        # --- 신규 조건 1-2: 누적 실적 조건이 텍스트에만 있고 구조화 안 된 경우 제외 ---
        # 예: BNF_0008 "월간 누적 700만원 이상, 삼성전자 포인트로" — min_prev_month_spend_krw
        # 필드는 비어있는데(None) 조건 설명 텍스트에는 큰 금액 문턱이 적혀 있다.
        # 이런 경우를 그냥 통과시키면(전월실적처럼 경고만 달고 포함) 문제가 더 크다:
        # BNF_0008은 조건 미충족 시 아예 못 받는 100만원짜리 적립이라, 경고 배지 하나로는
        # 부족하고 "최적 경로"를 통째로 왜곡한다(실제로 net_cost가 -976,300원까지 나왔다).
        # min_prev_month_spend_krw가 구조화되어 있는 일반 카드 혜택(전월실적 30만원 등)은
        # 계속 경고와 함께 포함하되, 이렇게 구조화가 안 된 채로 큰 문턱을 암시하는 경우만
        # "검증 불가"로 보고 안전하게 제외한다.
        UNSTRUCTURED_THRESHOLD_KEYWORDS = ("월간 누적", "연간 누적", "전월 누적")
        text = b.get("condition_raw_text") or ""
        if b["min_prev_month_spend_krw"] is None and \
           any(kw in text for kw in UNSTRUCTURED_THRESHOLD_KEYWORDS):
            continue

        # --- 신규 조건 2: 플랫폼-결제수단 호환성 (platform_connection 연동) ---
        # 이 플랫폼에서 아예 쓸 수 없는 결제수단이면 추천해봤자 결제가 불가능하다.
        if not is_method_supported(compat_index, b["provider_or_retailer"], platform):
            continue

        # --- 신규 조건 3: 검증 불가 조건에 대한 경고 수집 ---
        # 비회원 서비스라 전월 실적이나 사전 응모 여부를 시스템이 알 수 없다.
        # 그렇다고 제외하면 카드 혜택 대부분이 사라지므로, 적용은 하되 경고를 남긴다.
        notes = []
        if b["min_prev_month_spend_krw"]:
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
    """
    한도를 적용한다. max_benefit_krw가 3가지 의미를 갖기 때문에 분기가 필요하다.
      None  = 진짜 무제한 (정제 데이터 5건)
      0     = 한도 정보 미구조화 (84건) -> PERCENT면 보수적 상한 적용
      양수  = 실제 한도
    """
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
    denomination_list가 이미 정수 배열로 정제되어 있어 파싱 없이 바로 쓸 수 있다.
    반환값: (총 액면가, 사용 권종 리스트) 또는 불가능 시 None
    """
    if not denominations or target_amount <= 0:
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


# ★ 2026-08-06: find_best_online_card_benefit() 함수 삭제됨.
#
# 삭제 이유: 이전에는 "상품권을 온라인에서 구매하면 그 결제에 쓴 카드/PG의 적립
# 혜택도 추가로 받을 수 있다"는 가정으로 이 함수와 관련 로직([5-c] 단계)이
# 존재했다. 하지만 실제로 확인한 결과 그런 사례가 데이터에 전혀 없고
# (channel_type=ONLINE AND category in (CARD, E_PAYMENT) 조합 0건),
# 실서비스 확인 결과로도 "상품권으로 결제하면 결제수단 적립은 받을 수 없다"는
# 것이 확정되었다.
#
# 즉 규칙은 다음과 같이 확정된다:
#   - 상품권 경로(GIFT_CARD): 상품권 자체 할인만 적용된다. 카드/PG 적립은 없다.
#   - 직접결제 경로(DIRECT_PAYMENT): 스토어쿠폰 + PG + 카드사 적립·할인이 전부 적용된다.
# 이 규칙은 build_giftcard_routes()의 [5-c] 단계 제거로 반영되어 있다.


def build_giftcard_routes(giftcard_benefits, all_benefits, held_methods, platform, target_amount):
    """
    상품권 제공처마다 독립적으로 경로를 하나씩 만든다.

    ★ 상품권 경로에는 카드/PG 적립·할인이 붙지 않는다(확정된 규칙).
       상품권 자체 할인만 적용되며, 결제수단 적립을 받으려면 상품권을 거치지 않는
       직접결제 경로(DIRECT_PAYMENT, build_direct_payment_routes 참고)를 이용해야 한다.
    """
    routes = []

    for benefit in giftcard_benefits:
        result = find_min_overshoot_combo(benefit["denomination_list"], target_amount)
        if result is None:
            continue
        face_total, combo = result

        # [5-b] 상품권 자체 할인
        if benefit["benefit_unit"] == "PERCENT":
            gc_discount = face_total * benefit["benefit_value"] / 100
        else:
            gc_discount = benefit["benefit_value"]
        gc_discount = round(apply_cap(gc_discount, benefit))
        spent = face_total - gc_discount

        steps = [{
            "benefit_id": benefit["benefit_id"],
            "provider": benefit["provider_or_retailer"],
            "layer": "GIFT_CARD",
            "type": benefit["benefit_type"],
            "applied_amount": gc_discount,
            "giftcard_combo": combo,
            "giftcard_face_total": face_total,
        }]

        # [5-c] 잔액, [5-d] 실질 비용
        # (구 5-c "카드/PG 온라인 혜택 추가 적용" 단계는 삭제됨 — 위 함수 삭제 주석 참고)
        leftover = face_total - target_amount
        net_cost = spent - leftover

        routes.append({
            "route_type": "GIFT_CARD",
            "base_amount": target_amount,
            "steps": steps,
            "final_paid_amount": spent,
            "reward_total": 0,
            "fee_total": 0,
            "leftover_balance": leftover,
            "net_cost": net_cost,
        })

    return routes


# =============================================================================
# [단계 6] 경로 B: 직접결제 경로
# =============================================================================

def generate_combinations(benefits):
    """계층별로 '적용/미적용' 모든 경우의 수를 만든다."""
    by_layer = {layer: [] for layer in PAYMENT_LAYER_ORDER}
    for b in benefits:
        if b["stacking_layer"] in by_layer:
            by_layer[b["stacking_layer"]].append(b)
    choices = [[None] + by_layer[layer] for layer in PAYMENT_LAYER_ORDER]
    return list(itertools.product(*choices))


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
            effect = remaining * benefit["benefit_value"] / 100  # 직전 단계 잔액 기준
        else:
            effect = benefit["benefit_value"]
        effect = apply_cap(effect, benefit)

        btype = benefit["benefit_type"]
        if btype == "DISCOUNT":
            effect = round(min(effect, remaining))
            remaining -= effect
        elif btype in ("REWARD", "CASHBACK"):
            # ★ v7 수정: 결제 금액을 초과하는 적립을 방지하는 안전장치 추가.
            # 실제 데이터(BNF_0008 삼성페이)에서 "월간 누적 700만원 이상"이라는
            # 조건이 구조화된 필드(min_prev_month_spend_krw)에는 비어있고
            # condition_raw_text에만 적혀 있어서, 그 조건을 못 읽고 100만원
            # 적립을 30,000원짜리 단건 결제에 그대로 적용해 net_cost가
            # -976,300원이 되는 오류가 실제로 발생했다.
            # 근본 원인(조건 미구조화)은 데이터 쪽에서 고쳐야 하지만, 최소한
            # "적립이 결제 금액보다 클 수는 없다"는 상식적인 상한은 코드에서
            # 방어해야 한다. DISCOUNT에는 이미 있던 상한(remaining)을
            # REWARD/CASHBACK에도 동일하게 적용한다.
            effect = round(min(effect, remaining))
            reward_total += effect          # 결제액은 안 깎고 마지막에 차감
        elif btype == "FEE":
            effect = round(effect)
            fee_total += effect              # 수수료는 비용을 늘림

        steps.append({
            "benefit_id": benefit["benefit_id"],
            "provider": benefit["provider_or_retailer"],
            "layer": layer_name,
            "type": btype,
            "applied_amount": effect,
            "remaining_after": remaining,
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


# =============================================================================
# [신규] 스토어 자체 기본 적립 (SUMMARY_STORE_TIER_REWARD_RATES 반영)
# =============================================================================

def get_store_base_reward(benefit_rows, platform, store_tier=None):
    """
    SUMMARY_STORE_TIER_REWARD_RATES 카테고리에서 해당 플랫폼의 기본 적립 정보를 찾는다.

    이 값은 결제수단과 무관하게(카카오페이로 내든 카드로 내든) 스토어 계정에
    자동으로 붙는 적립이다. 따라서 filter_eligible_benefits()의 일반 필터링
    (POINT_ONLY 제외, INFO_ONLY 제외 등)을 거치지 않고 별도 경로로 조회한다.
    disbursement_type=INFO_ONLY라서 원래는 "참고정보"로 제외되는 카테고리인데,
    이 값만큼은 실제로 매 결제마다 적용되는 진짜 적립이라 예외적으로 다룬다.

    ★ target_platform 필드를 안 믿고 provider_or_retailer로 재확인한다.
      BNF_0096(갤럭시스토어 적립)이 target_platform=ALL로 잘못 표기되어 있어,
      그대로 믿으면 구글플레이/원스토어 결제에도 삼성 갤럭시스토어 적립이
      섞여 들어가는 오류가 생긴다(스토어쿠폰과 동일한 데이터 오류 패턴).

    store_tier: 유저가 자기 등급을 알고 있다면 등급명 문자열(예: "골드")을 넘긴다.
                모르면(None, 기본값) 모두가 보장받는 가장 낮은 등급의 적립률을 쓴다.
                실제로 못 받는 등급을 받은 것처럼 계산해 과대 추천하는 것을 막기 위함이다.
    """
    candidates = [
        r for r in benefit_rows
        # ★ v7 수정: 카테고리명이 "SUMMARY_STORE_TIER_REWARD_RATES" -> "REWARD_STORE"로
        # 바뀐 것을 실제 BigQuery 데이터로 확인함(2026-08-07 업로드분 기준). 예전 이름을
        # 계속 쓰면 이 함수가 항상 빈 리스트를 받아 스토어 기본 적립이 통째로 작동하지
        # 않는 상태가 된다(실제로 이 버그가 있었음).
        if r["category"] == "REWARD_STORE"
        and STORE_PROVIDER_TO_PLATFORM.get(r["provider_or_retailer"]) == platform
    ]
    if not candidates:
        return None

    def extract_tier_name(text):
        # condition_raw_text 예시: "Cond: 브론즈 / 1,000원당 1pt" -> "브론즈"
        if "Cond:" not in text:
            return ""
        return text.split("Cond:", 1)[1].split("/", 1)[0].strip()

    if store_tier:
        matched = [r for r in candidates if extract_tier_name(r["condition_raw_text"]) == store_tier]
        if matched:
            return matched[0]
        # 지정한 등급명을 못 찾으면(오타 등) 아래 기본값 로직으로 넘어간다.

    # 기본값: 여러 등급 중 적립률이 가장 낮은(=누구나 보장받는) 등급을 쓴다.
    return min(candidates, key=lambda r: r["benefit_value"])


def apply_store_base_reward(route, store_reward_benefit):
    """
    직접결제 경로 하나에 스토어 기본 적립을 추가로 반영한다.
    결제수단 적립(REWARD/CASHBACK)과 동일한 방식: 결제 금액은 안 깎고,
    reward_total에 더한 뒤 net_cost에서만 차감한다.

    ★ 상품권 경로(GIFT_CARD)에는 적용하지 않는다. 지난번 확정한 규칙
      ("상품권 결제 시 결제수단 적립 없음")과 같은 맥락으로, 스토어 기본
      적립도 "그 스토어에서 직접 결제할 때"를 전제로 한 값이기 때문이다.
      (상품권으로 충전한 잔액을 쓰는 경우까지 적립되는지는 데이터에 명시가
       없어 확정할 수 없으므로, 보수적으로 직접결제 경로에만 적용한다.)
    """
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
    })
    return route


# =============================================================================
# [진입점] API 서버(팀원3)가 호출할 단일 함수
# =============================================================================

def recommend_best_routes(benefit_rows, platform_rows, platform, amount, held_methods,
                          game="COOKIERUN_KINGDOM", is_first_purchase=False, top_n=3,
                          store_tier=None):
    """
    파라미터:
      benefit_rows   - benefit_info.jsonl(또는 BigQuery benefit_info 테이블) 행 리스트
      platform_rows  - platform_connection.jsonl(또는 BigQuery 테이블) 행 리스트
      platform       - 유저 선택 플랫폼 (GOOGLE_PLAY 등)
      amount         - 결제 예정 금액
      held_methods   - 유저 보유 결제수단 리스트
      game           - 대상 게임 (기본: COOKIERUN_KINGDOM)
      is_first_purchase - 첫 결제 여부
      top_n          - 반환할 상위 경로 개수
      store_tier     - (신규, 선택) 유저의 스토어 멤버십 등급명(예: "골드").
                       현재는 구글플레이만 등급이 나뉘어 있다. 모르면 안 넘겨도
                       되며, 이 경우 보장되는 최저 등급 적립률이 적용된다.

    반환값: {"routes": [...], "warnings": [...]} 형태의 딕셔너리 (그대로 JSON 변환 가능)
    """
    compat_index = build_compatibility_index(platform_rows)

    # [단계 3] 자격 필터링 (정제 데이터라 별도 정규화 단계가 필요 없다)
    eligible, warnings = filter_eligible_benefits(
        benefit_rows, compat_index, platform, game, amount, held_methods, is_first_purchase
    )

    # [단계 4] 두 그룹으로 분리
    # ★ stacking_layer가 아니라 category로 판정한다.
    #    정제 후에도 GIFT_CARD 9건이 CARD_ISSUER로 잘못 표기된 상태이기 때문이다.
    giftcard_benefits = [b for b in eligible if b["category"] == "GIFT_CARD"]
    payment_benefits = [
        b for b in eligible
        if b["category"] != "GIFT_CARD" and b["stacking_layer"] in PAYMENT_LAYER_ORDER
    ]

    # [단계 5] 경로 A + [단계 6] 경로 B
    routes = build_giftcard_routes(
        giftcard_benefits, benefit_rows, held_methods, platform, amount
    )
    direct_routes = [calculate_direct_payment_route(c, amount)
                      for c in generate_combinations(payment_benefits)]

    # [신규] 스토어 기본 적립을 직접결제 경로에만 반영
    store_reward_benefit = get_store_base_reward(benefit_rows, platform, store_tier)
    direct_routes = [apply_store_base_reward(r, store_reward_benefit) for r in direct_routes]

    routes += direct_routes

    # [단계 7] 통합 정렬 + [단계 8] 상위 N개
    routes.sort(key=lambda r: r["net_cost"])

    return {"routes": routes[:top_n], "warnings": warnings}


# =============================================================================
# 실행 및 검증
# =============================================================================

if __name__ == "__main__":
    import json

    BENEFIT_PATH = "/mnt/user-data/uploads/benefit_info.jsonl"
    PLATFORM_PATH = "/mnt/user-data/uploads/platform_connection.jsonl"

    def load_jsonl(path):
        """JSONL 파일을 딕셔너리 리스트로 읽는다. (BigQuery 조회 결과와 동일 구조)"""
        with open(path, encoding="utf-8") as f:
            return [json.loads(line) for line in f if line.strip()]

    benefit_rows = load_jsonl(BENEFIT_PATH)
    platform_rows = load_jsonl(PLATFORM_PATH)

    held = ["PAYCO", "NAVER_PAY", "TOSS_PAY", "KAKAO_PAY", "SAMSUNG_PAY",
            "SHINHAN_CARD", "SAMSUNG_CARD", "HANA_CARD",
            "ZEROPIN", "GMARKET", "SSG_COM", "11STREET"]

    print("=" * 72)
    print("검증 1: 정제 데이터 타입 및 라벨 상태 확인")
    print("=" * 72)
    r0 = benefit_rows[0]
    print(f"  benefit_value 타입: {type(r0['benefit_value']).__name__} (문자열 파싱 불필요)")
    print(f"  is_probabilistic 타입: {type(r0['is_probabilistic']).__name__} (bool 비교 가능)")
    print(f"  denomination_list 타입: {type(r0['denomination_list']).__name__} (배열, 파싱 불필요)")
    mislabeled = sum(1 for b in benefit_rows
                     if b["category"] == "GIFT_CARD" and b["stacking_layer"] == "CARD_ISSUER")
    print(f"  ⚠ category=GIFT_CARD인데 stacking_layer=CARD_ISSUER: {mislabeled}건 "
          f"(팀원1 UPDATE 미반영 → category 기준 우회 유지 중)")

    print()
    print("=" * 72)
    print("검증 2: 이상치 스캔 (마이너스 비용 / 과대 할인)")
    print("=" * 72)
    cases = [("GOOGLE_PLAY", 149000), ("GOOGLE_PLAY", 100000),
             ("ONE_STORE", 55000), ("GALAXY_STORE", 30000)]
    anomalies = 0
    for plat, amt in cases:
        res = recommend_best_routes(benefit_rows, platform_rows, plat, amt, held, top_n=100)
        for r in res["routes"]:
            if r["net_cost"] < 0:
                anomalies += 1
                print(f"  [이상치] {plat} {amt}: net_cost 음수 {r['net_cost']}")
            if r["route_type"] == "DIRECT_PAYMENT" and r["fee_total"] == 0 \
               and r["final_paid_amount"] > amt:
                anomalies += 1
                print(f"  [이상치] {plat} {amt}: 할인인데 결제액 증가")
    print("이상치 없음 (정상)" if anomalies == 0 else f"이상치 {anomalies}건 발견")

    print()
    print("=" * 72)
    print("검증 3: 추천 결과")
    print("=" * 72)
    for plat, amt in cases:
        res = recommend_best_routes(benefit_rows, platform_rows, plat, amt, held, top_n=3)
        print(f"\n[{plat} / {amt:,}원]")
        if not res["routes"]:
            print("  적용 가능한 경로 없음")
        for rank, r in enumerate(res["routes"], 1):
            print(f"  {rank}위 {r['route_type']:14s} net_cost={r['net_cost']:>8,}원 "
                  f"(지출 {r['final_paid_amount']:,} / 적립 {r['reward_total']:,} / 잔액 {r['leftover_balance']:,})")
            for s in r["steps"]:
                if s["layer"] == "GIFT_CARD":
                    combo = "+".join(f"{c:,}" for c in s["giftcard_combo"])
                    print(f"       └ {s['provider']:16s} 권종[{combo}] 할인 {s['applied_amount']:,}원")
                else:
                    print(f"       └ {s['layer']:13s} {s['provider'][:16]:18s} {s['applied_amount']:>7,}원")

    print()
    print("=" * 72)
    print("검증 4: 유저 확인 필요 조건 (비회원이라 시스템 검증 불가)")
    print("=" * 72)
    res = recommend_best_routes(benefit_rows, platform_rows, "GOOGLE_PLAY", 100000, held)
    for w in res["warnings"][:8]:
        print(f"  {w['benefit_id']} {w['provider']:16s}: {', '.join(w['conditions'])}")
    print(f"  ... 총 {len(res['warnings'])}건")