# "제휴 카드 선택" 드롭다운 - 다른 항목 클릭해도 항상 첫 번째 항목으로 출력되는 문제 수정

작업일: 2026-08-19 ~ 2026-08-20 (1차 수정에 문제가 있어 같은 날 2차로 재수정)

## 증상

검색 필터의 "제휴 카드 선택 (옵션)" 드롭다운에서, 같은 카드사 밑에 여러 항목이 있는 경우(예: "KB국민 노리2 체크카드 모바일 할인 (구글플레이스토어)" / "(앱스토어)", "NH농협 zgm.play카드" / "NH농협 GOODGAME 체크카드" 등) **뒤쪽 항목을 클릭해도 실제로는 항상 맨 위(첫 번째) 항목이 선택된 것처럼 동작**했습니다. KB국민카드, NH농협카드뿐 아니라 혜택이 2개 이상인 카드 전부(삼성카드, 신한카드 등)에서 동일하게 재현되는 문제였습니다.

## 근본 원인

`fe-app/src/hooks/useFilterState.ts`에서 `/payments` API 응답을 드롭다운 옵션으로 변환할 때, 카드사 하나(`m.code`)에 딸린 혜택(`m.benefits[]`)마다 **각각 별도의 `<option>`을 생성**하고 있었습니다. 이때 `label`(화면 표시 텍스트)은 혜택마다 다르게 넣었지만, `value`(실제 선택값)는 전부 **같은 `m.code`**를 그대로 사용했습니다.

```ts
// 원래 코드 (요약): 혜택 개수만큼 옵션이 생기지만 value는 전부 동일
m.benefits.forEach((b) => {
  options.push({ label: b.title, value: m.code }); // ⚠ value 충돌
});
```

HTML `<select>`는 `value`로 옵션을 식별하기 때문에, 같은 `value`를 가진 `<option>`이 여러 개 있으면 어떤 걸 클릭해도 실제 반영되는 값은 동일하고, 브라우저는 항상 DOM에 먼저 등장하는 옵션(대개 구글플레이 버전)을 선택된 것으로 취급합니다. 그 결과 사용자가 "앱스토어" 항목을 골라도 결과는 항상 "구글플레이스토어" 항목 기준으로 나왔습니다.

실제 운영 데이터(`/payments`)로 확인한 카드별 혜택(=상품) 개수:

| 카드사 코드 | 혜택(옵션) 개수 | 상품명 예시 |
|---|---|---|
| `KB_KOOKMIN_CARD` | 2 | 노리2 체크카드 (구글플레이스토어) / (앱스토어) — **같은 카드의 스토어별 버전** |
| `NH_NONGHYUP_CARD` | 5 | zgm.play카드(중복 3건, 스토어별 버전) + GOODGAME 체크카드(중복 2건) — **서로 다른 두 카드 상품** |
| `SAMSUNG_CARD` | 3 | iD SELECT ON / iD GLOBAL(중복 2건) — **서로 다른 두 카드 상품** |
| `SHINHAN_CARD` | 2 | LineageM 신한카드 / 신한카드 체크 — **서로 다른 두 카드 상품** |

→ 혜택이 2개 이상인 카드는 전부 동일한 `value` 충돌 버그를 갖고 있었고, **그중 일부는 같은 카드의 스토어별 버전이지만 나머지 대부분은 이름부터 다른, 실제로 서로 다른 카드 상품**이었습니다.

### KB국민카드만 겉보기에 동작했던 이유

`fe-app/src/components/FilterSection.tsx`에 **KB 노리2 카드에 한해서만** 임시 패치가 있었습니다. 두 중복 옵션을 걸러내고 `KB_NORI2_CARD`라는 가짜 값 하나로 합친 뒤, 선택 시 `filter.osType`(안드로이드/iOS)을 보고 `KB_NORI2_APPSTORE` / `KB_NORI2_PLAYSTORE`로 재매핑하는 방식이었습니다. 이 특수 처리가 KB 노리2 외 카드에는 적용돼 있지 않아 NH·삼성·신한 등에서 동일 버그가 그대로 남아 있었습니다.

---

## ⚠️ 1차 수정 (문제 있었음 — 되돌림)

**시도한 방식**: 백엔드 혜택 계산 로직(`game-pay-api/engine/calculator.py:255`)을 보면, 특정 혜택이 계산에 포함될지는 `provider_code`(카드사 코드)가 보유 결제수단에 있는지 + `target_platform`이 검색 플랫폼과 맞는지로만 결정되고, 드롭다운에서 어떤 세부 상품명을 골랐는지는 계산 결과에 영향이 없다는 걸 확인했습니다. 이를 근거로 "카드사(`m.code`)당 대표 이름 1개만 옵션으로 남기고 나머지는 합쳐버리면 되겠다"고 판단해, `NH농협 zgm.play카드`/`NH농협 GOODGAME 체크카드`처럼 **이름이 다른 별개의 카드 상품**까지 카드사 단위로 한 줄로 합쳐버렸습니다.

**무엇이 잘못됐나**: 백엔드 계산 결과가 상품명과 무관하게 동일하다는 것과, **사용자가 자신이 실제로 들고 있는 카드 상품명을 드롭다운에서 찾아 선택할 수 있어야 한다는 것은 별개의 문제**였습니다. 사용자가 원한 건 "본인 카드(예: NH농협 GOODGAME 체크카드)를 골랐을 때 그 선택이 실제로 반영되는 것"이었는데, 1차 수정은 애초에 그 상품명 자체를 드롭다운에서 지워버려 문제를 "회피"한 것이라, 실질적으로 카드 목록이 통째로 줄어드는 회귀가 발생했습니다. (스크린샷 기준 KB/NH/삼성/신한 각각 2~5개였던 항목이 카드사당 1개, 총 7개로 줄어듦)

이 접근은 **전부 되돌리고 아래 2차 수정으로 대체**했습니다.

---

## ✅ 2차 수정 (최종) — 항목은 그대로 두고 `value`만 고유하게

**방향 전환**: 화면에 보이던 카드 상품명은 하나도 지우지 않고, 원래 있던 "혜택(상품)마다 별도 옵션을 만드는" 구조를 그대로 유지하되, **버그의 진짜 원인이었던 `value` 충돌만** 고칩니다. `/payments`가 내려주는 각 혜택에는 고유 식별자 `benefit_id`(예: `BNF_CARD_NH_99945c93`)가 이미 포함되어 있어서, 이를 활용해 옵션마다 값을 겹치지 않게 만들 수 있었습니다.

### 1. `fe-app/src/hooks/useFilterState.ts`

**위치**: `cardOptions`를 만드는 `useEffect` 내부, 카드 옵션 생성 루프

**변경**: 옵션을 만드는 루프 구조(혜택마다 옵션 1개, 중복 상품명은 기존처럼 스킵)는 그대로 두고, `value`만 `m.code` 단독에서 **`"${m.code}::${benefit_id}"`** 형태로 바꿨습니다.

```diff
   if (cardName && !addedCardNames.has(cardName) && !isTitleExcluded) {
     addedCardNames.add(cardName);
     options.push({
       label: cardName,
-      value: m.code,
+      value: `${m.code}::${b.benefit_id || cardName}`,
     });
   }
```

이제 같은 카드사 밑에 있어도 상품(혜택)마다 값이 달라서, `<select>`가 어떤 옵션이 클릭됐는지 정확히 구분합니다.

### 2. `fe-app/src/constants/searchOptions.ts` — 값 되돌리기 헬퍼 추가

**위치**: `CARD_CODE_MAP` 바로 아래

백엔드(`payment_methods`, `held_cards` 등)는 `"NH_NONGHYUP_CARD::BNF_..."` 같은 합성 값을 모르고 순수 카드사 코드(`NH_NONGHYUP_CARD`)만 이해하므로, 전송 직전에 `"::"` 앞부분만 잘라 원래 카드사 코드로 되돌리는 함수를 새로 추가했습니다. 기존 `CARD_CODE_MAP`(레거시 하드코딩 값들)과도 호환되도록 함께 처리합니다.

```ts
export function resolveCardProviderCode(selectedSpecialCard: string): string {
  if (CARD_CODE_MAP[selectedSpecialCard]) return CARD_CODE_MAP[selectedSpecialCard];
  const providerCode = selectedSpecialCard.split('::')[0];
  return CARD_CODE_MAP[providerCode] || providerCode;
}
```

### 3. `fe-app/src/pages/SearchResultPage.tsx` — 백엔드 전송 시 새 헬퍼 사용

**위치**: `fetchBackendData` 내 카드 코드 전송 로직

```diff
-      const cardCode = CARD_CODE_MAP[filter.selectedSpecialCard] || filter.selectedSpecialCard;
+      const cardCode = resolveCardProviderCode(filter.selectedSpecialCard);
       selectedProviders.push(cardCode);
```

### 4. `fe-app/src/pages/MyProfilePage.tsx` — 프로필 저장 시에도 순수 코드로 변환

**위치**: `handleSaveFilterSection`의 프로필 저장 payload 구성부

프로필에 저장되는 `held_cards`도 합성 값이 아니라 백엔드가 이해하는 순수 카드사 코드여야 하므로 동일한 헬퍼를 적용했습니다.

```diff
-          held_cards: filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE' ? [filter.selectedSpecialCard] : [],
+          held_cards: filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE'
+            ? [resolveCardProviderCode(filter.selectedSpecialCard)]
+            : [],
```

### 5. `fe-app/src/components/FilterSection.tsx` — KB 노리2 전용 임시 패치 제거 (유지)

1차 수정 때 제거했던 KB 노리2 전용 병합/재매핑 하드코딩(`KB_NORI2_CARD` / `KB_NORI2_APPSTORE` / `KB_NORI2_PLAYSTORE`)은 이번 2차 수정에서도 다시 넣지 않았습니다. 이제 모든 카드 옵션이 애초에 고유한 `value`를 가지므로, KB만 특별 취급해서 합칠 이유 자체가 없기 때문입니다. `<select>`는 `filter.selectedSpecialCard` 값을 그대로 쓰고, `<option>`의 `key`도 `card.value`(고유) 하나로 충분합니다.

## 변경 파일 목록 (최종)

| 파일 | 변경 내용 |
|---|---|
| `fe-app/src/hooks/useFilterState.ts` | 카드 옵션의 `value`를 `m.code` 단독에서 `m.code::benefit_id`로 변경 (옵션 목록/라벨/중복 제거 로직은 원래대로 유지 — 카드 상품명이 사라지지 않음) |
| `fe-app/src/constants/searchOptions.ts` | `resolveCardProviderCode()` 헬퍼 추가 — 합성 값에서 순수 카드사 코드만 추출 |
| `fe-app/src/pages/SearchResultPage.tsx` | 백엔드 전송용 카드 코드를 `resolveCardProviderCode()`로 계산하도록 변경 |
| `fe-app/src/pages/MyProfilePage.tsx` | 프로필 저장 시 `held_cards`도 `resolveCardProviderCode()`로 순수 코드 변환 |
| `fe-app/src/components/FilterSection.tsx` | KB 노리2 전용 병합/재매핑 하드코딩 제거 (더 이상 필요 없음) |

## 검증

- `npx tsc --noEmit` 통과 확인 (`fe-app` 전체, 타입 에러 없음)
- 로컬에서 `game-pay-api`(`uvicorn`)를 실제로 기동해 `/payments` 운영 데이터를 직접 조회
- 수정된 옵션 생성 로직 + `resolveCardProviderCode()`를 실제 `/payments` 응답 데이터에 그대로 재현해 검증한 결과:
  - 총 11개 옵션(스크린샷에 보이던 원래 카드 목록과 동일한 개수/이름)이 그대로 유지되고, 11개 `value`가 전부 고유함을 확인
  - 각 옵션의 `value`를 `resolveCardProviderCode()`에 넣으면 원래 카드사 코드(`NH_NONGHYUP_CARD`, `KB_KOOKMIN_CARD` 등)로 정확히 되돌아오는 것을 확인
- 수동 QA 권장 시나리오
  1. "제휴 카드 선택" 드롭다운을 열어, 스크린샷에서 보이던 카드 상품명이 **하나도 빠짐없이** 그대로 나오는지 확인 (KB 구글플레이/앱스토어, NH zgm.play/GOODGAME, 삼성 SELECT ON/GLOBAL, 신한 체크/일반 등)
  2. 같은 카드사의 두 번째·세 번째 항목(예: "NH농협 GOODGAME 체크카드")을 클릭했을 때, 드롭다운에 그 항목이 그대로 선택된 채 유지되는지 확인 (다른 항목으로 되돌아가지 않아야 함)
  3. 그 상태로 다시 검색 → Network 탭에서 `/routes` 요청의 `payment_methods`에 해당 카드사의 순수 코드(예: `NH_NONGHYUP_CARD`, `::BNF_...` 접미사 없이)가 정확히 포함되는지 확인
  4. 마이페이지에서 필터 저장 후 새로고침 → 저장된 `held_cards`에도 접미사 없는 순수 카드사 코드만 저장되는지 확인
  5. "카드 전월 실적 충족" 체크박스가 카드를 선택했을 때만 여전히 정상적으로 나타나는지 확인 (이번 수정으로 건드리지 않은 영역)
