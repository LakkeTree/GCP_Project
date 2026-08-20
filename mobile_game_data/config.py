from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

DATA_DIR = BASE_DIR / "data"
RAW_DIR = DATA_DIR / "raw"
FINAL_DIR = DATA_DIR / "final"
LOG_DIR = BASE_DIR / "logs"

for directory in (RAW_DIR, FINAL_DIR, LOG_DIR):
    directory.mkdir(parents=True, exist_ok=True)

# 수집기 활성화 여부
ENABLE_GOOGLE_PLAY = True
ENABLE_APP_STORE = True
ENABLE_GALAXY_STORE = False
ENABLE_ONE_STORE = False

# 국가
COUNTRY = "KR"

# Playwright
HEADLESS = False
SCROLL_LIMIT = 30
SCROLL_WAIT_MS = 1200
NO_CHANGE_LIMIT = 5
