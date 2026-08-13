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


import re


def _dedup_key(row: dict) -> str:
    """
    '이 행이 저 행과 같은 혜택인가'를 판단하는 비교용 키를 만듭니다.

    [초보자 설명: benefit_id 대신 이걸 쓰는 이유]
    benefit_id는 Gemini가 만든 item_or_event_name 텍스트로 해시를 만듭니다.
    그런데 Gemini는 temperature=0으로 설정해도 완벽하게 똑같은 문장을 매번
    만들지는 않습니다 — "위클리 출석체크 5%"와 "위클리출석체크 5%"처럼
    공백·문장부호가 살짝 다르면 benefit_id도 매번 달라져서, 같은 혜택인데도
    "새 혜택"으로 착각해 계속 쌓이는 문제가 생깁니다.

    이 함수는 공백·문장부호를 전부 지우고 핵심 필드만 비교해서, 표현이
    조금 달라도 "같은 혜택"으로 정확히 인식하게 만듭니다.
    """
    def strip_symbols(s: str) -> str:
        s = (s or "").lower()
        return re.sub(r"[^a-z0-9가-힣]", "", s)

    return "|".join([
        (row.get("source_file") or "").strip().lower(),
        strip_symbols(row.get("provider_or_retailer", "")),
        (row.get("target_platform") or "").strip().upper(),
        strip_symbols(row.get("target_game", "")),
        (row.get("benefit_type") or "").strip().upper(),
        (row.get("benefit_unit") or "").strip().upper(),
        (row.get("benefit_value") or "").strip(),
        (row.get("end_date") or "").strip(),
        # 이름은 앞 40자만 비교합니다. 전체를 다 비교하면 사소한 차이에도
        # 여전히 민감해지고, 아예 안 쓰면 서로 다른 혜택(예: 1차/2차 쿠폰,
        # 출석 일수별 다른 보상)까지 하나로 뭉개질 위험이 있어 절충했습니다.
        strip_symbols(row.get("item_or_event_name", ""))[:40],
    ])


def _loose_key(row: dict) -> str:
    """
    _dedup_key()보다 한 단계 더 느슨한 키입니다. item_or_event_name을 아예
    빼고, provider+platform+게임+할인율+종료일만 봅니다. 이 키가 같은데
    _dedup_key()는 다른 행이 있으면 "진짜 중복인데 이름 차이 때문에 못
    합쳐진 것"일 가능성이 있어 경고만 남깁니다(자동으로 합치지는 않습니다 —
    '돌격 기사단' 1차/2차처럼 할인율까지 같은 진짜 별개 혜택을 잘못 합칠
    위험이 있기 때문입니다).
    """
    def strip_symbols(s: str) -> str:
        s = (s or "").lower()
        return re.sub(r"[^a-z0-9가-힣]", "", s)

    return "|".join([
        (row.get("source_file") or "").strip().lower(),
        strip_symbols(row.get("provider_or_retailer", "")),
        (row.get("target_platform") or "").strip().upper(),
        strip_symbols(row.get("target_game", "")),
        (row.get("benefit_value") or "").strip(),
        (row.get("end_date") or "").strip(),
    ])


def _warn_near_duplicates(rows: list[dict]) -> None:
    """병합 후에도 '이름만 다르고 사실상 같아 보이는' 행이 남아있으면 경고 로그를 남깁니다."""
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(_loose_key(row), []).append(row)

    for key, group in groups.items():
        if len(group) > 1:
            names = [r.get("item_or_event_name", "") for r in group]
            log.warning(
                "⚠️ 이름만 다르고 나머지 조건(제공처/플랫폼/게임/할인율/종료일)이 "
                "전부 같은 행이 %d개 있습니다 — 실제로는 같은 혜택인데 Gemini가 "
                "이름을 다르게 표현해서 안 합쳐졌을 수 있습니다. 직접 확인해 "
                "주세요: %s",
                len(group), names,
            )


def merge_csv_strings(existing_csv: str, new_csv: str) -> str:
    """
    기존 CSV 내용과 새로 만든 CSV 내용을 합쳐서 하나의 CSV 문자열로 돌려줍니다.

    [초보자 설명: 병합 규칙]
    benefit_id가 아니라 _dedup_key()로 계산한 '느슨한 동일성 키'가 같으면
    같은 혜택으로 보고, '새 것'(new_csv)의 값으로 덮어씁니다. Gemini가
    실행마다 이름을 살짝 다르게 표현해도 이 키는 안정적으로 같게 나오므로,
    같은 페이지를 여러 번 크롤링해도 행이 계속 늘어나지 않습니다.

    이름 차이가 너무 커서 _dedup_key()로도 못 잡아내는 경우에 대비해,
    병합이 끝난 뒤 _warn_near_duplicates()로 "혹시 놓친 중복이 있는지"
    경고 로그를 남깁니다(자동으로 지우지는 않습니다 — 잘못 지우면 진짜
    다른 혜택을 잃을 위험이 있어서, 사람이 확인하도록 알림만 줍니다).

    Args:
        existing_csv: 버킷에 이미 있던 CSV 내용 (download_text() 결과)
        new_csv: 이번에 새로 만든 CSV 내용 (build_csv_string() 결과)

    Returns:
        합쳐진 CSV 문자열. 컬럼 순서는 새 CSV(new_csv) 기준을 따릅니다.
    """
    import io

    new_reader = list(csv.DictReader(io.StringIO(new_csv)))
    if not existing_csv or not existing_csv.strip():
        return new_csv  # 기존 파일이 없거나 비어 있으면 새 내용 그대로 씁니다.

    existing_reader = list(csv.DictReader(io.StringIO(existing_csv)))

    # _dedup_key()가 같으면 같은 혜택으로 보고, 나중에 들어온(new_csv) 쪽이 이깁니다.
    merged: dict[str, dict] = {}
    for row in existing_reader:
        merged[_dedup_key(row)] = row
    for row in new_reader:
        merged[_dedup_key(row)] = row

    fieldnames = list(new_reader[0].keys()) if new_reader else list(existing_reader[0].keys())

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames)
    writer.writeheader()
    for row in merged.values():
        # 기존 CSV에 새 컬럼이 없을 수 있으니(스키마가 나중에 늘어난 경우 등),
        # 빠진 값은 빈 칸으로 채워서 열 개수를 맞춥니다.
        writer.writerow({k: row.get(k, "") for k in fieldnames})

    log.info("CSV 병합: 기존 %d건 + 신규 %d건 -> 합계 %d건",
              len(existing_reader), len(new_reader), len(merged))

    _warn_near_duplicates(list(merged.values()))

    return buffer.getvalue()


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