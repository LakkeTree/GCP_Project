import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useFilterState } from '../hooks/useFilterState';
import LegalModals from '../components/LegalModals';
import FilterSection from '../components/FilterSection';
import type { OsType } from '../constants/searchOptions';
import { getGameCode } from '../constants/gameMapping';
import {
  CARD_CODE_MAP,
  PLATFORM_CODE_MAP,
  PAYMENT_METHOD_MAP,
  LAYER_NAME_MAP,
  REVERSE_PAYMENT_MAP,
  BACKEND_API_URL,
} from '../constants/searchOptions';

const KOREAN_PAYMENT_MAP: Record<string, string> = {
  'GOOGLE_PLAY Giftcard/Voucher': '구글 플레이 기프트카드 할인',
  'GOOGLE_PLAY_Giftcard/Voucher': '구글 플레이 기프트카드 할인',
  'GOOGLE_PLAY Giftcard': '구글 플레이 기프트카드',
  'GOOGLE_PLAY_GIFTCARD': '구글 플레이 기프트카드',
  'GALAXY_STORE_GIFTCARD': '갤럭시 스토어 기프트카드',
  'ONESTORE_GIFTCARD': '원스토어 기프트카드',
  'APPLE_GIFTCARD': '애플 기프트카드',
  'STORE MEMBERSHIP REWARD': '스토어 멤버십 기본 적립',
  'STORE_MEMBERSHIP_REWARD': '스토어 멤버십 기본 적립',
  'CREDIT CHECK CARD': '일반 신용/체크카드',
  'CREDIT_CHECK_CARD': '일반 신용/체크카드',
  'TELECOM DISCOUNT': '통신사 멤버십 / 소액결제',
  'TELECOM_DISCOUNT': '통신사 멤버십 / 소액결제',
  'CULTURELAND CASH': '컬쳐랜드 캐시 (우회)',
  'CULTURELAND_CASH': '컬쳐랜드 캐시 (우회)',
  'CULTURELAND BYPASS': '컬쳐랜드 상품권 우회',
  'CULTURELAND_BYPASS': '컬쳐랜드 상품권 우회',
  'QUICK BANK TRANSFER': '실시간 계좌이체',
  'QUICK_BANK_TRANSFER': '실시간 계좌이체',
};

const formatMethodName = (text: string) => {
  if (!text) return '';
  const trimmed = text.trim();
  
  if (KOREAN_PAYMENT_MAP[trimmed]) {
    return KOREAN_PAYMENT_MAP[trimmed];
  }

  return trimmed
    .replace(/GOOGLE_PLAY\s*Giftcard\/Voucher/gi, '구글 기프트카드 할인')
    .replace(/GALAXY_STORE\s*Giftcard\/Voucher/gi, '갤스 기프트카드 할인')
    .replace(/ONESTORE\s*Giftcard\/Voucher/gi, '원스토어 기프트카드 할인')
    .replace(/STORE\s*MEMBERSHIP\s*REWARD/gi, '스토어 기본 적립')
    .replace(/CREDIT\s*CHECK\s*CARD/gi, '일반 신용/체크카드')
    .replace(/TELECOM\s*DISCOUNT/gi, '통신사 할인')
    .replace(/갤럭시 스토어\s*\d+월 모바일 게임 월간 할인 쿠폰 이벤트\s*-\s*/g, '갤스 월간 쿠폰 ')
    .replace(/한여름 쿠폰 WAVE,\s*팔팔한 혜택이 밀려온다\s*-\s*/g, '갤스 한여름 WAVE ')
    .replace(/혜택은 서포트,\s*게임은 퍼펙트\s*갤럭시 스토어\s*/g, '갤스 ')
    .replace(/스토어별 첫 결제 혜택\s*-\s*/g, '첫 결제 ')
    .replace(/CU_CONVENIENCE_STORE/g, 'CU 편의점')
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

const getUsageGuide = (pathText: string, comboText?: string) => {
  const text = pathText.toUpperCase();
  let prefix = "";

  if (comboText && comboText.trim() !== "") {
    const items = comboText.split("+");
    const counts: Record<string, number> = {};
    items.forEach((item) => {
      const trimmed = item.trim();
      counts[trimmed] = (counts[trimmed] || 0) + 1;
    });

    const comboSummary = Object.entries(counts)
      .map(([denom, count]) => (count > 1 ? `${denom} x ${count}개` : `${denom} 1개`))
      .join(", ");

    prefix = `💡 [추천 권종 구매] ${comboSummary} 구매 후 충전 진행 ➔ `;
  }

  if (text.includes("CU")) {
    return `${prefix}CU 편의점/Pocket CU 앱에서 기프트카드 구매 ➔ 영수증/카드 핀번호(코드) 입력 ➔ 스토어 충전 후 결제`;
  }
  if (text.includes("ZEROPIN") || text.includes("제로핀")) {
    return `${prefix}제로핀 공식몰에서 기프트코드 할인 구매 ➔ 발급된 핀번호 입력 및 스토어 충전 ➔ 인앱 결제 진행`;
  }
  if (text.includes("CULTURELAND") || text.includes("컬쳐랜드") || text.includes("북앤라이프")) {
    return `${prefix}문화상품권 할인 구매 ➔ 해당 컬쳐캐시/상품권 핀번호 입력 충전 ➔ 스토어 우회 결제 적용`;
  }
  if (text.includes("NAVER") && (text.includes("STORE") || text.includes("스토어"))) {
    return `${prefix}네이버 스마트스토어 공식 판매처 구매 ➔ 문자/알림톡 기프트코드 핀번호 입력 ➔ 스토어 등록 후 결제`;
  }
  if (text.includes("삼성페이") || text.includes("SAMSUNG_PAY")) {
    return "결제 경로 가이드: 스토어 쿠폰함에서 할인 쿠폰 받기 ➔ 게임 결제창 접속 ➔ 삼성페이 선택하여 즉시 결제";
  }
  if (text.includes("갤럭시") || text.includes("GALAXY")) {
    return "결제 경로 가이드: 갤럭시 스토어 [쿠폰함] 쿠폰 다운로드 ➔ 게임 결제창에서 쿠폰 적용 후 선택 결제 수단으로 결제";
  }
  if (text.includes("원스토어") || text.includes("ONE_STORE")) {
    return "결제 경로 가이드: 원스토어 [혜택/쿠폰함] 쿠폰 및 T멤버십 할인 선택 ➔ 결제 수단 최종 확인 후 결제";
  }
  
  return `${prefix}해당 스토어/공식 판매처에서 기프트카드 구매 ➔ 핀번호 입력 충전 후 인앱 결제 진행`;
};

const getInitialGames = (): { id: string; name: string; company: string; icon_url: string; stores?: string[] }[] => {
  try {
    const localData = localStorage.getItem('cached_games_list');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
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
  let cleaned = title
    .replace(/^\(더미\)\s*/, '')
    .replace(/^혜택은 서포트,\s*게임은 퍼펙트\s*갤럭시 스토어\s*/, '')
    .replace(/<[^>]+>\s*이벤트\s*-\s*/, '')
    .replace(/스토어\d*월\s*모바일\s*게임\s*월간\s*할인\s*쿠폰\s*이벤트\s*-\s*/gi, '')
    .replace(/할인 쿠폰$/, '쿠폰')
    .trim();

  if (title.includes('첫 결제') || title.includes('FIRST_PAY')) {
    if (!cleaned.startsWith('[첫 결제]')) {
      cleaned = `[첫 결제 혜택] ${cleaned.replace(/^스토어별 첫 결제 혜택 -\s*/, '')}`;
    }
  }

  return cleaned;
};

const renderStoreLogo = (platformName: string) => {
  const p = platformName.toLowerCase();

  if (p.includes('구글') || p.includes('google')) {
    return (
      <img
        src="/stores/google_play.png"
        alt="Google Play"
        className="w-10 h-10 object-contain rounded-xl shadow-2xs border border-slate-100 bg-white p-0.5 shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  if (p.includes('갤럭시') || p.includes('galaxy') || p.includes('갤스')) {
    return (
      <img
        src="/stores/galaxy_store.png"
        alt="Galaxy Store"
        className="w-10 h-10 object-contain rounded-xl shadow-2xs shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  if (p.includes('원스') || p.includes('one')) {
    return (
      <img
        src="/stores/one_store.png"
        alt="ONE Store"
        className="w-10 h-10 object-contain rounded-xl shadow-2xs shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  if (p.includes('앱스토어') || p.includes('apple') || p.includes('app')) {
    return (
      <img
        src="/stores/app_store.png"
        alt="App Store"
        className="w-10 h-10 object-contain rounded-xl shadow-2xs shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 font-bold text-[10px] flex items-center justify-center border border-slate-200 shrink-0">
      STORE
    </div>
  );
};

export default function SearchResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'contact' | null>(null);

  const initialGame = searchParams.get('game') || '쿠키런: 킹덤';
  const initialAmount = Number(searchParams.get('amount')) || 150000;

  const filterState = useFilterState(false);
  const { filter, setFilter } = filterState;

  const [gameTitle, setGameTitle] = useState(initialGame);
  const [activeGameTitle, setActiveGameTitle] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);

  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);

  useEffect(() => {
    const savedFilter = localStorage.getItem('user_filter_settings');
    if (savedFilter) {
      try {
        const parsed = JSON.parse(savedFilter);
        if (parsed.favoriteGames) setFavoriteGames(parsed.favoriteGames);
      } catch (e) {}
    }
  }, []);

  const isFavorite = favoriteGames.includes(activeGameTitle);

  const handleToggleFavorite = () => {
    let updated: string[];
    if (isFavorite) {
      updated = favoriteGames.filter((g) => g !== activeGameTitle);
    } else {
      if (favoriteGames.length >= 10) {
        alert('즐겨찾기는 최대 10개까지만 등록할 수 있습니다.');
        return;
      }
      updated = [...favoriteGames, activeGameTitle];
    }

    setFavoriteGames(updated);

    const savedFilter = localStorage.getItem('user_filter_settings');
    const parsed = savedFilter ? JSON.parse(savedFilter) : {};
    parsed.favoriteGames = updated;
    localStorage.setItem('user_filter_settings', JSON.stringify(parsed));

    const token = localStorage.getItem('google_token');
    if (token) {
      fetch('http://127.0.0.1:8000/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ favorite_games: updated }),
      }).catch((err) => console.error('즐겨찾기 저장 에러:', err));
    }
  };

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || suggestedGames.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestedGames.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestedGames.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestedGames.length) {
        e.preventDefault();
        const selectedGame = suggestedGames[selectedIndex];
        handleSelectSuggestedGame(selectedGame.name);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  };

  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');
  const [loading, setLoading] = useState<boolean>(false);
  const [rawResultsList, setRawResultsList] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  const [allGames, setAllGames] = useState(getInitialGames);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/games')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          setAllGames(result.data);
          localStorage.setItem('cached_games_list', JSON.stringify(result.data));
        }
      })
      .catch((err) => console.error('게임 DB 수집 실패:', err));
  }, []);

  const currentGameObj = allGames.find((g) => g.name === activeGameTitle);

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

  useEffect(() => {
    if (currentGameObj?.stores && currentGameObj.stores.length > 0) {
      setFilter((prev) => ({
        ...prev,
        androidStores: prev.androidStores.filter((st) => isStoreSupported(st, currentGameObj.stores)),
      }));
    }
  }, [activeGameTitle, currentGameObj, setFilter]);

  const fetchBackendData = useCallback(async (targetGameName?: string) => {
    setLoading(true);
    setError(null);

    const gameToQuery = targetGameName || activeGameTitle;

    try {
      fetch('http://127.0.0.1:8000/games/search-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_name: gameToQuery }),
      }).catch((err) => console.error('검색 로그 전송 실패:', err));
    } catch (e) {}

    const selectedProviders: string[] = [];

    if (filter.useCarriers) {
      filter.carriers.forEach((c) => PAYMENT_METHOD_MAP[c] && selectedProviders.push(PAYMENT_METHOD_MAP[c]));
    }
    if (filter.usePays) {
      filter.pays.forEach((p) => PAYMENT_METHOD_MAP[p] && selectedProviders.push(PAYMENT_METHOD_MAP[p]));
    }
    if (filter.useVoucherBypasses) {
      filter.voucherBypasses.forEach((v) => {
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

    if (filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE') {
      const cardCode = CARD_CODE_MAP[filter.selectedSpecialCard] || filter.selectedSpecialCard;
      selectedProviders.push(cardCode);
    }

    const supportedStoresForGame = currentGameObj?.stores || ['구글', '원스', '갤스', '앱스토어'];

    const targetPlatforms = filter.osType === 'ANDROID'
      ? filter.androidStores
          .filter((s) => isStoreSupported(s, supportedStoresForGame))
          .map((s) => PLATFORM_CODE_MAP[s] || s)
      : ['APP_STORE'];

    const amountNum = payAmount > 0 ? payAmount : 150000;

    try {
      const requests = targetPlatforms.map((platform) => {
        let tier = 'STANDARD';
        if (platform === 'GOOGLE_PLAY') tier = filter.googlePlayTier;
        if (platform === 'GALAXY_STORE') tier = filter.galaxyStoreTier;

        const payload = {
          platform: platform,
          amount: amountNum,
          is_first_pay: filter.isFirstPayment,
          payment_methods: selectedProviders,
          game: getGameCode(gameToQuery),
          membership_tier: tier,
          has_subscription: filter.useTMembership,
          has_prev_spend: filter.useSpecialOptions ? filter.hasPrevSpend : false,
          has_pre_applied: filter.hasPreApplied,
          use_game_benefits: filter.useGameBenefits,
        };

        return fetch(BACKEND_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
          .then((res) => {
            if (!res.ok) throw new Error(`API 통신 실패 (Status: ${res.status})`);
            return res.json() as Promise<BackendResponse>;
          })
          .then((data) => ({
            ...data,
            routes: (data.routes || []).map((r) => ({ ...r, reqPlatform: platform })),
          }));
      });

      const responses = await Promise.all(requests);
      const combinedRoutes: RecommendedRoute[] = responses.flatMap((res) => res.routes || []);
      combinedRoutes.sort((a, b) => a.net_cost - b.net_cost);

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
          } else if (step.provider.includes('GOOGLE') || step.provider.includes('PLAY')) {
            const pts = Math.floor(step.applied_amount);
            const wonValue = pts * 10;

            effectiveAmount = wonValue;
            adjustedRewardTotal += effectiveAmount;
            formattedText = `+${pts.toLocaleString()}pt (${wonValue.toLocaleString()}원)`;
          }  else {
            adjustedRewardTotal += step.applied_amount;
            formattedText = `+${step.applied_amount.toLocaleString()}원 (${step.applied_amount.toLocaleString()}원)`;
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

        const PLATFORM_DISPLAY_MAP: Record<string, string> = {
          GOOGLE_PLAY: '구글 플레이 스토어',
          ONE_STORE: '원스토어',
          GALAXY_STORE: '갤럭시 스토어',
          APP_STORE: '앱스토어',
        };

        const displayPlatform =
          PLATFORM_DISPLAY_MAP[(route as any).reqPlatform] || '구글 플레이 스토어';

        let storeIcon = 'GOOGLE';
        if (displayPlatform.includes('구글')) storeIcon = 'GOOGLE';
        if (displayPlatform.includes('갤럭시')) storeIcon = 'GALAXY';
        if (displayPlatform.includes('원스토어')) storeIcon = 'ONE';
        if (filter.osType === 'IOS' || displayPlatform.includes('앱스토어')) storeIcon = 'APPLE';

        const formattedProviders = routeProviders.map((p) => formatMethodName(p));

        const routeTitle = formattedProviders.length > 0
          ? `[${formattedProviders.slice(0, 2).join(' + ')}] 최적 조합`
          : `추천 결제 경로 #${idx + 1}`;

        let guideText = route.route_type === 'GIFT_CARD'
          ? '상품권 할인 충전 후 우회 결제하는 최고 할인 경로입니다.'
          : '스토어 쿠폰, 통신사/간편결제 및 기본 적립이 조합된 경로입니다.';

        if (route.leftover_balance > 0) {
          guideText += ` (결제 후 상품권 잔액 ${route.leftover_balance.toLocaleString()}원 남음)`;
        }

        const routeBonusBadges: string[] = [];

        if (stepsDetailed.some((s) => s.isGameSpecific)) {
          routeBonusBadges.push('게임 전용 혜택');
        }

        if (
          stepsDetailed.some(
            (s) =>
              s.eventName.includes('사전 응모') ||
              s.conditionText.includes('사전 응모') ||
              s.eventName.includes('사전응모')
          )
        ) {
          routeBonusBadges.push('사전 응모 완료');
        }

        if (
          stepsDetailed.some(
            (s) =>
              s.eventName.includes('첫 결제') ||
              s.conditionText.includes('첫 결제') ||
              s.eventName.includes('첫결제')
          )
        ) {
          routeBonusBadges.push('첫 결제 대상');
        }

        return {
          rank: idx + 1,
          title: routeTitle,
          platform: displayPlatform,
          os: filter.osType,
          original_price: amountNum,
          actual_payment_price: actualPaymentPrice,
          immediate_discount_total: immediateDiscountTotal,
          discountRatePercent: discountRatePercent,
          reward_point: rewardPointTotal,
          rewardRatePercent: rewardRatePercent,
          final_price: netCost,
          total_benefit_amount: totalBenefitAmount,
          discount_rate: discountRate,
          paymentRoute: formattedProviders.length > 0 ? formattedProviders : ['기본 인앱 결제'],
          discountDetail: `즉시 할인 ${discountRatePercent}% + 포인트 적립 ${rewardRatePercent}%`,
          storeIcon: storeIcon,
          discount_steps: discountSteps,
          reward_steps: rewardSteps,
          guide_text: guideText,
          appliedBonusBadges: routeBonusBadges,
        };
      });

      setRawResultsList(converted);
    } catch (err) {
      console.error('API Error:', err);
      setError('백엔드 연산 서버(http://127.0.0.1:8000)에 연결할 수 없습니다.');
    } finally {
      setLoading(false);
    }
  }, [filter, payAmount, activeGameTitle, currentGameObj]);

  const suggestedGames = gameTitle.trim()
    ? allGames.filter(
        (g) =>
          g.name.toLowerCase().includes(gameTitle.toLowerCase()) ||
          g.company.toLowerCase().includes(gameTitle.toLowerCase())
      )
    : [];

  useEffect(() => {
    fetchBackendData();
  }, [fetchBackendData]);

  const handleSelectSuggestedGame = (selectedGameName: string) => {
    setGameTitle(selectedGameName);
    setActiveGameTitle(selectedGameName);
    setShowDropdown(false);

    const params = new URLSearchParams({
      game: selectedGameName,
      amount: String(payAmount),
      os: filter.osType,
      stores: filter.osType === 'IOS' ? '앱스토어' : filter.androidStores.join(','),
      googleTier: filter.googlePlayTier,
      galaxyTier: filter.galaxyStoreTier,
      isPcVersion: String(filter.isPcVersion),
      useGameBenefits: String(filter.useGameBenefits),
      hasPreApplied: String(filter.hasPreApplied),
      isFirstPayment: String(filter.isFirstPayment),
      carriers: filter.useCarriers ? filter.carriers.join(',') : '',
      pays: filter.usePays ? filter.pays.join(',') : '',
      vouchers: filter.useVoucherBypasses ? filter.voucherBypasses.join(',') : '',
      specialCard: filter.selectedSpecialCard,
      hasPrevSpend: String(filter.hasPrevSpend),
    });

    navigate(`/search-result?${params.toString()}`);
    fetchBackendData(selectedGameName);
  };

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

    setActiveGameTitle(gameTitle);

    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(payAmount),
      os: filter.osType,
      stores: filter.osType === 'IOS' ? '앱스토어' : filter.androidStores.join(','),
      googleTier: filter.googlePlayTier,
      galaxyTier: filter.galaxyStoreTier,
      isPcVersion: String(filter.isPcVersion),
      useGameBenefits: String(filter.useGameBenefits),
      hasPreApplied: String(filter.hasPreApplied),
      isFirstPayment: String(filter.isFirstPayment),
      carriers: filter.useCarriers ? filter.carriers.join(',') : '',
      pays: filter.usePays ? filter.pays.join(',') : '',
      vouchers: filter.useVoucherBypasses ? filter.voucherBypasses.join(',') : '',
      specialCard: filter.selectedSpecialCard,
      hasPrevSpend: String(filter.hasPrevSpend),
    });

    navigate(`/search-result?${params.toString()}`);
    fetchBackendData(gameTitle);
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">          
          <main className="lg:col-span-8 space-y-5">
            <div className="bg-white rounded-lg border border-slate-200/90 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-3">
                <div>
                  <button
                    type="button"
                    onClick={handleToggleFavorite}
                    className="inline-flex items-center gap-1.5 py-1 text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer group select-none"
                  >
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 group-active:scale-125 ${
                        isFavorite
                          ? 'fill-amber-400 stroke-amber-400'
                          : 'fill-none stroke-amber-400 hover:fill-amber-100'
                      }`}
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                    <span className="font-extrabold text-slate-800">즐겨찾기</span>
                  </button>
                </div>

                <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                  {currentGameObj?.icon_url ? (
                    <img
                      src={currentGameObj.icon_url}
                      alt={activeGameTitle}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 md:w-12 md:h-12 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0 border border-slate-200">
                      GAME
                    </div>
                  )}

                  <div className="flex items-center flex-wrap gap-1.5 relative">
                    <div className="relative inline-block">
                      <input
                        type="text"
                        value={gameTitle}
                        onChange={(e) => {
                          setGameTitle(e.target.value);
                          setShowDropdown(true);
                          setSelectedIndex(-1);
                        }}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setShowDropdown(true)}
                        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                        style={{
                          fontSize:
                            gameTitle.length > 20
                              ? '1.15rem'
                              : gameTitle.length > 12
                              ? '1.4rem'
                              : '1.875rem',
                          width: `${Math.max(
                            (gameTitle || '게임명 입력')
                              .split('')
                              .reduce((acc, char) => acc + (char.charCodeAt(0) > 128 ? 1.8 : 0.95), 0) + 0.4,
                            4
                          )}ch`,
                          lineHeight: '1.35',
                          paddingBottom: '6px',
                        }}
                        className="font-black bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] bg-clip-text text-transparent border-b-2 border-[#00D2B8] focus:outline-none px-1 max-w-[300px] sm:max-w-[420px] md:max-w-[550px] transition-all"
                        placeholder="게임명 입력"
                      />

                      {showDropdown && suggestedGames.length > 0 && (
                        <ul className="absolute left-0 top-full mt-1.5 z-50 w-72 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                          {suggestedGames.map((game, idx) => (
                            <li
                              key={game.id}
                              onMouseDown={() => handleSelectSuggestedGame(game.name)}
                              onMouseEnter={() => setSelectedIndex(idx)}
                              className={`p-2.5 cursor-pointer flex items-center space-x-2.5 transition-colors ${
                                idx === selectedIndex ? 'bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 font-black' : 'hover:bg-slate-50'
                              }`}
                            >
                              {game.icon_url ? (
                                <img
                                  src={game.icon_url}
                                  alt={game.name}
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0">
                                  GAME
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

                    <span className="text-2xl md:text-3xl font-black text-slate-900 whitespace-nowrap ml-1">
                      에 관한 검색 결과
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-xs pt-0.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-1 text-slate-500 font-bold">
                      <span>기준 결제 금액:</span>
                      <span className="text-slate-900 font-black">{payAmount.toLocaleString()}원</span>
                    </div>

                    <div className="h-3 w-[1px] bg-slate-300 hidden sm:block" />

                    <div className="flex items-center space-x-1.5">
                      <span className="text-slate-400 font-bold text-[11px]">지원 스토어:</span>
                      <div className="flex flex-wrap gap-1">
                        {(currentGameObj?.stores || ['구글', '원스', '갤스', '앱스토어']).map((store) => (
                          <span
                            key={store}
                            className="text-[10px] font-bold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                          >
                            {store}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleReSearch(e)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded transition-all shadow-xs cursor-pointer flex items-center gap-1.5 whitespace-nowrap"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>다시 검색 (재연산)</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-3">
                <span className="text-xs font-bold text-slate-500">
                  총 <strong className="text-[#00A896]">{resultsList.length}개</strong>의 추천 결제 경로
                </span>
                <button
                  type="button"
                  onClick={() => setIsCriteriaModalOpen(true)}
                  className="text-xs font-semibold text-slate-500 hover:text-[#00A896] underline cursor-pointer"
                >
                  [환산 기준 보기]
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  className="text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 hover:bg-[#00D2B8]/25 px-2.5 py-1 rounded border border-[#00D2B8]/30 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                >
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
                    className={`px-3.5 py-1.5 rounded text-xs font-black transition-all cursor-pointer ${
                      sortOption === tab.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading && (
              <div className="relative min-h-[420px] w-full rounded-lg border border-slate-200 bg-white/60 overflow-hidden shadow-xs flex flex-col items-center justify-center p-8 select-none">
                <div className="relative z-10 flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-[#00D2B8] rounded-full animate-spin shadow-md" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xl font-black text-slate-900 tracking-wider animate-pulse">
                      최저가 연산 실행 중...
                    </h3>
                  </div>
                </div>
              </div>
            )}

            {!loading && error && (
              <div className="p-8 bg-rose-50 rounded-lg border border-rose-200 text-center space-y-2">
                <p className="text-xs font-bold text-rose-700">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-3">
                {resultsList.length === 0 ? (
                  <div className="p-8 md:p-12 bg-white rounded-lg border-2 border-dashed border-slate-200 text-center space-y-4 shadow-2xs">
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <h4 className="text-base font-black text-slate-800">
                        조건에 맞는 최저가 경로가 없습니다
                      </h4>
                    </div>
                  </div>
                ) : (
                  resultsList.map((item) => {
                    let cardStyle = 'border-slate-200 bg-white';
                    let rankStyle = 'bg-slate-200 text-slate-700';

                    if (item.rank === 1) {
                      cardStyle = 'border-2 border-[#00D2B8] shadow-[0_4px_14px_rgba(0,210,184,0.35)] bg-white';
                      rankStyle = 'bg-amber-400 text-slate-950 font-black';
                    } else if (item.rank === 2) {
                      cardStyle = 'border-sky-300 bg-sky-50/30 shadow-2xs';
                      rankStyle = 'bg-sky-500 text-white font-black';
                    } else if (item.rank === 3) {
                      cardStyle = 'border-purple-300 bg-purple-50/30 shadow-2xs';
                      rankStyle = 'bg-purple-500 text-white font-black';
                    }

                    return (
                      <div
                        key={item.rank}
                        onClick={() => setSelectedResultForDetail(item)}
                        className={`rounded-lg border transition-all hover:shadow-md grid grid-cols-1 md:grid-cols-12 overflow-hidden cursor-pointer items-stretch ${cardStyle}`}
                      >
                        <div className="md:col-span-3 lg:col-span-2.5 p-3 bg-slate-50/90 border-b md:border-b-0 md:border-r border-slate-200/80 flex flex-col justify-between space-y-2 shrink-0">
                          <div className="flex items-center space-x-1.5">
                            <span className={`px-2 py-0.5 rounded text-xs shadow-2xs ${rankStyle}`}>
                              {item.rank}등
                            </span>
                          </div>

                          <div className="flex-1 flex flex-col items-center justify-center text-center p-2.5 bg-white rounded border border-slate-200/80 shadow-2xs space-y-2">
                            <div className="flex items-center justify-center">
                              {renderStoreLogo(item.platform)}
                            </div>
                            <h4 className="font-black text-slate-900 text-xs sm:text-sm truncate max-w-full px-1">
                              {item.platform}
                            </h4>
                          </div>
                        </div>

                        <div className="md:col-span-6 lg:col-span-6.5 p-3 md:p-3.5 flex flex-col justify-between space-y-2 min-w-0">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {item.paymentRoute.map((step: string, idx: number) => (
                                <React.Fragment key={idx}>
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[11px] rounded border border-slate-200/80">
                                    {formatMethodName(step)}
                                  </span>
                                  {idx < item.paymentRoute.length - 1 && (
                                    <span className="text-slate-300 font-bold text-[10px]">➔</span>
                                  )}
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="md:col-span-3 lg:col-span-3 p-3 md:p-3.5 bg-gradient-to-br from-[#00D2B8]/10 via-cyan-50/60 to-[#00F5FF]/10 border-t md:border-t-0 md:border-l border-[#00D2B8]/40 flex flex-col justify-between items-end text-right space-y-2 shrink-0">
                          <div className="w-full pt-1.5 border-t border-[#00D2B8]/30 text-right space-y-0.5">
                            <div className="flex justify-between items-center text-[11px] font-black text-[#00A896]">
                              <span>실질 체감가</span>
                              <span className="text-lg font-black text-[#00A896]">
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

          {/* 우측 사이드바 필터 */}
          <aside className="lg:col-span-4 space-y-3.5 h-full">
            <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
              <span className="text-xs font-black text-slate-800 block border-b pb-2">결제 금액 수정</span>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-black text-slate-900 focus:outline-none pr-8 h-[38px]"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">원</span>
              </div>
            </div>

            {/* 💡 공통 필터 컴포넌트로 깔끔하게 대체 및 연산 트리거 연결 */}
            <FilterSection
              filterState={filterState}
              onFilterChange={() => fetchBackendData()}
            />
          </aside>

        </div>
      </div>

      <LegalModals type={modalType} onClose={() => setModalType(null)} />
        {/* 💡 1. 환산 기준 안내 모달 (isCriteriaModalOpen 경고 해결) */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-900 border-b pb-2">
              실시간 최저가 연산 기준 안내
            </h3>
            <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
              <p>• <strong>스토어 멤버십 반영</strong>: 구글 Play Points / 갤럭시 스토어 등급별 적립률이 실시간 연산에 포함됩니다.</p>
              <p>• <strong>즉시 결제 원칙</strong>: 미션/출석체크를 제외하고 당장 결제 가능한 최대 할인 조합을 산출합니다.</p>
              <p>• <strong>1P = 1원 환산</strong>: 적립되는 포인트는 현금 동일 가치(1원)로 실질 체감가에 차감 계산됩니다.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsCriteriaModalOpen(false)}
              className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] text-slate-950 font-black text-sm rounded cursor-pointer"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

      {/* 💡 2. 스토어별 최저가 비교 모달 (isCompareModalOpen, storeComparisonData 경고 해결) */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">스토어별 1위 최저가 비교표</h3>
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
                  className={`p-4 rounded border flex flex-col justify-between space-y-2 ${
                    idx === 0
                      ? 'bg-amber-50/80 border-amber-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="font-extrabold text-slate-900 text-xs">{store.platform}</span>
                  <div>
                    <span className="text-[10px] text-slate-400 font-medium line-through block">
                      {store.originalPrice.toLocaleString()}원
                    </span>
                    <span className="text-lg font-black text-slate-900">
                      {store.minPrice.toLocaleString()}원
                    </span>
                    <span className="text-xs font-extrabold text-rose-600 ml-2">
                      ({store.discountRate}% 절감)
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCompareModalOpen(false)}
              className="w-full py-3 bg-slate-900 text-white font-bold text-xs rounded cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 💡 3. 상세 정보 및 결제 가이드 모달 (selectedResultForDetail, getUsageGuide 경고 해결) */}
      {selectedResultForDetail && (
        <div
          onClick={() => setSelectedResultForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {selectedResultForDetail.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedResultForDetail(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 rounded border border-[#00D2B8]/30 text-xs font-extrabold text-slate-900 leading-relaxed">
              {getUsageGuide(
                selectedResultForDetail.paymentRoute.join(' '),
                selectedResultForDetail.discount_steps.find((s) => s.comboText)?.comboText ||
                selectedResultForDetail.reward_steps.find((s) => s.comboText)?.comboText
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedResultForDetail(null)}
              className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}