"""
stacking_layer 라벨 오류 일괄 수정 스크립트
============================================

[문제]
category == "GIFT_CARD" 인 9건(BNF_0027~0035)의 stacking_layer가
"GIFT_CARD"여야 하는데 "CARD_ISSUER"로 잘못 표기되어 있다.

[영향]
계산 엔진이 stacking_layer 기준으로 혜택을 분류하면, 상품권이 카드사 계층에
들어가버려 "상품권 + 카드 동시 적용" 조합이 아예 생성되지 않는다.
(서비스 핵심 가치인 중복 할인 경로가 통째로 누락됨)

[수정 대상 파일 3개]
  1. gift_card_benefits.csv      - 원본 소스 CSV (여기를 안 고치면 재생성 시 오류 부활)
  2. Total_Benefit_Info_DB.csv   - 통합 CSV
  3. benefit_info.jsonl          - BigQuery 적재용 정제 파일

셋 다 고쳐야 하는 이유: 데이터 파이프라인이
  개별 CSV -> 통합 CSV -> clean_csv_for_bq.py -> JSONL
순서로 흐르므로, 상류(원본 CSV)를 안 고치면 다음 번 파이프라인 실행 때
같은 오류가 다시 하류로 전파된다.

사용법:
  python fix_stacking_layer.py
"""

import csv
import json
import shutil
from pathlib import Path

SRC_DIR = Path("/mnt/user-data/uploads")
OUT_DIR = Path("/mnt/user-data/outputs/fixed_data")

# 수정 규칙: category가 이 값이면 stacking_layer도 이 값이어야 한다
CATEGORY_TO_LAYER = {"GIFT_CARD": "GIFT_CARD"}


def fix_csv(filename):
    """CSV 파일에서 category=GIFT_CARD인 행의 stacking_layer를 교정한다."""
    src = SRC_DIR / filename
    dst = OUT_DIR / filename

    with src.open(encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    fixed_ids = []
    for row in rows:
        category = row.get("category", "").strip()
        expected_layer = CATEGORY_TO_LAYER.get(category)
        if expected_layer and row.get("stacking_layer", "").strip() != expected_layer:
            before = row["stacking_layer"]
            row["stacking_layer"] = expected_layer
            fixed_ids.append((row["benefit_id"], before, expected_layer))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"[{filename}] 총 {len(rows)}행 중 {len(fixed_ids)}건 수정")
    for bid, before, after in fixed_ids:
        print(f"    {bid}: {before} -> {after}")
    return len(fixed_ids)


def fix_jsonl(filename):
    """JSONL 파일에서 category=GIFT_CARD인 행의 stacking_layer를 교정한다."""
    src = SRC_DIR / filename
    dst = OUT_DIR / filename

    with src.open(encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]

    fixed_ids = []
    for row in rows:
        expected_layer = CATEGORY_TO_LAYER.get(row.get("category"))
        if expected_layer and row.get("stacking_layer") != expected_layer:
            before = row["stacking_layer"]
            row["stacking_layer"] = expected_layer
            fixed_ids.append((row["benefit_id"], before, expected_layer))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    with dst.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"[{filename}] 총 {len(rows)}행 중 {len(fixed_ids)}건 수정")
    for bid, before, after in fixed_ids:
        print(f"    {bid}: {before} -> {after}")
    return len(fixed_ids)


def verify():
    """수정 결과를 재검증한다. category와 stacking_layer 불일치가 0건이어야 정상."""
    print("\n" + "=" * 60)
    print("검증: 수정 후 category-stacking_layer 정합성")
    print("=" * 60)

    ok = True

    for filename in ["gift_card_benefits.csv", "Total_Benefit_Info_DB.csv"]:
        with (OUT_DIR / filename).open(encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        bad = [r for r in rows
               if r["category"] == "GIFT_CARD" and r["stacking_layer"] != "GIFT_CARD"]
        print(f"  {filename}: 불일치 {len(bad)}건")
        if bad:
            ok = False

    with (OUT_DIR / "benefit_info.jsonl").open(encoding="utf-8") as f:
        rows = [json.loads(l) for l in f if l.strip()]
    bad = [r for r in rows
           if r["category"] == "GIFT_CARD" and r["stacking_layer"] != "GIFT_CARD"]
    print(f"  benefit_info.jsonl: 불일치 {len(bad)}건")
    if bad:
        ok = False

    # 다른 category는 건드리지 않았는지 확인 (의도치 않은 변경 방지)
    from collections import Counter
    print("\n  수정 후 stacking_layer 분포:")
    for layer, count in sorted(Counter(r["stacking_layer"] for r in rows).items()):
        print(f"    {layer}: {count}건")

    print("\n결과:", "정상 (모든 불일치 해소)" if ok else "오류 남아있음")
    return ok


def main():
    print("=" * 60)
    print("stacking_layer 라벨 오류 수정")
    print("=" * 60)
    total = 0
    total += fix_csv("gift_card_benefits.csv")
    total += fix_csv("Total_Benefit_Info_DB.csv")
    total += fix_jsonl("benefit_info.jsonl")
    print(f"\n총 {total}건 수정 완료")

    # 호환성 DB는 수정 대상이 아니지만, 함께 배포되어야 하므로 그대로 복사
    shutil.copy(SRC_DIR / "platform_connection.jsonl", OUT_DIR / "platform_connection.jsonl")
    print("platform_connection.jsonl: 수정 불필요, 그대로 복사")

    verify()


if __name__ == "__main__":
    main()
