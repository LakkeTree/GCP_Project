# -*- coding: utf-8 -*-
"""
common/logger.py
--------------------------------------------------------------------
프로젝트 전체가 똑같은 형식으로 로그를 찍게 해 주는 모듈입니다.

[초보자 설명]
print() 로 찍어도 되지만, 로그는 print보다 좋습니다.
 - 시간, 어느 파일에서 났는지가 자동으로 붙습니다.
 - "지금은 자잘한 메시지는 숨겨" 처럼 수준을 조절할 수 있습니다.
 - 나중에 Cloud Run에 올리면 GCP 로그 뷰어에서 그대로 검색됩니다.

[사용법]
    from common.logger import get_logger
    log = get_logger(__name__)
    log.info("크롤링 시작")
    log.error("실패했습니다")
"""

import logging
import sys

from common.config import get_settings

# 로그 설정을 딱 한 번만 하기 위한 표시등
_CONFIGURED = False


def _configure_root_logger() -> None:
    """맨 처음 한 번만 전체 로그 형식을 정합니다."""
    global _CONFIGURED
    if _CONFIGURED:
        return

    settings = get_settings()

    # 출력 형식 예시:
    # 2026-08-10 15:04:11 | INFO     | common.ai_client | 혜택 3건 추출 완료
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)-8s | %(name)-22s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()          # 중복 출력 방지: 기존 핸들러를 비웁니다.
    root.addHandler(handler)
    root.setLevel(getattr(logging, settings.log_level, logging.INFO))

    # 외부 라이브러리들이 너무 시끄럽게 로그를 찍는 걸 막습니다.
    for noisy in ("urllib3", "google", "google.auth", "httpx", "google_genai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    """
    로거를 하나 만들어 돌려줍니다.
    name 에는 보통 __name__ (현재 파일 이름)을 넣습니다.
    """
    _configure_root_logger()
    return logging.getLogger(name)
