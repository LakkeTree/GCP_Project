# -*- coding: utf-8 -*-
"""
common/csv_export.py
--------------------------------------------------------------------
크롤러가 뽑아낸 혜택 데이터를 CSV 파일로 저장하는 모듈입니다.

[초보자 설명: 왜 필요한가?]
지금까지는 크롤러 결과가 BigQuery로 바로 들어갔습니다. 그런데 상황에 따라
"일단 파일로 받아서 엑셀로 눈으로 확인하고 싶다", "BigQuery 권한이 없는
사람에게 결과를 공유하고 싶다" 같은 경우가 있을 수 있습니다. 이 모듈은
BigQuery 대신(또는 그 전 단계로) CSV 파일을 만들어 줍니다.

[주의할 점: denomination_list 같은 배열 컬럼]
CSV는 엑셀 표처럼 "칸 하나에 값 하나"만 담을 수 있어서, [5000, 10000]처럼
여러 값이 든 배열은 그대로 못 넣습니다. 그래서 "5000;10000"처럼 세미콜론으로
이어붙인 문자열로 바꿔서 저장합니다. (참고: common/schema.py의
_parse_denominations()가 이미 세미콜론/쉼표로 구분된 문자열을 다시 배열로
읽어들이는 기능을 갖고 있어서, 나중에 이 CSV를 다시 시스템에 넣어야 할 일이
생겨도 호환됩니다)

[주의할 점: 엑셀에서 한글이 깨지는 문제]
일반적인 UTF-8로 저장하면 Windows 엑셀에서 한글이 깨져 보이는 경우가 흔합니다.
그래서 "utf-8-sig"(BOM 포함 UTF-8)로 저장합니다 — 이러면 엑셀에서 바로 열어도
한글이 정상적으로 보입니다.
"""

from __future__ import annotations

import csv
from pathlib import Path
from typing import Iterable

from common.logger import get_logger
from common.schema import BenefitInfo

log = get_logger(__name__)


def _build_csv_rows(items: list[BenefitInfo]) -> tuple[list[str], list[dict]]:
    """
    BenefitInfo 목록을 CSV용 (컬럼 순서, 행 목록)으로 변환하는 내부 헬퍼입니다.
    파일로 저장하든(export_benefits_csv), 문자열로만 만들든(build_csv_string)
    똑같은 변환 로직을 쓰기 위해 분리해 뒀습니다.
    """
    rows = []
    for item in items:
        row = item.to_bq_row()
        row["denomination_list"] = ";".join(str(d) for d in row["denomination_list"])
        for key, value in row.items():
            if value is None:
                row[key] = ""
        rows.append(row)

    fieldnames = list(rows[0].keys()) if rows else []
    return fieldnames, rows


def build_csv_string(items: Iterable[BenefitInfo]) -> str:
    """
    혜택 목록을 CSV '내용'(문자열)으로 만듭니다. 파일로 저장하지 않고
    바로 GCS에 업로드하고 싶을 때 씁니다 (common/gcs_client.py에서 사용).

    Returns:
        CSV 파일 내용 전체를 담은 문자열. 항목이 없으면 빈 문자열.
    """
    items = list(items)
    if not items:
        return ""

    fieldnames, rows = _build_csv_rows(items)

    # StringIO: 메모리 안에서 파일처럼 동작하는 객체. 디스크에 안 써도 됩니다.
    import io
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def export_benefits_csv(items: Iterable[BenefitInfo], path: str | Path) -> int:
    """
    혜택 목록을 CSV 파일로 저장합니다.

    Args:
        items: 저장할 BenefitInfo 목록 (크롤러 run()의 반환값을 그대로 넣으면 됩니다)
        path: 저장할 파일 경로. 예) "data/output/one_store.csv"
              폴더가 없으면 자동으로 만듭니다.

    Returns:
        저장된 행 수. 0이면 저장할 내용이 없었다는 뜻입니다.
    """
    items = list(items)
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if not items:
        log.warning("내보낼 혜택이 없어 CSV를 만들지 않습니다: %s", path)
        return 0

    fieldnames, rows = _build_csv_rows(items)

    # utf-8-sig: 윈도우 엑셀에서 한글이 안 깨지도록 BOM을 포함합니다.
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    log.info("CSV로 저장했습니다: %s (%d건)", path, len(rows))
    return len(rows)
