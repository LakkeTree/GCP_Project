import React, { useState } from 'react';



// ==========================================
// 1. 백엔드 (game pay api / main.py) 연동 스키마
// ==========================================
export interface RouteRequest {
  platform: string;           // "GOOGLE_PLAY", "ONE_STORE", "GALAXY_STORE", "APP_STORE"
  amount: number;             // 결제 예정 금액
  is_first_pay: boolean;      // 첫 결제 여부
  payment_methods: string[];  // 백엔드 Enum 매핑 코드 리스트
  game: string;               // "COOKIERUN_KINGDOM"
}

export interface RouteStep {
  layer: string;              // "STORE_COUPON", "PAYMENT_PG", "CARD_ISSUER", "GIFT_CARD"
  provider: string;           // "SHINHAN_CARD", "CULTURELAND_CASH" 등
  type: string;               // "DISCOUNT", "REWARD", "CASHBACK", "FEE"
  applied_amount: number;     // 적용 혜택 금액
  giftcard_combo?: number[];  // 상품권 우회 시 권종 조합
}

export interface RecommendedRoute {
  route_type: string;         // "DIRECT_PAYMENT", "GIFT_CARD"
  base_amount: number;        // 원금
  final_paid_amount: number;  // 실제 결제액
  reward_total: number;       // 총 적립 포인트
  net_cost: number;           // 실질 체감 비용 (결제액 - 적립금)
  leftover_balance: number;   // 잔액 (상품권 사용 시)
  steps: RouteStep[];
}

export interface BackendResponse {
  routes: RecommendedRoute[];
  warnings: Array<{ benefit_id: string; provider: string; conditions: string[] }>;
}

// ==========================================
// 2. 프론트엔드 UI 카드 출력용 데이터 타입
// ==========================================
export interface OptimizationResult {
  rank: number;                  // 순위 (1 ~ 10)
  platform: string;              // 플랫폼 명
  original_price: number;        // 정가 (원)
  final_price: number;           // 실 결제 체감 금액 (원)
  reward_point: number;          // 적립 예정 포인트 (원)
  apply_steps: string[];         // 즉시 할인/적립 적용 단계 리스트
  guide_text: string;            // 결제 안내 팁
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
export type SortOption = 'perceived' | 'immediate';

export interface FormData {
  gameTitle: string;             // 게임명
  osType: OsType;                // OS 선택 ('ANDROID' | 'IOS')
  androidStores: string[];       // 안드로이드 선택 시 세부 스토어 리스트
  amount: number | '';           // 결제 예정 금액
  isFirstPayment: boolean;       // 마켓 첫 결제 여부
  
  useCards: boolean;             // 카드 카테고리 활성화
  cards: string[];               // 보유 카드사 리스트
  
  useCarriers: boolean;          // 통신사 카테고리 활성화
  carriers: string[];            // 통신사 리스트
  
  usePays: boolean;              // 페이 카테고리 활성화
  pays: string[];                // 간편결제 리스트
  
  useVoucherBypasses: boolean;   // 문화상품권 카테고리 활성화
  voucherBypasses: string[];     // 문화상품권 우회 결제 수단 리스트
  
  sortOption: SortOption;        // 정렬 기준
}

// ==========================================
// 4. 입력 UI 옵션 상수
// ==========================================
export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARD_OPTIONS = ['삼성카드', '신한카드', 'KB국민카드', 'NH농협카드', '하나카드', '롯데카드', '현대카드'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
export const PAY_OPTIONS = ['삼성페이', '네이버페이', '페이코', '토스페이', '카카오페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프'
];

// ==========================================
// 5. BigQuery DB / main.py 연동 전용 코드 매핑 테이블
// ==========================================
export const PLATFORM_CODE_MAP: Record<string, string> = {
  '구글 플레이 스토어': 'GOOGLE_PLAY',
  '원스토어': 'ONE_STORE',
  '갤럭시 스토어': 'GALAXY_STORE',
  '앱스토어': 'APP_STORE',
};

export const PAYMENT_METHOD_MAP: Record<string, string> = {
  '삼성카드': 'SAMSUNG_CARD',
  '신한카드': 'SHINHAN_CARD',
  'KB국민카드': 'KB_CARD',
  'NH농협카드': 'NH_CARD',
  '하나카드': 'HANA_CARD',
  '롯데카드': 'LOTTE_CARD',
  '현대카드': 'HYUNDAI_CARD',
  'SKT': 'SKT',
  'KT': 'KT',
  'LGU+': 'LGU_PLUS',
  '삼성페이': 'SAMSUNG_PAY',
  '네이버페이': 'NAVER_PAY',
  '페이코': 'PAYCO',
  '토스페이': 'TOSS_PAY',
  '카카오페이': 'KAKAO_PAY',
  '컬쳐랜드(우회/캐시)': 'CULTURELAND_CASH',
  '구글 핀번 기프트코드': 'GOOGLE_PLAY_GIFTCARD',
  '원스토어 핀번 기프트코드': 'ONESTORE_GIFTCARD',
  '북앤라이프': 'CULTURELAND_PAYMENT',
};





// 백엔드 API 서버 기본 주소 (main.py / Dockerfile 기준 8000 포트)
const BACKEND_API_URL = 'http://127.0.0.1:8000/routes';

// 서버 오프라인 시 사용할 Fallback Mock 데이터
const MOCK_API_RESPONSE: ApiResponse = {
  status: 'SUCCESS',
  data: [
    {
      rank: 1,
      platform: '원스토어 (ONE_STORE)',
      original_price: 55000,
      final_price: 46500,
      reward_point: 1500,
      apply_steps: [
        '컬쳐랜드 상품권 7% 할인가 사전 구매 후 캐시 충전',
        '원스토어 결제 수단에서 컬쳐랜드 캐시선택 결제',
        'T멤버십 10% 차감 적립 혜택 즉시 적용'
      ],
      guide_text: '출석 미션 없이 당장 7% 할인된 상품권으로 우회 결제 시 가장 저렴합니다.'
    },
    {
      rank: 2,
      platform: '갤럭시 스토어 (GALAXY_STORE)',
      original_price: 55000,
      final_price: 50000,
      reward_point: 500,
      apply_steps: [
        '갤럭시 스토어 첫 결제 5,000원 즉시 할인 쿠폰 적용',
        '하나카드 결제 시 1% 추가 청구 할인 적용'
      ],
      guide_text: '첫 결제 쿠폰 적용 시 절차가 간편하며 카드 청구 할인까지 챙길 수 있습니다.'
    },
    {
      rank: 3,
      platform: '구글 플레이 (GOOGLE_PLAY)',
      original_price: 55000,
      final_price: 53350,
      reward_point: 1650,
      apply_steps: [
        '구글 플레이 인앱 결제 선택',
        '네이버페이 포인트/머니 결제 시 3% 포인트 적립'
      ],
      guide_text: '추가 우회 절차 없이 즉시 결제 가능한 경로 중 가장 적립율이 높습니다.'
    },
    {
      rank: 4,
      platform: '원스토어 (ONE_STORE - 삼성카드)',
      original_price: 55000,
      final_price: 53900,
      reward_point: 550,
      apply_steps: ['원스토어 삼성카드 즉시할인 2% 적용'],
      guide_text: '상품권 충전 절차 없이 카드로 즉시 결제할 때 유용한 경로입니다.'
    },
    {
      rank: 5,
      platform: '갤럭시 스토어 (GALAXY_STORE - 페이코)',
      original_price: 55000,
      final_price: 54450,
      reward_point: 1100,
      apply_steps: ['페이코 포인트 결제 1% 리워드 적립'],
      guide_text: '페이코 포인트를 보유 중일 때 추천하는 결제 수단입니다.'
    },
    {
      rank: 6,
      platform: '구글 플레이 (GOOGLE_PLAY - 카카오페이)',
      original_price: 55000,
      final_price: 54450,
      reward_point: 550,
      apply_steps: ['카카오페이 포인트 1% 기본 적립'],
      guide_text: '기본 구글 플레이 계정 결제 경로 중 하나입니다.'
    },
    {
      rank: 7,
      platform: '원스토어 (ONE_STORE - KT 소액결제)',
      original_price: 55000,
      final_price: 55000,
      reward_point: 2000,
      apply_steps: ['KT 소액결제 이벤트 대상 2,000P 캐시백 적립'],
      guide_text: '다음 달 통신비로 청구되는 결제 수단입니다.'
    },
    {
      rank: 8,
      platform: '갤럭시 스토어 (GALAXY_STORE - 토스페이)',
      original_price: 55000,
      final_price: 55000,
      reward_point: 500,
      apply_steps: ['토스 행운퀴즈 및 무작위 포인트 적용'],
      guide_text: '토스프라임 이용 시 추가 적립 혜택을 받습니다.'
    },
    {
      rank: 9,
      platform: '구글 플레이 (GOOGLE_PLAY - 신한카드)',
      original_price: 55000,
      final_price: 55000,
      reward_point: 275,
      apply_steps: ['신한 마이신한포인트 0.5% 기본 적립'],
      guide_text: '신한카드 기본 적립 혜택 적용 경로입니다.'
    },
    {
      rank: 10,
      platform: '구글 플레이 (GOOGLE_PLAY - 일반 카드)',
      original_price: 55000,
      final_price: 55000,
      reward_point: 0,
      apply_steps: ['할인 및 적립 혜택 없음 (정가 결제)'],
      guide_text: '별도 혜택 없이 정가로 결제되는 일반 경로입니다.'
    }
  ]
};

/**
 * 백엔드 RecommendedRoute 데이터를 UI 카드용 OptimizationResult 포맷으로 변환하는 어댑터
 */
// 백엔드 영문 레이어 코드를 한글 명칭으로 변환하는 매핑표
const LAYER_NAME_MAP: Record<string, string> = {
  STORE_COUPON: '스토어 쿠폰',
  PAYMENT_PG: '간편결제/통신사',
  CARD_ISSUER: '카드사 혜택',
  GIFT_CARD: '상품권 우회',
  ONLINE_CARD_ON_GIFTCARD: '상품권 카드결제 혜택',
};

// 백엔드 영문 제휴사 코드를 한글 명칭으로 역변환하는 매핑표
const REVERSE_PAYMENT_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(PAYMENT_METHOD_MAP).map(([k, v]) => [v, k])
);

/**
 * 백엔드 데이터를 한글 UI 카드 포맷으로 변환하는 어댑터
 */
const convertBackendRouteToUI = (
  routes: RecommendedRoute[],
  originalPrice: number
): OptimizationResult[] => {
  return routes.map((route, idx) => {
    // 혜택 단계 문구를 영문 코드에서 한글 명칭으로 변환
    const applySteps = route.steps.map((step) => {
      const layerKorean = LAYER_NAME_MAP[step.layer] || step.layer;
      const providerKorean = REVERSE_PAYMENT_MAP[step.provider] || step.provider;
      const amt = step.applied_amount.toLocaleString();

      if (step.layer === 'GIFT_CARD' && step.giftcard_combo) {
        const comboStr = step.giftcard_combo.map((c) => `${c.toLocaleString()}원`).join('+');
        return `[${layerKorean}] ${providerKorean} (${comboStr} 권종) - ${amt}원 할인`;
      }
      return `[${layerKorean}] ${providerKorean} - ${amt}원 ${step.type === 'REWARD' ? '적립' : '할인'}`;
    });

    // 가이드 팁 문구 가공
    let guideText = route.route_type === 'GIFT_CARD'
      ? '상품권 사전 할인 구매 후 결제하는 우회 경로입니다.'
      : '카드/간편결제 즉시 할인 및 적립 적용 경로입니다.';
    
    if (route.leftover_balance > 0) {
      guideText += ` (결제 후 잔액 ${route.leftover_balance.toLocaleString()}원 남음)`;
    }

    // 카드 상단 대표 타이틀 한글화
    const mainProvider = route.steps[0]?.provider || '일반 결제';
    const mainProviderKorean = REVERSE_PAYMENT_MAP[mainProvider] || mainProvider;

    return {
      rank: idx + 1,
      platform: `${mainProviderKorean} 경로`,
      original_price: originalPrice,
      final_price: route.net_cost,
      reward_point: route.reward_total,
      apply_steps: applySteps,
      guide_text: guideText,
    };
  });
};
/**
 * 실시간 최저가 연산 API 통신 모듈 (main.py 백엔드 실제 연동)
 */
export const fetchLowestPriceRecommendations = async (
  formData: FormData
): Promise<ApiResponse> => {
  // 1. 활성화된 카테고리의 결제수단만 영문 코드(Enum)로 추출
  const selectedProviders: string[] = [];
  if (formData.useCards) formData.cards.forEach((c) => PAYMENT_METHOD_MAP[c] && selectedProviders.push(PAYMENT_METHOD_MAP[c]));
  if (formData.useCarriers) formData.carriers.forEach((c) => PAYMENT_METHOD_MAP[c] && selectedProviders.push(PAYMENT_METHOD_MAP[c]));
  if (formData.usePays) formData.pays.forEach((p) => PAYMENT_METHOD_MAP[p] && selectedProviders.push(PAYMENT_METHOD_MAP[p]));
  if (formData.useVoucherBypasses) formData.voucherBypasses.forEach((v) => PAYMENT_METHOD_MAP[v] && selectedProviders.push(PAYMENT_METHOD_MAP[v]));

  // 2. 조회 대상 스토어 플랫폼 결정
  const targetPlatforms = formData.osType === 'ANDROID'
    ? formData.androidStores.map((s) => PLATFORM_CODE_MAP[s] || s)
    : ['APP_STORE'];

  const amountNum = Number(formData.amount) || 0;

  try {
    // 3. 선택된 플랫폼별로 main.py POST /routes API 병렬 요청
    const requests = targetPlatforms.map((platform) => {
      const payload: RouteRequest = {
        platform: platform,
        amount: amountNum,
        is_first_pay: formData.isFirstPayment,
        payment_methods: selectedProviders,
        game: formData.gameTitle === '쿠키런: 킹덤' ? 'COOKIERUN_KINGDOM' : 'ALL',
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

    // 4. 병렬 요청 결과 합산 및 체감가(net_cost) 기준 종합 정렬
    const responses = await Promise.all(requests);
    const combinedRoutes: RecommendedRoute[] = responses.flatMap((res) => res.routes || []);
    
    combinedRoutes.sort((a, b) => a.net_cost - b.net_cost);

    // 5. UI 포맷으로 변환하여 반환
    const convertedResults = convertBackendRouteToUI(combinedRoutes.slice(0, 10), amountNum);

    return {
      status: 'SUCCESS',
      data: convertedResults,
    };
  } catch (err) {
    console.warn('⚠️ 백엔드 API 연결 중 오류 발생. Fallback Mock 데이터를 표시합니다.', err);
    // API 연결에 실패하더라도 개발/테스트가 원활히 진행되도록 Mock 데이터를 반환합니다.
    return MOCK_API_RESPONSE;
  }
};




export default function App() {
  // 1. Form 및 UI 상태 관리
  const [formData, setFormData] = useState<FormData>({
    gameTitle: '쿠키런: 킹덤',
    osType: 'ANDROID',
    androidStores: ANDROID_STORE_OPTIONS, // 👈 안드로이드 스토어 전체 선택 (구글/원스/갤스)
    amount: 55000,
    isFirstPayment: false,
    
    useCards: true,
    cards: CARD_OPTIONS,                   // 👈 모든 카드사 전체 선택 (삼성, 신한, 국민, 농협, 하나, 롯데, 현대)
    
    useCarriers: true,
    carriers: CARRIER_OPTIONS,             // 👈 모든 통신사 전체 선택 (SKT, KT, LGU+)
    
    usePays: true,
    pays: PAY_OPTIONS,                     // 👈 모든 간편결제 전체 선택 (삼성페이, 네이버페이, 페이코, 토스페이, 카카오페이)
    
    useVoucherBypasses: true,
    voucherBypasses: VOUCHER_OPTIONS,     // 👈 모든 문화상품권/우회수단 전체 선택 (컬쳐랜드, 구글/원스 핀번, 북앤라이프)
    
    sortOption: 'perceived',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [showAll, setShowAll] = useState<boolean>(false);

  // 2. 다중 선택 체크박스/버튼 토글 헬퍼 함수
  const handleToggleArrayItem = (field: keyof FormData, item: string) => {
    const currentArray = formData[field] as string[];
    const updatedArray = currentArray.includes(item)
      ? currentArray.filter((i) => i !== item)
      : [...currentArray, item];

    setFormData({ ...formData, [field]: updatedArray });
  };

  // 3. 폼 유효성 검사
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

  // 4. 제출 핸들러
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);
    setShowAll(false);

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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-6">
        
        {/* 상단 프로토타입 안내 배너 */}
        <header className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-6 rounded-2xl shadow-lg text-center">
          <span className="inline-block px-3 py-1 bg-white/20 rounded-full text-xs font-semibold mb-2 backdrop-blur-sm">
            🎯 실시간 즉시 결제 전용 최저가 추천
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            쿠키런: 킹덤 최저가 결제 루트 안내
          </h1>
          <p className="text-sm mt-1 opacity-90">
            출석체크/장기 미션 제외! 지금 결제할 때 적용 가능한 최대 할인 경로
          </p>
        </header>

        {/* 메인 입력 폼 */}
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md border border-slate-100 space-y-6">
          
          {/* [영역 1] OS 선택 및 안드로이드 세부 스토어 선택 */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-slate-700">1. 사용 중인 스마트폰 OS 선택</label>
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
                  🛒 이용 가능한 안드로이드 스토어 선택 (다중 선택 가능)
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

          {/* [영역 2] 기본 결제 정보 */}
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

          {/* 첫 결제 여부 토글 */}
          <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl">
            <input
              type="checkbox"
              id="firstPayment"
              checked={formData.isFirstPayment}
              onChange={(e) => setFormData({ ...formData, isFirstPayment: e.target.checked })}
              className="w-5 h-5 text-amber-600 rounded focus:ring-amber-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="firstPayment" className="text-sm font-medium text-slate-700 cursor-pointer">
              해당 마켓 첫 결제 이벤트 대상자입니다. (첫 결제 혜택 포함 연산)
            </label>
          </div>

          {/* [영역 3] 보유 결제 수단 선택 */}
          <div className="space-y-5 pt-2">
            <h3 className="text-base font-bold text-slate-800 border-b pb-2">
              2. 현재 즉시 사용 가능한 결제 수단 선택
            </h3>

            {/* 카테고리 1: 보유 카드사 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">💳 보유 카드사</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-medium text-slate-500 hover:text-amber-600">
                  <input
                    type="checkbox"
                    checked={formData.useCards}
                    onChange={(e) => setFormData({ ...formData, useCards: e.target.checked })}
                    className="w-3.5 h-3.5 text-amber-500 rounded focus:ring-amber-400 border-slate-300"
                  />
                  <span>사용</span>
                </label>
              </div>
              <div className={`flex flex-wrap gap-2 transition-opacity ${formData.useCards ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
                {CARD_OPTIONS.map((card) => {
                  const selected = formData.cards.includes(card);
                  return (
                    <button
                      type="button"
                      key={card}
                      disabled={!formData.useCards}
                      onClick={() => handleToggleArrayItem('cards', card)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        selected
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                    >
                      {card}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 카테고리 2: 사용 통신사 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">📱 사용 통신사</span>
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
              <div className={`flex flex-wrap gap-2 transition-opacity ${formData.useCarriers ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
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

            {/* 카테고리 3: 사용 간편결제 (페이) */}
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
              <div className={`flex flex-wrap gap-2 transition-opacity ${formData.usePays ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
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

            {/* 카테고리 4: 문화상품권 & 우회 결제 수단 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">🎟️ 문화상품권 & 우회 결제 수단</span>
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
              <div className={`flex flex-wrap gap-2 transition-opacity ${formData.useVoucherBypasses ? 'opacity-100' : 'opacity-30 pointer-events-none'}`}>
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

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-base rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? '실시간 최저가 경로 계산 중...' : '⚡ 실시간 최저가 경로 연산하기'}
          </button>
        </form>




        {/* ========================================== */}
        {/* [4단계] 로딩 스피너, 결과 TOP 10, 예외 UI, 모달 */}
        {/* ========================================== */}

        {/* 1. 비동기 로딩 스피너 */}
        {loading && (
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div>
            <p className="text-slate-600 font-bold">
              선택한 마켓 및 결제 수단 기반 실시간 최저가 경로 계산 중...
            </p>
          </div>
        )}

        {/* 2. 에러 예외 화면 */}
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

        {/* 3. 연산 결과 출력 (Top 10 및 더보기 연동) */}
        {!loading && !error && results && (() => {
          if (results.length === 0) {
            return (
              <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center space-y-3">
                <div className="text-3xl">🔍</div>
                <h3 className="font-bold text-slate-800 text-base">해당 조건에 맞는 최저가 혜택이 없습니다.</h3>
                <p className="text-xs text-slate-500">
                  선택한 보유 결제 수단이나 스토어 옵션을 변경한 후 다시 계산해 보세요.
                </p>
              </div>
            );
          }

          const visibleResults = showAll ? results : results.slice(0, 3);

          return (
            <section className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-900">추천 결제 경로 Top 10</h2>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-amber-600 underline cursor-pointer"
                >
                  [환산 기준 보기]
                </button>
              </div>

              {/* 카드 리스트 */}
              <div className="space-y-4">
                {visibleResults.map((item) => {
                  const isFirst = item.rank === 1;
                  return (
                    <div
                      key={item.rank}
                      className={`p-6 rounded-2xl bg-white transition-all border ${
                        isFirst
                          ? 'border-amber-400 ring-2 ring-amber-400 shadow-xl relative'
                          : 'border-slate-200 shadow-sm'
                      }`}
                    >
                      {isFirst && (
                        <span className="absolute -top-3 right-6 bg-amber-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md">
                          👑 최저가 추천
                        </span>
                      )}

                      <div className="flex items-center justify-between border-b pb-3 mb-3">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-sm ${
                              isFirst ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {item.rank}
                          </span>
                          <h3 className="font-extrabold text-base text-slate-800">{item.platform}</h3>
                        </div>
                        <div className="text-right">
                          <span className="text-xs text-slate-400 line-through block">
                            정가 {item.original_price.toLocaleString()}원
                          </span>
                          <span className="text-xl font-black text-amber-600">
                            {item.final_price.toLocaleString()}원
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs text-slate-600 mb-4">
                        <p className="font-bold text-slate-700">📌 즉시 적용 혜택 단계:</p>
                        <ul className="list-disc pl-5 space-y-1">
                          {item.apply_steps.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="bg-slate-50 p-3 rounded-xl flex items-center justify-between text-xs">
                        <span className="text-slate-500">{item.guide_text}</span>
                        {item.reward_point > 0 && (
                          <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                            +{item.reward_point.toLocaleString()}P 적립
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 더보기 버튼 */}
              {!showAll && results.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="w-full py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                >
                  전체 결과 10개 더보기 (4~10위) ∨
                </button>
              )}

              {/* 접기 버튼 */}
              {showAll && results.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAll(false)}
                  className="w-full py-2.5 bg-slate-100 text-slate-500 font-semibold text-xs rounded-xl hover:bg-slate-200 transition-all cursor-pointer"
                >
                  상위 3개만 보기 (4~10위 접기) ∧
                </button>
              )}

              {/* 조건 재설정 버튼 */}
              <button
                type="button"
                onClick={() => {
                  setResults(null);
                  setShowAll(false);
                }}
                className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                🔄 결제 조건 다시 설정하기
              </button>
            </section>
          );
        })()}

        {/* 4. 환산 기준 모달 팝업 */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                💡 실시간 최저가 연산 기준 안내
              </h3>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>• <strong>즉시 결제 원칙</strong>: 출석체크, 누적 미션, 선착순 마감 가능성이 있는 조건은 모두 제외되어 있습니다.</p>
                <p>• <strong>1P = 1원 환산</strong>: 적립되는 네이버페이/T멤버십/스토어 포인트는 현금과 동일한 1원 가치로 단순 산산됩니다.</p>
                <p>• <strong>BigQuery 기반 연산</strong>: 백엔드 API(main.py)를 통해 BigQuery 실시간 수수료/혜택 데이터를 계산합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}