1. Git, Python, Node.js 를 로컬 컴퓨터에 인스탈
2. VS code 들어가기
3. ctr + ~ 를 통하여 terminal 실행
4. cd fe-app/ ← 을 통하여 fe-app에 들어간다
    - npm run dev ← 이것을 입력하면 링크를 주며 이를 통하여 fe-app에 들어갈수 있다
5.  ctr + ~ 로 새로운 터미널로 명령 실행이 가능하다.’
    - 가끔 깃허브에서 난리 날때면 git rm -r --cached node_modules 이것을 입력하여 캐시 삭제
    - npm install 이것으로 다른 브랜치 갔다가 올때 생기는 문제 해결
백엔드 구현 후 프런트엔드 구현
1. 우선 gcloud auth application-default login를 통하여 g-cloud 로그인을 해야만함
2. cd game-pay-api/ ← 이것을 입력하면 백엔드 파일 열기가능
3. .\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000 를 통하여 실행


++ 업데이트를 하였으니 
- cd fe-app
- npm install 이것을 우선적으로 하기

++ 3.12 다운로드
- # 1. 3.12 가상환경 생성 (이미 만들어져 있다면 바로 넘어갑니다)
py -3.12 -m venv venv

# 2. 가상환경 전용 파이썬으로 패키지 설치
.\venv\Scripts\python.exe -m pip install -r requirements.txt

# 3. 가상환경 전용 파이썬으로 백엔드 서버 실행
.\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
이것들을 입력 후 가상환경 생성