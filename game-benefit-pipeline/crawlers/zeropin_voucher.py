# -*- coding: utf-8 -*-
"""
crawlers/zeropin_voucher.py
--------------------------------------------------------------------
제로핀(zeropin.co.kr)에서 게임 결제와 관련된 상품권/기프트카드 할인
판매가를 수집하는 크롤러입니다.

⚠️ 원스토어/갤럭시 스토어 때와 달리, 이번엔 '목록에서 링크를 찾는' 방식이
아니라 실제로 열어봐서 이미 확인한 URL들을 그대로 하드코딩했습니다.
(2026-08-12 기준, 정식 통신판매업 등록 업체: 상호 세이프핀,
통신판매업신고번호 제2022-용인기흥-3057)

제로핀은 25개 넘는 상품권을 팝니다(스타벅스·배달의민족 등 게임과 무관한
것 포함). 그중 게임 결제와 명확히 관련된 5개만 골라서 크롤링합니다.
    /product/culture   - 컬쳐랜드 상품권 (최대 5% 할인)
    /product/culture2  - 문화상품권 18핀 (최대 5% 할인)
    /product/book      - 북앤라이프 도서상품권 (최대 6% 할인)
    /product/google    - 구글 기프트카드 (최대 4% 할인)
    /product/smart      - 스마트문상 (최대 6% 할인)

각 페이지를 실제로 열어보니(book 페이지 기준) 권종별(5만원권/3만원권/
1만원권/5천원권/3천원권) 정가와 판매가, 할인율이 표까지 정확히 나옵니다.
서버가 완성된 HTML을 줘서 Playwright 없이 http_client만으로 충분합니다.
"""

from __future__ import annotations

from typing import Iterator

from common.http_client import html_to_text
from crawlers.base import BaseCrawler, PageContent

# 게임 결제와 명확히 관련된 상품권만 골랐습니다.
# (넥슨카드·한게임·플레이스테이션·로블록스 등은 특정 게임사 전용 캐시라
#  저희 target_platform(ONE_STORE/GOOGLE_PLAY/GALAXY_STORE/APP_STORE) 범위
#  밖이라 제외했습니다. 필요하면 나중에 추가할 수 있습니다.)
PRODUCT_PAGES = {
    "컬쳐랜드 상품권": "https://zeropin.co.kr/product/culture",
    "문화상품권(18핀)": "https://zeropin.co.kr/product/culture2",
    "북앤라이프 도서상품권": "https://zeropin.co.kr/product/book",
    "구글 기프트카드": "https://zeropin.co.kr/product/google",
    "스마트문상": "https://zeropin.co.kr/product/smart",
}


class ZeropinVoucherCrawler(BaseCrawler):
    """제로핀에서 게임 관련 상품권 할인 판매가를 수집합니다."""

    source_name = "zeropin_voucher"

    context_hint = (
        "제로핀(정식 통신판매업 등록 업체)의 상품권 판매 페이지입니다. "
        "provider_or_retailer는 반드시 'ZEROPIN'으로 고정하세요.\n"
        "★ 상품명에 따라 target_platform을 다르게 정하세요:\n"
        "  - '구글 기프트카드' -> GOOGLE_PLAY (구글 공식 기프트코드라 "
        "구글플레이 전용입니다). condition_raw_text에 '갤럭시 스토어에서는 "
        "구글 기프트카드로 결제 불가(삼성 공식 확인)'를 반드시 남기세요.\n"
        "  - '컬쳐랜드', '문화상품권', '북앤라이프', '스마트문상' -> ONE_STORE "
        "(ALL이 아닙니다! 이 상품권들은 체크아웃에서 결제수단으로 바로 고르는 "
        "게 아니라, 먼저 '원스토어 캐시'로 충전/전환한 뒤에 쓰는 방식으로 "
        "확인됐습니다. 구글플레이·앱스토어가 이 상품권을 직접 받는지는 "
        "확인되지 않았고, 애플은 자사 기프트카드만 받으므로 ALL로 표시하면 "
        "부정확합니다). condition_raw_text에 '갤럭시 스토어에서도 결제 "
        "가능하나 인증 오류로 실패하는 사례가 있어 완전히 안정적이지 않음. "
        "구글플레이는 직접 결제수단이 아니며, 컬쳐랜드 상품은 별도로 "
        "구글플레이 기프트코드 구매에 사용 가능'을 반드시 남기세요.\n"
        "target_game=ALL로 고정하세요.\n"
        "★ category=VOUCHER_PURCHASE, benefit_type=DISCOUNT, "
        "disbursement_type=CHARGE_PURCHASE, stacking_layer=GIFT_CARD로 "
        "고정하세요.\n"
        "★★ 권종(5만원권/3만원권/1만원권 등)마다 할인율이 다르면 반드시 "
        "별도 항목으로 분리하세요. denomination_list에는 그 항목의 권종 "
        "금액만(예: 1만원권이면 [10000]) 넣으세요.\n"
        "★ benefit_value는 표에 적힌 할인율을 그대로 쓰세요(예: '6.5%↓' -> "
        "6.5). 정가와 판매가로 직접 계산하지 말고 원문의 할인율 표기를 "
        "우선하세요.\n"
        "★ min_spend_krw=0으로 고정하세요. max_benefit_krw는 정가-판매가 "
        "차액(원)을 계산해서 넣으세요.\n"
        "★ 일일 구매 한도 안내(예: '문화상품권 일일 구매한도 20만원')가 "
        "있으면 condition_raw_text에 포함하세요."
    )

    def fetch_pages(self) -> Iterator[PageContent]:
        for name, url in PRODUCT_PAGES.items():
            html = self.http.get(url)
            if not html:
                continue

            text = html_to_text(html)
            if not text or len(text.strip()) < 30:
                continue

            yield PageContent(
                url=url,
                text=f"[상품명: {name}]\n\n{text}",
                hint=self.context_hint,
            )


if __name__ == "__main__":
    crawler = ZeropinVoucherCrawler()
    try:
        results = crawler.run(upload_to_gcs=False)
        print(f"\n총 {len(results)}건 추출됨\n")
        for item in results:
            print(f"- {item.item_or_event_name} | {item.benefit_value}{item.benefit_unit.value} "
                  f"| 권종: {item.denomination_list} | {item.target_platform.value}")
    finally:
        crawler.close()