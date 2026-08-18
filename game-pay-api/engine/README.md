# engine

계산 엔진(팀원2 담당) 모듈입니다.

## 파일 구성

| 파일 | 역할 |
|---|---|
| `calculator.py` | 순수 계산 로직. 딕셔너리 리스트를 입력받아 계산만 한다. 데이터가 BigQuery에서 왔는지, 테스트용 하드코딩인지 전혀 모른다. |
| `loader.py` | BigQuery에서 데이터를 가져와 `calculator.py`가 원하는 형태로 변환해주는 역할만 한다. |
| `requirements.txt` | 이 모듈을 실행하는 데 필요한 파이썬 패키지 목록 |

## 설치

```bash
cd engine
pip install -r requirements.txt --break-system-packages
```

## 사용법 (팀원3 API 서버에서)

```python
from engine.loader import recommend_best_routes

result = recommend_best_routes(
    platform="GOOGLE_PLAY",
    amount=149000,
    held_methods=["ZEROPIN", "GMARKET", "KAKAO_PAY", "SAMSUNG_CARD"],
)
# result["routes"]   -> 추천 경로 리스트
# result["warnings"] -> 유저가 직접 확인해야 하는 조건(전월실적 등)
```

## 실행 전 준비

1. BigQuery 인증: `gcloud auth application-default login`
2. (선택) 다른 프로젝트/데이터셋을 쓰려면 환경변수로 덮어쓰기 가능:
   ```bash
   export BQ_PROJECT_ID="다른-프로젝트-id"
   export BQ_DATASET_ID="다른-데이터셋"
   ```

## 왜 이렇게 나눴나

`calculator.py`는 계산 로직에만 집중하고, `loader.py`는 데이터를 가져오는 일에만 집중합니다. 나중에 데이터 소스가 BigQuery에서 다른 걸로 바뀌어도 `calculator.py`는 안 건드리고 `loader.py`만 새로 짜면 됩니다. 반대로 계산 로직에 버그가 있으면 `loader.py`와 무관하게 `calculator.py`만 고치면 됩니다.
