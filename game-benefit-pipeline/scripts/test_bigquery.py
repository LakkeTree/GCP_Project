# -*- coding: utf-8 -*-
"""
scripts/test_bigquery.py
--------------------------------------------------------------------
BigQuery 연동을 확인하는 테스트 스크립트입니다.

[실행 방법]
    python -m scripts.test_bigquery

[안전장치]
    .env 의 DRY_RUN=true 면 실제로 쓰지 않고 화면 출력만 합니다.
    처음에는 true 로 한 번 돌려보고, 문제없으면 false 로 바꾸세요.
    테스트 데이터는 benefit_id 가 BNF_AUTO_TEST_ 로 시작하므로
    실제 데이터(BNF_0001, 크롤링분)와 섞이지 않고 나중에 골라 지울 수 있습니다.

[테스트 순서]
    1. 설정 점검
    2. 데이터셋·테이블 준비
    3. 신규 업서트 (INSERT 확인)
    4. 같은 데이터 재업서트 (중복 방지 확인) ★가장 중요
    5. 내용 변경 후 업서트 (UPDATE 확인)
    6. 계산엔진용 조회 함수 확인
"""

from __future__ import annotations

import sys

from common.bq_client import BigQueryClient
from common.config import get_settings
from common.dedupe import to_benefit_info
from common.logger import get_logger
from common.schema import (
    BenefitCategory,
    BenefitExtraction,
    BenefitType,
    BenefitUnit,
    ChannelType,
    DisbursementType,
    Platform,
    PlatformConnection,
    StackingLayer,
)

log = get_logger("test_bigquery")

# 테스트 데이터임을 알아볼 수 있는 표식
TEST_MARKER = "__TEST__"


def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def make_test_items(discount_rate: float = 20.0) -> list:
    """테스트용 가짜 혜택 2건을 만듭니다."""
    raw = [
        BenefitExtraction(
            category=BenefitCategory.DISCOUNT_STORE,
            provider_or_retailer="ONE_STORE",
            item_or_event_name=f"{TEST_MARKER} 원스토어 Day 즉시 할인 쿠폰",
            target_platform=Platform.ONE_STORE,
            target_game="ALL",
            channel_type=ChannelType.IN_APP,
            benefit_type=BenefitType.DISCOUNT,
            benefit_value=discount_rate,          # 이 값을 바꿔 UPDATE 테스트를 합니다.
            benefit_unit=BenefitUnit.PERCENT,
            min_spend_krw=10000,
            max_benefit_krw=10000,
            stacking_layer=StackingLayer.STORE_COUPON,
            disbursement_type=DisbursementType.INSTANT_DISCOUNT,
            start_date="2026-08-01",
            end_date="2026-08-31",
            condition_raw_text="건당 1만원 이상 결제, 최대 1만원 할인",
        ),
        BenefitExtraction(
            category=BenefitCategory.REWARD_E_PAY,
            provider_or_retailer="NAVER_PAY",
            item_or_event_name=f"{TEST_MARKER} 네이버페이 상시 적립",
            target_platform=Platform.ALL,
            target_game="COOKIERUN_KINGDOM",
            channel_type=ChannelType.IN_APP,
            benefit_type=BenefitType.REWARD,
            benefit_value=2.0,
            benefit_unit=BenefitUnit.PERCENT,
            min_spend_krw=0,
            max_benefit_krw=None,                  # 무제한 (null 처리 테스트)
            stacking_layer=StackingLayer.PAYMENT_E_PAY,
            disbursement_type=DisbursementType.POINT_REWARD,
            start_date=None,                       # 상시 혜택 (날짜 null 테스트)
            end_date=None,
            denomination_list=[5000, 10000, 50000],  # 배열 컬럼 테스트
            condition_raw_text="상시 적립, 한도 없음",
        ),
    ]
    return [to_benefit_info(x, source_name="test_script",
                           source_url="https://example.com/test") for x in raw]


def main() -> int:
    print("\n🚀 BigQuery 공통 모듈 테스트를 시작합니다.")

    # ------------------------------------------------------------------
    print_header("1단계 | 설정 점검")
    settings = get_settings()
    problems = settings.validate()

    print(f"  프로젝트      : {settings.gcp_project_id}")
    print(f"  혜택 테이블   : {settings.bq_table_fqn}")
    print(f"  호환성 테이블 : {settings.bq_platform_table_fqn}")
    print(f"  리전          : {settings.bq_location}")
    print(f"  DRY_RUN       : {settings.dry_run}")

    if problems:
        print("\n❌ 설정 문제:")
        for p in problems:
            print(f"   - {p}")
        return 1
    print("\n✅ 설정 정상")

    # ------------------------------------------------------------------
    print_header("2단계 | 데이터셋·테이블 준비")
    try:
        bq = BigQueryClient()
        bq.setup()
        print("\n✅ 준비 완료")
    except Exception as e:
        print(f"\n❌ 실패: {e}")
        print("\n  자주 나오는 원인:")
        print("   - 인증 안 됨 → `gcloud auth application-default login` 실행")
        print("   - 권한 부족 → 계정에 'BigQuery 데이터 편집자' 역할 부여")
        print("   - 리전 불일치 → 기존 데이터셋 리전과 BQ_LOCATION 이 같아야 함")
        return 1

    if settings.dry_run:
        print("\n⚠️ DRY_RUN=true 이므로 쓰기 테스트는 건너뜁니다.")
        print("   전체 테스트를 하려면 .env 에서 DRY_RUN=false 로 바꾸세요.")
        return 0

    # ------------------------------------------------------------------
    print_header("3단계 | 신규 업서트 (INSERT 테스트)")
    before = bq.count_rows()
    print(f"  현재 행 수: {before}")

    items = make_test_items(discount_rate=20.0)
    for item in items:
        print(f"  넣을 데이터: {item.benefit_id}")
        print(f"              {item.item_or_event_name}")

    result = bq.upsert_benefits(items)
    after_first = bq.count_rows()
    print(f"\n  결과: {result}")
    print(f"  행 수: {before} → {after_first}")
    print("✅ 첫 업서트 완료")

    # ------------------------------------------------------------------
    print_header("4단계 | 같은 데이터 재업서트 (중복 방지) ★가장 중요")
    print("  방금과 똑같은 데이터를 한 번 더 넣습니다.")
    print("  행 수가 늘어나지 않아야 정상입니다.")

    bq.upsert_benefits(make_test_items(discount_rate=20.0))
    after_second = bq.count_rows()
    print(f"\n  행 수: {after_first} → {after_second}")

    if after_second == after_first:
        print("✅ 중복이 생기지 않았습니다. 업서트 정상 동작!")
    else:
        print("❌ 행 수가 늘었습니다. dedupe.py 의 ID 생성 규칙을 확인하세요.")
        return 1

    # ------------------------------------------------------------------
    print_header("5단계 | 내용 변경 후 업서트 (UPDATE 테스트)")
    print("  할인율을 20% → 25% 로 바꿔 다시 넣습니다.")
    print("  행 수는 그대로이고 값만 바뀌어야 정상입니다.")

    bq.upsert_benefits(make_test_items(discount_rate=25.0))
    after_third = bq.count_rows()
    print(f"\n  행 수: {after_second} → {after_third}")

    rows = bq.fetch_all_benefits()
    updated = [r for r in rows
               if TEST_MARKER in str(r.get("item_or_event_name", ""))
               and r.get("stacking_layer") == "STORE_COUPON"]

    if after_third == after_second and updated and float(updated[0]["benefit_value"]) == 25.0:
        print("✅ 행 수 유지 + 값이 25.0 으로 갱신되었습니다. UPDATE 정상!")
    elif after_third != after_second:
        print("❌ 행이 새로 생겼습니다. MERGE 조건을 확인하세요.")
        return 1
    else:
        print("⚠️ 값 확인 실패. BigQuery 반영에 몇 초 걸릴 수 있으니 잠시 후 재확인하세요.")

    # --- null / 배열 컬럼이 제대로 저장됐는지 확인 ---
    unlimited = [r for r in rows
                 if TEST_MARKER in str(r.get("item_or_event_name", ""))
                 and r.get("stacking_layer") == "PAYMENT_E_PAY"]
    if unlimited:
        u = unlimited[0]
        print(f"\n  상시 혜택 저장 확인:")
        print(f"    max_benefit_krw = {u.get('max_benefit_krw')}  (무제한이므로 None 이어야 함)")
        print(f"    start_date      = {u.get('start_date')}  (상시이므로 None 이어야 함)")
        print(f"    denomination_list = {u.get('denomination_list')}  (배열이 보존되어야 함)")

    # ------------------------------------------------------------------
    print_header("6단계 | 계산엔진용 조회 확인")
    all_benefits = bq.fetch_all_benefits()
    print(f"  계산엔진에 넘길 혜택: {len(all_benefits)}건")

    # 호환성 테이블도 테스트해 봅니다.
    test_conn = [
        PlatformConnection(payment_method="NAVER_PAY", platform=Platform.GOOGLE_PLAY,
                           is_supported=True, note=None),
        PlatformConnection(payment_method="CULTURELAND_CASH", platform=Platform.APP_STORE,
                           is_supported=False, note="앱스토어 컬쳐랜드 직접 결제 미지원"),
    ]
    print(f"\n  ⚠️ 참고: replace_platform_connections() 는 테이블을 '통째로 교체'합니다.")
    print(f"     여기서 호출하면 실제 80건이 2건으로 덮어써지므로 호출하지 않습니다.")
    print(f"     (시드 적재는 python -m scripts.seed_bigquery 로 하세요)")

    conns = bq.fetch_platform_connections()
    print(f"  현재 호환성 테이블: {len(conns)}건")

    # ------------------------------------------------------------------
    print_header("테스트 완료")
    print("  테스트 데이터를 지우려면 BigQuery 콘솔에서 아래를 실행하세요:\n")
    print(f"    DELETE FROM `{settings.bq_table_fqn}`")
    print(f"    WHERE item_or_event_name LIKE '%{TEST_MARKER}%';")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
