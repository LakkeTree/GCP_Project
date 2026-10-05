# 간편결제 적립률/구간 계산 버그 수정 + 게임별 미지원 플랫폼 선택 제한

작업일: 2026-08-19

이번에 리포트된 3가지를 확인했습니다.
1. 네이버페이 일반/네이버플러스 멤버십, 토스페이 일반/토스프라임 적립률이 계산에서 구분되지 않는 문제
2. 30만원 결제 시 "토스페이 20만원 이하" 구간 적립이 잘못 표시되는 문제
3. 게임이 지원하지 않는 플랫폼(스토어)을 아예 선택 못 하게 막는 기능 추가

1·2번은 원인을 파고들어 보니 **같은 근본 원인**(계산 엔진이 데이터에 있는 "구간/등급 조건"을 실제로 검증하지 않고 그냥 다 통과시킴)에서 나온 서로 다른 증상이었습니다.

---

## 0. 데이터 확인부터: 실제로 어떤 혜택 행이 있는지

`game-pay-api/engine/loader.py`가 읽는 BigQuery `benefit_info` 테이블과 같은 구조의 로컬 스크레이퍼 산출물(`epay_data/output/Epay_Benefit_Info_DB.csv`)을 직접 열어봤습니다. 토스페이 관련 행 2개가 있었습니다.

| benefit_id | item_or_event_name | benefit_value | min_spend_krw | user_segment | condition_type | is_tiered_limit |
|---|---|---|---|---|---|---|
| BNF_EPAY_TOSSPAY_8540ca98 | 토스프라임 토스페이 결제 적립 (20만원 이하) | 4.0% | 0 | VIP_MEMBER | MEMBERSHIP_TIER | TRUE |
| BNF_EPAY_TOSSPAY_fa48427c | 토스프라임 토스페이 결제 적립 (20만원 초과) | 1.0% | 200000 | VIP_MEMBER | MEMBERSHIP_TIER | TRUE |

네이버페이는 반대로 일반 적립(1%/1.5%/0.5%, `user_segment=ALL_USERS`) 3개 행만 있고 "네이버플러스 전용" 행 자체가 이 스크레이퍼 산출물에는 없었습니다(구축 초기 시드 데이터인 `bigquery/cleaned/benefit_info.jsonl`에는 `BNF_0064`/`BNF_0065`로 네이버플러스 전용 1%/4% 행이 있지만, 이 두 행은 `disbursement_type=INFO_ONLY`라 애초에 계산 대상에서 제외되도록 설계돼 있습니다). 즉 **네이버페이 쪽은 "차등 계산"을 만들 데이터 자체가 없거나(라이브 스크레이퍼본), 있어도 정보용으로만 표기돼 있어(구 시드본) 계산에 안 들어가는 게 정상 설계**입니다.

반면 토스페이 두 행은 `disbursement_type=POINT_REWARD`로 실제 계산 대상이고, `user_segment=VIP_MEMBER`(토스프라임 회원 전용)에 `is_tiered_limit=TRUE`(구간별 한도가 있다는 표시)까지 붙어 있는데, 계산 엔진이 이 두 필드를 **둘 다 전혀 읽지 않고 있었습니다.**

---

## 1. 토스프라임/일반 토스페이 적립률이 구분되지 않는 문제

### 위치
`game-pay-api/engine/calculator.py` — `filter_eligible_benefits` (자격 필터링 루프)

### 원인
```python
notes = []
...
if b["user_segment"] == "VIP_MEMBER":
    notes.append("특정 등급 회원 전용")
...
eligible.append(b)   # ← user_segment와 무관하게 항상 통과
```
`user_segment == "VIP_MEMBER"`인 혜택은 경고 문구(`notes`)만 붙이고 실제로는 무조건 `eligible`에 포함시키고 있었습니다. 즉 프론트엔드의 "토스프라임 구독 중" 체크박스(`filter.useTossPrime`) 값이 백엔드로 아예 전달되지도 않았고, 설사 전달됐어도 계산 로직이 그 값을 검증에 쓰지 않았습니다. 그 결과 토스프라임 미가입 상태로 계산해도 4%/1% 멤버십 적립이 항상 잡혀서, "일반 토스페이"와 "토스프라임 토스페이"가 결과에 차이가 없었던 겁니다.

### 수정
**1) 백엔드: 실제 멤버십 여부를 검증하도록 필터에 게이트 추가**
```python
# game-pay-api/engine/calculator.py
VIP_MEMBERSHIP_FLAG_BY_PROVIDER = {
    "NAVER_PAY": "has_naver_plus",
    "TOSS_PAY": "has_toss_prime",
}
...
if b.get("user_segment") == "VIP_MEMBER":
    membership_flag_name = VIP_MEMBERSHIP_FLAG_BY_PROVIDER.get(provider_code)
    has_required_membership = {
        "has_naver_plus": has_naver_plus,
        "has_toss_prime": has_toss_prime,
    }.get(membership_flag_name, False)
    if not has_required_membership:
        continue
```
`VIP_MEMBERSHIP_FLAG_BY_PROVIDER`에 없는(=프론트에 대응 체크박스가 없어 확인할 방법이 없는) provider의 VIP_MEMBER 행은 안전하게 기본 제외되도록 했습니다.

**2) API 요청/응답 배선: `has_naver_plus`, `has_toss_prime`가 실제로 오가도록 연결**
- `game-pay-api/main.py` — `RouteRequest`에 `has_naver_plus`, `has_toss_prime` 필드 추가, `get_optimal_routes`에서 `recommend_best_routes` 호출 시 두 값 전달
- `game-pay-api/engine/calculator.py` — `recommend_best_routes`가 `kwargs`에서 두 값을 꺼내 `filter_eligible_benefits`로 전달
- `fe-app/src/pages/SearchResultPage.tsx` — API payload에 `has_naver_plus: filter.useNaverMembership`, `has_toss_prime: filter.useTossPrime` 추가 (이전에는 이 두 체크박스 상태가 아예 요청 바디에 실리지 않고 있었습니다)

이제 "토스프라임 구독 중" 체크박스를 껐다 켰다 하면 결과에 실제로 4%/1% 적립 유무가 반영됩니다. 네이버페이는 위에서 설명한 대로 라이브 데이터에 멤버십 전용 행이 없어 체감 변화는 없지만, 데이터가 추가되는 순간 자동으로 정상 반영되도록 같은 게이트를 함께 걸어뒀습니다.

---

## 2. 30만원 결제 시 "토스페이 20만원 이하" 적립이 같이 뜨는 문제

### 위치
`game-pay-api/engine/calculator.py` — `filter_eligible_benefits`

### 원인
구간별 혜택은 `min_spend_krw`(구간 하한)만 구조화된 필드로 갖고 있고, **상한을 담는 필드가 스키마에 아예 없습니다.** "20만원 이하"라는 상한 정보는 `item_or_event_name`(제목)에 괄호로만 적혀 있는 자유 텍스트입니다.
```python
if amount < b["min_spend_krw"]:
    continue
# ← 여기서 끝. 상한 검증이 없어서 30만원을 넣어도
#   "20만원 이하" 행(min_spend_krw=0)이 그냥 통과함
```
그래서 30만원을 입력하면 "20만원 이하"(하한 0원 통과) 행과 "20만원 초과"(하한 200,000원도 통과) 행이 **둘 다** 조건을 통과해 각각 다른 추천 경로에 동시에 나타났던 것입니다.

### 수정
다행히 이 두 행에는 `is_tiered_limit=TRUE`라는, 지금까지 코드 어디에서도 안 읽던 구조화된 플래그가 이미 붙어 있었습니다. 이걸 신호로 삼아 제목에서 상한을 파싱하도록 했습니다.
```python
_SPEND_TIER_UPPER_BOUND_PATTERN = re.compile(r'(\d+)\s*만\s*원\s*(?:이하|까지)')

def _parse_spend_tier_upper_bound_krw(benefit):
    if not benefit.get("is_tiered_limit"):
        return None
    for field in ("item_or_event_name", "condition_raw_text"):
        text = str(benefit.get(field) or "")
        matches = _SPEND_TIER_UPPER_BOUND_PATTERN.findall(text)
        if matches:
            return int(matches[-1]) * 10000
    return None
```
```python
tier_upper_bound = _parse_spend_tier_upper_bound_krw(b)
if tier_upper_bound is not None and amount > tier_upper_bound:
    continue
```
`is_tiered_limit=TRUE`인 행에만 적용해서, 관련 없는 다른 혜택의 설명 문구에 우연히 "OO만원"이라는 표현이 들어가 있어도 오탐하지 않도록 범위를 좁혔습니다. 30만원 결제 시 "20만원 이하" 행(상한 200,000원)은 이제 정상적으로 제외되고, "20만원 초과" 행만 계산에 반영됩니다.

### 단위 테스트로 확인
실제 데이터와 동일한 구조의 두 행(20만원 이하 4%, 20만원 초과 1%)으로 세 가지 케이스를 직접 검증했습니다.
- 30만원 + 토스프라임 O → "20만원 초과" 행만 통과 ✅
- 15만원 + 토스프라임 O → "20만원 이하" 행만 통과 ✅
- 30만원 + 토스프라임 X → 둘 다 제외 (1번 수정 검증 겸용) ✅

---

## 3. 게임이 지원하지 않는 플랫폼(스토어)은 선택 자체를 막기

### 위치
- `fe-app/src/components/FilterSection.tsx` — OS 선택 버튼 / 안드로이드 스토어 선택 버튼
- `fe-app/src/pages/SearchPage.tsx`, `fe-app/src/pages/SearchResultPage.tsx` — `FilterSection`에 `supportedStores` prop 전달

### 이전 동작
`SearchPage.tsx`/`SearchResultPage.tsx`에는 이미 게임이 바뀌면 `filter.androidStores`에서 미지원 스토어를 걸러내는 `useEffect`가 있었지만, 이건 "이미 선택된 값 정리용"일 뿐 **선택 UI 자체(버튼)는 계속 클릭 가능한 상태**였습니다. 즉 미지원 스토어를 눌러서 선택했다가 다음 렌더링에 다시 빠지는 식의 어색한 동작이 가능했습니다.

### 수정
`FilterSection`에 `supportedStores?: string[]` prop을 추가하고, 각 페이지에서 현재 선택된 게임의 지원 스토어 목록(`selectedGame?.stores` / `currentGameObj?.stores`)을 그대로 넘기도록 했습니다.
```tsx
// SearchPage.tsx
<FilterSection filterState={filterState} ... supportedStores={selectedGame?.stores} />

// SearchResultPage.tsx
<FilterSection filterState={filterState} supportedStores={currentGameObj?.stores} />
```
`FilterSection` 내부에는 기존 페이지들과 동일한 퍼지 매칭 로직(`isStoreSupported`)을 추가해서, 지원하지 않는 스토어 버튼과 iOS/안드로이드 OS 버튼을 `disabled` 처리하고 회색으로 표시합니다(마우스를 올리면 "현재 선택한 게임이 지원하지 않는 스토어/OS입니다" 툴팁이 뜹니다). `supportedStores`가 전달되지 않는 화면(예: 게임과 무관한 `MyProfilePage.tsx`의 기본 필터 설정)은 기존처럼 전부 선택 가능하게 그대로 둡니다.

---

## 변경 파일 목록

- `game-pay-api/engine/calculator.py`
  - `VIP_MEMBERSHIP_FLAG_BY_PROVIDER` 매핑 + `user_segment == VIP_MEMBER` 실제 검증 추가
  - `_parse_spend_tier_upper_bound_krw` 추가 + 구간 상한 검증 추가
  - `filter_eligible_benefits`/`recommend_best_routes`에 `has_naver_plus`, `has_toss_prime` 파라미터 추가
- `game-pay-api/main.py`
  - `RouteRequest`에 `has_naver_plus`, `has_toss_prime` 필드 추가, `get_optimal_routes`에서 전달
- `fe-app/src/pages/SearchResultPage.tsx`
  - API payload에 `has_naver_plus`, `has_toss_prime` 추가
  - `FilterSection`에 `supportedStores={currentGameObj?.stores}` 전달
- `fe-app/src/pages/SearchPage.tsx`
  - `FilterSection`에 `supportedStores={selectedGame?.stores}` 전달
- `fe-app/src/components/FilterSection.tsx`
  - `supportedStores` prop 추가, OS/스토어 버튼에 `isStoreSupported` 기반 비활성화 적용

기존 로직/조건/변수명은 유지하고 위 지점만 최소 추가했습니다(라인 삭제 없이 파라미터·게이트 추가 위주).

## 검증

- `python -c "import ast; ast.parse(...)"` 로 `calculator.py`, `main.py` 문법 확인
- 위 "단위 테스트로 확인" 절의 시나리오 3건을 실제 `filter_eligible_benefits` 함수 호출로 직접 실행해 통과 확인
- `npx tsc --noEmit` 통과 확인 (타입 에러 없음, `fe-app` 전체)
- 수동 QA 권장 시나리오
  1. "토스프라임 구독 중" 체크 해제 → 토스페이가 포함된 경로에 멤버십 적립(4%/1%)이 더 이상 안 잡히는지 확인
  2. "토스프라임 구독 중" 체크 + 결제 금액을 20만원 이하/초과로 각각 입력 → 해당 구간에 맞는 적립률(4% 또는 1%)만 나오는지, 30만원 입력 시 "20만원 이하" 문구가 더 이상 안 뜨는지 확인
  3. 특정 스토어만 지원하는 게임(예: 원스토어 미지원 게임)을 선택 → 필터의 스토어 선택 버튼에서 미지원 스토어가 회색으로 비활성화되고 클릭이 안 되는지 확인

---

## 4. 후속 조치 (2026-08-19 추가 요청): 네이버플러스 멤버십 기능 삭제 + "토스페이" → "토스페이 프라임" 표기 변경

위 1번 항목을 실제로 테스트해보니, 네이버플러스 멤버십(+4%)은 확인 결과 게임 결제에는 적용되지 않는 것으로 파악되어 **기능 자체를 삭제**했고, 일반(비회원) 토스페이는 게임 결제 적립률이 사실상 0%라서 **"토스페이" 선택지 자체를 "토스페이 프라임"으로 바꿔** 별도 체크박스 없이 선택=프라임 회원으로 처리하도록 변경했습니다.

### 네이버플러스 멤버십 삭제
- `fe-app/src/hooks/useFilterState.ts` — `FilterState`/`emptyFilterState`/`deselectAll()`에서 `useNaverMembership` 필드 제거
- `fe-app/src/components/FilterSection.tsx` — "네이버플러스 멤버십 가입 중 (+4% 추가 적립)" 체크박스 블록과, 그 표시 여부를 판단하던 `isNaverPaySelected` 변수 제거
- `fe-app/src/pages/SearchPage.tsx` — `activeSubscriptions`에 네이버플러스 문구를 넣던 줄 제거
- `fe-app/src/pages/SearchResultPage.tsx` — API payload에서 `has_naver_plus` 필드 제거
- `fe-app/src/pages/MyProfilePage.tsx` — 프로필 저장 payload에서 `has_naver_plus` 필드 제거
- `fe-app/src/constants/searchOptions.ts` — `SUBSCRIPTION_OPTIONS`에서 "네이버플러스 멤버십 (+4% 적립)" 항목 제거 (T멤버십 항목만 남김)
- `game-pay-api/main.py` — `RouteRequest`에서 `has_naver_plus` 필드 제거, `get_optimal_routes`에서 전달하던 부분 제거
- `game-pay-api/engine/calculator.py` — `VIP_MEMBERSHIP_FLAG_BY_PROVIDER`에서 `"NAVER_PAY": "has_naver_plus"` 매핑 제거, `filter_eligible_benefits`/`recommend_best_routes`에서 `has_naver_plus` 파라미터 제거

`game-pay-api/main.py`의 `ProfileUpdateRequest`/`UserModel`(로그인 유저의 저장된 프로필 DB 컬럼)에 남아있는 `has_naver_plus` 필드는 이번 삭제 범위에서 제외했습니다. 이건 실제 경로 계산(`RouteRequest`)과는 무관한, 로그인 유저의 "내 보유 자산 프로필" 저장용 별도 컬럼이라 스키마/DB 컬럼 삭제(마이그레이션)까지는 이번 요청 범위를 벗어난다고 판단했습니다. 프론트에서 더 이상 이 값을 보내지 않으므로 항상 기본값(False)으로만 저장되어 실질적인 문제는 없습니다.

### "토스페이" → "토스페이 프라임"
- `fe-app/src/constants/searchOptions.ts`
  - `PAY_OPTIONS`: `'토스페이'` → `'토스페이 프라임'`
  - `PAYMENT_METHOD_MAP`: 키를 `'토스페이'` → `'토스페이 프라임'`으로 변경 (백엔드로 보내는 코드값 `TOSS_PAY`는 그대로)
  - `SUBSCRIPTION_OPTIONS`에서 "토스프라임 (+4% 적립)" 항목 제거
- `fe-app/src/components/FilterSection.tsx` — "토스프라임 구독 중 (+4% 추가 적립)" 체크박스 블록과 `isTossPaySelected` 변수 제거 (이제 "토스페이 프라임"을 고르는 것 자체가 곧 프라임 회원이라는 뜻)
- `fe-app/src/pages/SearchPage.tsx` — `activeSubscriptions`에 토스프라임 문구를 넣던 줄 제거
- `fe-app/src/pages/SearchResultPage.tsx`
  - API payload의 `has_toss_prime`을 체크박스 값 대신 `filter.usePays && filter.pays.includes('토스페이 프라임')`으로 계산하도록 변경
  - `formatMethodName`의 `TOSS_PAY` → 표시명을 `'토스페이 프라임'`으로 변경
- `fe-app/src/pages/MyProfilePage.tsx` — 프로필 저장 payload의 `has_toss_prime`도 동일하게 `filter.pays.includes('토스페이 프라임')` 기준으로 변경

백엔드(`game-pay-api/engine/calculator.py`, `main.py`)의 `has_toss_prime` 게이트 로직 자체는 3번(위 "1. 토스프라임/일반 토스페이 적립률이 구분되지 않는 문제")에서 이미 만들어둔 것을 그대로 재사용했습니다 — 이번엔 그 값을 프론트에서 어떻게 만들어 보내는지만 "체크박스" → "결제수단 선택 여부"로 바꾼 것입니다.

### 검증
- `python -c "import ast; ast.parse(...)"` 로 `main.py`, `calculator.py` 문법 확인
- `filter_eligible_benefits`를 직접 호출해, 네이버페이 VIP_MEMBER 행은 어떤 플래그를 넘겨도 항상 제외되고(매핑 자체가 없으므로) 토스페이 VIP_MEMBER 행은 `has_toss_prime=True`일 때만 통과하는지 재확인
- `has_naver_plus`를 키워드 인자로 넘기면 `TypeError`가 나는 것까지 확인해, 관련 파라미터가 코드에서 완전히 제거됐음을 검증
- `npx tsc --noEmit` 통과 확인 (타입 에러 없음, `fe-app` 전체)
- 수동 QA 권장 시나리오
  1. 필터 화면에 "네이버플러스 멤버십" 체크박스가 더 이상 보이지 않는지 확인
  2. "사용 간편결제" 목록에 "토스페이"가 아니라 "토스페이 프라임"으로 표시되는지, 별도의 "토스프라임 구독 중" 체크박스는 더 이상 없는지 확인
  3. "토스페이 프라임"을 선택하고 검색 → 결과 경로에 토스프라임 멤버십 적립(4%/1%)이 정상적으로 계산되는지 확인 (체크박스 없이도 선택만으로 적용되는지)
