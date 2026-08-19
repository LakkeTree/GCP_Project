import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const FILTER_STORAGE_KEY = 'user_search_filter_settings';

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
        className="w-11 h-11 object-contain rounded-xl shadow-2xs border border-slate-100 bg-white p-1 shrink-0"
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
        className="w-11 h-11 object-contain rounded-xl shadow-2xs shrink-0"
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
        className="w-11 h-11 object-contain rounded-xl shadow-2xs shrink-0"
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
        className="w-11 h-11 object-contain rounded-xl shadow-2xs shrink-0"
        onError={(e) => {
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-500 font-bold text-xs flex items-center justify-center border border-slate-200 shrink-0">
      STORE
    </div>
  );
};

export default function SearchResultPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'contact' | null>(null);

  const initialGame = searchParams.get('game') || '붕괴: 스타레일';
  const initialAmount = Number(searchParams.get('amount')) || 200000;

  const filterState = useFilterState(false);
  const { filter, setFilter } = filterState;

  const [gameTitle, setGameTitle] = useState(initialGame);
  const [activeGameTitle, setActiveGameTitle] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);

  const [favoriteGames, setFavoriteGames] = useState<string[]>([]);
  const [allGames, setAllGames] = useState(getInitialGames);
  const [showDropdown, setShowDropdown] = useState(false);

  const measureSpanRef = useRef<HTMLSpanElement>(null);
  const [inputWidth, setInputWidth] = useState<number>(140);

  useEffect(() => {
    if (measureSpanRef.current) {
      const measuredWidth = measureSpanRef.current.getBoundingClientRect().width;
      setInputWidth(Math.max(measuredWidth + 8, 60));
    }
  }, [gameTitle]);

  useEffect(() => {
    const osParam = searchParams.get('os') as OsType | null;
    const storesParam = searchParams.get('stores');
    const carriersParam = searchParams.get('carriers');
    const paysParam = searchParams.get('pays');
    const vouchersParam = searchParams.get('vouchers');
    const specialCardParam = searchParams.get('specialCard');
    const googleTierParam = searchParams.get('googleTier');
    const galaxyTierParam = searchParams.get('galaxyTier');

    setFilter((prev) => {
      const updated = {
        ...prev,
        osType: osParam || prev.osType,
        androidStores: storesParam ? storesParam.split(',').filter(Boolean) : prev.androidStores,
        useGameBenefits: searchParams.has('useGameBenefits') ? searchParams.get('useGameBenefits') === 'true' : prev.useGameBenefits,
        hasPreApplied: searchParams.has('hasPreApplied') ? searchParams.get('hasPreApplied') === 'true' : prev.hasPreApplied,
        isFirstPayment: searchParams.has('isFirstPayment') ? searchParams.get('isFirstPayment') === 'true' : prev.isFirstPayment,
        googlePlayTier: googleTierParam || prev.googlePlayTier,
        galaxyStoreTier: galaxyTierParam || prev.galaxyStoreTier,
        useCarriers: carriersParam !== null ? Boolean(carriersParam && carriersParam.length > 0) : prev.useCarriers,
        carriers: carriersParam !== null ? (carriersParam ? carriersParam.split(',').filter(Boolean) : []) : prev.carriers,
        usePays: paysParam !== null ? Boolean(paysParam && paysParam.length > 0) : prev.usePays,
        pays: paysParam !== null ? (paysParam ? paysParam.split(',').filter(Boolean) : []) : prev.pays,
        useVoucherBypasses: vouchersParam !== null ? Boolean(vouchersParam && vouchersParam.length > 0) : prev.useVoucherBypasses,
        voucherBypasses: vouchersParam !== null ? (vouchersParam ? vouchersParam.split(',').filter(Boolean) : []) : prev.voucherBypasses,
        useSpecialOptions: searchParams.has('useSpecialOptions') ? searchParams.get('useSpecialOptions') === 'true' : prev.useSpecialOptions,
        selectedSpecialCard: specialCardParam || prev.selectedSpecialCard,
        hasPrevSpend: searchParams.has('hasPrevSpend') ? searchParams.get('hasPrevSpend') === 'true' : prev.hasPrevSpend,
        isPcVersion: searchParams.has('isPcVersion') ? searchParams.get('isPcVersion') === 'true' : prev.isPcVersion,
        useNaverMembership: searchParams.has('useNaverMembership') ? searchParams.get('useNaverMembership') === 'true' : prev.useNaverMembership,
        useTossPrime: searchParams.has('useTossPrime') ? searchParams.get('useTossPrime') === 'true' : prev.useTossPrime,
      };

      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [searchParams, setFilter]);

  useEffect(() => {
    const savedFilter = localStorage.getItem('user_filter_settings');
    if (savedFilter) {
      try {
        const parsed = JSON.parse(savedFilter);
        if (parsed.favoriteGames) setFavoriteGames(parsed.favoriteGames);
      } catch (e) {}
    }
  }, []);

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

  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');
  const [loading, setLoading] = useState<boolean>(false);
  const [rawResultsList, setRawResultsList] = useState<OptimizationResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  const currentGameObj = allGames.find((g) => g.name === activeGameTitle);

  const suggestedGames = gameTitle.trim()
    ? allGames.filter(
        (g) =>
          g.name.toLowerCase().includes(gameTitle.toLowerCase()) ||
          g.company.toLowerCase().includes(gameTitle.toLowerCase())
      )
    : [];

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
      let cardCode = CARD_CODE_MAP[filter.selectedSpecialCard] || filter.selectedSpecialCard;
      if (cardCode === 'KB_NORI2_CARD' || cardCode.includes('NORI2')) {
        cardCode = 'KB_KOOKMIN_CARD';
      }
      if (cardCode) selectedProviders.push(cardCode);
    }

    const supportedStoresForGame = currentGameObj?.stores || ['구글', '원스', '갤스', '앱스토어'];

    const targetPlatforms = filter.osType === 'ANDROID'
      ? filter.androidStores
          .filter((s) => isStoreSupported(s, supportedStoresForGame))
          .map((s) => PLATFORM_CODE_MAP[s] || s)
      : ['APP_STORE'];

    const amountNum = payAmount > 0 ? payAmount : 200000;

    try {
      const requests = targetPlatforms.map((platform) => {
        let tier = 'STANDARD';
        if (platform === 'GOOGLE_PLAY') tier = filter.googlePlayTier || 'BRONZE';
        if (platform === 'GALAXY_STORE') tier = filter.galaxyStoreTier || 'STANDARD';

        // 💡 [핵심] 백엔드로 네이버플러스/토스프라임 및 등급 정보를 전달
        const payload = {
          platform: platform,
          amount: amountNum,
          is_first_pay: filter.isFirstPayment,
          payment_methods: selectedProviders,
          game: getGameCode(gameToQuery),
          membership_tier: tier,
          has_subscription: filter.useCarriers,
          has_prev_spend: filter.useSpecialOptions ? filter.hasPrevSpend : false,
          has_pre_applied: filter.hasPreApplied,
          use_game_benefits: filter.useGameBenefits,
          use_naver_membership: filter.usePays && filter.pays.includes('네이버페이') && filter.useNaverMembership,
          use_toss_prime: filter.usePays && filter.pays.includes('토스페이') && filter.useTossPrime,
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
            const providerKorean = REVERSE_PAYMENT_MAP[step.provider] || formatMethodName(step.provider);
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
              formattedText = `-${step.applied_amount.toLocaleString()}원`;
            } else if (step.provider.includes('GOOGLE') || step.provider.includes('PLAY')) {
              const pts = Math.floor(step.applied_amount);
              const wonValue = pts * 10;
              effectiveAmount = wonValue;
              adjustedRewardTotal += effectiveAmount;
              formattedText = `+${pts.toLocaleString()}pt (${wonValue.toLocaleString()}원)`;
            } else {
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
        const totalBenefitAmount = immediateDiscountTotal + rewardPointTotal;

        const discountRatePercent = amountNum > 0 ? Math.round((immediateDiscountTotal / amountNum) * 1000) / 10 : 0;
        const rewardRatePercent = amountNum > 0 ? Math.round((rewardPointTotal / amountNum) * 1000) / 10 : 0;
        const totalBenefitRate = amountNum > 0 ? Math.round((totalBenefitAmount / amountNum) * 1000) / 10 : 0;

        const platformNameMap: Record<string, string> = {
          GOOGLE_PLAY: '구글 플레이 스토어',
          GALAXY_STORE: '갤럭시 스토어',
          ONE_STORE: '원스토어',
          APP_STORE: '앱스토어',
        };

        const platformDisp = platformNameMap[(route as any).reqPlatform] || (route as any).reqPlatform;
        const title = `${platformDisp}`;

        const bonusBadges: string[] = [];
        if (filter.isFirstPayment) bonusBadges.push('첫 결제 혜택');
        if (filter.useGameBenefits) bonusBadges.push('게임 전용 이벤트');

        const pathTextForGuide = routeProviders.join(' ');
        const mainComboStr = discountSteps.find((s) => s.comboText)?.comboText;
        const guideText = getUsageGuide(pathTextForGuide, mainComboStr);

        return {
          rank: idx + 1,
          title,
          platform: platformDisp,
          os: filter.osType,
          original_price: amountNum,
          actual_payment_price: actualPaymentPrice,
          immediate_discount_total: immediateDiscountTotal,
          discountRatePercent,
          reward_point: rewardPointTotal,
          rewardRatePercent,
          final_price: route.net_cost,
          total_benefit_amount: totalBenefitAmount,
          discount_rate: totalBenefitRate,
          paymentRoute: routeProviders.length > 0 ? routeProviders : ['기본 결제 수단'],
          discountDetail: `${totalBenefitRate}% 체감 혜택 적용`,
          storeIcon: '🎮',
          discount_steps: discountSteps,
          reward_steps: rewardSteps,
          guide_text: guideText,
          appliedBonusBadges: bonusBadges,
        };
      });

      setRawResultsList(converted);
    } catch (err: any) {
      console.error('백엔드 연산 오류:', err);
      setError('최저가 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [activeGameTitle, filter, payAmount, currentGameObj]);

  useEffect(() => {
    fetchBackendData();
  }, []);

  const sortedResults = useMemo(() => {
    const list = [...rawResultsList];
    if (sortOption === 'BEST_PRICE') {
      list.sort((a, b) => a.final_price - b.final_price);
    } else if (sortOption === 'POINT_FIRST') {
      list.sort((a, b) => b.reward_point - a.reward_point);
    } else if (sortOption === 'DISCOUNT_RATE') {
      list.sort((a, b) => b.total_benefit_amount - a.total_benefit_amount);
    }

    return list.map((item, index) => ({ ...item, rank: index + 1 }));
  }, [rawResultsList, sortOption]);

  const handleApplyFilterSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActiveGameTitle(gameTitle);
    
    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(payAmount),
      os: filter.osType,
      stores: filter.osType === 'IOS' ? '앱스토어' : filter.androidStores.join(','),
      useGameBenefits: String(filter.useGameBenefits),
      hasPreApplied: String(filter.hasPreApplied),
      isFirstPayment: String(filter.isFirstPayment),
      googleTier: filter.googlePlayTier,
      galaxyTier: filter.galaxyStoreTier,
      carriers: filter.useCarriers ? filter.carriers.join(',') : '',
      pays: filter.usePays ? filter.pays.join(',') : '',
      vouchers: filter.useVoucherBypasses ? filter.voucherBypasses.join(',') : '',
      useSpecialOptions: String(filter.useSpecialOptions),
      specialCard: filter.selectedSpecialCard,
      hasPrevSpend: String(filter.hasPrevSpend),
      isPcVersion: String(filter.isPcVersion),
      useNaverMembership: String(filter.useNaverMembership),
      useTossPrime: String(filter.useTossPrime),
    });
    setSearchParams(params);

    fetchBackendData(gameTitle);
  };

  const supportedStoresList = currentGameObj?.stores || ['구글', '갤스', '앱스토어'];

  const storeBestRankings = useMemo(() => {
    const map = new Map<string, OptimizationResult>();
    rawResultsList.forEach((item) => {
      if (!map.has(item.platform) || item.final_price < map.get(item.platform)!.final_price) {
        map.set(item.platform, item);
      }
    });
    return Array.from(map.values());
  }, [rawResultsList]);

  return (
    <div className="bg-gradient-to-b from-[#F2F5F8] via-[#F8FAFC] to-[#EFF4F8] min-h-screen py-6 md:py-8 relative font-sans text-slate-800 overflow-x-clip">
      
      <span
        ref={measureSpanRef}
        className="absolute invisible text-2xl md:text-3xl font-black whitespace-pre tracking-normal font-sans"
        aria-hidden="true"
      >
        {gameTitle || '게임 검색...'}
      </span>

      <div className="absolute top-0 right-0 w-[550px] h-[550px] pointer-events-none opacity-[0.06] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,20 480,80 380,420 40,300" fill="#00D2B8" />
          <polygon points="480,80 380,420 490,480" fill="#0F172A" />
        </svg>
      </div>
      <div className="absolute top-[20%] -left-16 w-[500px] h-[500px] pointer-events-none opacity-[0.05] z-0 rotate-12">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,50 450,120 300,450 100,380" fill="#00D2B8" />
          <polygon points="450,120 300,450 480,320" fill="#00E5FF" />
        </svg>
      </div>

      <div className="max-w-[1380px] mx-auto px-4 md:px-6 space-y-6 relative z-10">
        
        {/* 상단 타이틀 헤더 */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 min-h-[125px] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-20">
          <div className="flex items-center space-x-4 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleToggleFavorite}
              className={`p-2.5 rounded-xl border transition-all active:scale-95 cursor-pointer shrink-0 shadow-2xs ${
                isFavorite
                  ? 'bg-amber-400 text-amber-950 border-amber-300 ring-2 ring-amber-400/40'
                  : 'bg-slate-50 text-slate-400 border-slate-200 hover:bg-amber-50 hover:text-amber-500'
              }`}
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill={isFavorite ? '#FFF' : 'none'} stroke="currentColor" strokeWidth="2.3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </button>
            
            {currentGameObj?.icon_url ? (
              <img src={currentGameObj.icon_url} alt={activeGameTitle} className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-2xs shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl border border-slate-200 shrink-0">🎮</div>
            )}

            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                <div className="relative inline-flex items-center shrink-0">
                  <input
                    type="text"
                    value={gameTitle}
                    onChange={(e) => {
                      setGameTitle(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    onBlur={() => setTimeout(() => setShowDropdown(false), 250)}
                    style={{ width: `${inputWidth}px` }}
                    className="text-2xl md:text-3xl font-black text-[#00D2B8] underline underline-offset-4 decoration-2 bg-transparent focus:outline-none transition-[width] duration-75"
                    placeholder="게임 검색..."
                  />

                  {showDropdown && suggestedGames.length > 0 && (
                    <ul className="absolute left-0 top-[48px] z-50 bg-white border border-slate-200 rounded-xl shadow-2xl max-h-60 overflow-y-auto min-w-[280px] divide-y divide-slate-100">
                      {suggestedGames.map((game) => (
                        <li
                          key={game.id}
                          onMouseDown={() => {
                            setGameTitle(game.name);
                            setActiveGameTitle(game.name);
                            setShowDropdown(false);
                            fetchBackendData(game.name);
                          }}
                          className="p-3 hover:bg-gradient-to-r hover:from-[#00D2B8]/10 hover:to-[#00F5FF]/10 cursor-pointer flex items-center space-x-3 transition-colors"
                        >
                          {game.icon_url ? (
                            <img src={game.icon_url} alt={game.name} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs shrink-0">🎮</div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-900 truncate">{game.name}</p>
                            <p className="text-[10px] font-medium text-slate-400 truncate">{game.company}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <span className="text-2xl md:text-3xl font-black text-slate-900 shrink-0">에 관한 검색 결과</span>
              </div>

              <div className="flex items-center space-x-3 text-xs text-slate-500 font-bold pt-0.5">
                <span>기준 결제 금액: <strong className="text-slate-900 font-black">{payAmount.toLocaleString()}원</strong></span>
                <span className="text-slate-300">|</span>
                <div className="flex items-center space-x-1.5">
                  <span className="text-slate-400 font-bold">지원 스토어:</span>
                  {supportedStoresList.map((st) => (
                    <span key={st} className="px-2 py-0.5 bg-slate-100 rounded text-[11px] font-bold text-slate-700 border border-slate-200/80">
                      {st}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleApplyFilterSearch()}
            className="px-5 py-3.5 bg-[#0B132B] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 shrink-0 border border-slate-700 h-12"
          >
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>다시 검색 (재연산)</span>
          </button>
        </div>

        {/* 2. 본문 grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* 메인 최저가 카드 리스트 영역 (왼쪽 8열) */}
          <main className="lg:col-span-8 space-y-4">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs pb-1">
              <div className="flex items-center space-x-2 font-bold text-slate-600">
                <span>총 <strong className="text-[#00A896] font-black text-sm">{sortedResults.length}개</strong>의 추천 결제 경로</span>
                <button
                  type="button"
                  onClick={() => setIsCriteriaModalOpen(true)}
                  className="text-slate-400 hover:text-slate-600 underline font-medium cursor-pointer"
                >
                  [환산 기준 보기]
                </button>
                <button
                  type="button"
                  onClick={() => setIsCompareModalOpen(true)}
                  className="px-3 py-1.5 bg-[#00D2B8]/15 text-[#008A7B] font-extrabold rounded-lg border border-[#00D2B8]/30 hover:bg-[#00D2B8]/25 transition-all cursor-pointer shadow-2xs"
                >
                  스토어별 최저가 비교
                </button>
              </div>

              <div className="flex items-center space-x-1 bg-slate-200/70 p-1 rounded-xl border border-slate-200/80">
                {[
                  { key: 'BEST_PRICE', label: '최적 체감가 순' },
                  { key: 'POINT_FIRST', label: '최대 적립 순' },
                  { key: 'DISCOUNT_RATE', label: '최대 할인율 순' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setSortOption(tab.key as SortOption)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                      sortOption === tab.key
                        ? 'bg-[#0B132B] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center space-y-3 shadow-2xs">
                <div className="w-9 h-9 border-4 border-[#00D2B8] border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-xs font-extrabold text-slate-600">최적 결제 경로를 연산하는 중입니다...</p>
              </div>
            ) : error ? (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-700 text-xs font-bold shadow-2xs">
                {error}
              </div>
            ) : sortedResults.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-16 text-center text-slate-500 text-xs font-bold shadow-2xs">
                선택하신 조건에 해당하는 할인 조합 경로가 없습니다.
              </div>
            ) : (
              sortedResults.map((item) => {
                const isFirst = item.rank === 1;
                const isSecond = item.rank === 2;
                const isThird = item.rank === 3;

                let cardStyle = "bg-gradient-to-r from-slate-50/80 to-white border-slate-200/90 hover:border-slate-300";
                if (isFirst) {
                  cardStyle = "bg-gradient-to-r from-amber-500/10 via-amber-50/40 to-white border-[#00D2B8] ring-2 ring-[#00D2B8]/40 shadow-[0_4px_20px_rgba(0,210,184,0.15)]";
                } else if (isSecond) {
                  cardStyle = "bg-gradient-to-r from-sky-500/10 via-sky-50/40 to-white border-sky-300 ring-1 ring-sky-400/20";
                } else if (isThird) {
                  cardStyle = "bg-gradient-to-r from-purple-500/10 via-purple-50/40 to-white border-purple-300 ring-1 ring-purple-400/20";
                }

                return (
                  <div
                    key={item.rank}
                    onClick={() => setSelectedResultForDetail(item)}
                    className={`rounded-2xl border-2 transition-all cursor-pointer shadow-2xs hover:shadow-md p-3.5 md:p-4 space-y-3 ${cardStyle}`}
                  >
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-0 items-stretch">
                      
                      <div className="md:col-span-3 border-b md:border-b-0 md:border-r border-slate-200/90 p-2 pr-4 flex flex-col items-center justify-center text-center space-y-2">
                        <div className="flex items-center space-x-1.5">
                          <span className={`px-2.5 py-0.5 text-[11px] font-black rounded ${
                            isFirst
                              ? 'bg-amber-400 text-slate-950 shadow-2xs'
                              : isSecond
                              ? 'bg-sky-500 text-white shadow-2xs'
                              : isThird
                              ? 'bg-purple-500 text-white shadow-2xs'
                              : 'bg-slate-600 text-white'
                          }`}>
                            {item.rank}등
                          </span>
                          {isFirst && (
                            <span className="px-2 py-0.5 bg-[#00D2B8] text-slate-950 text-[11px] font-black rounded shadow-2xs">
                              최고 추천
                            </span>
                          )}
                        </div>

                        <div className="pt-0.5 flex flex-col items-center space-y-1">
                          <span className="text-[10px] font-bold text-slate-400">결제 추천 스토어</span>
                          {renderStoreLogo(item.platform)}
                          <span className="text-xs font-black text-slate-900 pt-0.5">{item.platform}</span>
                        </div>
                      </div>

                      <div className="md:col-span-5 border-b md:border-b-0 md:border-r border-slate-200/90 p-2 px-4 space-y-2.5 text-xs flex flex-col justify-center">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-extrabold text-slate-400 block">결제 진행 수단 및 경로</span>
                          <div className="flex items-center flex-wrap gap-1">
                            {item.paymentRoute.map((p, idx) => (
                              <React.Fragment key={idx}>
                                <span className="px-2.5 py-0.5 bg-white/90 text-slate-800 font-extrabold rounded border border-slate-200 text-[11px]">
                                  {p}
                                </span>
                                {idx < item.paymentRoute.length - 1 && (
                                  <span className="text-slate-300 font-black text-xs">➔</span>
                                )}
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold text-slate-400 block">할인</span>
                          {item.discount_steps.length > 0 ? (
                            <ul className="space-y-1">
                              {item.discount_steps.map((ds, idx) => (
                                <li key={idx} className="text-rose-600 font-extrabold text-[11px] flex items-center justify-between bg-rose-50/90 px-2.5 py-1 rounded border border-rose-200/80">
                                  <span className="truncate max-w-[170px]">• {ds.eventName}</span>
                                  <span className="shrink-0 font-black">({ds.formattedAmountText})</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 font-bold text-[11px] block pl-1">할인 미적용</span>
                          )}
                        </div>

                        <div className="space-y-1 pt-1 border-t border-slate-100">
                          <span className="text-[10px] font-extrabold text-slate-400 block">적립</span>
                          {item.reward_steps.length > 0 ? (
                            <ul className="space-y-1">
                              {item.reward_steps.map((rs, idx) => (
                                <li key={idx} className="text-emerald-700 font-extrabold text-[11px] flex items-center justify-between bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200/80">
                                  <span className="truncate max-w-[170px]">• {rs.eventName}</span>
                                  <span className="shrink-0 font-black">({rs.formattedAmountText})</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-slate-400 font-bold text-[11px] block pl-1">적립 미적용</span>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-4 p-2 pl-4 flex flex-col justify-between h-full space-y-2 text-right text-xs">
                        <div className="flex justify-end">
                          <span className="px-2.5 py-0.5 bg-rose-500 text-white font-black text-[11px] rounded-md shadow-2xs">
                            실질 {item.discount_rate}% OFF
                          </span>
                        </div>

                        <div className="space-y-1">
                          {item.immediate_discount_total > 0 && (
                            <div className="bg-rose-50/90 p-2 rounded-xl border border-rose-200/80 space-y-0.5 text-rose-800 font-black text-right">
                              <div className="flex justify-between items-center text-[11px]">
                                <span>총 할인 ({item.discountRatePercent}%)</span>
                                <span className="text-rose-600 font-black">-{item.immediate_discount_total.toLocaleString()}원</span>
                              </div>
                              {item.discount_steps.map((ds, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600 font-medium text-[10px] pl-1">
                                  <span>└ {ds.providerName}</span>
                                  <span className="text-rose-600 font-bold">-{ds.amount.toLocaleString()}원</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {item.reward_point > 0 && (
                            <div className="bg-emerald-50/90 p-2 rounded-xl border border-emerald-200/80 space-y-0.5 text-emerald-800 font-black text-right">
                              <div className="flex justify-between items-center text-[11px]">
                                <span>총 적립 ({item.rewardRatePercent}%)</span>
                                <span className="text-emerald-700 font-black">+{item.reward_point.toLocaleString()}원 상당</span>
                              </div>
                              {item.reward_steps.map((rs, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600 font-medium text-[10px] pl-1">
                                  <span>└ {rs.providerName}</span>
                                  <span className="text-emerald-700 font-bold">+{rs.amount.toLocaleString()}원</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 space-y-0.5">
                          <div className="flex justify-between text-slate-400 font-medium text-[11px]">
                            <span>정가</span>
                            <span className="line-through">{item.original_price.toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between text-slate-700 font-bold text-[11px]">
                            <span>실제 결제액</span>
                            <span className="font-black">{item.actual_payment_price.toLocaleString()}원</span>
                          </div>
                          <div className="flex justify-between items-baseline pt-0.5">
                            <span className="font-extrabold text-slate-900 text-xs">실질 체감가</span>
                            <span className="text-xl md:text-2xl font-black text-emerald-600">{item.final_price.toLocaleString()}원</span>
                          </div>
                        </div>

                      </div>

                    </div>
                  </div>
                );
              })
            )}
          </main>

          {/* 우측 결제 조건 설정 패널 및 스티키 광고 영역 (오른쪽 4열) */}
          <aside className="lg:col-span-4 space-y-5">
            
            <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-2">
              <label className="text-xs font-black text-slate-900 block">결제 금액 수정</label>
              <form onSubmit={handleApplyFilterSearch} className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 font-black text-slate-900 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#00D2B8]"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">원</span>
                </div>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-[#0B132B] hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                >
                  적용
                </button>
              </form>
            </div>

            <FilterSection filterState={filterState} />

            <div className="sticky top-28 bg-[#0B132B] rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-between text-center shadow-xl h-[580px] z-30">
              <span className="px-3 py-1 bg-slate-800/90 text-slate-300 font-bold text-[10px] rounded-full border border-slate-700/80 tracking-wider">
                ADVERTISEMENT
              </span>
              <div className="space-y-4 my-auto">
                <div className="w-16 h-16 bg-slate-800/80 rounded-2xl flex items-center justify-center text-sm font-black text-[#00D2B8] border border-slate-700/90 mx-auto shadow-inner">
                  AD
                </div>
                <div className="space-y-2">
                  <h3 className="font-black text-white text-base">제휴 카드 프로모션</h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-[170px] mx-auto font-medium">
                    최저가 결제 조합 전용 추가 적립 및 카테고리별 청구 할인 프로모션 혜택
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalType('contact')}
                className="w-full py-3.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded-xl transition-all shadow-lg cursor-pointer"
              >
                제휴 문의하기
              </button>
            </div>

          </aside>

        </div>
      </div>

      {/* 환산 기준 모달 */}
      {isCriteriaModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-2">최저가 연산 산출 기준</h3>
            <ul className="text-xs space-y-2 text-slate-600 list-disc pl-4 leading-relaxed font-medium">
              <li>실시되는 스토어 쿠폰, 카드사 전월 실적/청구 할인, 간편결제 적립을 실시간 합산 연산합니다.</li>
              <li>구글 플레이 포인트는 10pt 당 100원 환산 기준으로 실체감가를 적용합니다.</li>
              <li>중복 적용이 불가능한 결제 수단 조합은 자동으로 필터링하여 최적 경로만 제공합니다.</li>
            </ul>
            <button
              type="button"
              onClick={() => setIsCriteriaModalOpen(false)}
              className="w-full py-3 bg-[#0B132B] text-white font-bold text-xs rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* 스토어별 1위 최저가 비교표 모달 */}
      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-black text-slate-900">스토어별 1위 최저가 비교표</h3>
              <button
                type="button"
                onClick={() => setIsCompareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {storeBestRankings.map((res, idx) => (
                <div
                  key={res.platform}
                  className={`p-4 rounded-xl border flex flex-col justify-between space-y-2 ${
                    idx === 0 ? 'bg-amber-50/50 border-amber-300' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="font-extrabold text-xs text-slate-900">{res.platform}</span>
                  <div>
                    <p className="text-[11px] text-slate-400 line-through">{res.original_price.toLocaleString()}원</p>
                    <div className="flex items-baseline space-x-1.5">
                      <span className="font-black text-slate-900 text-lg">{res.final_price.toLocaleString()}원</span>
                      <span className="text-rose-600 font-extrabold text-xs">({res.discount_rate}% 절감)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setIsCompareModalOpen(false)}
              className="w-full py-3.5 bg-[#0B132B] text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 상세 보기 모달 */}
      {selectedResultForDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">{selectedResultForDetail.title} 조합안 {selectedResultForDetail.rank} 상세 보기</h3>
              <button
                type="button"
                onClick={() => setSelectedResultForDetail(null)}
                className="text-slate-400 hover:text-slate-600 font-black text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-2">
                <p className="font-extrabold text-slate-900 flex items-center gap-1.5">
                  <span>📌</span> 경로 이용 가이드
                </p>
                <p className="text-slate-600 leading-relaxed font-medium">{selectedResultForDetail.guide_text}</p>
              </div>

              <div className="space-y-2.5">
                <p className="font-extrabold text-slate-900">할인 및 적립 세부 항목</p>
                {[...selectedResultForDetail.discount_steps, ...selectedResultForDetail.reward_steps].map((step, idx) => {
                  const isDiscount = step.type === 'DISCOUNT' || step.type === 'FEE';
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl p-3.5 space-y-1 border shadow-2xs ${
                        isDiscount
                          ? 'bg-rose-50/90 border-rose-200/90'
                          : 'bg-emerald-50/90 border-emerald-200/90'
                      }`}
                    >
                      <div className="flex justify-between font-bold text-xs">
                        <span className="text-slate-900">{step.eventName}</span>
                        <span className={isDiscount ? 'text-rose-600 font-black' : 'text-emerald-700 font-black'}>
                          {step.formattedAmountText}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-normal font-medium">{step.conditionText}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedResultForDetail(null)}
              className="w-full py-3.5 bg-[#0B132B] text-white font-extrabold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      <LegalModals type={modalType} onClose={() => setModalType(null)} />
    </div>
  );
}