import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  SPECIAL_CARD_OPTIONS,
  CARD_CODE_MAP,
  PLATFORM_CODE_MAP,
  PAYMENT_METHOD_MAP,
  LAYER_NAME_MAP,
  REVERSE_PAYMENT_MAP,
  BACKEND_API_URL,
  getGameIcon,
  getGameStores,
} from '../constants/searchOptions';

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

export interface StepDetail {
  layerName: string;
  providerName: string;
  type: string;
  amount: number;
  ratePercent?: number;
  formattedAmountText: string;
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
  os: OsType;
  original_price: number;
  actual_payment_price: number;
  immediate_discount_total: number;
  discountRatePercent: number;
  reward_point: number;
  rewardRatePercent: number;
  final_price: number;
  total_benefit_amount: number;
  discount_rate: number;
  paymentRoute: string[];
  discountDetail: string;
  storeIcon: string;
  discount_steps: StepDetail[];
  reward_steps: StepDetail[];
  guide_text: string;
  appliedBonusBadges: string[];
}

type SortOption = 'BEST_PRICE' | 'POINT_FIRST' | 'DISCOUNT_RATE';

const formatEventTitle = (title: string): string => {
  if (!title) return '';
  return title
    .replace(/^\(더미\)\s*/, '')
    .replace(/^스토어별 첫 결제 혜택 -\s*/, '')
    // 💡 갤럭시 스토어 긴 홍보 문구 정제 추가
    .replace(/^혜택은 서포트,\s*게임은 퍼펙트\s*갤럭시 스토어\s*/, '')
    .replace(/<[^>]+>\s*이벤트\s*-\s*/, '')      // <8월 월간 쿠폰> 이벤트 - 부분 제거
    .replace(/할인 쿠폰$/, '쿠폰')
    .trim();
};

export default function SearchResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL 쿼리 파라미터 파싱
  const initialGame = searchParams.get('game') || '쿠키런: 킹덤';
  const initialAmount = Number(searchParams.get('amount')) || 150000;
  const initialOs = (searchParams.get('os') as OsType) || 'ANDROID';
  const initialStores = searchParams.get('stores') ? searchParams.get('stores')!.split(',') : ANDROID_STORE_OPTIONS;
  // 빈 문자열("")로 넘어왔을 때 VOUCHER_OPTIONS로 복원되는 버그 수정
  const rawCarriers = searchParams.get('carriers');
  const initialCarriers = rawCarriers !== null 
    ? (rawCarriers.trim() ? rawCarriers.split(',') : []) 
    : [];

  const rawPays = searchParams.get('pays');
  const initialPays = rawPays !== null 
    ? (rawPays.trim() ? rawPays.split(',') : PAY_OPTIONS) 
    : PAY_OPTIONS;

  const rawVouchers = searchParams.get('vouchers');
  const initialVouchers = rawVouchers !== null 
    ? (rawVouchers.trim() ? rawVouchers.split(',') : []) 
    : VOUCHER_OPTIONS;
  const initialSpecialCard = searchParams.get('specialCard') || 'NONE';
  const initialHasPrevSpend = searchParams.get('hasPrevSpend') === 'true';

  const initialGoogleTier = searchParams.get('googleTier') || 'GOLD';
  const initialGalaxyTier = searchParams.get('galaxyTier') || 'STANDARD';
  const initialIsPcVersion = searchParams.get('isPcVersion') === 'true';

  const initialUseGameBenefits = searchParams.get('useGameBenefits') !== 'false';
  const initialHasPreApplied = searchParams.get('hasPreApplied') === 'true';
  const initialIsFirstPayment = searchParams.get('isFirstPayment') !== 'false';

  // 우측 필터 폼 상태
  const [gameTitle, setGameTitle] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);
  const [osType, setOsType] = useState<OsType>(initialOs);
  const [androidStores, setAndroidStores] = useState<string[]>(initialStores);

  const [googlePlayTier] = useState(initialGoogleTier);
  const [galaxyStoreTier] = useState(initialGalaxyTier);
  const [isPcVersion] = useState(initialIsPcVersion);

  const [useTMembership, setUseTMembership] = useState(true);

  const [useCarriers, setUseCarriers] = useState(initialCarriers.length > 0);
  const [carriers, setCarriers] = useState<string[]>(initialCarriers);

  const [usePays, setUsePays] = useState(initialPays.length > 0);
  const [pays, setPays] = useState<string[]>(initialPays);

  const [useVoucherBypasses, setUseVoucherBypasses] = useState(initialVouchers.length > 0);
  // OFF 상태로 넘어와도 선택 가능한 전체 옵션 목록은 기본 세팅해둠
  const [vouchers, setVouchers] = useState<string[]>(
    initialVouchers.length > 0 ? initialVouchers : VOUCHER_OPTIONS
  );

  const [useSpecialOptions, setUseSpecialOptions] = useState(initialSpecialCard !== 'NONE');
  const [selectedSpecialCard, setSelectedSpecialCard] = useState(initialSpecialCard);
  const [hasPrevSpend, setHasPrevSpend] = useState(initialHasPrevSpend);

  const [useGameBenefits, setUseGameBenefits] = useState(initialUseGameBenefits);
  const [hasPreApplied, setHasPreApplied] = useState(initialHasPreApplied);
  const [isFirstPayment, setIsFirstPayment] = useState(initialIsFirstPayment);

  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');

  // 로딩, 결과, 에러 상태
  const [loading, setLoading] = useState<boolean>(false);
  const [rawResultsList, setRawResultsList] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 모달 제어 상태
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  // 배열 항목 토글 처리 헬퍼 함수
  const handleToggleArray = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // 백엔드 API 연동 함수
  const fetchBackendData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const selectedProviders: string[] = [];

    if (useCarriers) {
      carriers.forEach((c) => PAYMENT_METHOD_MAP[c] && selectedProviders.push(PAYMENT_METHOD_MAP[c]));
    }
    if (usePays) {
      pays.forEach((p) => PAYMENT_METHOD_MAP[p] && selectedProviders.push(PAYMENT_METHOD_MAP[p]));
    }
    if (useVoucherBypasses) {
      vouchers.forEach((v) => {
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

    if (useSpecialOptions && selectedSpecialCard !== 'NONE') {
      const cardCode = CARD_CODE_MAP[selectedSpecialCard] || selectedSpecialCard;
      selectedProviders.push(cardCode);
    }

    const targetPlatforms = osType === 'ANDROID'
      ? androidStores.map((s) => PLATFORM_CODE_MAP[s] || s)
      : ['APP_STORE'];

    const amountNum = payAmount > 0 ? payAmount : 150000;

    try {
      const requests = targetPlatforms.map((platform) => {
        let tier = 'STANDARD';
        if (platform === 'GOOGLE_PLAY') tier = googlePlayTier;
        if (platform === 'GALAXY_STORE') tier = galaxyStoreTier;

        const payload = {
          platform: platform,
          amount: amountNum,
          is_first_pay: isFirstPayment,
          payment_methods: selectedProviders,
          game: gameTitle === '쿠키런: 킹덤' ? 'COOKIERUN_KINGDOM' : 'ALL',
          membership_tier: tier,
          has_subscription: useSpecialOptions,
          has_prev_spend: useSpecialOptions ? hasPrevSpend : false,
          has_pre_applied: hasPreApplied,
          use_game_benefits: useGameBenefits,
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

      const bonusBadges: string[] = [];
      if (useGameBenefits) bonusBadges.push('🎮 게임 전용 혜택');
      if (hasPreApplied) bonusBadges.push('📝 사전 응모 완료');
      if (isFirstPayment) bonusBadges.push('🎉 첫 결제 대상');

      const converted: OptimizationResult[] = combinedRoutes.map((route, idx) => {
        const routeProviders: string[] = [];
        let adjustedRewardTotal = 0; // ✅ 보정된 적립 금액 합계 변수

        const stepsDetailed: StepDetail[] = route.steps.map((step) => {
          const layerKorean = LAYER_NAME_MAP[step.layer] || step.layer;
          const providerKorean = REVERSE_PAYMENT_MAP[step.provider] || step.provider;
          if (providerKorean && !routeProviders.includes(providerKorean)) {
            routeProviders.push(providerKorean);
          }

          let comboStr = '';
          if (step.layer === 'GIFT_CARD' && step.giftcard_combo) {
            comboStr = step.giftcard_combo.map((c) => `${c.toLocaleString()}원`).join('+');
          }

          const targetGame = step.target_game || 'ALL';
          const isGameSpecific = targetGame !== 'ALL';

          // ✅ 구글 플레이 포인트 10원 단위 절사(버림) 및 금액 보정
          let effectiveAmount = step.applied_amount;
          let formattedText = '';

          if (step.type === 'DISCOUNT' || step.type === 'FEE') {
            formattedText = `-${step.applied_amount.toLocaleString()}원 할인`;
          } else if (step.provider === 'GOOGLE_PLAY') {
            // 구글: 10원당 1pt (100pt = 1,000원)
            const nativePt = Math.floor(step.applied_amount / 10);
            effectiveAmount = nativePt * 10;
            adjustedRewardTotal += effectiveAmount;
            formattedText = `+${nativePt.toLocaleString()}pt (${effectiveAmount.toLocaleString()}원)`;
          } else {
            // 원스토어/네이버페이 등 1:1 적립: (870pt = 870원)
            adjustedRewardTotal += step.applied_amount;
            formattedText = `+${step.applied_amount.toLocaleString()}pt (${step.applied_amount.toLocaleString()}원)`;
          }

          // 이름 중복 정리 (예: "스토어 등급별 적립률 - 적립률" -> "스토어 등급별 적립률")
          let rawEventName = step.item_or_event_name && step.item_or_event_name.trim() !== ''
            ? step.item_or_event_name
            : `${providerKorean} ${layerKorean}`;
          
          if (rawEventName.includes(' 적립률 - 적립률')) {
            rawEventName = rawEventName.replace(' 적립률 - 적립률', ' 적립률');
          }

          // 💡 정제 헬퍼 함수를 실제로 적용!
          const realEventName = formatEventTitle(rawEventName);

          const realConditionText = step.condition_raw_text && step.condition_raw_text.trim() !== ''
            ? step.condition_raw_text
            : '상세 조건은 해당 스토어/결제사 이벤트를 확인하세요.';

          const stepRate = amountNum > 0 ? Math.round((effectiveAmount / amountNum) * 1000) / 10 : 0;

          return {
            layerName: layerKorean,
            providerName: providerKorean,
            type: step.type,
            amount: effectiveAmount,
            ratePercent: stepRate,
            formattedAmountText: formattedText,
            eventName: realEventName,
            conditionText: realConditionText,
            comboText: comboStr,
            targetGame: targetGame,
            isGameSpecific: isGameSpecific,
          };
        });

        const discountSteps = stepsDetailed.filter((s) => s.type === 'DISCOUNT' || s.type === 'FEE');
        const rewardSteps = stepsDetailed.filter((s) => s.type === 'REWARD' || s.type === 'CASHBACK');

        const actualPaymentPrice = route.final_paid_amount;
        const immediateDiscountTotal = Math.max(0, amountNum - actualPaymentPrice);
        
        // ✅ 1,000원 정확 보정 적용
        const rewardPointTotal = adjustedRewardTotal; 
        const netCost = actualPaymentPrice - rewardPointTotal; // 77,000 - 1,000 = 76,000원
        const totalBenefitAmount = immediateDiscountTotal + rewardPointTotal; // 23,000 + 1,000 = 24,000원
        const discountRate = amountNum > 0 ? Math.round((totalBenefitAmount / amountNum) * 1000) / 10 : 0;

        const discountRatePercent = amountNum > 0 ? Math.round((immediateDiscountTotal / amountNum) * 1000) / 10 : 0;
        const rewardRatePercent = amountNum > 0 ? Math.round((rewardPointTotal / amountNum) * 1000) / 10 : 0;

        const knownStores = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어', '앱스토어'];
        const foundStore = routeProviders.find((p) => knownStores.includes(p));

        let displayPlatform = '구글 플레이 스토어';
        if (foundStore) {
          displayPlatform = foundStore;
        } else if (osType === 'IOS') {
          displayPlatform = '앱스토어';
        } else if (androidStores.length === 1) {
          displayPlatform = androidStores[0];
        }

        let storeIcon = '🛍️';
        if (displayPlatform.includes('구글')) storeIcon = '🤖';
        if (displayPlatform.includes('갤럭시')) storeIcon = '🌌';
        if (displayPlatform.includes('원스토어')) storeIcon = '🛍️';
        if (osType === 'IOS' || displayPlatform.includes('앱스토어')) storeIcon = '🍎';

        const routeTitle = routeProviders.length > 0
          ? `[${routeProviders.slice(0, 2).join(' + ')}] 최적 조합`
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
          platform: displayPlatform,
          os: osType,
          original_price: amountNum,
          actual_payment_price: actualPaymentPrice,
          immediate_discount_total: immediateDiscountTotal,
          discountRatePercent: discountRatePercent,
          reward_point: rewardPointTotal,
          rewardRatePercent: rewardRatePercent,
          final_price: netCost,
          total_benefit_amount: totalBenefitAmount,
          discount_rate: discountRate,
          paymentRoute: routeProviders.length > 0 ? routeProviders : ['기본 인앱 결제'],
          discountDetail: `즉시 할인 ${discountRatePercent}% + 포인트 적립 ${rewardRatePercent}%`,
          storeIcon: storeIcon,
          discount_steps: discountSteps,
          reward_steps: rewardSteps,
          guide_text: guideText,
          appliedBonusBadges: bonusBadges,
        };
      });

      setRawResultsList(converted);
    } catch (err) {
      console.error('API Error:', err);
      setError('백엔드 연산 서버(http://127.0.0.1:8000)에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [
    osType, androidStores, payAmount, isFirstPayment, useCarriers, carriers,
    usePays, pays, useVoucherBypasses, vouchers, useSpecialOptions,
    selectedSpecialCard, googlePlayTier, galaxyStoreTier, hasPrevSpend,
    hasPreApplied, useGameBenefits, gameTitle
  ]);

  useEffect(() => {
    fetchBackendData();
  }, [fetchBackendData]);

  // 정렬 탭 선택에 따른 결과 동적 재정렬
  const resultsList = useMemo(() => {
    const list = [...rawResultsList];
    if (sortOption === 'BEST_PRICE') {
      list.sort((a, b) => a.final_price - b.final_price);
    } else if (sortOption === 'POINT_FIRST') {
      list.sort((a, b) => b.reward_point - a.reward_point);
    } else if (sortOption === 'DISCOUNT_RATE') {
      list.sort((a, b) => b.discount_rate - a.discount_rate);
    }
    return list.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rawResultsList, sortOption]);

  // 실시간 스토어별 1위 최저가 집계 연산
  const storeComparisonData = useMemo(() => {
    const map: Record<string, { minPrice: number; originalPrice: number; discountRate: number; routeTitle: string; icon: string }> = {};

    rawResultsList.forEach((item) => {
      if (!map[item.platform] || item.final_price < map[item.platform].minPrice) {
        map[item.platform] = {
          minPrice: item.final_price,
          originalPrice: item.original_price,
          discountRate: item.discount_rate,
          routeTitle: item.title,
          icon: item.storeIcon,
        };
      }
    });

    return Object.entries(map).map(([platform, data]) => ({
      platform,
      ...data,
    })).sort((a, b) => a.minPrice - b.minPrice);
  }, [rawResultsList]);

  const handleReSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!gameTitle.trim()) {
      alert('게임을 선택하거나 입력해 주세요.');
      return;
    }

    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(payAmount),
      os: osType,
      stores: osType === 'IOS' ? '앱스토어' : androidStores.join(','),
      googleTier: googlePlayTier,
      galaxyTier: galaxyStoreTier,
      isPcVersion: String(isPcVersion),
      useGameBenefits: String(useGameBenefits),
      hasPreApplied: String(hasPreApplied),
      isFirstPayment: String(isFirstPayment),
      carriers: useCarriers ? carriers.join(',') : '',
      pays: usePays ? pays.join(',') : '',
      vouchers: useVoucherBypasses ? vouchers.join(',') : '',
      specialCard: selectedSpecialCard,
      hasPrevSpend: String(hasPrevSpend),
    });

    navigate(`/search-result?${params.toString()}`);
    fetchBackendData();
  };

const isOneStoreSelected = osType === 'ANDROID' && androidStores.includes('원스토어');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* [좌측 8열] 메인 검색 타이틀 & 연산 카드 리스트 */}
        <main className="lg:col-span-8 space-y-5">
          
          {/* 상단 타이틀 배너 */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-black text-cyan-800 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-200">
                  실시간 최저가 연산 완료
                </span>
              </div>

              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <span className="text-4xl shrink-0 leading-none">
                  {getGameIcon(gameTitle)}
                </span>

                <div className="flex items-center flex-wrap gap-1.5">
                  <input
                    type="text"
                    value={gameTitle}
                    onChange={(e) => setGameTitle(e.target.value)}
                    style={{ width: `${Math.max(gameTitle.length * 1.5 + 2, 7)}rem` }}
                    className="text-2xl md:text-3xl font-black text-cyan-600 bg-transparent border-b-2 border-cyan-400 focus:outline-none focus:border-cyan-600 px-1 py-0.5 max-w-[280px] md:max-w-[360px]"
                    placeholder="게임명 입력"
                  />
                  <span className="text-2xl md:text-3xl font-black text-slate-900 whitespace-nowrap">
                    에 관한 검색 결과
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs pt-0.5">
                <div className="flex items-center space-x-1 text-slate-500 font-bold">
                  <span>기준 결제 금액:</span>
                  <span className="text-slate-800 font-black">{payAmount.toLocaleString()}원</span>
                </div>

                <div className="h-3 w-[1px] bg-slate-300 hidden sm:block" />

                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400 font-bold text-[11px]">지원 스토어:</span>
                  <div className="flex flex-wrap gap-1">
                    {getGameStores(gameTitle).map((store) => (
                      <span
                        key={store}
                        className="text-[10px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                      >
                        {store}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={(e) => handleReSearch(e)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>🔄</span>
                <span>다시 검색 (재연산)</span>
              </button>
            </div>
          </div>

          {/* 정렬 탭 바 & 환산 기준 모달 / 스토어별 비교 버튼 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-bold text-slate-500">
                총 <strong className="text-cyan-600">{resultsList.length}개</strong>의 추천 결제 경로
              </span>
              <button
                type="button"
                onClick={() => setIsCriteriaModalOpen(true)}
                className="text-xs font-semibold text-slate-500 hover:text-cyan-600 underline cursor-pointer"
              >
                [환산 기준 보기]
              </button>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(true)}
                className="text-xs font-extrabold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded border border-cyan-300 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
              >
                <span>📊</span>
                <span>스토어별 최저가 비교</span>
              </button>
            </div>

            <div className="flex items-center space-x-2">
              {(
                [
                  { id: 'BEST_PRICE', label: '최적 체감가 순' },
                  { id: 'POINT_FIRST', label: '최대 적립 순' },
                  { id: 'DISCOUNT_RATE', label: '최대 할인율 순' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSortOption(tab.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    sortOption === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

{/* 로딩 스켈레톤 (실제 결과 카드 뼈대 연출) */}
          {loading && (
            <div className="space-y-3">
              {/* 상단 로딩 상태 안내 문구 (점 애니메이션 연출) */}
              <div className="p-3 bg-cyan-50/90 border border-cyan-200 rounded-xl flex items-center justify-between shadow-2xs">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-black text-cyan-950 tracking-wide flex items-center gap-1">
                    <span>최저가 연산 중</span>
                    <span className="inline-flex items-center space-x-0.5 ml-0.5">
                      <span className="animate-bounce font-black text-cyan-600" style={{ animationDelay: '0ms' }}>.</span>
                      <span className="animate-bounce font-black text-cyan-600" style={{ animationDelay: '150ms' }}>.</span>
                      <span className="animate-bounce font-black text-cyan-600" style={{ animationDelay: '300ms' }}>.</span>
                    </span>
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-cyan-800 bg-white px-2.5 py-0.5 rounded-full border border-cyan-200 shadow-2xs">
                  실시간 계산 중 ⚡
                </span>
              </div>

              {/* 스켈레톤 카드 3개 연속 출력 */}
              {[1, 2, 3].map((skeletonIdx) => (
                <div
                  key={skeletonIdx}
                  className="rounded-xl border border-slate-200 bg-white grid grid-cols-1 md:grid-cols-12 overflow-hidden shadow-xs animate-pulse"
                >
                  {/* [좌측 3열] 등수 & 스토어 뼈대 */}
                  <div className="md:col-span-3 p-5 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-4">
                    <div className="w-16 h-6 bg-slate-200 rounded-md"></div>
                    <div className="space-y-1.5">
                      <div className="w-12 h-3 bg-slate-200 rounded"></div>
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 bg-slate-300 rounded-full shrink-0"></div>
                        <div className="w-24 h-5 bg-slate-300 rounded"></div>
                      </div>
                    </div>
                  </div>

                  {/* [중앙 6열] 결제 경로 & 이벤트 태그 뼈대 */}
                  <div className="md:col-span-6 p-5 flex flex-col justify-between space-y-4">
                    <div className="space-y-2">
                      <div className="w-28 h-3 bg-slate-200 rounded"></div>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-6 bg-slate-200 rounded"></div>
                        <div className="w-4 h-3 bg-slate-200 rounded"></div>
                        <div className="w-24 h-6 bg-slate-200 rounded"></div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      <div className="flex space-x-2">
                        <div className="w-28 h-5 bg-red-100 rounded"></div>
                        <div className="w-28 h-5 bg-emerald-100 rounded"></div>
                      </div>
                      <div className="w-3/4 h-3 bg-slate-200 rounded"></div>
                    </div>
                  </div>

                  {/* [우측 3열] 할인율 & 가격 뼈대 */}
                  <div className="md:col-span-3 p-5 bg-rose-50/30 border-t md:border-t-0 md:border-l border-rose-100 flex flex-col justify-between items-end text-right space-y-4">
                    <div className="w-20 h-6 bg-red-200/70 rounded"></div>
                    <div className="space-y-1.5 text-right w-full flex flex-col items-end">
                      <div className="w-16 h-3 bg-slate-200 rounded"></div>
                      <div className="w-28 h-6 bg-slate-300 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 에러 상태 */}
          {!loading && error && (
            <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center space-y-2">
              <p className="text-xs font-bold text-rose-700">{error}</p>
              <p className="text-[11px] text-slate-500">백엔드 서버(`main.py`)가 8000번 포트에서 실행 중인지 확인해주세요.</p>
            </div>
          )}

          {/* 실시간 BigQuery DB 연산 결과 카드 리스트 */}
          {!loading && !error && (
            <div className="space-y-3">
              {resultsList.length === 0 ? (
                <div className="p-8 md:p-12 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-4 shadow-2xs">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center text-3xl mx-auto border border-slate-200">
                    🔍
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="text-base font-black text-slate-800">
                      조건에 맞는 최저가 경로가 없습니다
                    </h4>
                    <p className="text-xs text-slate-500 leading-relaxed font-medium">
                      보유하신 결제 수단이나 이용 스토어가 모두 해제되어 있을 수 있습니다. 우측 필터에서 조건(페이, 문화상품권 등)을 추가해 보세요!
                    </p>
                  </div>
                  
                  <div className="pt-2 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setUsePays(true);
                        setUseVoucherBypasses(true);
                        setUseCarriers(true);
                      }}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                    >
                      ⚡ 주요 결제 수단 한 번에 모두 켜기
                    </button>
                  </div>
                </div>
              ) : (
                resultsList.map((item) => {
                  let cardStyle = 'border-slate-200 bg-white';
                  let rankStyle = 'bg-slate-700 text-white';

                  if (item.rank === 1) {
                    cardStyle = 'border-cyan-400 ring-2 ring-cyan-400/30 bg-white shadow-sm';
                    rankStyle = 'bg-amber-500 text-white';
                  } else if (item.rank === 2) {
                    cardStyle = 'border-slate-300 ring-1 ring-slate-300 bg-white shadow-sm';
                    rankStyle = 'bg-slate-600 text-white';
                  } else if (item.rank === 3) {
                    cardStyle = 'border-amber-700/40 ring-1 ring-amber-600/20 bg-white shadow-sm';
                    rankStyle = 'bg-amber-700 text-white';
                  }

                  return (
                    <div
                      key={item.rank}
                      onClick={() => setSelectedResultForDetail(item)}
                      className={`rounded-2xl border transition-all hover:shadow-lg grid grid-cols-1 md:grid-cols-12 overflow-hidden cursor-pointer ${cardStyle}`}
                    >
                      {/* 1. [좌측 2.5열] 등수 배지 + 스토어 (세로 공간 밀도 있게 채움) */}
                      <div className="md:col-span-3 lg:col-span-2.5 p-4 md:p-5 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-center space-y-3 shrink-0">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2.5 py-1 rounded-lg text-xs md:text-sm font-black shadow-2xs ${rankStyle}`}>
                            {item.rank}등
                          </span>

                          {item.rank === 1 && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-2 py-0.5 rounded-md border border-amber-300 shadow-2xs whitespace-nowrap">
                              최고 추천 👍
                            </span>
                          )}
                        </div>

                        {/* 사용 스토어 박스 */}
                        <div className="p-3 bg-white rounded-xl border border-slate-200/70 shadow-2xs space-y-1">
                          <span className="text-[10px] text-slate-400 font-extrabold block tracking-tight">
                            결제 추천 스토어
                          </span>
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xl md:text-2xl shrink-0 leading-none">
                              {item.storeIcon}
                            </span>
                            <span className="font-black text-slate-900 text-xs sm:text-sm md:text-base whitespace-nowrap tracking-tight">
                              {item.platform}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* 2. [중앙 6.5열] 정렬된 쿠폰 및 적립 혜택 레이아웃 */}
                      <div className="md:col-span-6 lg:col-span-6.5 p-4 md:p-5 flex flex-col justify-between space-y-3 min-w-0">
                        {/* 결제 경로 및 보너스 태그 */}
                        <div className="space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-extrabold block">
                            결제 진행 수단 및 경로
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.paymentRoute.map((step: string, idx: number) => (
                              <React.Fragment key={idx}>
                                <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded-lg border border-slate-200/80">
                                  {step}
                                </span>
                                {idx < item.paymentRoute.length - 1 && (
                                  <span className="text-slate-300 font-bold text-xs">➔</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {item.appliedBonusBadges && item.appliedBonusBadges.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {item.appliedBonusBadges.map((badge, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="text-[10px] font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200/70"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 적용 쿠폰 & 적립 혜택 (정렬 및 여백 균형 조정) */}
                        <div className="pt-2.5 border-t border-slate-100 space-y-2">
                          <div className="flex items-start text-xs font-bold">
                            <span className="w-20 shrink-0 text-slate-500 font-extrabold flex items-center gap-1">
                              <span>🎫</span>
                              <span>적용 쿠폰</span>
                            </span>
                            <div className="flex-1 flex flex-wrap gap-1">
                              {item.discount_steps.length > 0 ? (
                                item.discount_steps.map((dStep, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="inline-flex items-center gap-1.5 bg-rose-50/90 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200/80 text-[10.5px] font-extrabold max-w-[280px] sm:max-w-[340px] md:max-w-[400px] overflow-hidden"
                                  >
                                    {/* 텍스트가 너무 길면 말줄임표(...) 처리되며 우측 영역 침범 불가 */}
                                    <span className="truncate min-w-0 flex-1">
                                      {dStep.eventName}
                                    </span>
                                    <span className="text-rose-600 font-black shrink-0 whitespace-nowrap">
                                      (-{dStep.amount.toLocaleString()}원)
                                    </span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 font-medium text-[11px]">
                                  쿠폰 미적용 (기존 인앱결제)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-start text-xs font-bold">
                            <span className="w-20 shrink-0 text-slate-500 font-extrabold flex items-center gap-1">
                              <span>🎁</span>
                              <span>적립 혜택</span>
                            </span>
                            <div className="flex-1 flex flex-wrap gap-1.5">
                              {item.reward_steps.length > 0 ? (
                                item.reward_steps.map((rStep, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="inline-flex flex-wrap items-center gap-1 bg-emerald-50/90 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200/80 text-[10.5px] font-extrabold leading-tight"
                                  >
                                    <span>{rStep.eventName}</span>
                                    <span className="text-emerald-700 font-black whitespace-nowrap">
                                      ({rStep.formattedAmountText})
                                    </span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 font-medium text-[11px]">
                                  적립 포인트 없음
                                </span>
                              )}
                            </div>
                          </div>

                          {/* 요약 태그 바 */}
                          <div className="flex items-center space-x-2 text-[11px] font-black pt-1">
                            {item.discountRatePercent > 0 && (
                              <span className="text-rose-700 bg-rose-50/90 px-2 py-0.5 rounded-md border border-rose-200/60">
                                총 할인 {item.discountRatePercent}% (-{item.immediate_discount_total.toLocaleString()}원)
                              </span>
                            )}
                              {item.rewardRatePercent > 0 && (
                                <span className="text-emerald-800 bg-emerald-50/90 px-2 py-0.5 rounded-md border border-emerald-200/60">
                                  총 적립 {item.rewardRatePercent}% (+{item.reward_point.toLocaleString()}원 상당)
                                </span>
                              )}
                          </div>
                        </div>
                      </div>

                      {/* 3. [우측 3열] 톤다운 가격 수치 */}
                      <div className="md:col-span-3 lg:col-span-3 p-4 md:p-5 bg-slate-50/40 border-t md:border-t-0 md:border-l border-slate-200/80 flex flex-col justify-between items-end text-right space-y-3 shrink-0">
                        <div className="text-right space-y-1.5 w-full">
                          <div className="flex items-center justify-end">
                            <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-xs rounded-md shadow-2xs">
                              실질 {item.discount_rate}% OFF
                            </span>
                          </div>

                          <div className="space-y-1 pt-1 text-[11px]">
                            {item.immediate_discount_total > 0 && (
                              <div className="flex justify-between items-center text-rose-700 font-extrabold bg-rose-50/80 px-2 py-0.5 rounded border border-rose-100">
                                <span>즉시할인</span>
                                <span>-{item.immediate_discount_total.toLocaleString()}원</span>
                              </div>
                            )}

                            {item.reward_steps.length > 0 ? (
                              item.reward_steps.map((rStep, rIdx) => {
                                const isGoogle = rStep.providerName.includes('GOOGLE') || rStep.providerName.includes('구글');
                                const nativePt = isGoogle ? Math.floor(rStep.amount / 10) : rStep.amount;
                                const cashVal = isGoogle ? nativePt * 10 : rStep.amount;

                                // 우측 박스 폭에 맞춰 '포인트' 단어 제거 (네이버페이 포인트 -> 네이버페이)
                                let nameLabel = isGoogle
                                  ? '구글'
                                  : rStep.providerName.replace(/ P$/, '').replace(/ 포인트$/, '');

                                return (
                                  <div
                                    key={rIdx}
                                    className="flex justify-between items-center text-emerald-800 font-extrabold bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-100 gap-1 text-[10px] sm:text-[10.5px]"
                                  >
                                    <span className="shrink-0 font-bold whitespace-nowrap">{nameLabel}</span>
                                    <span className="text-right whitespace-nowrap font-black">
                                      +{nativePt.toLocaleString()}pt ({cashVal.toLocaleString()}원)
                                    </span>
                                  </div>
                                );
                              })
                            ) : (


                              item.reward_point > 0 && (
                                <div className="flex justify-between items-center text-emerald-800 font-extrabold bg-emerald-50/80 px-2 py-0.5 rounded border border-emerald-100">
                                  <span>포인트 적립</span>
                                  <span>+{item.reward_point.toLocaleString()}P</span>
                                </div>
                              )
                            )}
                          </div>
                        </div>

                        <div className="w-full pt-2 border-t border-slate-200/80 text-right space-y-1">
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold">
                            <span>정가</span>
                            <span className="line-through">{payAmount.toLocaleString()}원</span>
                          </div>

                          <div className="flex justify-between items-center text-xs font-black text-slate-800">
                            <span>💳 실제 결제액</span>
                            <span>{item.actual_payment_price.toLocaleString()}원</span>
                          </div>

                          <div className="flex justify-between items-center pt-1.5 border-t border-slate-200">
                            <span className="text-xs font-black text-cyan-950">🎉 실질 체감가</span>
                            <span className="text-xl font-black text-cyan-600">
                              {item.final_price.toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

        </main>

        {/* [우측 4열] 스티키 사이드바 */}
        <aside className="lg:col-span-4 h-full space-y-5">
          
{/* 1. 모바일 대응 우측 필터 카드 */}
          <form
            onSubmit={handleReSearch}
            className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-sm space-y-4"
          >
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-1.5">
                <span>🎛️</span>
                <span>실시간 필터 조절</span>
              </h3>
              <span className="text-[10px] text-cyan-600 bg-cyan-50 font-bold px-2 py-0.5 rounded border border-cyan-200">
                실시간 연산
              </span>
            </div>

            {/* 스마트폰 OS (모바일 터치 크기 확대) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 block">스마트폰 OS</span>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setOsType('ANDROID')}
                  className={`py-2.5 rounded-lg transition-all cursor-pointer text-xs md:text-sm min-h-[44px] flex items-center justify-center ${
                    osType === 'ANDROID'
                      ? 'bg-slate-900 text-white font-black shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  안드로이드
                </button>
                <button
                  type="button"
                  onClick={() => setOsType('IOS')}
                  className={`py-2.5 rounded-lg transition-all cursor-pointer text-xs md:text-sm min-h-[44px] flex items-center justify-center ${
                    osType === 'IOS'
                      ? 'bg-slate-900 text-white font-black shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  iOS
                </button>
              </div>
            </div>

            {/* 결제 금액 수정 (모바일 패딩 확대) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 block">결제 금액 수정</span>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-xs md:text-sm rounded-xl border border-slate-300 bg-slate-50 font-black text-slate-900 focus:outline-none focus:bg-white transition-all pr-8 min-h-[44px]"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">원</span>
              </div>
            </div>

            {/* 이용 스토어 필터 태그 (터치 영역 확보) */}
            {osType === 'ANDROID' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">이용 스토어 필터</span>
                <div className="flex flex-wrap gap-2">
                  {ANDROID_STORE_OPTIONS.map((st: string) => {
                    const selected = androidStores.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleToggleArray(setAndroidStores, st)}
                        className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all cursor-pointer min-h-[40px] flex items-center ${
                          selected
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{st}
                      </button>
                    );
                  })}
                </div>

                {isOneStoreSelected && (
                  <div className="pt-1 animate-fadeIn">
                    <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={useTMembership}
                        onChange={(e) => setUseTMembership(e.target.checked)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0"
                      />
                      <span className="text-xs font-bold text-slate-800">T멤버십 이용 중 (원스토어 10% 할인)</span>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* 보유 결제 수단 필터 (통신사/간편결제/상품권 모바일 터치 대응) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-black text-slate-900 block">보유 결제 수단 필터</span>

              {/* 통신사 토글 */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    id="resCarriersToggle"
                    checked={useCarriers}
                    onChange={(e) => setUseCarriers(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs md:text-sm font-extrabold text-slate-800 select-none">
                    통신사 할인 사용하기
                  </span>
                </label>
                
                <div className={`flex flex-wrap gap-1.5 pl-1 transition-all ${useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {CARRIER_OPTIONS.map((c: string) => {
                    const selected = carriers.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!useCarriers}
                        onClick={() => handleToggleArray(setCarriers, c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all min-h-[36px] ${
                          selected && useCarriers
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 간편결제 토글 */}
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    id="resPaysToggle"
                    checked={usePays}
                    onChange={(e) => setUsePays(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs md:text-sm font-extrabold text-slate-800 select-none">
                    사용 간편결제 (페이) 선택
                  </span>
                </label>

                <div className={`flex flex-wrap gap-1.5 pl-1 transition-all ${usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {PAY_OPTIONS.map((p: string) => {
                    const selected = pays.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!usePays}
                        onClick={() => handleToggleArray(setPays, p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all min-h-[36px] ${
                          selected && usePays
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 💡 [여기서부터 새로 들어가는 문화상품권 블록] */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    id="resVoucherToggle"
                    checked={useVoucherBypasses}
                    onChange={(e) => {
                      setUseVoucherBypasses(e.target.checked);
                      if (e.target.checked && vouchers.length === 0) {
                        setVouchers([...VOUCHER_OPTIONS]);
                      }
                    }}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs md:text-sm font-extrabold text-slate-800 select-none">
                    문화상품권 우회 충전 할인
                  </span>
                </label>

                <div
                  className={`flex flex-wrap gap-1.5 pl-1 transition-all ${
                    useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  {VOUCHER_OPTIONS.map((v: string) => {
                    const selected = vouchers.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!useVoucherBypasses}
                        onClick={() => handleToggleArray(setVouchers, v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all min-h-[36px] ${
                          selected && useVoucherBypasses
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{v}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>


            {/* 💳 제휴 카드 선택 (옵션) */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 block">제휴 카드 선택 (옵션)</span>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSpecialOptions}
                    onChange={(e) => setUseSpecialOptions(e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 shrink-0"
                  />
                  <span className="text-[11px] font-bold text-cyan-700">옵션 {useSpecialOptions ? '열림' : '닫힘'}</span>
                </label>
              </div>

              {useSpecialOptions && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <select
                    value={selectedSpecialCard}
                    onChange={(e) => setSelectedSpecialCard(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-slate-50 font-bold text-slate-900 focus:outline-none focus:bg-white transition-all min-h-[40px]"
                  >
                    {SPECIAL_CARD_OPTIONS.map((card: { label: string; value: string }) => (
                      <option key={card.value} value={card.value}>
                        {card.label}
                      </option>
                    ))}
                  </select>

                  {selectedSpecialCard !== 'NONE' && (
                    <label className="flex items-center space-x-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer min-h-[40px]">
                      <input
                        type="checkbox"
                        checked={hasPrevSpend}
                        onChange={(e) => setHasPrevSpend(e.target.checked)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0"
                      />
                      <span className="text-xs font-bold text-slate-800">카드 전월 실적 충족 (20만~50만원)</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* 기타 혜택 터치 영역 확대 */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <span className="text-xs font-black text-slate-900 block">기타 혜택</span>

              <div className="space-y-2 text-xs md:text-sm font-extrabold text-slate-800">
                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={useGameBenefits}
                    onChange={(e) => setUseGameBenefits(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0"
                  />
                  <span>🎮 게임 전용 혜택 포함</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={hasPreApplied}
                    onChange={(e) => setHasPreApplied(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0"
                  />
                  <span>📝 사전 응모 완료 혜택</span>
                </label>

                <label className="flex items-center space-x-3 cursor-pointer p-2 rounded-xl hover:bg-slate-50 transition-colors min-h-[40px]">
                  <input
                    type="checkbox"
                    checked={isFirstPayment}
                    onChange={(e) => setIsFirstPayment(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 shrink-0"
                  />
                  <span>🎉 첫 결제 이벤트 대상</span>
                </label>
              </div>
            </div>
          </form>

          {/* 확장된 스티키 광고 */}
          <div className="sticky top-28 min-h-[550px] p-6 bg-slate-100 rounded-xl border border-slate-200/80 flex flex-col items-center justify-between text-center space-y-6 shadow-inner">
            <span className="px-3 py-1 bg-slate-800 text-white font-bold text-[10px] rounded tracking-wider">ADVERTISEMENT</span>
            
            <div className="space-y-5 my-auto">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-3xl font-black text-slate-400 shadow-sm border border-slate-200 mx-auto animate-pulse">
                📢
              </div>
              
              <div className="space-y-2">
                <h3 className="font-black text-slate-800 text-sm md:text-base">협업 제휴 프로모션</h3>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[160px] mx-auto font-medium">
                  게임별 스토어 & 제휴 카드사 전용 특별 혜택 및 광고 영역입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 font-bold space-y-1">
                <p>💡 실시간 제휴 입점 문의</p>
                <p className="text-[10px] text-slate-400 font-normal">맞춤형 타겟팅 배너 게재</p>
              </div>
            </div>

            <button className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer">
              신청하기
            </button>
          </div>

        </aside>

      </div>

      {/* 환산 기준 안내 모달 */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
              💡 실시간 최저가 연산 기준 안내
            </h3>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>• <strong>스토어 멤버십 반영</strong>: 구글 Play Points / 갤럭시 스토어 등급별 적립률이 실시간 연산에 포함됩니다.</p>
              <p>• <strong>즉시 결제 원칙</strong>: 미션/출석체크를 제외하고 당장 결제 가능한 최대 할인 조합을 산출합니다.</p>
              <p>• <strong>1P = 1원 환산</strong>: 적립되는 포인트는 현금 동일 가치(1원)로 실질 체감가에 차감 계산됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCriteriaModalOpen(false)}
              className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

      {/* 스토어별 1위 최저가 비교 모달 */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <span>📊</span>
                <span>스토어별 1위 최저가 비교표</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 font-medium">
              선택하신 조건 내에서 각 스토어별로 산출된 <strong>1등 최저가 경로</strong> 비교표입니다.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {storeComparisonData.map((store, idx) => (
                <div
                  key={store.platform}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 ${
                    idx === 0
                      ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-400/30'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xl">{store.icon}</span>
                      <span className="font-extrabold text-slate-800 text-xs">{store.platform}</span>
                    </div>
                    {idx === 0 && (
                      <span className="text-[10px] font-black text-amber-800 bg-amber-200 px-2 py-0.5 rounded-full">
                        전체 1위 스토어 👑
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-400 font-medium line-through block">
                      {store.originalPrice.toLocaleString()}원
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {store.minPrice.toLocaleString()}원
                    </span>
                    <span className="text-xs font-extrabold text-red-600 ml-2">
                      ({store.discountRate}% 절감)
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 font-medium bg-white p-2 rounded border border-slate-100 truncate">
                    💡 {store.routeTitle}
                  </p>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCompareModalOpen(false)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 카드 클릭 시 세부 결제 경로 모달 (바깥 회색 배경 클릭 시 바로 닫힘) */}
      {selectedResultForDetail && (
        <div
          onClick={() => setSelectedResultForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
        >
          {/* e.stopPropagation()으로 모달 박스 클릭 시 닫히는 현상 방지 */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto cursor-default"
          >
            
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-bold text-cyan-600 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
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
            <div className="bg-cyan-50/80 p-4 rounded-xl border border-cyan-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>정가</span>
                <span>{selectedResultForDetail.original_price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-red-600 font-medium">
                <span>(-) 즉시 할인 금액 ({selectedResultForDetail.discountRatePercent}%)</span>
                <span>-{selectedResultForDetail.immediate_discount_total.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 font-bold border-t border-cyan-200/80 pt-1.5">
                <span>💳 실제 결제창 결제액</span>
                <span className="text-sm">{selectedResultForDetail.actual_payment_price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 font-medium">
                <span>(-) 결제 후 적립 포인트 ({selectedResultForDetail.rewardRatePercent}%)</span>
                <span>-{selectedResultForDetail.reward_point.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-cyan-900 font-black border-t border-cyan-300 pt-2 text-sm">
                <span>🎉 최종 체감가</span>
                <span className="text-base text-cyan-600">{selectedResultForDetail.final_price.toLocaleString()}원</span>
              </div>
              <div className="text-right text-[11px] text-cyan-800 font-bold pt-1">
                (총 {selectedResultForDetail.total_benefit_amount.toLocaleString()}원 혜택 / 실질 {selectedResultForDetail.discount_rate}% 절감)
              </div>
            </div>

            {/* 즉시 할인 단계 */}
            {selectedResultForDetail.discount_steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700">💳 결제 시 즉시 할인 이벤트</h4>
                {selectedResultForDetail.discount_steps.map((step, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        {step.isGameSpecific ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                            🎮 {step.targetGame} 전용
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            🌐 공통 혜택
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-slate-800">{step.eventName}</span>
                      </div>
                      <span className="text-xs font-bold text-red-600">
                        -{step.amount.toLocaleString()}원 할인 {step.ratePercent ? `(${step.ratePercent}%)` : ''}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                      📝 <strong>상세 조건:</strong> {step.conditionText}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 결제 후 적립 단계 */}
            {selectedResultForDetail.reward_steps.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-extrabold text-slate-700">🎁 결제 후 적립 이벤트</h4>
                {selectedResultForDetail.reward_steps.map((step, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5">
                        {step.isGameSpecific ? (
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                            🎮 {step.targetGame} 전용
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-md">
                            🌐 공통 혜택
                          </span>
                        )}
                        <span className="text-xs font-extrabold text-slate-800">{step.eventName}</span>
                      </div>

                      <span className="text-xs font-bold text-emerald-600">
                        {step.formattedAmountText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                      📝 <strong>상세 조건:</strong> {step.conditionText}
                    </p>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}