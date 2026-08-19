# -*- coding: utf-8 -*-
"""
catalog/normalize.py
--------------------------------------------------------------------
스토어마다 같은 게임을 조금씩 다르게 표기하는 문제를 다루는 모듈입니다.
(예: "쿠키런: 킹덤" vs "쿠키런 킹덤" vs "COOKIERUN: Kingdom")

[초보자 설명: 왜 필요한가?]
구글플레이 순위에서 "쿠키런: 킹덤"으로, 앱스토어 순위에서 "쿠키런 킹덤"으로
나오면, 이걸 그대로 두면 최종 CSV에 같은 게임이 두 줄로 따로 나옵니다.
요청하신 대로 "겹치는 게임은 한 줄만" 만들려면 비교용 '정규화된 이름'이
필요합니다.

⚠️ 이건 완벽한 매칭이 아닙니다. 특수문자·공백·대소문자만 정리하는
수준이라, 표기가 크게 다른 경우(예: "브롤스타즈" vs "Brawl Stars")는
같은 게임인데도 다르게 인식될 수 있습니다. 정확도를 더 높이려면 나중에
게임 배급사 정보나 유사도 매칭(fuzzy matching) 라이브러리를 추가로
쓰는 걸 고려해 보세요.
"""

from __future__ import annotations

import re


def normalize_for_comparison(name: str) -> str:
    """
    비교용 키를 만듭니다. 화면에 보여줄 이름이 아니라, "같은 게임인지
    판별하기 위한" 내부용 문자열입니다.

    처리 순서: 소문자화 → 공백/특수문자 제거 → 앞뒤 공백 정리
    """
    if not name:
        return ""
    text = name.lower()
    # 한글, 영문, 숫자만 남기고 나머지(공백, 콜론, 하이픈, 이모지 등)는 제거합니다.
    text = re.sub(r"[^a-z0-9가-힣]", "", text)
    return text


def dedupe_game_names(names: list[str]) -> list[str]:
    """
    여러 스토어에서 모은 게임명 목록에서 중복을 제거합니다.
    같은 정규화 키를 가진 것들 중 '가장 먼저 나온 원래 표기'를 대표로 남깁니다.
    """
    seen_keys: set[str] = set()
    unique: list[str] = []

    for name in names:
        key = normalize_for_comparison(name)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        unique.append(name)

    return unique
