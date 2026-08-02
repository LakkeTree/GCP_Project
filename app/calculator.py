from typing import List
from app.schemas import UserConditionInput, PathRecommendation, RecommendationStep

def calculate_best_paths(user_input: UserConditionInput, mock_benefits: List[dict]) -> List[PathRecommendation]:
    """
    1. 사용자가 이용할 수 없는 혜택 제거 (스토어, 카드, 최소 결제금액 등)
    2. 중복 가능한 혜택 조합 생성
    3. 각 조합별 실결제액 계산
    4. 최저가 순으로 정렬하여 Top 3 반환
    """
    results = []
    
    # [MVP용 간단 로직 예시] 스토어별로 가용한 혜택을 모아 간단히 계산
    for store in user_input.available_stores:
        # 해당 스토어에 적용 가능한 혜택 필터링
        valid_benefits = [
            b for b in mock_benefits 
            if b["store"] == store and user_input.target_amount >= b["min_amount"]
        ]
        
        total_discount = 0
        applied_names = []
        steps = [RecommendationStep(step_number=1, title=f"{store} 앱 실행", description=f"{store}에 접속합니다.")]
        
        step_idx = 2
        for b in valid_benefits:
            # 할인액 계산 (율 할인 or 고정액 할인)
            discount = b["discount_amount"] if b["type"] == "FIXED" else int(user_input.target_amount * b["discount_rate"])
            if b.get("max_discount"):
                discount = min(discount, b["max_discount"])
                
            total_discount += discount
            applied_names.append(b["name"])
            
            steps.append(RecommendationStep(
                step_number=step_idx, 
                title=f"{b['name']} 적용", 
                description=f"{b['description']} (할인액: {discount:,}원)"
            ))
            step_idx += 1

        final_price = max(0, user_input.target_amount - total_discount)
        
        results.append(PathRecommendation(
            rank=0,
            store_name=store,
            original_price=user_input.target_amount,
            final_price=final_price,
            total_discount=total_discount,
            applied_benefits=applied_names,
            steps=steps
        ))

    # 실결제액(final_price)이 낮은 순으로 정렬
    results.sort(key=lambda x: x.final_price)
    
    # 순위 지정
    for idx, path in enumerate(results):
        path.rank = idx + 1
        
    return results # 최저가로 정렬됨.