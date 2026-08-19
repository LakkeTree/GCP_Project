# 1. 백엔드 디렉토리 이동
cd game-pay-api

# 2. Python 3.12 기준 가상환경(venv) 생성 (없는 경우)
py -3.12 -m venv venv

# 3. 윈도우 한글 환경 UTF-8 인코딩 설정 (cp949 인코딩 에러 방지)
$env:PYTHONUTF8=1

# 4. 가상환경 전용 파이썬으로 필수 패키지 일괄 설치
.\venv\Scripts\python.exe -m pip install -r requirements.txt

# 5. 구글 인증 및 캐시 관련 추가 패키지 설치
.\venv\Scripts\python.exe -m pip install cachecontrol google-auth requests

# 6. 백엔드 서버 구동
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# 1. 새 터미널을 열고 프론트엔드 디렉토리 이동
cd fe-app

# 2. 의존성 패키지 설치
npm install

# 3. 프론트엔드 개발 서버 실행
npm run dev

# 위에것들을 했을경우
cd game-pay-api
gcloud auth application-default login 
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000

# 새창에서
cd fe-app
npm run dev