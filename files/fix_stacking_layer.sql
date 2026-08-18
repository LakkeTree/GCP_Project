-- =============================================================================
-- stacking_layer 라벨 오류 수정 SQL (BigQuery용)
-- =============================================================================
-- 대상: category = 'GIFT_CARD' 인데 stacking_layer = 'CARD_ISSUER' 로 잘못 표기된 9건
--       (BNF_0027 ~ BNF_0035: ZEROPIN, SSG_COM, GMARKET, 11STREET,
--        GOOGLE_PLAY_NAVER_STORE, CU_CONVENIENCE_STORE, SKT)
--
-- 사용 시점:
--   A) 이미 BigQuery에 데이터를 적재한 경우 -> 아래 UPDATE 실행
--   B) 아직 적재 전이거나 재적재 예정인 경우 -> UPDATE 대신
--      수정된 benefit_info.jsonl 을 그대로 적재하면 됨 (SQL 불필요)
--
-- 주의: YOUR_PROJECT.YOUR_DATASET 을 실제 값으로 치환하세요.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- [1단계] 수정 전 확인 — 실제로 몇 건이 대상인지 먼저 본다 (9건이 나와야 정상)
-- -----------------------------------------------------------------------------
SELECT
  benefit_id,
  provider_or_retailer,
  category,
  stacking_layer AS current_layer
FROM `YOUR_PROJECT.YOUR_DATASET.benefit_info`
WHERE category = 'GIFT_CARD'
  AND stacking_layer != 'GIFT_CARD'
ORDER BY benefit_id;


-- -----------------------------------------------------------------------------
-- [2단계] 실제 수정
-- -----------------------------------------------------------------------------
UPDATE `YOUR_PROJECT.YOUR_DATASET.benefit_info`
SET stacking_layer = 'GIFT_CARD'
WHERE category = 'GIFT_CARD'
  AND stacking_layer != 'GIFT_CARD';


-- -----------------------------------------------------------------------------
-- [3단계] 수정 후 검증 — 아래 쿼리 결과가 0행이어야 정상
-- -----------------------------------------------------------------------------
SELECT COUNT(*) AS remaining_mismatch
FROM `YOUR_PROJECT.YOUR_DATASET.benefit_info`
WHERE category = 'GIFT_CARD'
  AND stacking_layer != 'GIFT_CARD';


-- -----------------------------------------------------------------------------
-- [4단계] 분포 확인 — 기대값: CARD_ISSUER 22, GIFT_CARD 21, PAYMENT_PG 55, STORE_COUPON 8
-- -----------------------------------------------------------------------------
SELECT
  stacking_layer,
  COUNT(*) AS cnt
FROM `YOUR_PROJECT.YOUR_DATASET.benefit_info`
GROUP BY stacking_layer
ORDER BY stacking_layer;


-- =============================================================================
-- [예방책] 앞으로 같은 오류가 재발하지 않게 하는 정합성 체크 쿼리
-- 데이터 갱신(OPS-001) 때마다 이 쿼리를 돌려서 0행인지 확인하면 된다.
-- =============================================================================
SELECT
  benefit_id,
  category,
  stacking_layer,
  'category와 stacking_layer 불일치' AS issue
FROM `YOUR_PROJECT.YOUR_DATASET.benefit_info`
WHERE
  -- 규칙 1: 상품권 카테고리는 반드시 GIFT_CARD 레이어여야 한다
  (category = 'GIFT_CARD' AND stacking_layer != 'GIFT_CARD')
  -- 규칙 2: 카드 카테고리는 반드시 CARD_ISSUER 레이어여야 한다
  OR (category = 'CARD' AND stacking_layer != 'CARD_ISSUER')
  -- 규칙 3: 간편결제 카테고리는 반드시 PAYMENT_PG 레이어여야 한다
  OR (category = 'E_PAYMENT' AND stacking_layer != 'PAYMENT_PG');
