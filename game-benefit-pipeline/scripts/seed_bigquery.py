# -*- coding: utf-8 -*-
"""
scripts/seed_bigquery.py
--------------------------------------------------------------------
직접 정리하신 benefit_info.jsonl / platform_connection.jsonl 을
BigQuery 에 처음 올리는(시드) 스크립트입니다.

[실행 방법]
    python -m scripts.seed_bigquery --dir /경로/uploads

    옵션:
      --dir       jsonl 파일이 있는 폴더 (기본값: data/seed)
      --benefit   혜택 파일 이름 (기본값: benefit_info.jsonl)
      --platform  호환성 파일 이름 (기본값: platform_connection.jsonl)
      --check-only  BigQuery 에 쓰지 않고 검증만 수행

[초보자 설명]
이 스크립트는 크롤러가 아닙니다. "이미 손으로 정리해 둔 데이터를
BigQuery 라는 창고에 처음 넣는" 이삿짐 트럭 역할입니다.

중요한 점: 시드 데이터의 benefit_id(BNF_0001 등)를 그대로 보존합니다.
크롤러가 만드는 ID(BNF_AUTO_...)와 접두어가 달라서 나중에 섞이지 않습니다.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

from common.bq_client import BigQueryClient
from common.config import PROJECT_ROOT, get_settings
from common.dedupe import make_content_hash
from common.logger import get_logger
from common.schema import BenefitInfo, PlatformConnection

log = get_logger("seed")


def print_header(title: str) -> None:
    print()
    print("=" * 70)
    print(f"  {title}")
    print("=" * 70)


def load_jsonl(path: Path) -> list[dict]:
    """jsonl 파일을 읽어 dict 목록으로 돌려줍니다."""
    rows: list[dict] = []
    with path.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                log.error("%s %d번째 줄을 읽지 못했습니다: %s", path.name, line_no, e)
    return rows


def validate_benefits(raw_rows: list[dict]) -> tuple[list[BenefitInfo], list[tuple]]:
    """
    혜택 데이터를 검증합니다.

    시드 데이터는 이미 benefit_id 가 있으므로 새로 만들지 않고 그대로 씁니다.
    다만 content_hash 는 없으므로 여기서 계산해 채웁니다.
    (이게 있어야 나중에 크롤러가 같은 혜택을 갱신할 때 변경 감지가 됩니다)
    """
    now_iso = datetime.now(timezone.utc).isoformat(timespec="seconds")
    valid: list[BenefitInfo] = []
    failed: list[tuple] = []

    for raw in raw_rows:
        try:
            item = BenefitInfo.model_validate(raw)

            # 시드 데이터에 없는 운영용 필드를 채웁니다.
            if not item.content_hash:
                item.content_hash = make_content_hash(item)
            if not item.crawled_at:
                item.crawled_at = now_iso
            item.updated_at = now_iso
            item.refresh_active_flag()

            valid.append(item)

        except ValidationError as e:
            err = e.errors()[0] if e.errors() else {}
            failed.append((
                raw.get("benefit_id", "?"),
                ".".join(str(x) for x in err.get("loc", [])),
                err.get("msg", "알 수 없음"),
            ))

    return valid, failed


def validate_platforms(raw_rows: list[dict]) -> tuple[list[PlatformConnection], list[tuple]]:
    """플랫폼 호환성 데이터를 검증합니다."""
    valid: list[PlatformConnection] = []
    failed: list[tuple] = []

    for raw in raw_rows:
        try:
            valid.append(PlatformConnection.model_validate(raw))
        except ValidationError as e:
            err = e.errors()[0] if e.errors() else {}
            failed.append((
                f"{raw.get('payment_method')}×{raw.get('platform')}",
                ".".join(str(x) for x in err.get("loc", [])),
                err.get("msg", "알 수 없음"),
            ))

    return valid, failed


def main() -> int:
    parser = argparse.ArgumentParser(description="시드 데이터를 BigQuery에 적재합니다.")
    parser.add_argument("--dir", default=str(PROJECT_ROOT / "data" / "seed"),
                        help="jsonl 파일이 있는 폴더")
    parser.add_argument("--benefit", default="benefit_info.jsonl", help="혜택 파일 이름")
    parser.add_argument("--platform", default="platform_connection.jsonl", help="호환성 파일 이름")
    parser.add_argument("--check-only", action="store_true",
                        help="BigQuery에 쓰지 않고 검증만 합니다")
    args = parser.parse_args()

    seed_dir = Path(args.dir)
    benefit_path = seed_dir / args.benefit
    platform_path = seed_dir / args.platform

    print("\n🚀 시드 데이터 적재를 시작합니다.")

    # ------------------------------------------------------------------
    print_header("1단계 | 파일 확인")
    print(f"  폴더: {seed_dir}")

    if not benefit_path.exists():
        print(f"❌ 혜택 파일이 없습니다: {benefit_path}")
        print("   --dir 옵션으로 파일이 있는 폴더를 지정하세요.")
        return 1

    benefit_raw = load_jsonl(benefit_path)
    print(f"  ✓ {benefit_path.name}: {len(benefit_raw)}건")

    platform_raw: list[dict] = []
    if platform_path.exists():
        platform_raw = load_jsonl(platform_path)
        print(f"  ✓ {platform_path.name}: {len(platform_raw)}건")
    else:
        print(f"  ⚠️ 호환성 파일이 없어 건너뜁니다: {platform_path.name}")

    # ------------------------------------------------------------------
    print_header("2단계 | 데이터 검증")

    benefits, b_failed = validate_benefits(benefit_raw)
    print(f"  혜택: {len(benefits)}/{len(benefit_raw)}건 통과")
    if b_failed:
        print(f"  ❌ 실패 {len(b_failed)}건 (아래 항목은 적재되지 않습니다):")
        for bid, loc, msg in b_failed[:15]:
            print(f"     - {bid} | 필드={loc} | {msg}")
        if len(b_failed) > 15:
            print(f"     ... 외 {len(b_failed) - 15}건")

    platforms, p_failed = validate_platforms(platform_raw)
    if platform_raw:
        print(f"  호환성: {len(platforms)}/{len(platform_raw)}건 통과")
        for pm, loc, msg in p_failed[:10]:
            print(f"     - {pm} | 필드={loc} | {msg}")

    if not benefits:
        print("\n❌ 적재할 유효한 데이터가 없습니다.")
        return 1

    # --- 간단한 데이터 요약 ---
    from collections import Counter

    print("\n  --- 적재될 데이터 요약 ---")
    print(f"  플랫폼별: " + ", ".join(
        f"{k}({v})" for k, v in
        Counter(b.target_platform.value for b in benefits).most_common()
    ))
    print(f"  중첩계층별: " + ", ".join(
        f"{k}({v})" for k, v in
        Counter(b.stacking_layer.value for b in benefits).most_common()
    ))
    active_count = sum(1 for b in benefits if b.is_active)
    print(f"  오늘 기준 유효: {active_count}건 / 종료됨: {len(benefits) - active_count}건")

    if args.check_only:
        print("\n✅ --check-only 모드이므로 여기서 종료합니다. (BigQuery에 쓰지 않음)")
        return 0

    # ------------------------------------------------------------------
    print_header("3단계 | BigQuery 준비")
    settings = get_settings()
    problems = settings.validate()
    if problems:
        print("❌ 설정 문제:")
        for p in problems:
            print(f"   - {p}")
        return 1

    print(f"  혜택 테이블   : {settings.bq_table_fqn}")
    print(f"  호환성 테이블 : {settings.bq_platform_table_fqn}")
    print(f"  리전          : {settings.bq_location}")
    print(f"  DRY_RUN       : {settings.dry_run}")

    try:
        bq = BigQueryClient()
        bq.setup()
        print("\n✅ 데이터셋·테이블 준비 완료")
    except Exception as e:
        print(f"\n❌ 실패: {e}")
        print("\n  자주 나오는 원인:")
        print("   - 인증 안 됨 → `gcloud auth application-default login` 실행")
        print("   - 권한 부족 → 계정에 'BigQuery 데이터 편집자' 역할 부여")
        print("   - 리전 불일치 → 기존 데이터셋의 리전과 BQ_LOCATION 이 같아야 함")
        return 1

    # ------------------------------------------------------------------
    print_header("4단계 | 적재")

    before = bq.count_rows() if not settings.dry_run else 0
    result = bq.upsert_benefits(benefits)
    after = bq.count_rows() if not settings.dry_run else 0

    print(f"\n  혜택: {result}")
    if not settings.dry_run:
        print(f"  행 수: {before} → {after}")

    if platforms:
        n = bq.replace_platform_connections(platforms)
        print(f"  호환성: {n}건 적재")

    # ------------------------------------------------------------------
    print_header("완료")
    if settings.dry_run:
        print("  DRY_RUN 모드였습니다. 실제로 넣으려면 .env 에서 DRY_RUN=false 로 바꾸세요.")
    else:
        print("  이제 BigQuery 콘솔에서 확인해 보세요:\n")
        print(f"    SELECT * FROM `{settings.bq_table_fqn}` LIMIT 20;")
        print("\n  다시 실행해도 중복이 생기지 않습니다(업서트 방식).")
    print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
