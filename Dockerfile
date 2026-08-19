# 결제혜택 크롤러(card_data/epay_data/store_data/voucher_data/telecom_data) 공용 이미지.
# 도메인마다 card_data.common(normalize/crawl_log/gcs_upload)을 공유해서 쓰기 때문에
# 레포 전체를 담는다. Cloud Run Job마다 command/args만 다르게 오버라이드해서
# "xvfb-run -a python -m <domain>.run_all" 형태로 실행한다.
#
# SCRAPER_HEADLESS는 일부러 안 세팅한다(base.py 기본값 false=headed 그대로 사용).
# 로컬에서 headless=True로 돌려보니 일부 사이트(SPA 렌더링 타이밍에 민감한
# zeropin/gmarket/naver_brandstore/galaxy_store/lgu_event_board)가 크래시 없이
# 조용히 0건을 반환하는 회귀가 확인됨 — Xvfb 가상 디스플레이 위에서 진짜 headed
# 브라우저를 그대로 띄워서 로컬 검증된 렌더링/타이밍을 재현하는 쪽으로 우회한다.
FROM python:3.11-slim

ENV PIP_ROOT_USER_ACTION=ignore \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends xvfb xauth x11-utils \
    && rm -rf /var/lib/apt/lists/*

COPY card_data/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && playwright install --with-deps chromium

COPY . .
