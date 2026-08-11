# -*- coding: utf-8 -*-
"""
scripts/run_all.py
--------------------------------------------------------------------
crawlers/ 폴더 안의 모든 크롤러를 자동으로 찾아서 순서대로 실행합니다.

[초보자 설명: "자동으로 찾는다"는 게 무슨 뜻인가?]
crawlers/one_store.py, crawlers/google_play.py 처럼 파일이 늘어날 때마다
이 스크립트에 "OneStoreCrawler도 돌려라, GooglePlayCrawler도 돌려라"라고
하나하나 코드를 추가해야 한다면 번거롭고 빠뜨리기도 쉽습니다.

그래서 이 스크립트는 crawlers/ 폴더 안의 .py 파일을 전부 열어보고,
그 안에 BaseCrawler를 상속한 클래스가 있으면 자동으로 목록에 추가합니다.
새 크롤러 파일을 crawlers/ 안에 추가하기만 하면, 이 스크립트를 고칠 필요 없이
다음 실행부터 자동으로 같이 돌아갑니다.

[사용법]
    # 전체 크롤러를 BigQuery에 실제로 저장하며 실행
    python -m scripts.run_all

    # BigQuery에 저장하지 않고 결과만 확인 (안전하게 미리 점검할 때)
    python -m scripts.run_all --dry-run

    # 특정 크롤러만 실행 (쉼표로 여러 개 지정 가능)
    python -m scripts.run_all --only one_store
    python -m scripts.run_all --only one_store,google_play

    # 어떤 크롤러들이 인식되는지만 보고 싶을 때 (아무것도 실행 안 함)
    python -m scripts.run_all --list

[동작 원칙]
    크롤러 하나가 에러로 죽어도 나머지 크롤러는 계속 실행됩니다.
    (원스토어가 그날따라 접속이 안 된다고 구글플레이까지 못 도는 건 곤란하니까요)
    마지막에 크롤러별 성공/실패 요약을 보여줍니다.
"""

from __future__ import annotations

import argparse
import importlib
import inspect
import pkgutil
import sys
import traceback
from dataclasses import dataclass, field
from typing import Optional

import crawlers
from crawlers.base import BaseCrawler
from common.logger import get_logger

log = get_logger("run_all")


@dataclass
class CrawlerRunResult:
    """크롤러 하나를 실행한 결과를 담는 상자."""

    name: str                              # source_name (예: "one_store")
    class_name: str                        # 클래스 이름 (예: "OneStoreCrawler")
    success: bool = False
    benefit_count: int = 0
    error_message: Optional[str] = None
    warnings: list[str] = field(default_factory=list)


def discover_crawlers() -> list[type[BaseCrawler]]:
    """
    crawlers/ 패키지 안의 모든 모듈을 뒤져서 BaseCrawler를 상속한 클래스를 찾습니다.

    [초보자 설명: pkgutil.iter_modules 가 하는 일]
    "crawlers 폴더 안에 어떤 .py 파일들이 있는지 나열해줘"를 자동으로 해줍니다.
    파일 이름을 하드코딩할 필요가 없습니다.
    """
    found: list[type[BaseCrawler]] = []

    # crawlers.__path__ = crawlers 폴더의 실제 경로.
    # iter_modules가 그 안의 .py 파일들을 하나씩 알려줍니다.
    for _, module_name, is_pkg in pkgutil.iter_modules(crawlers.__path__):
        if is_pkg or module_name in ("base",):
            # base.py는 크롤러가 아니라 '틀'이므로 건너뜁니다.
            continue

        full_module_name = f"crawlers.{module_name}"
        try:
            module = importlib.import_module(full_module_name)
        except Exception as e:
            # 문법 오류 등으로 import 자체가 안 되는 파일은 건너뛰고 경고만 남깁니다.
            log.error("crawlers.%s import 실패 (건너뜀): %s", module_name, e)
            continue

        # 그 모듈 안에서 'BaseCrawler를 상속했고, BaseCrawler 그 자체는 아닌'
        # 클래스만 골라냅니다.
        for _, obj in inspect.getmembers(module, inspect.isclass):
            if issubclass(obj, BaseCrawler) and obj is not BaseCrawler:
                # 같은 클래스가 여러 모듈에서 다시 나오는 걸 방지합니다.
                if obj not in found:
                    found.append(obj)

    return found


def run_one_crawler(crawler_cls: type[BaseCrawler], save_to_bq: bool) -> CrawlerRunResult:
    """크롤러 하나를 안전하게 실행합니다. 실패해도 예외를 밖으로 던지지 않습니다."""
    result = CrawlerRunResult(
        name=getattr(crawler_cls, "source_name", crawler_cls.__name__),
        class_name=crawler_cls.__name__,
    )

    crawler = None
    try:
        crawler = crawler_cls()
        benefits = crawler.run(save_to_bq=save_to_bq)
        result.success = True
        result.benefit_count = len(benefits)

    except Exception as e:
        result.success = False
        result.error_message = str(e)
        log.error("[%s] 크롤러 실행 중 오류 발생:\n%s", result.name, traceback.format_exc())

    finally:
        if crawler is not None:
            crawler.close()

    return result


def print_summary(results: list[CrawlerRunResult], save_to_bq: bool) -> None:
    """전체 실행 결과를 표 형태로 보기 좋게 출력합니다."""
    print()
    print("=" * 70)
    print("  전체 크롤링 결과 요약")
    print("=" * 70)

    if save_to_bq:
        print("  (BigQuery에 실제로 저장했습니다)")
    else:
        print("  (--dry-run 모드: BigQuery에 저장하지 않았습니다)")
    print()

    name_width = max((len(r.name) for r in results), default=10) + 2

    for r in results:
        status = "✅ 성공" if r.success else "❌ 실패"
        print(f"  {r.name:<{name_width}} {status}  |  혜택 {r.benefit_count}건")
        if not r.success:
            print(f"  {'':<{name_width}}     사유: {r.error_message}")

    print()
    succeeded = sum(1 for r in results if r.success)
    total_benefits = sum(r.benefit_count for r in results if r.success)
    print(f"  총 {len(results)}개 크롤러 중 {succeeded}개 성공, 혜택 총 {total_benefits}건 처리")
    print("=" * 70)


def main() -> int:
    parser = argparse.ArgumentParser(description="crawlers/ 폴더의 모든 크롤러를 자동으로 실행합니다.")
    parser.add_argument(
        "--dry-run", action="store_true",
        help="BigQuery에 저장하지 않고 추출 결과만 확인합니다.",
    )
    parser.add_argument(
        "--only", default=None,
        help="쉼표로 구분된 source_name 목록만 실행합니다. 예: --only one_store,google_play",
    )
    parser.add_argument(
        "--list", action="store_true",
        help="인식된 크롤러 목록만 보여주고 실행하지 않습니다.",
    )
    args = parser.parse_args()

    print("\n🚀 크롤러 자동 탐색 중...")
    crawler_classes = discover_crawlers()

    if not crawler_classes:
        print("❌ crawlers/ 폴더에서 BaseCrawler를 상속한 클래스를 찾지 못했습니다.")
        print("   crawlers/one_store.py 같은 파일이 실제로 있는지 확인하세요.")
        return 1

    print(f"✅ 크롤러 {len(crawler_classes)}개 인식됨:")
    for cls in crawler_classes:
        source_name = getattr(cls, "source_name", "(source_name 없음)")
        print(f"   - {cls.__name__}  (source_name='{source_name}')")

    if args.list:
        return 0

    # --only 필터 적용
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        before = len(crawler_classes)
        crawler_classes = [
            cls for cls in crawler_classes
            if getattr(cls, "source_name", None) in wanted
        ]
        print(f"\n--only 필터 적용: {before}개 중 {len(crawler_classes)}개만 실행합니다 ({', '.join(wanted)})")

        if not crawler_classes:
            print("❌ --only 로 지정한 이름과 일치하는 크롤러가 없습니다.")
            print("   정확한 이름은 위 '(source_name=...)' 목록을 참고하세요.")
            return 1

    save_to_bq = not args.dry_run

    # --- 순서대로 하나씩 실행 (하나가 실패해도 다음으로 넘어감) ---
    results: list[CrawlerRunResult] = []
    for i, cls in enumerate(crawler_classes, start=1):
        print(f"\n[{i}/{len(crawler_classes)}] {cls.__name__} 실행 중...")
        result = run_one_crawler(cls, save_to_bq=save_to_bq)
        results.append(result)

    print_summary(results, save_to_bq=save_to_bq)

    # 하나라도 실패한 크롤러가 있으면 종료 코드 1을 돌려줍니다.
    # (나중에 Cloud Scheduler 같은 자동화 도구가 실패를 감지할 수 있게 하기 위함)
    any_failed = any(not r.success for r in results)
    return 1 if any_failed else 0


if __name__ == "__main__":
    sys.exit(main())
