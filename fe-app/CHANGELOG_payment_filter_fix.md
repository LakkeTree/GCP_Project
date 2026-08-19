# 결제수단/첫결제 필터 반영 안 되는 문제 수정 기록

작업일: 2026-08-19
작업자 확인 요청 배경: 조원 브랜치와 병합(`develop` merge) 이후 재검토 요청 + "제휴카드만 선택해도 결제수단 최소 1개 경고가 뜬다" 신규 리포트

## 0. 재검토 결과 요약

병합 이후에도 기존에 보고했던 stale closure 문제는 **그대로 남아 있었고**, 병합 과정에서 카드 관련 로직에 **새로운 회귀(regression)가 하나 더 추가**되어 있었습니다. 여기에 이번에 새로 리포트된 "제휴카드만 선택해도 최소 1개 경고" 문제까지 포함해 총 3건을 수정했습니다.

| # | 증상 | 파일 | 원인 유형 |
|---|---|---|---|
| 1 | 필터(첫 결제/카드 등)를 바꾸고 "다시 검색"을 눌러도 이전 값 기준으로 계산됨 | `fe-app/src/pages/SearchResultPage.tsx` | React `useCallback` 의존성 배열 누락 (stale closure) |
| 2 | (병합으로 새로 생김) 제휴카드를 선택해도 "카드 전월 실적 충족"을 함께 체크하지 않으면 카드가 아예 결제수단 목록에서 빠짐 | `fe-app/src/pages/SearchResultPage.tsx` | 조건문에 무관한 플래그(`hasPrevSpend`)가 잘못 결합됨 |
| 3 | 제휴카드만 선택한 상태에서 다른 결제수단(카카오페이 등)을 해제하려 하면 "보유 결제 수단은 최소 1개 이상 선택해야 합니다" 경고가 뜸 | `fe-app/src/hooks/useFilterState.ts` | 최소 1개 검증 로직이 제휴카드를 합산에서 누락 |

세 문제 모두 **기존 코드 삭제는 최소화**하고, 조건/의존성 배열만 보정하는 방식으로 수정했습니다.

---

## 1. `fetchBackendData` stale closure (기존 문제, 병합 후에도 유지되어 있던 것 확인 후 수정)

### 위치
`fe-app/src/pages/SearchResultPage.tsx` — `fetchBackendData` (`useCallback` 정의부, 이번 수정 기준 약 406~690번째 줄)

### 문제
```ts
const fetchBackendData = useCallback(async (targetGameName?: string) => {
  // filter, payAmount, activeGameTitle, currentGameObj 를 참조
  ...
}, []); // ← 의존성 배열이 비어 있음
```
`useCallback(fn, [])`으로 의존성 배열을 비워두면, 함수 내부에서 참조하는 `filter`, `payAmount`, `activeGameTitle`, `currentGameObj`가 **최초 렌더링 시점 값으로 클로저에 고정**됩니다. 이후 사용자가 체크박스를 바꾸고 "다시 검색"을 눌러도, 실제 호출되는 `fetchBackendData`는 마운트 당시의 오래된 값을 그대로 사용해 API를 호출합니다.
- 첫 결제 체크를 해제해도 `is_first_pay`는 예전 값 그대로 전송됨
- 카드/간편결제를 새로 선택해도 `payment_methods`는 예전 값 그대로 전송됨

### 수정
```ts
}, [filter, payAmount, activeGameTitle, currentGameObj]);
```
의존성 배열을 실제로 참조하는 값들로 채워서, 호출 시점의 최신 상태를 읽도록 했습니다.

### 자동 재검색이 생기지 않는 이유
`fetchBackendData`를 마운트 시 1회만 호출하는 `useEffect(() => { fetchBackendData(); }, [])`는 **자기 자신의 의존성 배열이 `[]`** 이므로, `fetchBackendData`의 참조가 바뀌어도 재실행되지 않습니다. 즉 "필터를 바꿀 때마다 자동으로 재검색되는" 부작용 없이, "다시 검색" 버튼/엔터/금액 입력 blur 등 **명시적으로 호출하는 시점에만** 최신 필터가 반영됩니다.

---

## 2. (병합 중 새로 생긴 회귀) 제휴카드가 "전월 실적 충족" 체크에 종속되던 문제

### 위치
`fe-app/src/pages/SearchResultPage.tsx` — `fetchBackendData` 내 결제수단 조합 로직 (약 447번째 줄)

### 문제
병합 과정에서 아래처럼 조건이 바뀌어 있었습니다.
```ts
if (filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE' && filter.hasPrevSpend) {
  // 카드 코드를 selectedProviders에 push
}
```
`hasPrevSpend`("카드 전월 실적 충족" 체크박스)는 원래 백엔드의 `has_prev_spend` 필드로 별도 전달되어 "전월 실적 조건이 있는 혜택"의 자격 여부만 판단하는 값입니다. 그런데 이 조건문에 함께 묶이면서, **카드를 선택했는데 전월 실적 체크박스를 켜지 않으면 카드 자체가 `payment_methods` 목록에서 통째로 빠지는** 결과를 만들었습니다. 사용자가 리포트한 "카드를 선택해도 카드 혜택 대신 네이버페이 등만 나온다"는 증상의 원인 중 하나입니다.

### 수정
```ts
if (filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE') {
  // 카드 코드를 selectedProviders에 push (전월 실적 여부와 무관하게 항상 포함)
}
```
`hasPrevSpend` 조건을 제거해, 카드를 선택하면 실적 조건과 무관하게 항상 보유 결제수단으로 전송되도록 되돌렸습니다. `has_prev_spend` 필드 자체는 아래쪽 payload 구성부(`has_prev_spend: filter.useSpecialOptions ? filter.hasPrevSpend : false`)에서 기존대로 별도로 전달되므로, 전월 실적 조건이 있는 혜택의 자격 판정 로직은 그대로 유지됩니다.

---

## 3. (신규 리포트) 제휴카드만 선택해도 "최소 1개 이상 선택" 경고가 뜨는 문제

### 위치
`fe-app/src/hooks/useFilterState.ts` — `toggleArrayItem` 함수 (약 248~278번째 줄)

### 문제
```ts
if (isSelected && (key === 'carriers' || key === 'pays' || key === 'voucherBypasses')) {
  const totalSelected =
    (prev.useCarriers ? prev.carriers.length : 0) +
    (prev.usePays ? prev.pays.length : 0) +
    (prev.useVoucherBypasses ? prev.voucherBypasses.length : 0);

  if (totalSelected <= 1) {
    alert('보유 결제 수단은 최소 1개 이상 선택해야 합니다.');
    return prev;
  }
}
```
"보유 결제수단 최소 1개" 합산에 통신사/간편결제/상품권 우회만 포함되고 **제휴카드(`useSpecialOptions` + `selectedSpecialCard`)가 빠져 있었습니다.** 그래서 제휴카드를 이미 선택한 상태에서 나머지 결제수단(예: 카카오페이)을 마지막 하나까지 해제하려고 하면, 실제로는 카드가 유효한 결제수단으로 남아있는데도 `totalSelected`가 0으로 계산되어 잘못된 경고가 뜨고 해제 자체가 막혔습니다.

### 수정
```ts
const hasCardSelected = prev.useSpecialOptions && prev.selectedSpecialCard !== 'NONE';
const totalSelected =
  (prev.useCarriers ? prev.carriers.length : 0) +
  (prev.usePays ? prev.pays.length : 0) +
  (prev.useVoucherBypasses ? prev.voucherBypasses.length : 0) +
  (hasCardSelected ? 1 : 0);
```
제휴카드가 선택되어 있으면 합산에 1개로 포함시켜, 카드만 선택된 상태에서는 다른 결제수단을 전부 해제할 수 있도록 했습니다.

---

## 2차 QA (백엔드+프론트엔드 실제 실행 후 재확인, 2026-08-19)

위 3건 수정본을 실제로 백엔드/프론트엔드를 켜서 돌려본 결과 새로 2건이 식별되었습니다. 아래 둘은 위 1~3번과 **다른 파일의 다른 코드**가 원인이라, 앞의 수정만으로는 해결되지 않았던 것입니다.

| # | 증상 | 파일 | 원인 유형 |
|---|---|---|---|
| 4 | 여전히 카드만 선택 시 "결제수단 최소 1개 이상 선택" 경고가 뜸 | `fe-app/src/pages/SearchPage.tsx` | 3번과 같은 종류의 검증 로직이 **별도 파일에 중복 구현**되어 있었고, 거기엔 3번에서 고친 제휴카드 합산 보정이 반영되지 않음 |
| 5 | SKT/KT/LGU+ 등 통신사 혜택이 경로 계산에 전혀 반영 안 됨 | `game-pay-api/main.py` | 신규 통신사 필터링 로직이 요구하는 `has_subscription` 값이 API 요청 모델과 백엔드 호출부에 아예 없어 **항상 `False`로 고정** |

### 4. `SearchPage.tsx`에 있던 두 번째 "최소 1개" 검증 (3번과 동일 버그, 다른 파일)

#### 위치
`fe-app/src/pages/SearchPage.tsx` — `handleSearch` 함수 (약 125~151번째 줄)

#### 문제
3번에서 고친 `useFilterState.ts`의 `toggleArrayItem`은 체크박스를 하나씩 해제할 때 동작하는 검증이고, 이와 별개로 검색 시작 페이지(`SearchPage.tsx`)의 "검색하기" 버튼(`handleSearch`)에 **완전히 동일한 로직이 중복 구현**되어 있었습니다.
```ts
const totalSelectedPayments =
  (filter.useCarriers ? filter.carriers.length : 0) +
  (filter.usePays ? filter.pays.length : 0) +
  (filter.useVoucherBypasses ? filter.voucherBypasses.length : 0);

if (totalSelectedPayments === 0) {
  alert('보유 결제 수단을 최소 1개 이상 선택해 주세요.');
  return;
}
```
이쪽도 제휴카드(`useSpecialOptions` + `selectedSpecialCard`)를 합산에서 빠뜨리고 있어서, 카드만 선택하고 다른 수단을 전부 해제한 채 "검색하기"를 누르면 여전히 경고가 뜨고 검색 자체가 막혔습니다. 3번 수정이 `toggleArrayItem`(체크박스 개별 해제 시점)만 고쳤을 뿐, 이 별도의 제출 시점 검증까지는 다루지 않아서 재현된 것입니다.

#### 수정
```ts
const hasCardSelectedForSearch = filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE';
const totalSelectedPayments =
  (filter.useCarriers ? filter.carriers.length : 0) +
  (filter.usePays ? filter.pays.length : 0) +
  (filter.useVoucherBypasses ? filter.voucherBypasses.length : 0) +
  (hasCardSelectedForSearch ? 1 : 0);
```
3번과 동일한 방식으로 제휴카드 선택 여부를 합산에 포함했습니다. 근본적으로는 `useFilterState.ts`와 `SearchPage.tsx`에 같은 검증 로직이 두 군데 중복돼 있는 구조라, 이후에도 한쪽만 고치면 같은 문제가 재발할 수 있습니다 — 장기적으로는 `useFilterState.ts`에 `hasAtLeastOnePaymentMethod(filter)` 같은 공용 헬퍼를 하나 만들어 두 곳에서 재사용하는 게 안전합니다(이번엔 기존 코드 삭제를 최소화하는 요청이라 구조 변경 없이 값만 맞춰 고쳤습니다).

---

### 5. 통신사(SKT/KT/LGU+) 혜택이 항상 계산에서 빠지는 문제

#### 위치
- `game-pay-api/game-pay-api` 백엔드 진입점 `main.py` — `RouteRequest` DTO 및 `get_optimal_routes` 함수 (약 74~221번째 줄)
- 참고: 실제 필터링 로직은 `game-pay-api/engine/calculator.py`의 `filter_eligible_benefits` (약 183~200번째 줄), 이 부분 자체는 정상 작동함

#### 원인
병합 과정에서 `calculator.py`에 통신사 전용 필터 블록이 새로 추가되어 있었습니다.
```python
# game-pay-api/engine/calculator.py
if requires_telecom:
    telecom_keys = {"TELECOM_DISCOUNT", "SKT", "KT", "LGU_PLUS", ...}
    has_telecom_held = any(m in telecom_keys for m in held_methods)
    if not has_telecom_held or not has_subscription:
        continue  # 🚫 통신사 옵션 해제 시 배제
```
즉 통신사 혜택이 보이려면 **① 보유 결제수단에 SKT/KT/LGU+가 있어야 하고, ② `has_subscription`이 True여야** 합니다. 프론트엔드(`SearchResultPage.tsx`)는 이미 `has_subscription: filter.useCarriers`로 값을 보내고 있었는데, 정작 백엔드 `main.py`에서:
1. `RouteRequest` Pydantic 모델에 `has_subscription` 필드가 아예 선언되어 있지 않아, FastAPI가 요청 바디에서 이 값을 조용히 버리고 있었고(Pydantic 기본 동작이 정의되지 않은 필드를 에러 없이 무시함),
2. `get_optimal_routes`에서 계산 엔진(`recommend_best_routes`)을 호출할 때도 `has_subscription` 인자를 넘기지 않고 있었습니다.

그 결과 계산 엔진 쪽에서는 `kwargs.get("has_subscription", False)`가 **항상 `False`로 고정**되어, 프론트엔드에서 SKT/KT를 아무리 선택해도 `not has_subscription` 조건이 항상 참이 되어 통신사 혜택이 무조건 제외됐습니다. 즉 프론트엔드 체크박스 상태와 무관하게 100% 재현되는 버그였습니다.

#### 수정
`game-pay-api/main.py`에 두 군데를 고쳤습니다.
```python
class RouteRequest(BaseModel):
    ...
    use_game_benefits: Optional[bool] = Field(True)
    has_subscription: Optional[bool] = Field(False)   # ← 추가
```
```python
result = recommend_best_routes(
    ...
    use_game_benefits=request.use_game_benefits,
    has_subscription=request.has_subscription,        # ← 추가
)
```
이제 프론트엔드가 보내는 `has_subscription`(= "통신사 멤버십 및 휴대폰 결제 사용" 체크박스 상태)이 `engine/loader.py`의 `**kwargs` → `calculator.py`의 `filter_eligible_benefits`까지 그대로 전달되어, 실제 체크 상태에 따라 통신사 혜택이 정상적으로 계산에 포함/제외됩니다.

참고로 실제 `Telecom_Benefit_Info_DB.csv` 데이터를 확인해보니 13건 중 12건이 `requires_pre_app=TRUE`(사전 신청 필요)로 표기돼 있어서, "사전 응모 완료 혜택 포함" 체크박스도 함께 켜지 않으면 대부분의 통신사 혜택은 여전히 안 보일 수 있습니다. 이건 별도 버그가 아니라 데이터/필터 설계상 의도된 동작이니, 통신사 혜택 확인 시에는 "통신사 사용" + "사전 응모 완료" 두 체크박스를 함께 켜고 테스트해 주세요.

---

## 3차 QA (2026-08-19, "여전히 경고가 뜬다" 재확인)

2차 QA에서 고친 4번(`SearchPage.tsx`)·3번(`useFilterState.ts`)은 모두 `useSpecialOptions && selectedSpecialCard !== 'NONE'`을 "카드 선택됨"으로 봤는데, 실제 재현 스크린샷을 보니 사용자는 **"제휴 카드 선택 (옵션)" 토글만 켜고 드롭다운은 기본값인 "선택 안 함 (일반 신용/체크카드 / 기본 결제)"에 그대로 둔 상태**였습니다. 이 경우 `selectedSpecialCard === 'NONE'`이라 위 조건이 여전히 거짓이 되어 경고가 그대로 재현됐습니다.

### 근본 원인 재정의
드롭다운의 첫 번째 옵션 라벨이 문자 그대로 **"선택 안 함 (일반 신용/체크카드 / 기본 결제)"** 입니다. 즉 `NONE`은 "결제수단이 없음"이 아니라 "특정 제휴카드 혜택은 안 쓰고 일반 신용/체크카드로 결제하겠다"는 **그 자체로 유효한 선택지**입니다. 사용자가 이전에 명시적으로 요구한 "제휴카드만 선택해도 결제가 되어야 한다"는 요구사항에 비춰 봐도, "제휴 카드 선택" 옵션을 켠 시점에 이미 카드로 결제하겠다는 의사표시가 끝난 것으로 봐야 합니다. 특정 카드를 더 골랐는지(`selectedSpecialCard`가 NONE이 아닌 구체적 코드인지)는 "어떤 카드의 전용 혜택을 추가로 적용할지"를 결정하는 것일 뿐, "결제수단이 있는지"를 판단하는 것과는 별개입니다.

### 수정
`fe-app/src/hooks/useFilterState.ts`(`toggleArrayItem`)와 `fe-app/src/pages/SearchPage.tsx`(`handleSearch`) 두 곳 모두, 보유 결제수단 합산 조건을
```ts
const hasCardSelected = prev.useSpecialOptions && prev.selectedSpecialCard !== 'NONE';
```
에서
```ts
const hasCardSelected = prev.useSpecialOptions;
```
로 바꿔, "제휴 카드 선택 (옵션)" 토글이 켜져 있으면 구체적으로 어떤 카드를 골랐는지와 무관하게 보유 결제수단 1개로 인정하도록 했습니다.

**주의**: 실제로 백엔드에 보낼 카드 코드를 결정하는 로직(`SearchResultPage.tsx`의 `if (filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE') { ...selectedProviders.push(cardCode) }`, `MyProfilePage.tsx`의 `held_cards` 저장 로직, `FilterSection.tsx`의 "카드 전월 실적 충족" 체크박스 렌더 조건)는 **그대로 `!== 'NONE'`을 유지**했습니다. 이 세 곳은 "구체적인 제휴카드가 골라졌을 때만" 의미가 있는 로직(카드 코드 전송, 프로필 저장, 실적 조건 UI)이라 NONE일 때 동작하면 안 되기 때문입니다. 즉 이번 수정은 **"최소 1개 선택됐는지 검증하는 곳"에만 한정**했고, 카드 코드 자체를 다루는 로직은 건드리지 않았습니다.

### "카드 전월 실적 충족" 체크박스가 사라졌다는 문제에 대해
`git diff`와 `git log -p`로 `fe-app/src/components/FilterSection.tsx` 전체 히스토리를 확인한 결과, 이 체크박스는 **이번 세션의 어떤 수정으로도 삭제되거나 변경된 적이 없습니다** (`git diff -- fe-app/src/components/FilterSection.tsx` 결과가 완전히 비어 있음). 이 체크박스는 원래부터
```tsx
{filter.selectedSpecialCard !== 'NONE' && (
  <div>... 카드 전월 실적 충족 ...</div>
)}
```
조건으로, **구체적인 제휴카드를 하나 골랐을 때만** 나타나도록 처음 추가된 시점(커밋 `eb1c38b`)부터 지금까지 동일하게 구현되어 있었습니다. 신고해주신 스크린샷 시점에는 드롭다운이 "선택 안 함" 상태였기 때문에 원래 설계대로 안 보인 것이지, 코드가 삭제된 게 아니었습니다. 이번에 위 검증 로직을 고쳤으니, 드롭다운에서 실제 카드(예: "KB국민 노리2 체크카드")를 선택하면 이 체크박스가 다시 정상적으로 나타납니다.

---

## 변경 파일 목록

- `fe-app/src/pages/SearchResultPage.tsx`
  - `fetchBackendData`의 `useCallback` 의존성 배열: `[]` → `[filter, payAmount, activeGameTitle, currentGameObj]`
  - 제휴카드 포함 조건에서 `&& filter.hasPrevSpend` 제거
- `fe-app/src/hooks/useFilterState.ts`
  - `toggleArrayItem`의 최소 1개 검증 합산식에 제휴카드 선택 여부 포함
  - *(3차 QA)* 합산 조건을 `useSpecialOptions && selectedSpecialCard !== 'NONE'` → `useSpecialOptions`로 재조정 (옵션을 켠 것 자체를 유효한 선택으로 인정)
- `fe-app/src/pages/SearchPage.tsx` *(2차 QA에서 추가)*
  - `handleSearch`의 `totalSelectedPayments` 합산식에 제휴카드 선택 여부 포함
  - *(3차 QA)* 위와 동일하게 `useSpecialOptions`만으로 판단하도록 재조정
- `game-pay-api/main.py` *(2차 QA에서 추가)*
  - `RouteRequest`에 `has_subscription` 필드 추가
  - `get_optimal_routes`에서 `recommend_best_routes` 호출 시 `has_subscription=request.has_subscription` 전달

`fe-app/src/pages/SearchResultPage.tsx`(카드 코드 전송), `fe-app/src/pages/MyProfilePage.tsx`(프로필 저장), `fe-app/src/components/FilterSection.tsx`(전월실적 체크박스 렌더 조건) 등 **실제 카드 코드값이 의미를 가지는 곳은 `selectedSpecialCard !== 'NONE'` 조건을 그대로 유지**했습니다 — "결제수단 존재 여부 검증"과 "어떤 카드 코드를 쓸지 결정"은 서로 다른 문제라, 전자만 완화하고 후자는 건드리지 않았습니다.

기존 로직/조건/변수명은 그대로 두고, 위 지점들만 최소 수정했습니다(라인 삭제 없이 조건/필드 추가 위주). `git diff -- fe-app/src/components/FilterSection.tsx`가 비어 있음을 확인해, "전월실적 체크박스가 삭제됐다"는 리포트가 실제 코드 삭제가 아니었음도 함께 검증했습니다.

## 검증

- `npx tsc --noEmit` 통과 확인 (타입 에러 없음, `fe-app` 전체, 3차 수정 후 재확인 포함)
- `python -c "import ast; ast.parse(open('main.py', encoding='utf-8').read())"` 로 `main.py` 문법 확인
- `git diff --stat` / `git diff -- fe-app/src/components/FilterSection.tsx`로 의도치 않은 삭제가 없는지 확인
- 수동 QA 권장 시나리오
  1. "첫 결제 이벤트 대상" 체크 해제 후 "다시 검색" → 결과 경로에 첫 결제 관련 혜택(뱃지/할인)이 더 이상 섞이지 않는지 확인
  2. "사용 간편결제(페이)"를 모두 해제하고 "제휴 카드 선택"만 지정 후 "다시 검색" → 카드 혜택 기반 경로가 정상적으로 나오는지, 네이버페이 등 이전에 선택했던 수단이 남아있지 않은지 확인
  3. 검색 시작 페이지·검색 결과 페이지 양쪽에서: "제휴 카드 선택" 옵션만 켠 상태(다른 결제수단 전부 해제) + 드롭다운을 **"선택 안 함" 그대로 둔 채로** 검색/재검색 시도 → 더 이상 "최소 1개 이상 선택" 경고 없이 진행되는지 확인 (3차 QA에서 재현된 시나리오)
  4. 같은 상태에서 드롭다운으로 실제 카드(예: "KB국민 노리2 체크카드")를 선택 → "카드 전월 실적 충족" 체크박스가 정상적으로 나타나는지 확인
  5. "통신사 멤버십 및 휴대폰 결제 사용" + SKT 또는 KT 선택, "사전 응모 완료 혜택 포함"까지 체크 후 재검색 → 통신사 혜택이 경로에 계산되는지 확인
  6. 브라우저 개발자도구 Network 탭에서 `/routes` 요청 payload가 사이드바에 표시된 현재 체크 상태와 일치하는지 확인 (`has_subscription` 필드가 체크박스 상태와 맞는지도 함께 확인)
