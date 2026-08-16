"""
benefit_info.provider_or_retailer 코드 → 결제수단 아이콘 이미지 URL 매핑.

csv_cleaning.py(향후 크롤링분 자동 반영)와 backfill_payment_method_icon_url.py
(기존 행 백필) 양쪽에서 공용으로 쓴다. URL은 전부 직접 검증(HTTP 200,
image/* 또는 svg+xml)했고, 스토어 hotlink 방식은 game_info.icon_url과 동일한
관례를 따른다(재호스팅 없음).
"""

PAYMENT_METHOD_ICON_URLS: dict[str, str] = {
    # 카드
    "KB_KOOKMIN_CARD": "https://www.kbfg.com/kor/images/about/pc/img_symbol_logo.jpg",
    "HANA_CARD": "https://www.hanafn.com/assets/img/ko/info/img-hana-symbol.png",
    "SHINHAN_CARD": "https://www.shinhancard.com/pconts/company/images/contents/shc_ci_basic_00.png",
    "NH_NONGHYUP_CARD": "https://www.nonghyup.com/images/contents/img_010601_1.png",
    "SAMSUNG_CARD": "https://images.samsung.com/is/image/samsung/assets/global/about-us/brand/logo/300_186_1.png?$568_N_PNG$",
    # 간편결제
    "NAVER_PAY": "https://developers.pay.naver.com/img/logo/signature/logo_navergr_small.svg",
    "PAYCO": "https://developers.payco.com/static/img/@img_guide_resource.png",
    # 게임 플랫폼(스토어)
    "ONE_STORE": "https://onestorecorp.com/assets/img/onestore/bi_summary.png",
    # 원본 제공 URL은 GCS 서명 URL(X-Goog-Expires=86400)이라 이미 만료됨.
    # Google 공식 "Get it on Google Play" 배지로 대체(2026-08-16 검증).
    "GOOGLE_PLAY": "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png",
    # 현재 provider_or_retailer로는 매칭되는 행이 없음(Apple 자체 발행 혜택
    # 스크래퍼가 없어 target_platform에만 등장). 추후 대비용으로 유지.
    "APP_STORE": "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg",
    # 삼성 공식 자산은 로그인이 필요해 확보 못함. seeklogo.com 미러(비공식) 사용.
    "GALAXY_STORE": "https://images.seeklogo.com/logo-png/43/1/samsung-galaxy-store-logo-png_seeklogo-438253.png",
    # 통신사
    "KT": "https://corp.kt.com/images/kt/kt-ci.png?ver=2022120801",
    "SKT": "https://news-static.sktelecom.com/wp-content/uploads/2021/08/SK%ED%85%94%EB%A0%88%EC%BD%A4-%EB%A1%9C%EA%B3%A0.png",
    # 원본 제공 URL(brandfetch)은 실제로 HTML 페이지를 반환해 사용 불가.
    # 위키미디어 커먼즈에 업로드된 공식 CI SVG로 대체(2026-08-16 검증).
    "LGU_PLUS": "https://upload.wikimedia.org/wikipedia/commons/5/5c/LG_U%2B_CI.svg",
    # 상품권 판매처
    # zeropin.co.kr은 SPA라 정적 태그가 없어 공식 Google Play 앱 리스팅의
    # og:image(앱 아이콘)에서 추출.
    "ZEROPIN": "https://play-lh.googleusercontent.com/9ass2YMspvkq2BpU0dQYrL_7WQ3XVU6HDBlPqR4npEaLKxQWDuWKw4o4Mw7DgAFsBwMCKZBUL3BYcBUGAE-B3w",
    # www.cultureland.co.kr은 302 리다이렉트 후 빈 응답이라 모바일 사이트
    # (m.cultureland.co.kr)의 favicon 사용.
    "CULTURELAND_CASH": "https://m.cultureland.co.kr/favicon.png",
}
