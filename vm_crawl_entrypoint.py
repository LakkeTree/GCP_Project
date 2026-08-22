"""헤드리스/클라우드 IP 차단 때문에 Cloud Run Job이 아니라 이 GCE VM
(Xvfb+headed)에서 돌아야 하는 6개 스크래퍼용 엔트리포인트.

대상: store_data.galaxy_store, voucher_data.zeropin/gmarket/naver_brandstore,
telecom_data.lgu_event_board (2026-08-19 진단: 이 5개는 headless Chromium을
구체적으로 탐지해서 차단 페이지를 반환함 — 렌더링 타이밍 문제가 아니라 봇 차단).

voucher_data.cultureland_cash_conversion (2026-08-22 진단: 차단 페이지가 아니라
TimeoutError로 실패 — Cloud Run Job의 Google 호스팅 IP를 대상 사이트가 감지해
응답 자체를 안 주는 것으로 추정. GCE VM에서는 실제로 해결됨, 아마 Cloud Run의
공유 IP 풀만 걸러내는 차단이었던 것으로 보임).

epay_data.samsung_pay는 여기서 시도했었으나(2026-08-22) VM에서도 동일하게
TimeoutError 재현되어 제외함 — www.samsung.com은 IP가 Cloud Run이든 GCE VM이든
Google 호스팅 ASN 자체를 카테고리째로 차단하는 것으로 추정(store_data의
galaxy_store_tier도 같은 도메인, 같은 증상). 기존 수집분 4건은 benefit_info에
source_file='legacy_manual_db'로 재태깅해 수동 관리 데이터로 남겨뒀다.

Cloud Run Job의 5개 domain run_all.py와 같은 GCS 목적지 파일명을 그대로 쓰면
동시 업로드 시 서로 덮어쓸 위험이 있어, DEST_FILENAME_OVERRIDE로 "_vm" 접미사
파일명을 쓴다(bigquery/main.py의 TARGETS에 등록되어 있어야 함).

GEMINI_API_KEY는 Cloud Run처럼 --set-secrets로 주입할 방법이 GCE 컨테이너에는
없어서, 이 스크립트가 시작 시 Secret Manager에서 직접 읽어와 환경변수로 세팅한다
(VM의 서비스 계정에 secretmanager.secretAccessor 권한이 이미 있음).

xvfb-run으로 감싸서 실행해야 한다:
  xvfb-run -a python vm_crawl_entrypoint.py
"""

import os
import subprocess
import sys

from google.cloud import secretmanager

PROJECT_ID = "positive-tuner-504502-m5"

RUNS = [
    ("store_data.run_all", ["galaxy_store"], "Store_Benefit_Info_DB_vm.csv"),
    (
        "voucher_data.run_all",
        ["zeropin", "gmarket", "naver_brandstore", "cultureland_cash_conversion"],
        "Voucher_Benefit_Info_DB_vm.csv",
    ),
    ("telecom_data.run_all", ["lgu_event_board"], "Telecom_Benefit_Info_DB_vm.csv"),
]


def _fetch_gemini_api_key() -> str:
    client = secretmanager.SecretManagerServiceClient()
    name = f"projects/{PROJECT_ID}/secrets/gemini-api-key/versions/latest"
    return client.access_secret_version(name=name).payload.data.decode("utf-8")


def main() -> None:
    os.environ["GEMINI_API_KEY"] = _fetch_gemini_api_key()
    os.environ.setdefault("CRAWL_TRIGGER_SOURCE", "SCHEDULED")

    exit_code = 0
    for module, targets, dest_filename in RUNS:
        print(f"\n=========== {module} {targets} -> {dest_filename} ===========")
        env = os.environ.copy()
        env["DEST_FILENAME_OVERRIDE"] = dest_filename
        result = subprocess.run([sys.executable, "-m", module, *targets], env=env)
        if result.returncode != 0:
            print(f"[{module}] 실패 (exit={result.returncode})")
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
