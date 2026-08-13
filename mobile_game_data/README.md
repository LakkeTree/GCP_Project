# Mobile Game Data Collector

모바일 게임 스토어/시장 데이터 수집 프로젝트입니다.

## 현재 구현 범위
- Google Play: Playwright 기반 수집기 골격
- App Store: 수집기 골격
- Galaxy Store: 수집기 골격
- ONE Store: 수집기 골격
- 게임명 정규화 및 플랫폼 True/False 통합
- raw CSV와 최종 games.csv 분리
- 모바일인덱스: 자동 크롤링하지 않음
- Sensor Tower / data.ai: 향후 보조 데이터 소스로 연결

## 설치

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m playwright install chromium
```

## 실행

```powershell
python main.py
```

처음에는 Google Play 수집기만 실행하도록 설정되어 있습니다.
다른 스토어는 각 scraper 파일의 구현을 완료한 뒤 `config.py`에서 활성화하세요.

## 출력
- `data/raw/*.csv`: 소스별 원본 수집 데이터
- `data/final/games.csv`: 중복 게임을 통합한 Master DB
