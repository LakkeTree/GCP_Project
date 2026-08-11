# -*- coding: utf-8 -*-
"""
common/ai_client.py
--------------------------------------------------------------------
Gemini(google-genai SDK)를 감싼 모듈입니다.
"지저분한 웹페이지 텍스트"를 넣으면 "계산엔진이 바로 쓸 수 있는 혜택 JSON"이 나옵니다.

[구조화된 출력(Structured Output)]
AI에게 그냥 "JSON으로 줘"라고 하면 앞뒤에 설명이나 ```json 표시를 붙여 파싱이 깨집니다.
google-genai SDK의 response_schema 기능은 "결과는 반드시 이 설계도를 따르는 JSON"이라고
강제하므로 파싱 실패가 거의 사라집니다.

[인증 방식 전환]
  USE_VERTEXAI=false -> AI Studio API 키 (간단, 지금 추천)
  USE_VERTEXAI=true  -> Vertex AI (GCP 크레딧 소진용)
코드 수정 없이 .env 값만 바꾸면 됩니다.
"""

from __future__ import annotations

import json
from typing import Optional

from google import genai
from google.genai import types
from pydantic import ValidationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from common.config import get_settings
from common.logger import get_logger
from common.schema import BenefitExtraction, build_allowed_values_prompt

log = get_logger(__name__)


# =============================================================================
# 시스템 프롬프트 (AI에게 주는 직무 기술서)
# =============================================================================
# ★ 이 프롬프트의 규칙들은 calculator.py 의 계산 로직에서 그대로 역산한 것입니다.
#   여기가 틀리면 계산 결과가 조용히 틀어지므로 가장 중요한 부분입니다.

SYSTEM_INSTRUCTION = """당신은 한국 모바일 게임 시장의 결제 혜택 데이터를 정제하는 전문 분석가입니다.

## 역할
입력으로 주어진 웹페이지 텍스트에서 "게임 결제와 관련된 할인/적립/캐시백/수수료 정보"만 찾아내어
구조화된 JSON 배열로 변환합니다.

## 반드시 지킬 규칙
1. 원문에 명시되지 않은 정보는 절대 지어내지 마세요. 특히 할인율, 금액, 날짜를 추측하면 안 됩니다.
2. 할인율/금액을 원문에서 확인할 수 없는 항목은 결과에서 제외하세요.
   불완전한 데이터를 넣는 것보다 아예 빼는 것이 낫습니다.
3. 게임 결제와 무관한 내용(신규 게임 출시 소식, 점검 안내, 업데이트 패치노트,
   채용 공고, 실물 상품 판매 등)은 모두 무시하세요.
4. 하나의 이벤트에 여러 혜택이 섞여 있으면(예: "20% 할인 + 5,000 포인트 적립")
   각각을 별도의 JSON 항목으로 분리하세요.
5. 혜택이 하나도 없으면 빈 배열 [] 을 반환하세요. 억지로 채우지 마세요.

## 필드 작성 지침 (중요한 것부터)

### 금액·수치
- benefit_value: 숫자만. "20% 할인" -> 20.0 / "5,000원 할인" -> 5000.0
- benefit_unit: 퍼센트면 PERCENT, 원화 정액이면 KRW
- min_spend_krw: "3만원 이상 결제 시" 같은 조건이 있을 때만 30000, 없으면 0
- max_benefit_krw: ★ 세 가지를 구분하세요.
    * "최대 1만원 할인" 처럼 한도가 명시됨      -> 10000
    * "한도 없음 / 무제한" 이라고 명시됨        -> null
    * 한도 언급이 아예 없어 알 수 없음          -> 0
  (0 과 null 은 계산엔진에서 다르게 처리되므로 뭉개면 안 됩니다)
- min_prev_month_spend_krw: "전월 실적 30만원 이상" -> 300000, 조건 없으면 null

### 날짜
- start_date / end_date: YYYY-MM-DD 형식.
  * "8월 1일 ~ 8월 31일" 처럼 연도가 없으면 아래 제공되는 '오늘 날짜'의 연도를 사용
  * ★ "상시", "소진 시까지", "기간 미표기" 인 경우 반드시 null 로 두세요.
    임의의 종료일을 지어내면 안 됩니다.

### 분류
- target_platform: 특정 스토어가 명시된 경우에만 그 스토어, 아니면 ALL
- target_game: 특정 게임 전용일 때만 게임 코드, 아니면 ALL
- channel_type: 게임 앱 안에서 결제하면 IN_APP, 웹/외부 사이트면 ONLINE, 매장이면 OFFLINE
- stacking_layer: ★ 혜택을 주는 주체가 누구인지로 판단합니다.
    * 카드사 혜택            -> CARD_ISSUER
    * 간편결제(페이코/네이버페이/토스/삼성페이 등) -> PAYMENT_E_PAY
    * 스토어 자체 쿠폰       -> STORE_COUPON
    * 기프트카드/상품권      -> GIFT_CARD
- disbursement_type: ★ 혜택을 '어떻게 받는지'로 판단합니다.
    * 결제 시 즉시 깎임      -> INSTANT_DISCOUNT
    * 포인트로 적립          -> POINT_REWARD
    * 청구서에서 할인        -> BILL_DISCOUNT
    * 쿠폰으로 발급          -> COUPON_ISSUE
    * 충전/구매 형태         -> CHARGE_PURCHASE
    * 단순 안내라 계산 불가  -> INFO_ONLY
- payment_route_type: 바로 결제면 DIRECT_PAY, 기프트코드 충전을 거치면 GIFTCODE_CHARGE,
  계정 직접 연동이면 DIRECT_LINK, 포인트 전환을 거치면 INDIRECT_CONVERSION

### 조건 플래그
- is_first_purchase: "첫 결제", "생애 첫" 등이 있으면 true
- requires_pre_app: "사전 응모", "응모 후 사용" 등이 있으면 true
- is_first_come_first_served: "선착순" 이 있으면 true
- is_tiered_limit: "실적 구간별 차등" 처럼 한도가 구간마다 다르면 true
- is_probabilistic: "랜덤", "당첨", "확률" 이면 true
- user_segment: 신규/휴면 대상이면 NEW_OR_RETURNING_USER, VIP/우수회원 한정이면
  VIP_MEMBER, 그 외 ALL_USERS

### 기타
- denomination_list: 상품권/기프트카드의 권종이 나열되어 있으면 정수 배열로.
  예) "1만원, 3만원, 5만원권" -> [10000, 30000, 50000]. 없으면 빈 배열 []
- item_or_event_name: 원문에 적힌 이벤트 이름을 한국어 그대로. 요약하거나 번역하지 마세요.
- condition_raw_text: ★ 조건이 적힌 원문 문장을 그대로 옮겨 담으세요.
  ★★ 단, 여러 항목이 같은 공통 유의사항(예: "SKT, KT, U+ 한정, 인당 1회 참여
  가능"처럼 페이지 하단에 한 번만 적혀 있고 모든 항목에 공통으로 적용되는 문구)을
  공유하는 경우, 그 공통 문구를 항목마다 반복해서 옮겨 적지 마세요. 각 항목의
  condition_raw_text에는 그 항목에 고유한 조건(할인율, 기간, 최소 결제금액 등)만
  담고, 공통 유의사항은 첫 번째 항목에만 한 번 포함하거나 생략하세요.
  이걸 지키지 않으면 응답이 너무 길어져 중간에 잘릴 수 있습니다.
"""


class GeminiExtractionError(Exception):
    """Gemini 호출 자체가 실패했을 때의 예외. (재시도 대상)"""


def _recover_complete_json_objects(text: str) -> list[dict]:
    """
    응답이 배열 중간에서 잘려도, '완전한 형태로 끝난 항목'만 골라 복구합니다.

    [초보자 설명: 왜 필요한가?]
    json.loads()는 문자열 전체가 완벽한 JSON이어야만 성공합니다. 20개 항목 중
    19개가 멀쩡해도 마지막 1개가 중간에 잘렸다면 통째로 실패해서 0건이 됩니다.

    이 함수는 문자열을 앞에서부터 한 글자씩 훑으면서 중괄호 짝이 맞아 완전히
    닫힌 { ... } 객체를 만날 때마다 하나씩 떼어내 파싱합니다. 문자열(" " 안)에
    있는 중괄호는 무시하도록 따옴표 상태도 함께 추적합니다.
    맨 마지막의 잘린 객체는 중괄호가 안 닫히므로 자연스럽게 무시됩니다.
    """
    objects: list[dict] = []

    start = text.find("[")
    if start == -1:
        return objects

    depth = 0
    obj_start: Optional[int] = None
    in_string = False
    escape = False

    for i in range(start + 1, len(text)):
        ch = text[i]

        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            continue

        if ch == '"':
            in_string = True
        elif ch == "{":
            if depth == 0:
                obj_start = i
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0 and obj_start is not None:
                candidate = text[obj_start : i + 1]
                try:
                    objects.append(json.loads(candidate))
                except json.JSONDecodeError:
                    pass  # 이 객체도 이상하면 조용히 건너뜁니다.
                obj_start = None

    return objects


class GeminiClient:
    """Gemini 호출 담당."""

    def __init__(self):
        self.settings = get_settings()

        if self.settings.use_vertexai:
            log.info(
                "Gemini 초기화 (Vertex AI) | project=%s location=%s",
                self.settings.gcp_project_id, self.settings.vertex_location,
            )
            self.client = genai.Client(
                vertexai=True,
                project=self.settings.gcp_project_id,
                location=self.settings.vertex_location,
            )
        else:
            log.info("Gemini 초기화 (AI Studio API 키)")
            if not self.settings.gemini_api_key:
                raise ValueError(
                    "GEMINI_API_KEY 가 비어 있습니다. .env 파일을 확인하세요.\n"
                    "발급: https://aistudio.google.com/apikey"
                )
            self.client = genai.Client(api_key=self.settings.gemini_api_key)

        self.model = self.settings.gemini_model

    # ------------------------------------------------------------------
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=2, min=2, max=20),   # 2초 -> 4초 -> 8초
        retry=retry_if_exception_type(GeminiExtractionError),
        reraise=True,
    )
    def _call_model(self, prompt: str) -> str:
        """Gemini를 호출하고 응답 텍스트를 돌려줍니다. 실패하면 자동 재시도합니다."""
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_INSTRUCTION,
                    # temperature 0 = 창의성 억제.
                    # 데이터 추출에서 창의성은 곧 '환각'이므로 0으로 둡니다.
                    temperature=0.0,
                    response_mime_type="application/json",
                    response_schema=list[BenefitExtraction],
                    max_output_tokens=self.settings.gemini_max_output_tokens,
                ),
            )
        except Exception as e:
            raise GeminiExtractionError(f"Gemini 호출 실패: {e}") from e

        text = (response.text or "").strip()
        if not text:
            raise GeminiExtractionError("Gemini가 빈 응답을 반환했습니다.")
        return text

    # ------------------------------------------------------------------
    def extract_benefits(
        self,
        raw_text: str,
        today: str,
        context_hint: Optional[str] = None,
    ) -> list[BenefitExtraction]:
        """
        웹페이지 텍스트에서 혜택 목록을 추출합니다.

        Args:
            raw_text: html_to_text() 로 정리한 페이지 텍스트
            today: 오늘 날짜 (YYYY-MM-DD). 연도 없는 날짜를 보정하는 데 씁니다.
            context_hint: 추가 힌트. 예) "원스토어 이벤트 목록 페이지입니다."

        Returns:
            검증을 통과한 항목만 담은 리스트. 없으면 빈 리스트.
        """
        if not raw_text or not raw_text.strip():
            log.warning("입력 텍스트가 비어 있어 AI 호출을 건너뜁니다.")
            return []

        if len(raw_text) > self.settings.max_input_chars:
            log.warning("입력이 길어 %d자로 자릅니다. (원본 %d자)",
                        self.settings.max_input_chars, len(raw_text))
            raw_text = raw_text[: self.settings.max_input_chars]

        parts = [f"## 오늘 날짜\n{today}", "", build_allowed_values_prompt(), ""]
        if context_hint:
            parts += [f"## 페이지 정보\n{context_hint}", ""]
        parts += ["## 분석할 웹페이지 텍스트", "---", raw_text, "---"]
        prompt = "\n".join(parts)

        log.info("Gemini 호출 (모델=%s, 입력 %d자)", self.model, len(prompt))

        try:
            response_text = self._call_model(prompt)
        except GeminiExtractionError as e:
            log.error("3회 재시도 후에도 실패했습니다: %s", e)
            return []

        # response_schema를 썼으므로 순수 JSON이 오지만, 만약을 대비해 정리합니다.
        cleaned = response_text.replace("```json", "").replace("```", "").strip()

        try:
            raw_items = json.loads(cleaned)
        except json.JSONDecodeError as e:
            log.warning(
                "응답을 통째로는 못 읽었습니다(아마 응답이 잘림): %s\n"
                "완전한 항목만 복구를 시도합니다...", e
            )
            raw_items = _recover_complete_json_objects(cleaned)
            if raw_items:
                log.warning(
                    "복구 성공: 잘린 응답에서 완전한 항목 %d건을 건졌습니다. "
                    "(전체가 다 필요하면 GEMINI_MAX_OUTPUT_TOKENS를 더 늘리거나 "
                    "페이지를 나눠서 넣는 걸 고려하세요)",
                    len(raw_items),
                )
            else:
                log.error("복구할 수 있는 항목도 없었습니다. 앞부분: %s", cleaned[:300])
                return []

        if not isinstance(raw_items, list):
            log.error("응답이 배열이 아닙니다. 타입=%s", type(raw_items).__name__)
            return []

        # --- 한 건씩 검증 ---
        # 한 건이 잘못됐다고 전체를 버리면 아깝습니다. 통과한 것만 모읍니다.
        valid: list[BenefitExtraction] = []
        for idx, raw in enumerate(raw_items):
            try:
                valid.append(BenefitExtraction.model_validate(raw))
            except ValidationError as e:
                first = e.errors()[0] if e.errors() else {}
                log.warning(
                    "%d번째 항목 검증 실패(건너뜀) | 필드=%s | 사유=%s | 원본=%s",
                    idx + 1,
                    ".".join(str(x) for x in first.get("loc", [])),
                    first.get("msg", "알 수 없음"),
                    str(raw)[:200],
                )

        log.info("추출 결과: %d건 중 %d건 검증 통과", len(raw_items), len(valid))
        return valid

    def ping(self) -> bool:
        """연결 확인용 간단 호출. 성공하면 True."""
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents="'연결 성공'이라고만 답하세요.",
                config=types.GenerateContentConfig(temperature=0.0, max_output_tokens=100),
            )
            log.info("Gemini 응답: %s", (response.text or "").strip())
            return True
        except Exception as e:
            log.error("Gemini 연결 실패: %s", e)
            return False