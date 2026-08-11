# -*- coding: utf-8 -*-
"""
scripts/test_gemini.py
--------------------------------------------------------------------
Gemini 연동이 제대로 되는지 확인하는 테스트 스크립트입니다.
BigQuery는 전혀 건드리지 않으므로 안심하고 여러 번 실행해도 됩니다.

[실행 방법]
    프로젝트 최상위 폴더(game-benefit-pipeline)에서:
        python -m scripts.test_gemini

    ⚠️ "python scripts/test_gemini.py" 가 아니라 "python -m scripts.test_gemini" 입니다.
       -m 을 붙여야 common 폴더를 import 할 수 있습니다.

[테스트 순서]
    1. .env 설정이 제대로 채워졌는지 확인
    2. Gemini에 인사 한마디를 보내 연결 확인
    3. 샘플 페이지 텍스트를 넣어 혜택 추출이 되는지 확인
    4. 추출 결과에 ID/해시를 붙여 최종 형태 확인
"""

from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from common.ai_client import GeminiClient
from common.config import PROJECT_ROOT, get_settings
from common.dedupe import deduplicate, to_benefit_info
from common.logger import get_logger

log = get_logger("test_gemini")
KST = ZoneInfo("Asia/Seoul")


def print_header(title: str) -> None:
    """구분선을 넣어 결과를 읽기 쉽게 만듭니다."""
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def step1_check_settings() -> bool:
    """1단계: .env 설정 점검"""
    print_header("1단계 | 설정(.env) 점검")

    env_path = PROJECT_ROOT / ".env"
    if not env_path.exists():
        print("❌ .env 파일이 없습니다.")
        print(f"   위치: {env_path}")
        print("   해결: .env.example 을 복사해서 .env 로 이름을 바꾸고 값을 채우세요.")
        return False

    settings = get_settings()
    problems = settings.validate()

    print(f"  인증 방식      : {'Vertex AI' if settings.use_vertexai else 'AI Studio API 키'}")
    print(f"  모델           : {settings.gemini_model}")
    print(f"  GCP 프로젝트   : {settings.gcp_project_id or '(비어 있음)'}")
    print(f"  BigQuery 테이블: {settings.bq_table_fqn}")
    print(f"  DRY_RUN        : {settings.dry_run}")

    if problems:
        print("\n❌ 설정에 문제가 있습니다:")
        for p in problems:
            print(f"   - {p}")
        return False

    print("\n✅ 설정이 정상입니다.")
    return True


def step2_check_connection(client: GeminiClient) -> bool:
    """2단계: Gemini 연결 확인"""
    print_header("2단계 | Gemini 연결 확인")
    print("  Gemini에 간단한 메시지를 보내는 중...")

    if client.ping():
        print("\n✅ Gemini 연결 성공!")
        return True

    print("\n❌ Gemini 연결 실패. 아래를 확인하세요:")
    print("   - API 키가 정확한지 (앞뒤 공백이 섞이지 않았는지)")
    print("   - 인터넷/방화벽 문제가 없는지")
    print("   - Vertex AI 모드라면 `gcloud auth application-default login` 을 했는지")
    return False


def step3_extract(client: GeminiClient) -> list:
    """3단계: 샘플 텍스트에서 혜택 추출"""
    print_header("3단계 | 샘플 페이지에서 혜택 추출")

    sample_path = PROJECT_ROOT / "data" / "samples" / "sample_page.txt"
    if not sample_path.exists():
        print(f"❌ 샘플 파일이 없습니다: {sample_path}")
        return []

    raw_text = sample_path.read_text(encoding="utf-8")
    print(f"  입력 텍스트: {len(raw_text)}자")
    print("  Gemini에게 분석을 요청하는 중... (10~20초 정도 걸립니다)")

    today = datetime.now(KST).strftime("%Y-%m-%d")
    extractions = client.extract_benefits(
        raw_text=raw_text,
        today=today,
        context_hint="원스토어 이벤트 목록 페이지입니다.",
    )

    if not extractions:
        print("\n⚠️ 추출된 혜택이 0건입니다.")
        print("   프롬프트가 너무 엄격하거나, 모델이 내용을 놓쳤을 수 있습니다.")
        return []

    print(f"\n✅ 혜택 {len(extractions)}건을 추출했습니다.\n")
    for i, item in enumerate(extractions, start=1):
        limit = f"최대 {item.max_benefit_krw:,}원" if item.max_benefit_krw else "한도 없음"
        min_spend = f"{item.min_spend_krw:,}원 이상" if item.min_spend_krw else "조건 없음"
        print(f"  [{i}] {item.item_or_event_name}")
        print(f"      혜택   : {item.benefit_value:g} {item.benefit_unit.value} ({limit})")
        print(f"      조건   : {min_spend}")
        print(f"      대상   : {item.target_platform.value} / {item.target_game}")
        print(f"      분류   : {item.category.value} / {item.benefit_type.value}")
        print(f"      기간   : {item.start_date} ~ {item.end_date}")
        print()

    # --- 검증 포인트 안내 ---
    print("  💡 확인 포인트:")
    print("     - '서버 점검 안내'와 '사전예약' 이 결과에 없어야 정상입니다.")
    print("       (혜택이 아닌 내용을 걸러내는지 보는 테스트입니다)")

    return extractions


def step4_finalize(extractions: list) -> None:
    """4단계: ID/해시를 붙여 BigQuery 저장 직전 형태 만들기"""
    print_header("4단계 | ID·해시 부여 및 최종 형태 확인")

    if not extractions:
        print("  추출된 항목이 없어 건너뜁니다.")
        return

    infos = [
        to_benefit_info(item, source_name="one_store", source_url="https://example.com/events")
        for item in extractions
    ]
    infos = deduplicate(infos)

    print(f"  최종 {len(infos)}건 (중복 제거 후)\n")
    for item in infos:
        print(f"  {item.benefit_id}  | hash={item.content_hash} | active={item.is_active}")

    # 첫 번째 항목의 전체 JSON을 보여줍니다.
    print("\n  --- 첫 번째 항목의 전체 데이터(JSON) ---")
    print(json.dumps(infos[0].to_bq_row(), ensure_ascii=False, indent=2))

    # 결과를 파일로도 남깁니다. jsonl 형식이라 나중에 비교하기 편합니다.
    out_dir = PROJECT_ROOT / "data" / "output"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "test_gemini_result.jsonl"

    with out_path.open("w", encoding="utf-8") as f:
        for item in infos:
            f.write(json.dumps(item.to_bq_row(), ensure_ascii=False) + "\n")

    print(f"\n✅ 결과를 파일로 저장했습니다: {out_path}")

    # --- 결정론적 ID 검증 ---
    # 같은 입력으로 ID를 다시 만들었을 때 똑같이 나오는지 확인합니다.
    # 이게 깨지면 매일 중복 데이터가 쌓이므로 아주 중요한 테스트입니다.
    from common.dedupe import make_benefit_id

    first = extractions[0]
    if make_benefit_id(first) == make_benefit_id(first):
        print("✅ ID 생성이 결정론적입니다. (같은 혜택 = 항상 같은 ID)")
    else:
        print("❌ ID 생성이 불안정합니다. dedupe.py 를 확인하세요.")


def main() -> int:
    """테스트 전체를 순서대로 실행합니다."""
    print("\n🚀 Gemini 공통 모듈 테스트를 시작합니다.")

    if not step1_check_settings():
        return 1

    try:
        client = GeminiClient()
    except Exception as e:
        print(f"\n❌ Gemini 클라이언트를 만들지 못했습니다: {e}")
        return 1

    if not step2_check_connection(client):
        return 1

    extractions = step3_extract(client)
    step4_finalize(extractions)

    print_header("테스트 완료")
    print("  다음 단계: python -m scripts.test_bigquery 로 BigQuery 연결을 확인하세요.")
    print()
    return 0


if __name__ == "__main__":
    # sys.exit(0) = 정상 종료, sys.exit(1) = 오류로 종료.
    # 나중에 자동화 도구가 성공/실패를 판단하는 데 쓰입니다.
    sys.exit(main())
