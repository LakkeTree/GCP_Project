FROM python:3.11-slim

# 1. 실시간 로그 출력(버퍼링 해제) 및 파이썬 모듈 경로 명시
ENV PYTHONUNBUFFERED=1
ENV PIP_ROOT_USER_ACTION=ignore
ENV PYTHONPATH=/app

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# 2. GCP Cloud Run 표준 JSON 배열 형태 실행 (포트 바인딩 및 프로세스 제어 최적화)
CMD ["sh", "-c", "exec gunicorn -w 2 -k uvicorn.workers.UvicornWorker --timeout 120 --bind 0.0.0.0:${PORT:-8080} main:app"]