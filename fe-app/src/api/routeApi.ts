import type {
  RouteRequest,
  RecommendedRoute,
  BackendResponse,
  StepDetail,
  OptimizationResult,
  ApiResponse,
  FormData,
} from '../types';
import {
  PAYMENT_METHOD_MAP,
  PLATFORM_CODE_MAP,
  CARD_CODE_MAP,
  LAYER_NAME_MAP,
  REVERSE_PAYMENT_MAP,
  BACKEND_API_URL,
} from '../constants/option';
 
const convertBackendRouteToUI = (
  routes: RecommendedRoute[],
  originalPrice: number
): OptimizationResult[] => {
  return routes.map((route, idx) => {
    const mainProviders: string[] = [];

    const stepsDetailed: StepDetail[] = route.steps.map((step) => {
      const layerKorean = LAYER_NAME_MAP[step.layer] || step.layer;
      const providerKorean = REVERSE_PAYMENT_MAP[step.provider] || step.provider;
      if (providerKorean && !mainProviders.includes(providerKorean)) {
        mainProviders.push(providerKorean);
      }

      let comboStr = '';
      if (step.layer === 'GIFT_CARD' && step.giftcard_combo) {
        comboStr = step.giftcard_combo.map((c) => `${c.toLocaleString()}원`).join('+');
      }

      const targetGame = step.target_game || 'ALL';
      const isGameSpecific = targetGame !== 'ALL';

      let formattedText = '';
      if (step.type === 'DISCOUNT' || step.type === 'FEE') {
        formattedText = `-${step.applied_amount.toLocaleString()}원 할인`;
      } else if (step.provider === 'GOOGLE_PLAY') {
        const nativePt = Math.round(step.applied_amount / 10);
        formattedText = `+${step.applied_amount.toLocaleString()}원 상당 (${nativePt} Play Points)`;
      } else {
        formattedText = `+${step.applied_amount.toLocaleString()}P 적립`;
      }

      const realEventName = step.item_or_event_name && step.item_or_event_name.trim() !== ''
        ? step.item_or_event_name
        : `${providerKorean} ${layerKorean}`;

      const realConditionText = step.condition_raw_text && step.condition_raw_text.trim() !== ''
        ? step.condition_raw_text
        : '상세 조건은 해당 스토어/결제사 이벤트를 확인하세요.';

      return {
        layerName: layerKorean,
        providerName: providerKorean,
        type: step.type,
        amount: step.applied_amount,
        formattedAmountText: formattedText,
        eventName: realEventName,
        conditionText: realConditionText,
        comboText: comboStr,
        targetGame: targetGame,
        isGameSpecific: isGameSpecific,
      };
    });

    const discountSteps = stepsDetailed.filter(
      (s) => s.type === 'DISCOUNT' || s.type === 'FEE'
    );
    const rewardSteps = stepsDetailed.filter(
      (s) => s.type === 'REWARD' || s.type === 'CASHBACK'
    );

    const actualPaymentPrice = route.final_paid_amount;
    const immediateDiscountTotal = Math.max(0, originalPrice - actualPaymentPrice);
    const rewardPointTotal = route.reward_total;
    const netCost = route.net_cost;
    const totalBenefitAmount = Math.max(0, originalPrice - netCost);
    const discountRate = originalPrice > 0 ? Math.round((totalBenefitAmount / originalPrice) * 1000) / 10 : 0;

    const routeTitle = mainProviders.length > 0
      ? `[${mainProviders.join(' + ')}] 최적 조합`
      : `추천 결제 경로 #${idx + 1}`;

    let guideText = route.route_type === 'GIFT_CARD'
      ? '상품권 할인 충전 후 우회 결제하는 최고 할인 경로입니다.'
      : '스토어 쿠폰, 통신사/간편결제 및 기본 적립이 조합된 경로입니다.';

    if (route.leftover_balance > 0) {
      guideText += ` (결제 후 상품권 잔액 ${route.leftover_balance.toLocaleString()}원 남음)`;
    }

    return {
      rank: idx + 1,
      title: routeTitle,
      platform: mainProviders[0] || '일반 결제',
      original_price: originalPrice,
      actual_payment_price: actualPaymentPrice,
      immediate_discount_total: immediateDiscountTotal,
      final_price: netCost,
      reward_point: rewardPointTotal,
      total_benefit_amount: totalBenefitAmount,
      discount_rate: discountRate,
      steps: stepsDetailed,
      discount_steps: discountSteps,
      reward_steps: rewardSteps,
      guide_text: guideText,
      rawRoute: route,
    };
  });
};

export const fetchLowestPriceRecommendations = async (
  formData: FormData
): Promise<ApiResponse> => {
  const selectedProviders: string[] = [];

  if (formData.useCarriers) {
    formData.carriers.forEach((c) => PAYMENT_METHOD_MAP[c] && selectedProviders.push(PAYMENT_METHOD_MAP[c]));
  }
  if (formData.usePays) {
    formData.pays.forEach((p) => PAYMENT_METHOD_MAP[p] && selectedProviders.push(PAYMENT_METHOD_MAP[p]));
  }
  if (formData.useVoucherBypasses) {
    formData.voucherBypasses.forEach((v) => {
      if (v === '구글 핀번 기프트코드') {
        selectedProviders.push(
          'GOOGLE_PLAY_GIFTCARD',
          'ZEROPIN',
          'GMARKET',
          '11STREET',
          'SSG_COM',
          'GOOGLE_PLAY_NAVER_STORE',
          'CU_CONVENIENCE_STORE',
          'GS25_CONVENIENCE_STORE',
          'SEVEN_ELEVEN'
        );
      } else if (v === '컬쳐랜드(우회/캐시)') {
        selectedProviders.push('CULTURELAND_CASH', 'CULTURELAND_VOUCHER');
      } else if (v === '북앤라이프') {
        selectedProviders.push('BOOKNLIFE_VOUCHER');
      } else if (PAYMENT_METHOD_MAP[v]) {
        selectedProviders.push(PAYMENT_METHOD_MAP[v]);
      }
    });
  }

  if (formData.useSpecialOptions && formData.selectedSpecialCard !== 'NONE') {
    const cardCode = CARD_CODE_MAP[formData.selectedSpecialCard] || formData.selectedSpecialCard;
    selectedProviders.push(cardCode);
  }

  const targetPlatforms = formData.osType === 'ANDROID'
    ? formData.androidStores.map((s) => PLATFORM_CODE_MAP[s] || s)
    : ['APP_STORE'];

  const amountNum = Number(formData.amount) || 0;

  try {
    const routeToken = localStorage.getItem('google_token');

    const requests = targetPlatforms.map((platform) => {
      let tier = 'STANDARD';
      if (platform === 'GOOGLE_PLAY') tier = formData.googlePlayTier;
      if (platform === 'GALAXY_STORE') tier = formData.galaxyStoreTier;

      const payload: RouteRequest = {
        platform: platform,
        amount: amountNum,
        is_first_pay: formData.isFirstPayment,
        payment_methods: selectedProviders,
        game: formData.gameTitle === '쿠키런: 킹덤' ? 'COOKIERUN_KINGDOM' : 'ALL',
        membership_tier: tier,
        has_subscription: formData.useSpecialOptions && formData.subscriptions.length > 0,
        has_prev_spend: formData.useSpecialOptions ? formData.hasPrevSpend : false,
        has_pre_applied: formData.hasPreApplied,
        use_game_benefits: formData.useGameBenefits,
      };

      // 로그인 유저는 관리자 대시보드용 유저별 게임 이용 로그도 함께 적재하기 위해 토큰을 실어 보낸다
      return fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(routeToken ? { Authorization: `Bearer ${routeToken}` } : {}),
        },
        body: JSON.stringify(payload),
      }).then((res) => {
        if (!res.ok) throw new Error(`API 통신 실패 (Status: ${res.status})`);
        return res.json() as Promise<BackendResponse>;
      });
    });

    const responses = await Promise.all(requests);
    const combinedRoutes: RecommendedRoute[] = responses.flatMap((res) => res.routes || []);
    combinedRoutes.sort((a, b) => a.net_cost - b.net_cost);

    const convertedResults = convertBackendRouteToUI(combinedRoutes.slice(0, 10), amountNum);

    return {
      status: 'SUCCESS',
      data: convertedResults,
    };
  } catch (err) {
    console.error('API Error:', err);
    throw err;
  }
};