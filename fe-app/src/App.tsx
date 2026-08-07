import React, { useState } from 'react';

// ==========================================
// 1. 백엔드 (game pay api / main.py) 연동 스키마
// ==========================================
export interface RouteRequest {
  platform: string;
  amount: number;
  is_first_pay: boolean;
  payment_methods: string[];
  game: string;
  membership_tier?: string;
  has_subscription?: boolean;
  has_prev_spend?: boolean;
  has_pre_applied?: boolean;    // 사전 응모 완료 여부 토글 (true/false)
  use_game_benefits?: boolean;  // 게임 전용 혜택 포함 여부 토글 (true/false)
}

export interface RouteStep {
  layer: string;
  provider: string;
  type: string;
  applied_amount: number;
  giftcard_combo?: number[];
  item_or_event_name?: string;
  condition_raw_text?: string;
  target_game?: string;
}

export interface RecommendedRoute {
  route_type: string;
  base_amount: number;
  final_paid_amount: number;
  reward_total: number;
  net_cost: number;
  leftover_balance: number;
  steps: RouteStep[];
}

export interface BackendResponse {
  routes: RecommendedRoute[];
  warnings: Array<{ benefit_id: string; provider: string; conditions: string[] }>;
}

// ==========================================
// 2. 프론트엔드 UI 카드 출력용 데이터 타입
// ==========================================
export interface StepDetail {
  layerName: string;
  providerName: string;
  type: string; // 'DISCOUNT', 'REWARD', 'CASHBACK', 'FEE'
  amount: number;
  eventName: string;
  conditionText: string;
  comboText?: string;
  targetGame: string;
  isGameSpecific: boolean;
}

export interface OptimizationResult {
  rank: number;
  title: string;
  platform: string;
  original_price: number;            // 정가
  actual_payment_price: number;      // 실제 결제창 결제금액 (final_paid_amount)
  immediate_discount_total: number;  // 즉시 할인 총액
  final_price: number;                // 최종 체감가 (net_cost)
  reward_point: number;               // 총 적립 포인트 (reward_total)
  total_benefit_amount: number;      // 총합 혜택 금액 (즉시할인 + 적립)
  discount_rate: number;             // 총합 할인율 (%)
  steps: StepDetail[];
  discount_steps: StepDetail[];       // 즉시 할인 단계 전용
  reward_steps: StepDetail[];         // 적립 혜택 단계 전용
  guide_text: string;
  rawRoute: RecommendedRoute;
}

export interface ApiResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data: OptimizationResult[];
}

// ==========================================
// 3. 사용자 입력 폼 데이터 타입
// ==========================================
export type OsType = 'ANDROID' | 'IOS';

export interface FormData {
  gameTitle: string;
  osType: OsType;
  androidStores: string[];
  amount: number | '';
  isFirstPayment: boolean;
  hasPreApplied: boolean;     // 사전 응모 완료 여부 (기본값: false)
  useGameBenefits: boolean;   // 게임 전용 혜택 포함 여부 (기본값: true)

  googlePlayTier: string;
  galaxyStoreTier: string;

  useCarriers: boolean;
  carriers: string[];

  usePays: boolean;
  pays: string[];

  useVoucherBypasses: boolean;
  voucherBypasses: string[];

  useSpecialOptions: boolean;
  subscriptions: string[];
  hasPrevSpend: boolean;
  isPcVersion: boolean;
  selectedSpecialCard: string;
}

// ==========================================
// 4. 입력 UI 옵션 상수 및 고유 매핑표
// ==========================================
export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
export const PAY_OPTIONS = ['네이버페이', '카카오페이', '페이코', '토스페이', '삼성페이', '애플페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프'
];

export const GOOGLE_PLAY_TIERS = [
  { label: '브론즈 (기본 1.0% 적립)', value: 'BRONZE' },
  { label: '실버 (1.1% 적립)', value: 'SILVER' },
  { label: '골드 (1.3% 적립)', value: 'GOLD' },
  { label: '플래티넘 (1.6% 적립)', value: 'PLATINUM' },
  { label: '다이아몬드 (최상위 2.0% 적립)', value: 'DIAMOND' },
];

export const GALAXY_STORE_TIERS = [
  { label: '기본 / 상시 (0.2% 적립)', value: 'STANDARD' },
  { label: '프레스티지 (1.1% 적립)', value: 'PRESTIGE' },
  { label: '로열블루 (2.1% 적립)', value: 'ROYAL_BLUE' },
];

export const SUBSCRIPTION_OPTIONS = [
  '네이버플러스 멤버십 (+4% 적립)',
  '토스프라임 (+4% 적립)',
  'T멤버십 (원스토어 10% 할인/적립)',
];

// 👈 [수정] 모든 세부 카드 옵션에 고유 ID 식별자 부여 (드롭다운 리셋 오류 완벽 해결)
export const SPECIAL_CARD_OPTIONS = [
  { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' },
  { label: '[신한] LineageM 신한카드 (인앱 10% 할인)', value: 'SHINHAN_CARD_LINEAGE' },
  { label: '[신한] LineageM 신한 체크카드 (인앱 5% 할인)', value: 'SHINHAN_CARD_CHECK' },
  { label: '[삼성] 삼성 모바일 플러스 (갤스 5% 할인)', value: 'SAMSUNG_CARD_MOBILE' },
  { label: '[삼성] 삼성 iD SELECT ON (인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_SELECT' },
  { label: '[삼성] 삼성 iD GLOBAL (해외/인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_GLOBAL' },
  { label: '[국민] KB국민 노리2 체크카드 (Play) (10% 할인)', value: 'KB_KOOKMIN_CARD_NORI' },
  { label: '[농협] NH농협 zgm.play (10% 할인)', value: 'NH_NONGHYUP_CARD_PLAY' },
  { label: '[농협] NH농협 zgm.streaming (10% 할인)', value: 'NH_NONGHYUP_CARD_STREAMING' },
  { label: '[하나] 원스토어 1 하나카드 (원스토어 2% 할인)', value: 'HANA_CARD_ONESTORE' },
];

// 👈 [추가] 고유 카드 ID -> 백엔드 연산용 카드사 코드 변환 어댑터
export const CARD_CODE_MAP: Record<string, string> = {
  'SHINHAN_CARD_LINEAGE': 'SHINHAN_CARD',
  'SHINHAN_CARD_CHECK': 'SHINHAN_CARD',
  'SAMSUNG_CARD_MOBILE': 'SAMSUNG_CARD',
  'SAMSUNG_CARD_ID_SELECT': 'SAMSUNG_CARD',
  'SAMSUNG_CARD_ID_GLOBAL': 'SAMSUNG_CARD',
  'KB_KOOKMIN_CARD_NORI': 'KB_KOOKMIN_CARD',
  'NH_NONGHYUP_CARD_PLAY': 'NH_NONGHYUP_CARD',
  'NH_NONGHYUP_CARD_STREAMING': 'NH_NONGHYUP_CARD',
  'HANA_CARD_ONESTORE': 'HANA_CARD',
};

export const PLATFORM_CODE_MAP: Record<string, string> = {
  '구글 플레이 스토어': 'GOOGLE_PLAY',
  '원스토어': 'ONE_STORE',
  '갤럭시 스토어': 'GALAXY_STORE',
  '앱스토어': 'APP_STORE',
};

export const PAYMENT_METHOD_MAP: Record<string, string> = {
  'SKT': 'SKT',
  'KT': 'KT',
  'LGU+': 'LGU_PLUS',
  '네이버페이': 'NAVER_PAY',
  '카카오페이': 'KAKAO_PAY',
  '페이코': 'PAYCO',
  '토스페이': 'TOSS_PAY',
  '삼성페이': 'SAMSUNG_PAY',
  '애플페이': 'APPLE_PAY',
  '컬쳐랜드(우회/캐시)': 'CULTURELAND_CASH',
  '구글 핀번 기프트코드': 'GOOGLE_PLAY_GIFTCARD',
  '원스토어 핀번 기프트코드': 'ONESTORE_GIFTCARD',
  '북앤라이프': 'BOOKNLIFE_VOUCHER',
  '구글 플레이 스토어': 'GOOGLE_PLAY_STORE',
  '갤럭시 스토어': 'GALAXY_STORE',
  '원스토어': 'ONE_STORE',
  '신한카드': 'SHINHAN_CARD',
  '삼성카드': 'SAMSUNG_CARD',
  'KB국민카드': 'KB_KOOKMIN_CARD',
  'NH농협카드': 'NH_NONGHYUP_CARD',
  '하나카드': 'HANA_CARD',
};

const LAYER_NAME_MAP: Record<string, string> = {
  STORE_COUPON: '스토어 쿠폰',
  PAYMENT_PG: '간편결제/통신사',
  PAYMENT_E_PAY: '간편결제/통신사',
  CARD_ISSUER: '카드사 혜택',
  GIFT_CARD: '상품권 우회',
  ONLINE_CARD_ON_GIFTCARD: '상품권 카드결제 혜택',
  STORE_BASE_REWARD: '스토어 기본 적립',
};

const REVERSE_PAYMENT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_METHOD_MAP).map(([k, v]) => [v, k])
);

const BACKEND_API_URL = 'http://127.0.0.1:8000/routes';

// ==========================================
// 5. 백엔드 데이터 변환 어댑터
// ==========================================
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

      return {
        layerName: layerKorean,
        providerName: providerKorean,
        type: step.type,
        amount: step.applied_amount,
        eventName: step.item_or_event_name || `${providerKorean} ${layerKorean}`,
        conditionText: step.condition_raw_text || '상세 조건은 해당 스토어/결제사 이벤트를 확인하세요.',
        comboText: comboStr,
        targetGame: targetGame,
        isGameSpecific: isGameSpecific,
      };
    });

    // 혜택 타입(type) 기준으로 즉시 할인과 적립을 엄격하게 분리
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
        selectedProviders.push('GOOGLE_PLAY_GIFTCARD', 'ZEROPIN', 'GMARKET', '11STREET', 'SSG_COM', 'GOOGLE_PLAY_NAVER_STORE');
      } else if (v === '컬쳐랜드(우회/캐시)') {
        selectedProviders.push('CULTURELAND_CASH', 'CULTURELAND_VOUCHER');
      } else if (v === '북앤라이프') {
        selectedProviders.push('BOOKNLIFE_VOUCHER');
      } else if (PAYMENT_METHOD_MAP[v]) {
        selectedProviders.push(PAYMENT_METHOD_MAP[v]);
      }
    });
  }

  // 👈 [수정] 특화 카드 선택 시 고유 ID -> 백엔드 연산용 카드사 코드로 자동 변환
  if (formData.useSpecialOptions && formData.selectedSpecialCard !== 'NONE') {
    const cardCode = CARD_CODE_MAP[formData.selectedSpecialCard] || formData.selectedSpecialCard;
    selectedProviders.push(cardCode);
  }

  const targetPlatforms = formData.osType === 'ANDROID'
    ? formData.androidStores.map((s) => PLATFORM_CODE_MAP[s] || s)
    : ['APP_STORE'];

  const amountNum = Number(formData.amount) || 0;

  try {
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

      return fetch(BACKEND_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

export default function App() {
  const [formData, setFormData] = useState<FormData>({
    gameTitle: '쿠키런: 킹덤',
    osType: 'ANDROID',
    androidStores: ANDROID_STORE_OPTIONS,
    amount: 55000,
    isFirstPayment: false,
    hasPreApplied: false,
    useGameBenefits: true,

    googlePlayTier: 'GOLD',
    galaxyStoreTier: 'STANDARD',

    useCarriers: true,
    carriers: CARRIER_OPTIONS,

    usePays: true,
    pays: PAY_OPTIONS,

    useVoucherBypasses: true,
    voucherBypasses: VOUCHER_OPTIONS,

    useSpecialOptions: false,
    subscriptions: ['네이버플러스 멤버십 (+4% 적립)', 'T멤버십 (원스토어 10% 할인/적립)'],
    hasPrevSpend: true,
    isPcVersion: false,
    selectedSpecialCard: 'NONE',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  const handleToggleArrayItem = (field: keyof FormData, item: string) => {
    const currentArray = formData[field] as string[];
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter((i) => i !== item)
      : [...currentArray, item];

    setFormData({ ...formData, [field]: updatedArray });
  };

  const validateForm = (): boolean => {
    if (!formData.gameTitle.trim()) {
      alert('게임명을 입력해주세요.');
      return false;
    }
    if (formData.osType === 'ANDROID' && formData.androidStores.length === 0) {
      alert('사용 가능한 안드로이드 스토어를 최소 1개 이상 선택해주세요.');
      return false;
    }
    if (formData.amount === '' || Number(formData.amount) <= 0) {
      alert('결제 예정 금액을 1원 이상 입력해주세요.');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetchLowestPriceRecommendations(formData);
      if (response.status === 'SUCCESS') {
        setResults(response.data);
      } else {
        setError(response.message || '결과를 불러오지 못했습니다.');
      }
    } catch (err) {
      setError('최저가 경로 계산 중 네트워크 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const isGoogleSelected = formData.osType === 'ANDROID' && formData.androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = formData.osType === 'ANDROID' && formData.androidStores.includes('갤럭시 스토어');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* 상단 배너 */}
        <header className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg text-center">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2 backdrop-blur-sm">
            🎯 실시간 즉시 결제 전용 최저가 추천
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            쿠키런: 킹덤 최저가 결제 루트 안내
          </h1>
          <p className="text-sm mt-1 opacity-90">
            스토어 멤버십 & 우회 상품권 혜택까지 반영한 실시간 최적가 비교
          </p>
        </header>

        {/* 메인 입력 폼 */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 space-y-6">

          {/* [영역 1] OS 및 스토어 선택 */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">1. 스마트폰 OS 및 이용 스토어 선택</label>
            <div className="grid grid-cols-2 gap-3">
              {(['ANDROID', 'IOS'] as OsType[]).map((os) => (
                <button
                  key={os}
                  type="button"
                  onClick={() => setFormData({ ...formData, osType: os })}
                  className={`py-3 px-4 rounded-xl font-bold transition-all text-center border-2 ${
                    formData.osType === os
                      ? 'border-amber-500 bg-amber-50 text-amber-700 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                  }`}
                >
                  {os === 'ANDROID' ? '🤖 안드로이드 (구글/원스/갤스)' : '🍎 iOS (앱스토어)'}
                </button>
              ))}
            </div>

            {formData.osType === 'ANDROID' && (
              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 transition-all">
                <span className="text-xs font-bold text-amber-900 block">
                  🛒 이용 가능한 스토어 선택 (다중 선택 가능)
                </span>
                <div className="flex flex-wrap gap-2">
                  {ANDROID_STORE_OPTIONS.map((store) => {
                    const selected = formData.androidStores.includes(store);
                    return (
                      <button
                        type="button"
                        key={store}
                        onClick={() => handleToggleArrayItem('androidStores', store)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                          selected
                            ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{store}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 멤버십 등급 설정 */}
          {(isGoogleSelected || isGalaxySelected) && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 transition-all">
              <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1">
                💎 선택한 스토어의 멤버십 등급 설정
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isGoogleSelected && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Google Play Points 등급
                    </label>
                    <select
                      value={formData.googlePlayTier}
                      onChange={(e) => setFormData({ ...formData, googlePlayTier: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      {GOOGLE_PLAY_TIERS.map((tier) => (
                        <option key={tier.value} value={tier.value}>
                          {tier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {isGalaxySelected && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Galaxy Store 멤버십 등급
                    </label>
                    <select
                      value={formData.galaxyStoreTier}
                      onChange={(e) => setFormData({ ...formData, galaxyStoreTier: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                    >
                      {GALAXY_STORE_TIERS.map((tier) => (
                        <option key={tier.value} value={tier.value}>
                          {tier.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* [영역 2] 기본 결제 정보 & 토글 옵션 */}
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">게임명</label>
                <input
                  type="text"
                  value={formData.gameTitle}
                  onChange={(e) => setFormData({ ...formData, gameTitle: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="예: 쿠키런: 킹덤"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1">결제 예정 금액 (원)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value === '' ? '' : Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="금액 입력 (예: 55000)"
                />
              </div>
            </div>

            {/* 검색 옵션 토글 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="useGameBenefits"
                  checked={formData.useGameBenefits}
                  onChange={(e) => setFormData({ ...formData, useGameBenefits: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="useGameBenefits" className="text-xs font-bold text-slate-700 cursor-pointer">
                  🎮 선택한 게임 전용 혜택 포함
                </label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="hasPreApplied"
                  checked={formData.hasPreApplied}
                  onChange={(e) => setFormData({ ...formData, hasPreApplied: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="hasPreApplied" className="text-xs font-bold text-slate-700 cursor-pointer">
                  📝 사전 응모 완료 혜택 포함
                </label>
              </div>

              <div className="flex items-center space-x-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <input
                  type="checkbox"
                  id="firstPayment"
                  checked={formData.isFirstPayment}
                  onChange={(e) => setFormData({ ...formData, isFirstPayment: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <label htmlFor="firstPayment" className="text-xs font-bold text-slate-700 cursor-pointer">
                  🎉 첫 결제 이벤트 대상
                </label>
              </div>
            </div>
          </div>

          {/* [영역 3] 보유 메인 결제 수단 */}
          <div className="space-y-5 pt-2">
            <h3 className="text-base font-bold text-slate-800 border-b pb-2">
              2. 보유 중인 메인 결제 수단 선택
            </h3>

            {/* 통신사 할인 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">📱 통신사 할인</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-medium text-slate-500 hover:text-amber-600">
                  <input
                    type="checkbox"
                    checked={formData.useCarriers}
                    onChange={(e) => setFormData({ ...formData, useCarriers: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-400 border-slate-300"
                  />
                  <span>사용</span>
                </label>
              </div>
              <div className={`flex flex-wrap gap-2 transition-all ${formData.useCarriers ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                {CARRIER_OPTIONS.map((carrier) => {
                  const selected = formData.carriers.includes(carrier);
                  return (
                    <button
                      type="button"
                      key={carrier}
                      disabled={!formData.useCarriers}
                      onClick={() => handleToggleArrayItem('carriers', carrier)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {carrier}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 사용 간편결제 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">💸 사용 간편결제 (페이)</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-medium text-slate-500 hover:text-amber-600">
                  <input
                    type="checkbox"
                    checked={formData.usePays}
                    onChange={(e) => setFormData({ ...formData, usePays: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-400 border-slate-300"
                  />
                  <span>사용</span>
                </label>
              </div>
              <div className={`flex flex-wrap gap-2 transition-all ${formData.usePays ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                {PAY_OPTIONS.map((pay) => {
                  const selected = formData.pays.includes(pay);
                  return (
                    <button
                      type="button"
                      key={pay}
                      disabled={!formData.usePays}
                      onClick={() => handleToggleArrayItem('pays', pay)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {pay}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 문화상품권 & 우회 결제 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">🎟️ 문화상품권 & 우회 결제</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-semibold text-orange-600 hover:text-orange-700">
                  <input
                    type="checkbox"
                    checked={formData.useVoucherBypasses}
                    onChange={(e) => setFormData({ ...formData, useVoucherBypasses: e.target.checked })}
                    className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-400 border-slate-300"
                  />
                  <span>우회 사용하기</span>
                </label>
              </div>
              <div className={`flex flex-wrap gap-2 transition-all ${formData.useVoucherBypasses ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                {VOUCHER_OPTIONS.map((voucher) => {
                  const selected = formData.voucherBypasses.includes(voucher);
                  return (
                    <button
                      type="button"
                      key={voucher}
                      disabled={!formData.useVoucherBypasses}
                      onClick={() => handleToggleArrayItem('voucherBypasses', voucher)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {voucher}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* [영역 4] 구독 서비스 및 카드 선택 */}
          <div className="pt-2 border-t space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-800">
                3. 구독 서비스 및 세부 카드 선택 (옵션)
              </h3>
              <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 hover:bg-amber-100 transition-all">
                <input
                  type="checkbox"
                  checked={formData.useSpecialOptions}
                  onChange={(e) => setFormData({ ...formData, useSpecialOptions: e.target.checked })}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 border-slate-300 cursor-pointer"
                />
                <span>{formData.useSpecialOptions ? '옵션 닫기 ∧' : '옵션 적용하기 ∨'}</span>
              </label>
            </div>

            {formData.useSpecialOptions && (
              <div className="space-y-4 p-4 bg-slate-50/80 rounded-xl border border-slate-200 transition-all animate-fadeIn">
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">⭐ 이용 중인 유료 구독 서비스</span>
                  <div className="flex flex-wrap gap-2">
                    {SUBSCRIPTION_OPTIONS.map((sub) => {
                      const selected = formData.subscriptions.includes(sub);
                      return (
                        <button
                          type="button"
                          key={sub}
                          onClick={() => handleToggleArrayItem('subscriptions', sub)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                            selected
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{sub}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">
                    💳 보유 중인 인앱/게이밍 제휴 카드 선택 (스크롤 메뉴)
                  </label>
                  <select
                    value={formData.selectedSpecialCard}
                    onChange={(e) => setFormData({ ...formData, selectedSpecialCard: e.target.value })}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-700"
                  >
                    {SPECIAL_CARD_OPTIONS.map((card) => (
                      <option key={card.value} value={card.value}>
                        {card.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center space-x-2 p-2.5 bg-white rounded-lg cursor-pointer border border-slate-200 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.hasPrevSpend}
                      onChange={(e) => setFormData({ ...formData, hasPrevSpend: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300"
                    />
                    <span>카드 전월 실적 조건 충족 (20만~50만원 이상)</span>
                  </label>

                  <label className="flex items-center space-x-2 p-2.5 bg-white rounded-lg cursor-pointer border border-slate-200 text-xs font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.isPcVersion}
                      onChange={(e) => setFormData({ ...formData, isPcVersion: e.target.checked })}
                      className="w-4 h-4 text-amber-500 rounded focus:ring-amber-400 border-slate-300"
                    />
                    <span>PC 버전 (Google Play Games) 접속 결제</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-base rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? '실시간 최저가 경로 계산 중...' : '⚡ 실시간 최저가 경로 연산하기'}
          </button>
        </form>

        {/* [결과 출력 영역] */}
        {loading && (
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div>
            <p className="text-slate-600 font-bold">
              선택한 스토어 및 멤버십 등급 기반 실시간 최저가 경로 계산 중...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-6 rounded-2xl text-center space-y-3">
            <div className="text-2xl">⚠️</div>
            <h3 className="font-bold text-base">서버와 통신 중 오류가 발생했습니다.</h3>
            <p className="text-xs opacity-80">{error}</p>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-all cursor-pointer"
            >
              🔄 다시 시도하기
            </button>
          </div>
        )}

        {!loading && !error && results && (() => {
          if (results.length === 0) {
            return (
              <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center space-y-3">
                <div className="text-3xl">🔍</div>
                <h3 className="font-bold text-slate-800 text-base">해당 조건에 맞는 최저가 혜택이 없습니다.</h3>
              </div>
            );
          }

          return (
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">추천 결제 경로 Top 10</h2>
                <button
                  type="button"
                  onClick={() => setIsCriteriaModalOpen(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-amber-600 underline cursor-pointer"
                >
                  [환산 기준 보기]
                </button>
              </div>

              <div className="space-y-4">
                {results.map((item) => {
                  const isFirst = item.rank === 1;
                  return (
                    <div
                      key={item.rank}
                      onClick={() => setSelectedResultForDetail(item)}
                      className={`p-5 rounded-2xl bg-white transition-all border cursor-pointer hover:shadow-lg ${
                        isFirst
                          ? 'border-amber-400 ring-2 ring-amber-400/50 shadow-md relative'
                          : 'border-slate-200 hover:border-amber-300'
                      }`}
                    >
                      {/* 헤더 */}
                      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 border-b pb-3 gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span
                              className={`w-7 h-7 rounded-full flex items-center justify-center font-extrabold text-xs ${
                                isFirst ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {item.rank}
                            </span>
                            <h3 className="font-extrabold text-base text-slate-800">{item.title}</h3>
                          </div>
                          
                          <div className="flex items-center space-x-1.5 pt-0.5">
                            <span className="px-2.5 py-0.5 rounded-full bg-red-500 text-white font-black text-xs shadow-sm">
                              최대 {item.discount_rate}% 할인
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-orange-100 text-orange-800 font-bold text-[11px]">
                              총 {item.total_benefit_amount.toLocaleString()}원 혜택
                            </span>
                          </div>
                        </div>

                        <div className="text-left md:text-right space-y-0.5">
                          <div className="text-xs text-slate-400">
                            정가 <span className="line-through">{item.original_price.toLocaleString()}원</span>
                          </div>
                          <div className="text-xs font-bold text-slate-700">
                            결제창 금액: <span className="text-slate-900">{item.actual_payment_price.toLocaleString()}원</span>
                          </div>
                          <div className="text-lg md:text-xl font-black text-amber-600">
                            최종 체감가: {item.final_price.toLocaleString()}원
                          </div>
                        </div>
                      </div>

                      {/* 💳 1. 결제 시 즉시 할인 단계 */}
                      {item.discount_steps.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>💳 1. 결제 시 즉시 할인 단계</span>
                            <span className="text-[11px] text-amber-700 font-extrabold">
                              결제창 결제액: {item.actual_payment_price.toLocaleString()}원
                            </span>
                          </span>
                          <div className="space-y-1.5">
                            {item.discount_steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 bg-amber-50/50 rounded-xl border border-amber-100 text-xs"
                              >
                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                  <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 font-bold text-[10px]">
                                    {step.layerName}
                                  </span>
                                  
                                  {step.isGameSpecific ? (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px]">
                                      🎮 {step.targetGame === 'COOKIERUN_KINGDOM' ? '쿠키런 전용' : '게임 전용'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 font-medium text-[10px]">
                                      🌐 공통 혜택
                                    </span>
                                  )}

                                  <span className="font-bold text-slate-800">{step.providerName}</span>
                                  {step.comboText && (
                                    <span className="text-[11px] text-slate-500 font-medium">({step.comboText})</span>
                                  )}
                                </div>
                                <span className="font-bold text-red-600 whitespace-nowrap">
                                  -{step.amount.toLocaleString()}원 할인
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 🎁 2. 결제 후 적립 혜택 */}
                      {item.reward_steps.length > 0 && (
                        <div className="space-y-2 mb-3">
                          <span className="text-xs font-bold text-slate-700 flex items-center justify-between">
                            <span>🎁 2. 결제 후 적립 혜택</span>
                            <span className="text-[11px] text-emerald-700 font-extrabold">
                              총 +{item.reward_point.toLocaleString()}P 적립
                            </span>
                          </span>
                          <div className="space-y-1.5">
                            {item.reward_steps.map((step, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100 text-xs"
                              >
                                <div className="flex items-center space-x-2 flex-wrap gap-1">
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 font-bold text-[10px]">
                                    {step.layerName}
                                  </span>

                                  {step.isGameSpecific ? (
                                    <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 font-bold text-[10px]">
                                      🎮 {step.targetGame === 'COOKIERUN_KINGDOM' ? '쿠키런 전용' : '게임 전용'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-600 font-medium text-[10px]">
                                      🌐 공통 혜택
                                    </span>
                                  )}

                                  <span className="font-bold text-slate-800">{step.providerName}</span>
                                </div>
                                <span className="font-bold text-emerald-600 whitespace-nowrap">
                                  +{step.amount.toLocaleString()}P 적립
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 하단 요약 가이드 */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                        <span className="text-slate-500 text-[11px]">{item.guide_text}</span>
                        <span className="text-amber-600 font-bold text-[11px] hover:underline">
                          🔍 이벤트 상세 보기 ›
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })()}

        {/* [모달 1] 환산 기준 안내 */}
        {isCriteriaModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                💡 실시간 최저가 연산 기준 안내
              </h3>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>• <strong>스토어 멤버십 반영</strong>: 선택하신 구글 Play Points/갤럭시 스토어 등급별 적립률이 계산에 포함됩니다.</p>
                <p>• <strong>즉시 결제 원칙</strong>: 미션/출석체크를 제외하고 현시점 당장 결제 가능한 최대 할인 조합을 산출합니다.</p>
                <p>• <strong>1P = 1원 환산</strong>: 적립되는 포인트는 현금 동일 가치(1원)로 실질 체감가에 차감 계산됩니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCriteriaModalOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        )}

        {/* [모달 2] 상세 조건 모달 */}
        {selectedResultForDetail && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    {selectedResultForDetail.rank}위 최저가 경로 상세 정보
                  </span>
                  <h3 className="text-base font-extrabold text-slate-800 mt-1">
                    {selectedResultForDetail.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedResultForDetail(null)}
                  className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* 금액 계산서 요약표 */}
              <div className="bg-amber-50/80 p-4 rounded-xl border border-amber-200 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>정가</span>
                  <span>{selectedResultForDetail.original_price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center text-red-600 font-medium">
                  <span>(-) 즉시 할인 금액</span>
                  <span>-{selectedResultForDetail.immediate_discount_total.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center text-slate-900 font-bold border-t border-amber-200/80 pt-1.5">
                  <span>💳 실제 결제창 결제액</span>
                  <span className="text-sm">{selectedResultForDetail.actual_payment_price.toLocaleString()}원</span>
                </div>
                <div className="flex justify-between items-center text-emerald-600 font-medium">
                  <span>(-) 결제 후 적립 포인트</span>
                  <span>-{selectedResultForDetail.reward_point.toLocaleString()}P</span>
                </div>
                <div className="flex justify-between items-center text-amber-900 font-black border-t border-amber-300 pt-2 text-sm">
                  <span>🎉 최종 체감가</span>
                  <span className="text-base text-amber-600">{selectedResultForDetail.final_price.toLocaleString()}원</span>
                </div>
                <div className="text-right text-[11px] text-orange-800 font-bold pt-1">
                  (총 {selectedResultForDetail.total_benefit_amount.toLocaleString()}원 혜택 / {selectedResultForDetail.discount_rate}% 절감)
                </div>
              </div>

              {/* 💳 즉시 할인 이벤트 목록 */}
              {selectedResultForDetail.discount_steps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700">💳 결제 시 즉시 할인 이벤트</h4>
                  {selectedResultForDetail.discount_steps.map((step, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          {step.isGameSpecific ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                              🎮 {step.targetGame === 'COOKIERUN_KINGDOM' ? '쿠키런 전용' : '게임 전용'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                              🌐 공통 혜택
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-slate-800">{step.eventName}</span>
                        </div>
                        <span className="text-xs font-bold text-red-600">
                          -{step.amount.toLocaleString()}원 할인
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                        📝 <strong>상세 조건:</strong> {step.conditionText}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* 🎁 결제 후 적립 이벤트 목록 */}
              {selectedResultForDetail.reward_steps.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold text-slate-700">🎁 결제 후 적립 이벤트</h4>
                  {selectedResultForDetail.reward_steps.map((step, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          {step.isGameSpecific ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                              🎮 {step.targetGame === 'COOKIERUN_KINGDOM' ? '쿠키런 전용' : '게임 전용'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                              🌐 공통 혜택
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-slate-800">{step.eventName}</span>
                        </div>
                        <span className="text-xs font-bold text-emerald-600">
                          +{step.amount.toLocaleString()}P 적립
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                        📝 <strong>상세 조건:</strong> {step.conditionText}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={() => setSelectedResultForDetail(null)}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md"
              >
                닫기
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}