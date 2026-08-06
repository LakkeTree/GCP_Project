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
PAYMENT_LAYER_ORDER = ["STORE_COUPON", "PAYMENT_PG", "CARD_ISSUER"]
CALCULABLE_TYPES = {"DISCOUNT", "REWARD", "CASHBACK", "FEE"}
EXCLUDED_DISBURSEMENT = {"INFO_ONLY"}
EXCLUDED_RESTRICTION = {"POINT_ONLY"}

# max_benefit_krw == 0 은 "한도 정보가 구조화되지 않음"을 뜻한다(정제 후에도 84건 그대로).
# 진짜 무제한은 null(None)로 따로 표기되어 있으므로 둘을 구분해서 처리한다.
FALLBACK_PERCENT_CAP_KRW = 10000


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
        if b["payment_method_restriction"] in EXCLUDED_RESTRICTION:
            continue
        if b["target_platform"] != "ALL" and b["target_platform"] != platform:
            continue
        if b["provider_or_retailer"] not in held_methods:
            continue
        if amount < b["min_spend_krw"]:      # 이제 int라 형변환 불필요
            continue
        if b["is_first_purchase"] and not is_first_purchase:
            continue

        # --- 신규 조건 1: 게임 일치 여부 (target_game) ---
        # 쿠키런 전용 혜택 10건을 다른 게임 계산에 섞지 않기 위해 필요하다.
        if b["target_game"] != "ALL" and b["target_game"] != game:
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


def find_best_online_card_benefit(all_benefits, held_methods, platform):
    """
    [단계 5-c] 상품권을 온라인에서 구매할 때 추가로 적용 가능한 카드/PG 혜택을 찾는다.

    조건: channel_type == "ONLINE" AND category in (CARD, E_PAYMENT)
    ★ category 조건이 필수다. 이게 없으면 상품권 판매처(GIFT_CARD)끼리 서로를
      '카드 혜택'으로 잘못 매칭하는 버그가 발생한다(v4 테스트에서 실제 발견).

    현재 데이터에는 해당 조합이 0건이라 항상 None을 반환한다.
    데이터가 추가되면 코드 수정 없이 자동으로 동작한다.
    """
    candidates = [
        b for b in all_benefits
        if b["channel_type"] == "ONLINE"
        and b["category"] in ("CARD", "E_PAYMENT")
        and b["provider_or_retailer"] in held_methods
        and (b["target_platform"] == "ALL" or b["target_platform"] == platform)
    ]
    if not candidates:
        return None
    return max(candidates, key=lambda b: b["benefit_value"])


def build_giftcard_routes(giftcard_benefits, all_benefits, held_methods, platform, target_amount):
    """상품권 제공처마다 독립적으로 경로를 하나씩 만든다."""
    routes = []
    online_card = find_best_online_card_benefit(all_benefits, held_methods, platform)

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

        # [5-c] 현금 전용이 아니면 카드/PG 온라인 혜택 추가 적용
        if benefit["payment_method_restriction"] != "CASH_ONLY" and online_card is not None:
            if online_card["benefit_unit"] == "PERCENT":
                card_effect = spent * online_card["benefit_value"] / 100
            else:
                card_effect = online_card["benefit_value"]
            card_effect = round(apply_cap(card_effect, online_card))
            card_effect = min(card_effect, spent)
            spent -= card_effect
            steps.append({
                "benefit_id": online_card["benefit_id"],
                "provider": online_card["provider_or_retailer"],
                "layer": "ONLINE_CARD_ON_GIFTCARD",
                "type": online_card["benefit_type"],
                "applied_amount": card_effect,
            })

        # [5-d] 잔액, [5-e] 실질 비용
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
            effect = round(effect)
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
# [진입점] API 서버(팀원3)가 호출할 단일 함수
# =============================================================================

def recommend_best_routes(benefit_rows, platform_rows, platform, amount, held_methods,
                          game="COOKIERUN_KINGDOM", is_first_purchase=False, top_n=3):
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
    routes += [calculate_direct_payment_route(c, amount)
               for c in generate_combinations(payment_benefits)]

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
