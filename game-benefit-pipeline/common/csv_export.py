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


def _extract_tier_marker(name: str) -> str:
    """
    이름에서 '1차', '2차'처럼 명시적인 차수 표시만 뽑아냅니다.
    이름 전체를 비교하지 않고 이 마커만 쓰는 이유는 아래 _dedup_key() 설명을
    참고하세요.
    """
    match = re.search(r"(\d+)\s*차", name or "")
    return match.group(1) if match else ""


def _dedup_key(row: dict) -> str:
    """
    '이 행이 저 행과 같은 혜택인가'를 판단하는 비교용 키를 만듭니다.

    [초보자 설명: 왜 이름을 거의 안 쓰는가 — v2로 바뀐 이유]
    처음엔 이름 앞 40자를 비교에 썼습니다. 그런데 실제로 겪어보니, Gemini는
    같은 혜택을 매번 완전히 다른 단어로 재작성하는 경우가 많았습니다.
    예) '원스토어 게임/앱 카테고리 할인', '원스토어 앱 인앱 할인',
        '원스토어 T 멤버십 게임/앱 할인' —전부 SKT의 같은 혜택 하나인데
        이름이 매번 딴판이라 40자 비교로는 절대 못 잡았습니다.

    그래서 이름은 '1차/2차' 같은 명시적 차수 표시만 뽑아 쓰고, 나머지는
    제공처·플랫폼·게임·혜택종류·수치·종료일·결제수단제한·권종처럼
    Gemini가 비교적 안정적으로 뽑아내는 '구조화된 필드'로만 판단합니다.

    ⚠️ 트레이드오프: 아주 드물게, 이름은 다른데 차수 표시도 없고 다른
    구조화 필드까지 우연히 전부 같은 서로 다른 혜택(예: 조건이 글로만
    설명되고 수치화된 필드에 안 잡히는 경우)이 있으면 잘못 합쳐질 수
    있습니다. 이런 경우가 생기면 알려주세요 — 그 케이스를 구분할 수 있는
    필드를 추가로 찾아서 반영하겠습니다.
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
        # 결제수단 제한·권종처럼, 이름과 무관하게 진짜 조건 차이를 담는
        # 구조화된 필드도 같이 봅니다. (예: 페이코의 VISA 컨택리스 vs
        # 실물카드처럼 할인율은 같아도 조건이 다른 경우를 구분하기 위함)
        (row.get("payment_method_restriction") or "").strip().upper(),
        (row.get("denomination_list") or "").strip(),
        (row.get("max_benefit_krw") or "").strip(),
        # 이름 전체 대신, 명시적 차수 표시만 뽑아서 씁니다.
        _extract_tier_marker(row.get("item_or_event_name", "")),
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


# 이번 실행(run_all 한 번) 안에서 이미 경고한 그룹은 다시 경고하지 않기 위한 캐시입니다.
# ⚠️ 크롤러 17개가 전부 같은 파일을 여러 번 병합하면서 매번 파일 전체를 다시
# 훑기 때문에, 이게 없으면 같은 문제 하나가 크롤러 수만큼(예: 17번) 반복
# 경고됩니다. 실제로 63건이던 게 550번 찍혔던 게 바로 이 문제였습니다.
_already_warned_keys: set[str] = set()


def _warn_near_duplicates(rows: list[dict]) -> None:
    """병합 후에도 '이름만 다르고 사실상 같아 보이는' 행이 남아있으면 경고 로그를 남깁니다."""
    groups: dict[str, list[dict]] = {}
    for row in rows:
        groups.setdefault(_loose_key(row), []).append(row)

    new_warnings = 0
    for key, group in groups.items():
        if len(group) > 1 and key not in _already_warned_keys:
            _already_warned_keys.add(key)
            new_warnings += 1
            names = [r.get("item_or_event_name", "") for r in group]
            log.warning(
                "⚠️ 이름만 다르고 나머지 조건(제공처/플랫폼/게임/할인율/종료일)이 "
                "전부 같은 행이 %d개 있습니다 — 실제로는 같은 혜택인데 Gemini가 "
                "이름을 다르게 표현해서 안 합쳐졌을 수 있습니다. 직접 확인해 "
                "주세요: %s",
                len(group), names,
            )

    if new_warnings == 0 and any(len(g) > 1 for g in groups.values()):
        log.debug("근접 중복 그룹이 있지만 이번 실행에서 이미 전부 경고했습니다(반복 생략).")


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