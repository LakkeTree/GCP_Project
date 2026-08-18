import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import type { OsType } from '../constants/searchOptions';
import { getGameCode } from '../constants/gameMapping';
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
} from '../constants/searchOptions';

// 💡 영문명 한글화 및 긴 이벤트명 자동 요약 단축 함수
// 💡 영문명 한글화 및 긴 이벤트명 자동 요약 단축 함수
const formatMethodName = (text: string) => {
  if (!text) return '';
  return text
    .replace(/갤럭시 스토어\s*\d+월 모바일 게임 월간 할인 쿠폰 이벤트\s*-\s*/g, '갤스 월간 쿠폰 ')
    .replace(/한여름 쿠폰 WAVE,\s*팔팔한 혜택이 밀려온다\s*-\s*/g, '갤스 한여름 WAVE ')
    .replace(/혜택은 서포트,\s*게임은 퍼펙트\s*갤럭시 스토어\s*/g, '갤스 ')
    .replace(/스토어별 첫 결제 혜택\s*-\s*/g, '첫 결제 ')
    .replace(/CU_CONVENIENCE_STORE/g, 'CU 편의점')
    .replace(/GOOGLE_PLAY_Giftcard\/Voucher/g, '구글 기프트카드 할인')
    .replace(/GOOGLE_PLAY_Giftcard/g, '구글 기프트카드')
    .replace(/Giftcard\/Voucher/g, '기프트카드 할인')
    .replace(/GOOGLE_PLAY_NAVER_STORE/g, '네이버 스토어')
    .replace(/ZEROPIN/g, '제로핀')
    .replace(/GOOGLE_PLAY/g, '구글 플레이')
    .replace(/GALAXY_STORE/g, '갤럭시 스토어')
    .replace(/ONE_STORE/g, '원스토어')
    .replace(/APP_STORE/g, '앱스토어')
    .replace(/SAMSUNG_PAY/g, '삼성페이')
    .replace(/KAKAO_PAY/g, '카카오페이')
    .replace(/TOSS_PAY/g, '토스페이')
    .replace(/NAVER_PAY/g, '네이버페이');
};

// 💡 [상품권 핀번호 입력 절차 포함] 동적 상세 경로 안내 생성 함수
const getUsageGuide = (pathText: string) => {
  const text = pathText.toUpperCase();

  if (text.includes('CU')) {
    return '💡 결제 경로 가이드: CU 편의점/Pocket CU 앱에서 구글 기프트카드 구매 ➔ 영수증/카드 핀번호(코드) 입력 ➔ 구글 스토어 충전 후 결제';
  }
  if (text.includes('ZEROPIN') || text.includes('제로핀')) {
    return '💡 결제 경로 가이드: 제로핀 공식몰에서 기프트코드 할인 구매 ➔ 발급된 핀번호 입력 및 스토어 충전 ➔ 인앱 결제 진행';
  }
  if (text.includes('CULTURELAND') || text.includes('컬쳐랜드') || text.includes('북앤라이프')) {
    return '💡 결제 경로 가이드: 문화상품권 할인 구매 ➔ 해당 컬쳐캐시/상품권 핀번호 입력 충전 ➔ 스토어 우회 결제 적용';
  }
  if (text.includes('NAVER') && (text.includes('STORE') || text.includes('스토어'))) {
    return '💡 결제 경로 가이드: 네이버 스마트스토어 공식 판매처 구매 ➔ 문자/알림톡 기프트코드 핀번호 입력 ➔ 스토어 등록 후 결제';
  }
  if (text.includes('삼성페이') || text.includes('SAMSUNG_PAY')) {
    return '💡 결제 경로 가이드: 스토어 쿠폰함에서 할인 쿠폰 받기 ➔ 게임 결제창 접속 ➔ 삼성페이 선택하여 즉시 결제';
  }
  if (text.includes('갤럭시') || text.includes('GALAXY')) {
    return '💡 결제 경로 가이드: 갤럭시 스토어 [쿠폰함] 쿠폰 다운로드 ➔ 게임 결제창에서 쿠폰 적용 후 선택 결제 수단으로 결제';
  }
  if (text.includes('원스토어') || text.includes('ONE_STORE')) {
    return '💡 결제 경로 가이드: 원스토어 [혜택/쿠폰함] 쿠폰 및 T멤버십 할인 선택 ➔ 결제 수단 최종 확인 후 결제';
  }
  if (text.includes('구글') || text.includes('GOOGLE')) {
    return '💡 결제 경로 가이드: 구글 플레이 [혜택] 탭 쿠폰 적용 확인 ➔ 게임 인앱 결제창에서 보유 수단으로 진행';
  }
  
  return '💡 결제 경로 가이드: 해당 스토어 쿠폰함에서 이벤트 쿠폰 적용 ➔ 지정된 결제 수단 선택 후 최종 결제 진행';
};

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
    .replace(/^혜택은 서포트,\s*게임은 퍼펙트\s*갤럭시 스토어\s*/, '')
    .replace(/<[^>]+>\s*이벤트\s*-\s*/, '')
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

  // 필터 및 입력 상태
  const [gameTitle, setGameTitle] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);
  const [osType, setOsType] = useState<OsType>(initialOs);
  const [androidStores, setAndroidStores] = useState<string[]>(initialStores);

  // 💡 상태 변경 함수(setGooglePlayTier, setGalaxyStoreTier) 추가
  const [googlePlayTier, setGooglePlayTier] = useState(initialGoogleTier);
  const [galaxyStoreTier, setGalaxyStoreTier] = useState(initialGalaxyTier);
  const [isPcVersion] = useState(initialIsPcVersion);

  const [useTMembership, setUseTMembership] = useState(true);

  const [useCarriers, setUseCarriers] = useState(initialCarriers.length > 0);
  const [carriers, setCarriers] = useState<string[]>(initialCarriers);

  const [usePays, setUsePays] = useState(initialPays.length > 0);
  const [pays, setPays] = useState<string[]>(initialPays);

  const [useVoucherBypasses, setUseVoucherBypasses] = useState(initialVouchers.length > 0);
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

  // 데이터/로딩/모달 제어 상태
  const [loading, setLoading] = useState<boolean>(false);
  const [rawResultsList, setRawResultsList] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  const handleToggleArray = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // 백엔드 연산 API 통신
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
        game: getGameCode(gameTitle), // 👈 121개 게임 동적 변환 함수 적용
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
        let adjustedRewardTotal = 0;

        const stepsDetailed: StepDetail[] = route.steps
          .filter((step) => step.applied_amount > 0)
          .map((step) => {
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

          let effectiveAmount = step.applied_amount;
          let formattedText = '';

          if (step.type === 'DISCOUNT' || step.type === 'FEE') {
            formattedText = `-${step.applied_amount.toLocaleString()}원 할인`;
          } else if (step.provider === 'GOOGLE_PLAY') {
            const nativePt = Math.floor(step.applied_amount / 10);
            effectiveAmount = nativePt * 10;
            adjustedRewardTotal += effectiveAmount;
            formattedText = `+${nativePt.toLocaleString()}pt (${effectiveAmount.toLocaleString()}원)`;
          } else {
            adjustedRewardTotal += step.applied_amount;
            formattedText = `+${step.applied_amount.toLocaleString()}pt (${step.applied_amount.toLocaleString()}원)`;
          }

          let rawEventName = step.item_or_event_name && step.item_or_event_name.trim() !== ''
            ? step.item_or_event_name
            : `${providerKorean} ${layerKorean}`;
          
          if (rawEventName.includes(' 적립률 - 적립률')) {
            rawEventName = rawEventName.replace(' 적립률 - 적립률', ' 적립률');
          }

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
        
        const rewardPointTotal = adjustedRewardTotal; 
        const netCost = actualPaymentPrice - rewardPointTotal;
        const totalBenefitAmount = immediateDiscountTotal + rewardPointTotal;
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

  // 💡 DB에서 전체 게임 목록(아이콘, 회사명) 수집 상태
  // 💡 DB에서 스토어 지원 목록(stores) 포함 수집
  const [allGames, setAllGames] = useState<{ id: string; name: string; company: string; icon_url: string; stores?: string[] }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // 백엔드 DB에서 실제 게임 목록 & 아이콘 수집
  useEffect(() => {
    fetch('http://127.0.0.1:8000/games')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          setAllGames(result.data);
        }
      })
      .catch((err) => console.error('게임 DB 수집 실패:', err));
  }, []);

// 현재 입력된 게임명에 해당하는 DB 객체 (이미지 URL 추출용)
  const currentGameObj = allGames.find((g) => g.name === gameTitle);

  // 💡 DB 스토어명과 프론트엔드 스토어 옵션 매칭 검사 함수
  const isStoreSupported = (storeName: string, supportedStores?: string[]) => {
    if (!supportedStores || supportedStores.length === 0) return true;
    return supportedStores.some((s) => {
      const normS = s.trim().toLowerCase();
      const normStore = storeName.trim().toLowerCase();
      if (normStore.includes('구글') && (normS.includes('구글') || normS.includes('google'))) return true;
      if (normStore.includes('원스') && (normS.includes('원스') || normS.includes('one'))) return true;
      if (normStore.includes('갤럭시') && (normS.includes('갤스') || normS.includes('갤럭시') || normS.includes('galaxy'))) return true;
      if ((normStore.includes('앱스토어') || normStore.includes('ios')) && (normS.includes('앱스토어') || normS.includes('ios') || normS.includes('애플') || normS.includes('apple'))) return true;
      return normS.includes(normStore) || normStore.includes(normS);
    });
  };

  // 💡 게임 변경 시 미지원 스토어 자동 선택 해제
  useEffect(() => {
    if (currentGameObj?.stores && currentGameObj.stores.length > 0) {
      setAndroidStores((prev) => prev.filter((st) => isStoreSupported(st, currentGameObj.stores)));
    }
  }, [gameTitle, currentGameObj]);

  // 실시간 입력어 기반 자동완성 필터링

  // 실시간 입력어 기반 자동완성 필터링
  const suggestedGames = gameTitle.trim()
    ? allGames.filter(
        (g) =>
          g.name.toLowerCase().includes(gameTitle.toLowerCase()) ||
          g.company.toLowerCase().includes(gameTitle.toLowerCase())
      )
    : [];

  // 💡 [핵심] 필터 변경 시 자동 연산 방지 ➔ 최초 페이지 진입 시에만 1회 연산
  useEffect(() => {
    fetchBackendData();
    // eslint-disable-next-deps-no-warning
  }, []);

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
  
  // 💡 구글 / 갤럭시 스토어 선택 여부 변수 추가
  const isGoogleSelected = osType === 'ANDROID' && androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = osType === 'ANDROID' && androidStores.includes('갤럭시 스토어');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
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
                {/* 🖼️ 보라색 이모티콘 대신 DB에서 불러온 실제 고화질 게임 아이콘 표출 */}
                {currentGameObj?.icon_url ? (
                  <img
                    src={currentGameObj.icon_url}
                    alt={gameTitle}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://via.placeholder.com/48?text=🎮';
                    }}
                  />
                ) : (
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-slate-200 flex items-center justify-center text-xl shrink-0 border border-slate-300">
                    🎮
                  </div>
                )}

                <div className="flex items-center flex-wrap gap-1.5 relative">
                  {/* 검색창 & 자동완성 드롭다운 */}
                  <div className="relative inline-block">
                    <input
                      type="text"
                      value={gameTitle}
                      onChange={(e) => {
                        setGameTitle(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      style={{ width: `${Math.max(gameTitle.length * 1.5 + 2, 7)}rem` }}
                      className="text-2xl md:text-3xl font-black text-cyan-600 bg-transparent border-b-2 border-cyan-400 focus:outline-none focus:border-cyan-600 px-1 py-0.5 max-w-[280px] md:max-w-[360px]"
                      placeholder="게임명 입력"
                    />

                    {/* 🔍 실시간 게임 추천 자동완성 목록 */}
                    {showDropdown && suggestedGames.length > 0 && (
                      <ul className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {suggestedGames.map((game) => (
                          <li
                            key={game.id}
                            onMouseDown={() => {
                              setGameTitle(game.name);
                              setShowDropdown(false);
                            }}
                            className="p-2.5 hover:bg-cyan-50 cursor-pointer flex items-center space-x-2.5 transition-colors"
                          >
                            {game.icon_url ? (
                              <img
                                src={game.icon_url}
                                alt={game.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://via.placeholder.com/28?text=🎮';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-xs shrink-0">
                                🎮
                              </div>
                            )}
                            <div className="min-w-0 flex-1 text-left">
                              <p className="text-xs font-bold text-slate-900 truncate">{game.name}</p>
                              <p className="text-[10px] font-medium text-slate-400 truncate">{game.company}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

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

                {/* 🎯 DB 데이터를 기반으로 지원 스토어 동적 태그 표출 */}
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400 font-bold text-[11px]">지원 스토어:</span>
                  <div className="flex flex-wrap gap-1">
                    {(currentGameObj?.stores || ['구글', '원스', '갤스', '앱스토어']).map((store) => (
                      <span
                        key={store}
                        className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
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

          {/* 💡 검색 결과 영역 전용 블러 오버레이 & 큰 동그라미 회전 로더 */}
          {loading && (
            <div className="relative min-h-[420px] w-full rounded-2xl border border-slate-200 bg-white/60 overflow-hidden shadow-sm flex flex-col items-center justify-center p-8 select-none">
              {/* 뒷배경 서서히 블러 처리되는 스켈레톤 베이스 */}
              <div className="absolute inset-0 p-4 space-y-3 filter blur-md opacity-40 pointer-events-none">
                {[1, 2, 3].map((idx) => (
                  <div key={idx} className="h-28 bg-slate-200 rounded-xl" />
                ))}
              </div>

              {/* 🎯 결과 영역 중앙 오버레이 & 대형 회전 원 로더 */}
              <div className="relative z-10 flex flex-col items-center justify-center space-y-4 text-center">
                {/* 1. 회전하는 큰 동그라미 원 (Circular Spinner) */}
                <div className="relative flex items-center justify-center">
                  <div className="w-16 h-16 border-4 border-slate-200 border-t-cyan-500 rounded-full animate-spin shadow-md" />
                  <div className="absolute w-8 h-8 border-4 border-slate-100 border-b-cyan-300 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                </div>

                {/* 2. 연산 실행 중 안내 문구 */}
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 tracking-wider animate-pulse">
                    최저가 연산 실행 중...
                  </h3>
                  <p className="text-xs font-bold text-slate-500">
                    실시간 스토어 혜택 및 결제 조합 경로를 계산하고 있습니다.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 에러 상태 */}
          {!loading && error && (
            <div className="p-8 bg-rose-50 rounded-xl border border-rose-200 text-center space-y-2">
              <p className="text-xs font-bold text-rose-700">{error}</p>
              <p className="text-[11px] text-slate-500">백엔드 서버(`main.py`)가 8000번 포트에서 실행 중인지 확인해주세요.</p>
            </div>
          )}

          {/* 결과 카드 리스트 */}
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
                      className={`rounded-xl border transition-all hover:shadow-md grid grid-cols-1 md:grid-cols-12 overflow-hidden cursor-pointer items-stretch ${cardStyle}`}
                    >
                      {/* 1. [좌측 2.5열] 슬림 컴팩트 스토어 박스 */}
                      <div className="md:col-span-3 lg:col-span-2.5 p-3 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between space-y-2 shrink-0">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-2 py-0.5 rounded-md text-xs font-black shadow-2xs ${rankStyle}`}>
                            {item.rank}등
                          </span>
                          {item.rank === 1 && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded border border-amber-300 shadow-2xs whitespace-nowrap">
                              최고 추천 👍
                            </span>
                          )}
                        </div>

                        <div className="flex-1 flex flex-col items-center justify-center text-center p-2.5 bg-white rounded-lg border border-slate-200/80 shadow-2xs space-y-1">
                          <span className="text-[9.5px] text-slate-400 font-extrabold block tracking-tight">
                            결제 추천 스토어
                          </span>
                          <div className="text-2xl sm:text-3xl shrink-0 leading-none">
                            {item.storeIcon}
                          </div>
                          <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate max-w-full px-1">
                            {item.platform}
                          </h4>
                        </div>
                      </div>

                      {/* 2. [중앙 6.5열] 결제 경로 및 슬림 쿠폰/적립 바 */}
                      <div className="md:col-span-6 lg:col-span-6.5 p-3 md:p-3.5 flex flex-col justify-between space-y-2 min-w-0">
                        <div className="space-y-1">
                          <span className="text-[9.5px] text-slate-400 font-extrabold block">
                            결제 진행 수단 및 경로
                          </span>
                          <div className="flex flex-wrap items-center gap-1">
                            {item.paymentRoute.map((step: string, idx: number) => (
                              <React.Fragment key={idx}>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded-md border border-slate-200/80">
                                  {formatMethodName(step)}
                                </span>
                                {idx < item.paymentRoute.length - 1 && (
                                  <span className="text-slate-300 font-bold text-[10px]">➔</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          <div className="pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-cyan-800 bg-cyan-50 hover:bg-cyan-100 px-2 py-0.5 rounded border border-cyan-200 transition-all cursor-pointer shadow-2xs">
                              <span>💡</span>
                              <span>추천 결제 가이드 & 적립 상세 보기 ➔</span>
                            </span>
                          </div>

                          {item.appliedBonusBadges && item.appliedBonusBadges.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {item.appliedBonusBadges.map((badge, bIdx) => (
                                <span
                                  key={bIdx}
                                  className="text-[9.5px] font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200/70"
                                >
                                  {badge}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* 적용 할인 & 적립 혜택 슬림 행 ('쿠폰' -> '할인' 명칭 변경) */}
                        <div className="pt-2 border-t border-slate-100 space-y-1">
                          <div className="flex items-center text-[11px] font-bold min-h-[22px]">
                            <span className="w-16 shrink-0 text-slate-500 font-extrabold flex items-center gap-1">
                              <span>🎫</span>
                              <span>할인</span>
                            </span>
                            <div className="flex-1 flex flex-wrap items-center gap-1">
                              {item.discount_steps.length > 0 ? (
                                item.discount_steps.map((dStep, dIdx) => (
                                  <span
                                    key={dIdx}
                                    className="inline-flex items-center gap-1 bg-rose-50/90 text-rose-800 px-1.5 py-0.5 rounded border border-rose-200/80 text-[10px] font-extrabold max-w-[220px] overflow-hidden"
                                  >
                                    <span className="truncate">{formatMethodName(dStep.eventName)}</span>
                                    <span className="text-rose-600 font-black shrink-0">(-{dStep.amount.toLocaleString()}원)</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 font-medium text-[10.5px]">할인 미적용</span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center text-[11px] font-bold min-h-[22px]">
                            <span className="w-16 shrink-0 text-slate-500 font-extrabold flex items-center gap-1">
                              <span>🎁</span>
                              <span>적립</span>
                            </span>
                            <div className="flex-1 flex flex-wrap items-center gap-1">
                              {item.reward_steps.length > 0 ? (
                                item.reward_steps.map((rStep, rIdx) => (
                                  <span
                                    key={rIdx}
                                    className="inline-flex items-center gap-1 bg-emerald-50/90 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-200/80 text-[10px] font-extrabold"
                                  >
                                    <span>{formatMethodName(rStep.eventName)}</span>
                                    <span className="text-emerald-700 font-black">({rStep.formattedAmountText})</span>
                                  </span>
                                ))
                              ) : (
                                <span className="text-slate-400 font-medium text-[10.5px]">적립 없음</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3. [우측 3열] 슬림 가격 박스 */}
                      <div className="md:col-span-3 lg:col-span-3 p-3 md:p-3.5 bg-slate-50/40 border-t md:border-t-0 md:border-l border-slate-200/80 flex flex-col justify-between items-end text-right space-y-2 shrink-0">
                        <div className="text-right space-y-1 w-full">
                          <div className="flex items-center justify-end">
                            <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[11px] rounded shadow-2xs">
                              실질 {item.discount_rate}% OFF
                            </span>
                          </div>

                          <div className="space-y-1 pt-0.5 w-full">
                            {item.immediate_discount_total > 0 && (
                              <div className="flex justify-between items-center text-rose-800 font-black bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">
                                <span>총 할인 ({item.discountRatePercent}%)</span>
                                <span>-{item.immediate_discount_total.toLocaleString()}원</span>
                              </div>
                            )}

                            {item.discount_steps.map((dStep, dIdx) => (
                              <div
                                key={dIdx}
                                className="flex justify-between items-center text-rose-700 font-bold bg-rose-50/60 px-1.5 py-0.5 rounded text-[9px] border border-rose-100/80 leading-tight"
                              >
                                <span className="truncate max-w-[95px] text-left">└ {formatMethodName(dStep.eventName)}</span>
                                <span className="shrink-0 font-black">-{dStep.amount.toLocaleString()}원</span>
                              </div>
                            ))}

                            {item.reward_point > 0 && (
                              <div className="flex justify-between items-center text-emerald-900 font-black bg-emerald-100/80 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] mt-1">
                                <span>총 적립 ({item.rewardRatePercent}%)</span>
                                <span>+{item.reward_point.toLocaleString()}원 상당</span>
                              </div>
                            )}

                            {item.reward_steps.map((rStep, rIdx) => {
                              const isGoogle = rStep.providerName.includes('GOOGLE') || rStep.providerName.includes('구글');
                              const nativePt = isGoogle ? Math.floor(rStep.amount / 10) : rStep.amount;
                              const labelName = formatMethodName(rStep.providerName);

                              return (
                                <div
                                  key={rIdx}
                                  className="flex justify-between items-center text-emerald-800 font-bold bg-emerald-50/60 px-1.5 py-0.5 rounded text-[9px] border border-emerald-100/80 leading-tight gap-1"
                                >
                                  <span className="truncate max-w-[90px] text-left">└ {labelName}</span>
                                  <span className="shrink-0 font-black whitespace-nowrap">
                                    +{nativePt.toLocaleString()}pt
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div className="w-full pt-1.5 border-t border-slate-200/80 text-right space-y-0.5">
                          <div className="flex justify-between items-center text-[9.5px] text-slate-400 font-bold">
                            <span>정가</span>
                            <span className="line-through">{payAmount.toLocaleString()}원</span>
                          </div>

                          <div className="flex justify-between items-center text-[11px] font-black text-slate-800">
                            <span>💳 실제 결제액</span>
                            <span>{item.actual_payment_price.toLocaleString()}원</span>
                          </div>

                          <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                            <span className="text-[11px] font-black text-cyan-950">🎉 실질 체감가</span>
                            <span className="text-lg font-black text-cyan-600">
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

        {/* [우측 4열] 우측 실시간 필터 조절 사이드바 */}
        <aside className="lg:col-span-4 h-full space-y-5">
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

            {/* 스마트폰 OS (안드로이드 전환 시 기본 지원 스토어 자동 선택) */}
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-slate-800 block">스마트폰 OS</span>
              <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setOsType('ANDROID');
                    // 💡 안드로이드로 전환 시 현재 게임이 지원하는 스토어 중 기본 스토어(구글 등) 자동 선택
                    if (androidStores.length === 0) {
                      const supported = ANDROID_STORE_OPTIONS.filter((st) =>
                        isStoreSupported(st, currentGameObj?.stores)
                      );
                      setAndroidStores(supported.length > 0 ? [supported[0]] : ['구글 플레이 스토어']);
                    }
                  }}
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

            {/* 이용 스토어 필터 (미지원 스토어 블러 & 선택 제한 적용) */}
            {osType === 'ANDROID' && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-800 block">이용 스토어 필터</span>
                <div className="flex flex-wrap gap-2">
                  {ANDROID_STORE_OPTIONS.map((st: string) => {
                    const isSupported = isStoreSupported(st, currentGameObj?.stores);
                    const selected = androidStores.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        disabled={!isSupported}
                        onClick={() => {
                          if (isSupported) {
                            handleToggleArray(setAndroidStores, st);
                          }
                        }}
                        className={`px-3 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all min-h-[40px] flex items-center ${
                          !isSupported
                            ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed blur-[0.6px] opacity-40 line-through select-none'
                            : selected
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-pointer'
                            : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer hover:border-cyan-300'
                        }`}
                        title={!isSupported ? '선택한 게임에서 지원하지 않는 스토어입니다.' : ''}
                      >
                        {!isSupported ? '✕ ' : selected ? '✓ ' : '+ '}{st}
                      </button>
                    );
                  })}
                </div>

                {isOneStoreSelected && isStoreSupported('원스토어', currentGameObj?.stores) && (
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

                {/* 🎯 [복원] 구글/갤럭시 스토어 선택 시 등급 선택 드롭다운 팝업 표출 */}
                {(isGoogleSelected || isGalaxySelected) && (
                  <div className="p-3 bg-cyan-50/60 rounded-xl border border-cyan-200/80 space-y-2.5 mt-2 animate-fadeIn">
                    {isGoogleSelected && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold text-cyan-950 block">Google Play Points 등급</label>
                        <select
                          value={googlePlayTier}
                          onChange={(e) => setGooglePlayTier(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-cyan-300 bg-white font-bold text-slate-900 focus:outline-none"
                        >
                          <option value="BRONZE">브론즈 (10원당 1pt)</option>
                          <option value="SILVER">실버 (10원당 1.1pt)</option>
                          <option value="GOLD">골드 (10원당 1.3pt)</option>
                          <option value="PLATINUM">플래티넘 (10원당 1.4pt)</option>
                          <option value="DIAMOND">다이아몬드 (10원당 1.6pt)</option>
                        </select>
                      </div>
                    )}

                    {isGalaxySelected && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-extrabold text-cyan-950 block">Galaxy Store 멤버십 등급</label>
                        <select
                          value={galaxyStoreTier}
                          onChange={(e) => setGalaxyStoreTier(e.target.value)}
                          className="w-full px-2.5 py-2 text-xs rounded-lg border border-cyan-300 bg-white font-bold text-slate-900 focus:outline-none"
                        >
                          <option value="STANDARD">일반 (1% 적립)</option>
                          <option value="VIP">VIP (2% 적립)</option>
                          <option value="VVIP">VVIP (3% 적립)</option>
                          <option value="ROYAL_BLUE">로열블루 (10% 적립)</option>
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-xs font-black text-slate-900 block">보유 결제 수단 필터</span>

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

          {/* 광고 배너 */}
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

      {/* 세부 결제 경로 모달 (포인트 적립 세부 내역 안내) */}
      {selectedResultForDetail && (
        <div
          onClick={() => setSelectedResultForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
        >
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
            </div>

            {/* 💡 [결제 가이드] 모달 상단에 결제 경로 및 핀번호 입력 안내 표출 */}
            <div className="p-3 bg-cyan-50/90 rounded-xl border border-cyan-200 text-xs font-extrabold text-cyan-950 leading-relaxed shadow-2xs">
              {getUsageGuide(selectedResultForDetail.paymentRoute.join(' '))}
            </div>

            {/* 1. 💳 결제 시 즉시 할인 이벤트 (분홍/장미 테마 테두리 적용으로 초록 적립상자와 완벽 대칭) */}
            {selectedResultForDetail.discount_steps.length > 0 && (
              <div className="p-4 bg-rose-50/50 rounded-xl border border-rose-200 space-y-2 text-xs">
                <h4 className="font-black text-rose-900 flex items-center gap-1.5 text-sm">
                  <span>💳</span>
                  <span>결제 시 즉시 할인 이벤트</span>
                </h4>
                <div className="space-y-2 pt-1">
                  {selectedResultForDetail.discount_steps.map((step, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-lg border border-rose-100 space-y-1.5 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          {step.isGameSpecific ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                              🎮 {step.targetGame} 전용
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                              🌐 공통 혜택
                            </span>
                          )}
                          <span className="text-xs font-extrabold text-slate-800">{step.eventName}</span>
                        </div>
                        <span className="text-xs font-black text-rose-600">
                          -{step.amount.toLocaleString()}원 할인 {step.ratePercent ? `(${step.ratePercent}%)` : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50/80 p-2 rounded border border-slate-100">
                        📝 <strong>상세 조건:</strong> {step.conditionText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 2. 🎁 포인트 적립 세부 내역 (적립 내역을 아래로 배치 & ++ 중복 표기 제거) */}
            {selectedResultForDetail.reward_steps.length > 0 && (
              <div className="p-4 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2 text-xs">
                <h4 className="font-black text-emerald-900 flex items-center gap-1.5 text-sm">
                  <span>🎁</span>
                  <span>포인트 적립 세부 내역</span>
                </h4>
                <div className="space-y-1.5 pt-1">
                  {selectedResultForDetail.reward_steps.map((step, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-emerald-100 font-bold shadow-2xs">
                      <span className="text-slate-700">
                        • {formatMethodName(step.providerName)} ({step.eventName})
                      </span>
                      <span className="text-emerald-700 font-black">
                        {step.formattedAmountText}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}