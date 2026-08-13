import re
import unicodedata


def normalize_game_name(name: str) -> str:
    """게임명 비교를 위한 최소한의 정규화."""
    if not name:
        return ""

    name = unicodedata.normalize("NFKC", str(name))
    name = re.sub(r"\s+", " ", name).strip()
    name = name.strip(" -–—|")

    return name


def normalize_key(name: str) -> str:
    """
    중복 비교용 key.
    한글/영문/숫자 이외의 문자를 제거하고 소문자로 변환한다.
    """
    name = normalize_game_name(name)
    name = name.lower()
    name = re.sub(r"[^0-9a-z가-힣]+", "", name)

    return name
