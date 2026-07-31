from typing import List, Optional
from pydantic import BaseModel


# ==========================================
# 1. 데이터 모델 정의 (DB 스키마의 기반이 됨)
# ==========================================

class Benefit(BaseModel):
    id: str
    name: str
    type: str  # 'platform_coupon', 'card_discount', 'pay_discount', 'point'
    platform: str  # 'galaxy_store', 'one_store', 'google_play', 'all'
    discount_rate: float = 0.0  # 할인율 (예: 0.20 = 20%)
    discount_amount: int = 0    # 고정 할인액 (원)
    min_pay_amount: int = 0     # 최소 결제 조건 (원)
    max_discount_amount: int = 0 # 최대 할인 한도 (원)
    
    # [핵심] 중복 적용 가능 여부 제약조건
    is_stackable_with_card: bool = True  # 카드 청구할인과 중복 가능 여부
    is_stackable_with_pay: bool = True   # 간편결제 혜택과 중복 가능 여부


class UserCondition(BaseModel):
    game_name: str
    target_amount: int            # 결제 예정 금액
    platform: str                 # 사용 중인 앱마켓 ('galaxy_store', 'one_store' 등)
    user_cards: List[str]         # 보유 카드사 ('shinhan', 'samsung' 등)
    user_pays: List[str]          # 사용 가능 간편결제 ('kakaopay', 'naverpay' 등)


class RecommendationResult(BaseModel):
    path_name: str
    original_amount: int
    applied_benefits: List[str]
    final_price: int
    total_savings: int
    step_by_step_guide: List[str]


# ==========================================
# 2. Mock Data (테스트용 DB 수집 데이터)
# ==========================================

MOCK_BENEFITS: List[Benefit] = [
    # 갤럭시스토어 20% 쿠폰 (최대 10,000원 할인)
    Benefit(
        id="b1",
        name="갤럭시스토어 20% 할인 쿠폰",
        type="platform_coupon",
        platform="galaxy_store",
        discount_rate=0.20,
        min_pay_amount=10000,
        max_discount_amount=10000,
        is_stackable_with_card=True,
        is_stackable_with_pay=True
    ),
    # 신한카드 청구할인 10% (최대 5,000원 할인)
    Benefit(
        id="b2",
        name="신한카드 10% 청구할인",
        type="card_discount",
        platform="all",
        discount_rate=0.10,
        min_pay_amount=30000,
        max_discount_amount=50000,
        is_stackable_with_card=True,
        is_stackable_with_pay=False  # 간편결제 중복 불가 예시
    ),
    # 카카오페이 3,000원 즉시할인
    Benefit(
        id="b3",
        name="카카오페이 3,000원 즉시할인",
        type="pay_discount",
        platform="all",
        discount_amount=3000,
        min_pay_amount=20000,
        max_discount_amount=3000,
        is_stackable_with_card=False,
        is_stackable_with_pay=True
    )
]


# ==========================================
# 3. 최적 조합 계산 엔진 (Core Calculation Logic)
# ==========================================

def calculate_best_payment_path(user: UserCondition, benefits: List[Benefit]) -> List[RecommendationResult]:
    results = []

    # 1. 사용자의 플랫폼에 맞는 쿠폰 필터링
    platform_coupons = [
        b for b in benefits 
        if b.type == "platform_coupon" 
        and b.platform in [user.platform, "all"]
        and user.target_amount >= b.min_pay_amount
    ]

    # 2. 카드/간편결제 혜택 필터링
    payment_benefits = [
        b for b in benefits 
        if b.type in ["card_discount", "pay_discount"]
        and user.target_amount >= b.min_pay_amount
    ]

    # 조합 계산 (쿠폰 1개 + 결제수단 혜택 1개)
    for coupon in platform_coupons + [None]:  # 쿠폰을 안 쓰는 경우 포함
        for pay_benefit in payment_benefits + [None]:  # 결제 혜택 안 쓰는 경우 포함
            
            applied = []
            guide = []
            current_price = user.target_amount

            # A. 쿠폰 적용
            if coupon:
                discount = int(user.target_amount * coupon.discount_rate)
                if coupon.max_discount_amount > 0:
                    discount = min(discount, coupon.max_discount_amount)
                
                current_price -= discount
                applied.append(f"{coupon.name} (-{discount:,}원)")
                guide.append(f"1. {user.platform}에서 '{coupon.name}' 다운로드 및 적용")

            # B. 결제수단 혜택 적용 (중복 여부 검증)
            if pay_benefit:
                # 중복 불가 조건 체크 (예: 쿠폰과 카드가 중복 불가능한 조건인 경우)
                if coupon and pay_benefit.type == "card_discount" and not coupon.is_stackable_with_card:
                    continue
                if coupon and pay_benefit.type == "pay_discount" and not coupon.is_stackable_with_pay:
                    continue

                # 할인액 계산
                if pay_benefit.discount_rate > 0:
                    discount = int(current_price * pay_benefit.discount_rate)
                    if pay_benefit.max_discount_amount > 0:
                        discount = min(discount, pay_benefit.max_discount_amount)
                else:
                    discount = pay_benefit.discount_amount

                current_price -= discount
                applied.append(f"{pay_benefit.name} (-{discount:,}원)")
                guide.append(f"2. 결제 단계에서 '{pay_benefit.name}' 선택하여 결제")

            if not applied:
                continue

            total_savings = user.target_amount - current_price
            results.append(
                RecommendationResult(
                    path_name=" + ".join([b.split(" (")[0] for b in applied]),
                    original_amount=user.target_amount,
                    applied_benefits=applied,
                    final_price=current_price,
                    total_savings=total_savings,
                    step_by_step_guide=guide
                )
            )

    # 실결제액이 가장 낮은(혜택이 가장 큰) 순서대로 정렬
    results.sort(key=lambda x: x.final_price)
    return results


# ==========================================
# 4. 실행 및 결과 테스트
# ==========================================

if __name__ == "__main__":
    # 사용자 입력 예시 (유저가 프론트엔드에서 입력할 정보)
    mock_user_input = UserCondition(
        game_name="붕괴: 스타레일",
        target_amount=55000,              # 55,000원 상품 구매 시도
        platform="galaxy_store",          # 갤럭시스토어 이용자
        user_cards=["shinhan"],           # 신한카드 보유
        user_pays=["kakaopay"]            # 카카오페이 이용 가능
    )

    print(f"🎮 게임: {mock_user_input.game_name}")
    print(f"💰 목표 결제금액: {mock_user_input.target_amount:,}원")
    print(f"📱 플랫폼: {mock_user_input.platform}\n" + "="*50)

    # 계산 실행
    recommendations = calculate_best_payment_path(mock_user_input, MOCK_BENEFITS)

    # 최적 조합 결과 출력
    for idx, rec in enumerate(recommendations[:3], 1):
        print(f"\n🏆 [추천 테크트리 {idx}순위]")
        print(f"• 최종 실결제액: {rec.final_price:,}원 (총 {rec.total_savings:,}원 절감!)")
        print(f"• 적용된 혜택: {', '.join(rec.applied_benefits)}")
        print("• 이용 가이드:")
        for step in rec.step_by_step_guide:
            print(f"   {step}")