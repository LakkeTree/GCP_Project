import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import LegalModals from '../components/LegalModals';
import type { OsType } from '../constants/searchOptions';
import { getGameCode } from '../constants/gameMapping';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  CARD_CODE_MAP,
  PLATFORM_CODE_MAP,
  PAYMENT_METHOD_MAP,
  LAYER_NAME_MAP,
  REVERSE_PAYMENT_MAP,
  BACKEND_API_URL,
} from '../constants/searchOptions';



// 검색 결과 및 상세 모달 전용 한국어 명칭 통합 매핑 사전
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
  
  // 1. 통합 매핑 사전에 정확히 일치하는 영문명이 있으면 한글로 즉시 변환
  if (KOREAN_PAYMENT_MAP[trimmed]) {
    return KOREAN_PAYMENT_MAP[trimmed];
  }

  // 2. 부분 일치 및 긴 이벤트 타이틀 정돈
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
const getUsageGuide = (pathText: string) => {
  const text = pathText.toUpperCase();

  if (text.includes('CU')) {
    return '결제 경로 가이드: CU 편의점/Pocket CU 앱에서 구글 기프트카드 구매 ➔ 영수증/카드 핀번호(코드) 입력 ➔ 구글 스토어 충전 후 결제';
  }
  if (text.includes('ZEROPIN') || text.includes('제로핀')) {
    return '결제 경로 가이드: 제로핀 공식몰에서 기프트코드 할인 구매 ➔ 발급된 핀번호 입력 및 스토어 충전 ➔ 인앱 결제 진행';
  }
  if (text.includes('CULTURELAND') || text.includes('컬쳐랜드') || text.includes('북앤라이프')) {
    return '결제 경로 가이드: 문화상품권 할인 구매 ➔ 해당 컬쳐캐시/상품권 핀번호 입력 충전 ➔ 스토어 우회 결제 적용';
  }
  if (text.includes('NAVER') && (text.includes('STORE') || text.includes('스토어'))) {
    return '결제 경로 가이드: 네이버 스마트스토어 공식 판매처 구매 ➔ 문자/알림톡 기프트코드 핀번호 입력 ➔ 스토어 등록 후 결제';
  }
  if (text.includes('삼성페이') || text.includes('SAMSUNG_PAY')) {
    return '결제 경로 가이드: 스토어 쿠폰함에서 할인 쿠폰 받기 ➔ 게임 결제창 접속 ➔ 삼성페이 선택하여 즉시 결제';
  }
  if (text.includes('갤럭시') || text.includes('GALAXY')) {
    return '결제 경로 가이드: 갤럭시 스토어 [쿠폰함] 쿠폰 다운로드 ➔ 게임 결제창에서 쿠폰 적용 후 선택 결제 수단으로 결제';
  }
  if (text.includes('원스토어') || text.includes('ONE_STORE')) {
    return '결제 경로 가이드: 원스토어 [혜택/쿠폰함] 쿠폰 및 T멤버십 할인 선택 ➔ 결제 수단 최종 확인 후 결제';
  }
  if (text.includes('구글') || text.includes('GOOGLE')) {
    return '결제 경로 가이드: 구글 플레이 [혜택] 탭 쿠폰 적용 확인 ➔ 게임 인앱 결제창에서 보유 수단으로 진행';
  }
  
  return '결제 경로 가이드: 해당 스토어 쿠폰함에서 이벤트 쿠폰 적용 ➔ 지정된 결제 수단 선택 후 최종 결제 진행';
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
    .replace(/할인 쿠폰$/, '쿠폰')
    .trim();

  // 첫 결제 혜택 명시화
  if (title.includes('첫 결제') || title.includes('FIRST_PAY')) {
    if (!cleaned.startsWith('[첫 결제]')) {
      cleaned = `[첫 결제 혜택] ${cleaned.replace(/^스토어별 첫 결제 혜택 -\s*/, '')}`;
    }
  }

  return cleaned;
};

// 💡 실제 저장된 이미지 파일(PNG/JPG)을 불러오는 renderStoreLogo 함수
const renderStoreLogo = (platformName: string) => {
  const p = platformName.toLowerCase();

  // 1. 구글 플레이 스토어
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

  // 2. 갤럭시 스토어
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

  // 3. 원스토어
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

  // 4. 애플 앱스토어
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

  const [gameTitle, setGameTitle] = useState(initialGame);
  const [activeGameTitle, setActiveGameTitle] = useState(initialGame);

  const [payAmount, setPayAmount] = useState<number>(initialAmount);
  const [osType, setOsType] = useState<OsType>(initialOs);
  const [androidStores, setAndroidStores] = useState<string[]>(initialStores);

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

  // 기존 코드
  const [googlePlayTier, setGooglePlayTier] = useState(initialGoogleTier);
  const [galaxyStoreTier, setGalaxyStoreTier] = useState(initialGalaxyTier);
  const [isPcVersion] = useState(initialIsPcVersion);

  const [useTMembership] = useState(true);  // 🔽 아래 2줄을 새로 추가해 주세요!


  const [useNaverMembership, setUseNaverMembership] = useState(false);
  const [useTossPrime, setUseTossPrime] = useState(false);

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

  // BigQuery 결제수단 통합 API로부터 카드사 목록을 동적 로드하는 State & Effect
  const [dynamicCardOptions, setDynamicCardOptions] = useState<{ label: string; value: string }[]>([
    { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' }
  ]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/payments')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          // 1. 우회 결제/기프트카드 관련 수단 제외 키워드
          const EXCLUDE_KEYWORDS = [
            'GIFTCARD', 'GIFT_CARD', 'SSG', '11STREET', 'GMARKET',
            'CONVENIENCE', 'CU_', 'GS25', 'SEVEN', 'ZEROPIN', 'NAVER_STORE', 'APPLE_GIFT',
            'CREDIT_CHECK_CARD', 'CREDIT'
          ];

          // 2. 카드 상품이 아닌 더미/일반 혜택 타이틀 제외 키워드
          const EXCLUDE_TITLES = [
            'CREDIT CHECK CARD', '삼성페이', '결제수단별', '기본 적립률', '기본/이벤트 혜택'
          ];

          const genuineCardMethods = result.data.filter((m: any) => {
            const isCardCategory = m.category === 'CARD' || m.code.includes('CARD');
            const isExcluded = EXCLUDE_KEYWORDS.some((kw) => m.code.toUpperCase().includes(kw));
            return isCardCategory && !isExcluded;
          });

          const cardOptions: { label: string; value: string }[] = [
            { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' }
          ];

          const addedCardTitles = new Set<string>();

          genuineCardMethods.forEach((c: any) => {
            if (c.benefits && c.benefits.length > 0) {
              c.benefits.forEach((b: any) => {
                const cardName = b.title || c.name;
                const isTitleExcluded = EXCLUDE_TITLES.some((t) => cardName.includes(t));

                if (!addedCardTitles.has(cardName) && !isTitleExcluded) {
                  addedCardTitles.add(cardName);
                  cardOptions.push({
                    label: cardName, // '[제휴]' 접두사 제거
                    value: c.code,
                  });
                }
              });
            } else {
              const isTitleExcluded = EXCLUDE_TITLES.some((t) => c.name.includes(t));
              if (!addedCardTitles.has(c.name) && !isTitleExcluded) {
                addedCardTitles.add(c.name);
                cardOptions.push({
                  label: c.name, // '[제휴]' 접두사 제거
                  value: c.code,
                });
              }
            }
          });

          setDynamicCardOptions(cardOptions);
        }
      })
      .catch((err) => console.error('제휴 카드 동적 로드 실패:', err));
  }, []);



  
  const [hasPrevSpend, setHasPrevSpend] = useState(initialHasPrevSpend);

  const [useGameBenefits, setUseGameBenefits] = useState(initialUseGameBenefits);
  const [hasPreApplied, setHasPreApplied] = useState(initialHasPreApplied);
  const [isFirstPayment, setIsFirstPayment] = useState(initialIsFirstPayment);

  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');

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

  // SearchResultPage.tsx 내 fetchBackendData 함수 내부 상단에 추가

const fetchBackendData = useCallback(async (targetGameName?: string) => {
  setLoading(true);
  setError(null);

  const gameToQuery = targetGameName || activeGameTitle;

  // 💡 [추가] 검색 실행 시 백엔드로 검색 로그전송 (카운트 +1)
  try {
    fetch('http://127.0.0.1:8000/games/search-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_name: gameToQuery }),
    }).catch((err) => console.error('검색 로그 전송 실패:', err));
  } catch (e) {}

  // ... (기존 최저가 계산 연산 로직 유지를 위해 아래 동일)
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

    // 💡 선택한 게임의 실제 지원 스토어에 포함된 플랫폼만 필터링하여 요청
    const supportedStoresForGame = currentGameObj?.stores || ['구글', '원스', '갤스', '앱스토어'];

    const targetPlatforms = osType === 'ANDROID'
      ? androidStores
          .filter((s) => isStoreSupported(s, supportedStoresForGame))
          .map((s) => PLATFORM_CODE_MAP[s] || s)
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
          game: getGameCode(gameToQuery),
          membership_tier: tier,
          has_subscription: useTMembership, // 통신사 멤버십 할인 포함
          has_prev_spend: useSpecialOptions ? hasPrevSpend : false,
          has_pre_applied: hasPreApplied,
          use_game_benefits: useGameBenefits,
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
            // 연산 요청한 실제 스토어 코드를 각 경로 데이터에 결합
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
            // 백엔드에서 넘어온 step.applied_amount는 순수 포인트(pt) 수량입니다.
            // Google Play Points 기준: 1pt = 10원 가치로 일관되게 환산합니다.
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
        if (osType === 'IOS' || displayPlatform.includes('앱스토어')) storeIcon = 'APPLE';

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

        // 실제 사용된 혜택이 존재하는 경우만 뱃지 동적 생성
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
  }, [
    osType, androidStores, payAmount, isFirstPayment, useCarriers, carriers,
    usePays, pays, useVoucherBypasses, vouchers, useSpecialOptions,
    selectedSpecialCard, googlePlayTier, galaxyStoreTier, hasPrevSpend,
    hasPreApplied, useGameBenefits, activeGameTitle
  ]);

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
      setAndroidStores((prev) => prev.filter((st) => isStoreSupported(st, currentGameObj.stores)));
    }
  }, [activeGameTitle, currentGameObj]);

  const suggestedGames = gameTitle.trim()
    ? allGames.filter(
        (g) =>
          g.name.toLowerCase().includes(gameTitle.toLowerCase()) ||
          g.company.toLowerCase().includes(gameTitle.toLowerCase())
      )
    : [];

  useEffect(() => {
    fetchBackendData();
  }, []);

  const handleSelectSuggestedGame = (selectedGameName: string) => {
    setGameTitle(selectedGameName);
    setActiveGameTitle(selectedGameName);
    setShowDropdown(false);

    const params = new URLSearchParams({
      game: selectedGameName,
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
    fetchBackendData(gameTitle);
  };

  const isGoogleSelected = osType === 'ANDROID' && androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = osType === 'ANDROID' && androidStores.includes('갤럭시 스토어');

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
      
      {/* 수직 연속 SVG 다층 기하학 모듈 */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] pointer-events-none opacity-[0.05] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,20 480,80 380,420 40,300" fill="#00D2B8" />
          <polygon points="480,80 380,420 490,480" fill="#0F172A" />
        </svg>
      </div>

      <div className="absolute top-[20%] -left-16 w-[500px] h-[500px] pointer-events-none opacity-[0.04] z-0 rotate-12">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,50 450,120 300,450 100,380" fill="#00D2B8" />
          <polygon points="450,120 300,450 480,320" fill="#00E5FF" />
        </svg>
      </div>

      <div className="absolute top-[45%] -right-20 w-[600px] h-[600px] pointer-events-none opacity-[0.05] z-0 -rotate-15">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="80,100 420,30 350,480 60,320" fill="#00E5FF" />
          <polygon points="420,30 350,480 490,250" fill="#0F172A" />
        </svg>
      </div>

      <div className="absolute top-[70%] -left-20 w-[550px] h-[550px] pointer-events-none opacity-[0.04] z-0 rotate-45">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="100,40 460,150 280,460 50,300" fill="#00D2B8" />
        </svg>
      </div>

      <div className="absolute bottom-10 right-0 w-[500px] h-[500px] pointer-events-none opacity-[0.05] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="150,30 450,100 390,450 80,350" fill="#00E5FF" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">          
          <main className="lg:col-span-8 space-y-5">
            
            {/* 상단 타이틀 배너 */}
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

                  {favoriteGames.length > 0 && (
                    <div className="flex items-center space-x-1.5 pt-1">
                      <span className="text-amber-500 font-bold text-[11px] shrink-0 flex items-center gap-0.5">
                        ★ 즐겨찾기:
                      </span>
                      <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar">
                        {favoriteGames.map((favGame) => (
                          <button
                            key={favGame}
                            type="button"
                            onClick={() => handleSelectSuggestedGame(favGame)}
                            className={`text-[10.5px] font-extrabold px-2.5 py-0.5 rounded border transition-all cursor-pointer whitespace-nowrap ${
                              favGame === activeGameTitle
                                ? 'bg-amber-400 text-slate-950 border-amber-500 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:bg-amber-50'
                            }`}
                          >
                            {favGame}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(() => {
                    let recentList: string[] = [];
                    try {
                      const localFilter = localStorage.getItem('user_filter_settings');
                      if (localFilter) {
                        const parsed = JSON.parse(localFilter);
                        if (Array.isArray(parsed.recentSearches)) {
                          recentList = parsed.recentSearches.filter((g: string) => g !== activeGameTitle);
                        }
                      }
                    } catch (e) {}

                    if (recentList.length === 0) return null;

                    return (
                      <div className="flex items-center space-x-1.5">
                        <span className="text-slate-400 font-bold text-[11px] shrink-0">
                          최근 검색:
                        </span>
                        <div className="flex flex-wrap gap-1.5 overflow-x-auto no-scrollbar">
                          {recentList.slice(0, 5).map((recGame) => (
                            <button
                              key={recGame}
                              type="button"
                              onClick={() => handleSelectSuggestedGame(recGame)}
                              className="text-[10.5px] font-extrabold text-slate-600 bg-white hover:bg-slate-50 hover:text-[#00A896] px-2 py-0.5 rounded border border-slate-200 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                            >
                              {recGame}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
                <div className="absolute inset-0 p-4 space-y-3 filter blur-md opacity-40 pointer-events-none">
                  {[1, 2, 3].map((idx) => (
                    <div key={idx} className="h-28 bg-slate-200 rounded" />
                  ))}
                </div>

                <div className="relative z-10 flex flex-col items-center justify-center space-y-4 text-center">
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 border-4 border-slate-200 border-t-[#00D2B8] rounded-full animate-spin shadow-md" />
                    <div className="absolute w-8 h-8 border-4 border-slate-100 border-b-[#00F5FF] rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                  </div>

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

            {!loading && error && (
              <div className="p-8 bg-rose-50 rounded-lg border border-rose-200 text-center space-y-2">
                <p className="text-xs font-bold text-rose-700">{error}</p>
                <p className="text-[11px] text-slate-500">백엔드 서버가 8000번 포트에서 실행 중인지 확인해주세요.</p>
              </div>
            )}

            {!loading && !error && (
              <div className="space-y-3">
                {resultsList.length === 0 ? (
                  <div className="p-8 md:p-12 bg-white rounded-lg border-2 border-dashed border-slate-200 text-center space-y-4 shadow-2xs">
                    <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto border border-slate-200">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <h4 className="text-base font-black text-slate-800">
                        조건에 맞는 최저가 경로가 없습니다
                      </h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        보유하신 결제 수단이나 이용 스토어가 모두 해제되어 있을 수 있습니다. 우측 필터에서 조건을 추가해 보세요!
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
                        className="px-4 py-2 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded shadow-2xs transition-all cursor-pointer"
                      >
                        주요 결제 수단 한 번에 모두 켜기
                      </button>
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
                            {item.rank === 1 && (
                              <span className="text-[10px] font-black text-slate-950 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap">
                                최고 추천
                              </span>
                            )}
                          </div>

                          <div className="flex-1 flex flex-col items-center justify-center text-center p-2.5 bg-white rounded border border-slate-200/80 shadow-2xs space-y-2">
                            <span className="text-[9.5px] text-slate-400 font-extrabold block tracking-tight">
                              결제 추천 스토어
                            </span>

                            {/* 💡 [추가] 스토어 브랜드 SVG 로고 아이콘 노출 */}
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
                            <span className="text-[9.5px] text-slate-400 font-extrabold block">
                              결제 진행 수단 및 경로
                            </span>
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

                          <div className="pt-2 border-t border-slate-100 space-y-1">
                            <div className="flex items-center text-[11px] font-bold min-h-[22px]">
                              <span className="w-12 shrink-0 text-slate-500 font-extrabold">
                                할인
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
                              <span className="w-12 shrink-0 text-slate-500 font-extrabold">
                                적립
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

                        {/* 💡 [수정 포인트 1] 오른쪽 최종 결과창에 시선 강화를 위해 은은한 민트-시안 그라데이션 패널 및 보더 적용 */}
                        <div className="md:col-span-3 lg:col-span-3 p-3 md:p-3.5 bg-gradient-to-br from-[#00D2B8]/10 via-cyan-50/60 to-[#00F5FF]/10 border-t md:border-t-0 md:border-l border-[#00D2B8]/40 flex flex-col justify-between items-end text-right space-y-2 shrink-0">
                          <div className="text-right space-y-1 w-full">
                            <div className="flex items-center justify-end">
                              <span className="px-2 py-0.5 bg-rose-600 text-white font-black text-[11px] rounded shadow-2xs">
                                실질 {item.discount_rate}% OFF
                              </span>
                            </div>

                            <div className="space-y-1 pt-0.5 w-full">
                              {item.immediate_discount_total > 0 && (
                                <div className="flex justify-between items-center text-rose-800 font-black bg-rose-100/90 px-1.5 py-0.5 rounded border border-rose-200 text-[10px]">
                                  <span>총 할인 ({item.discountRatePercent}%)</span>
                                  <span>-{item.immediate_discount_total.toLocaleString()}원</span>
                                </div>
                              )}

                              {item.discount_steps.map((dStep, dIdx) => (
                                <div
                                  key={dIdx}
                                  className="flex justify-between items-center text-rose-700 font-bold bg-white/80 px-1.5 py-0.5 rounded text-[9px] border border-rose-100/80 leading-tight"
                                >
                                  <span className="truncate max-w-[95px] text-left">└ {formatMethodName(dStep.eventName)}</span>
                                  <span className="shrink-0 font-black">-{dStep.amount.toLocaleString()}원</span>
                                </div>
                              ))}

                              {item.reward_point > 0 && (
                                <div className="flex justify-between items-center text-emerald-900 font-black bg-emerald-100/90 px-1.5 py-0.5 rounded border border-emerald-200 text-[10px] mt-1">
                                  <span>총 적립 ({item.rewardRatePercent}%)</span>
                                  <span>+{item.reward_point.toLocaleString()}원 상당</span>
                                </div>
                              )}

                              {item.reward_steps.map((rStep, rIdx) => {
                                const isGoogle = rStep.providerName.includes('GOOGLE') || rStep.providerName.includes('구글') || rStep.providerName.includes('PLAY');
                                const pts = isGoogle ? Math.floor(rStep.amount / 10) : rStep.amount;
                                const labelName = formatMethodName(rStep.providerName);

                                return (
                                  <div
                                    key={rIdx}
                                    className="flex justify-between items-center text-emerald-800 font-bold bg-white/80 px-1.5 py-0.5 rounded text-[9px] border border-emerald-100/80 leading-tight gap-1"
                                  >
                                    <span className="truncate max-w-[90px] text-left">└ {labelName}</span>
                                    <span className="shrink-0 font-black whitespace-nowrap">
                                      +{pts.toLocaleString()}{isGoogle ? 'pt' : '원'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="w-full pt-1.5 border-t border-[#00D2B8]/30 text-right space-y-0.5">
                            <div className="flex justify-between items-center text-[9.5px] text-slate-400 font-bold">
                              <span>정가</span>
                              <span className="line-through">{payAmount.toLocaleString()}원</span>
                            </div>

                            <div className="flex justify-between items-center text-[11px] font-black text-slate-800">
                              <span>실제 결제액</span>
                              <span>{item.actual_payment_price.toLocaleString()}원</span>
                            </div>

                            <div className="flex justify-between items-center pt-1 border-t border-[#00D2B8]/40">
                              <span className="text-[11px] font-black text-[#00A896]">실질 체감가</span>
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

          {/* 우측 사이드바 (부모 높이를 main과 동기화) */}
          <aside className="lg:col-span-4 space-y-3.5 h-full">
            <form
              onSubmit={handleReSearch}
              className={`space-y-3 transition-all duration-200 ${
                loading ? 'pointer-events-none opacity-50 select-none cursor-not-allowed' : ''
              }`}
            >
              <fieldset disabled={loading} className="space-y-3 border-0 p-0 m-0 min-w-0">
              <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-800 block">스마트폰 OS</span>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded border border-slate-200 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => {
                        setOsType('ANDROID');
                        if (androidStores.length === 0) {
                          const supported = ANDROID_STORE_OPTIONS.filter((st) =>
                            isStoreSupported(st, currentGameObj?.stores)
                          );
                          setAndroidStores(supported.length > 0 ? [supported[0]] : ['구글 플레이 스토어']);
                        }
                      }}
                      className={`py-2 rounded transition-all cursor-pointer text-xs flex items-center justify-center ${
                        osType === 'ANDROID'
                          ? 'bg-slate-900 text-white font-black shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      안드로이드
                    </button>
                    <button
                      type="button"
                      onClick={() => setOsType('IOS')}
                      className={`py-2 rounded transition-all cursor-pointer text-xs flex items-center justify-center ${
                        osType === 'IOS'
                          ? 'bg-slate-900 text-white font-black shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      iOS
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-slate-200/60">
                  <span className="text-xs font-black text-slate-800 block">결제 금액 수정</span>
                  <div className="relative flex items-center">
                    <input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-black text-slate-900 focus:outline-none transition-all pr-8 h-[38px]"
                    />
                    <span className="absolute right-3 text-xs font-bold text-slate-400">원</span>
                  </div>
                </div>
              </div>

              {osType === 'ANDROID' && (
                <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                  <span className="text-xs font-black text-slate-800 block">이용 스토어 필터</span>
                  <div className="flex flex-wrap gap-1.5">
                    {ANDROID_STORE_OPTIONS.map((st: string) => {
                      const isSupported = isStoreSupported(st, currentGameObj?.stores);
                      const selected = androidStores.includes(st);
                      return (
                        /* 💡 [수정 포인트 2] 클릭 시 강한 민트 칠하기 대신 화이트 바탕 + 민트 보더 + 민트 그라데이션 글로우 구현 */
                        <button
                          key={st}
                          type="button"
                          disabled={!isSupported}
                          onClick={() => {
                            if (isSupported) {
                              handleToggleArray(setAndroidStores, st);
                            }
                          }}
                          className={`px-2.5 py-1.5 rounded text-xs transition-all ${
                            selected
                              ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                              : 'bg-slate-50 text-slate-600 font-bold border border-slate-200 cursor-pointer hover:border-[#00D2B8]/60'
                          }`}
                        >
                          {!isSupported ? '✕ ' : selected ? '✓ ' : '+ '}{st}
                        </button>
                      );
                    })}
                  </div>

                  
                  {/* 💡 [수정 포인트 3] 등급 선택 서브 박스에 약한 세로/가로 그라데이션 틴트 적용 */}
                  {(isGoogleSelected || isGalaxySelected) && (
                    <div className="p-2.5 bg-gradient-to-r from-[#00D2B8]/10 via-slate-50 to-[#00F5FF]/10 rounded border border-[#00D2B8]/30 space-y-2 mt-2 shadow-2xs">
                      {isGoogleSelected && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-extrabold text-slate-900 block">Google Play Points 등급</label>
                          <select
                            value={googlePlayTier}
                            onChange={(e) => setGooglePlayTier(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-900 focus:outline-none"
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
                          <label className="text-[11px] font-extrabold text-slate-900 block">Galaxy Store 멤버십 등급</label>
                          <select
                            value={galaxyStoreTier}
                            onChange={(e) => setGalaxyStoreTier(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-900 focus:outline-none"
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

              <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
                <span className="text-xs font-black text-slate-800 block">보유 결제 수단 필터</span>

                <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-3">
                <span className="text-xs font-black text-slate-800 block">보유 결제 수단 필터</span>

                {/* 통신사 멤버십 영역 */}
                <div className="space-y-1.5">
                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCarriers}
                      onChange={(e) => setUseCarriers(e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800 select-none">
                      통신사 멤버십 혜택 포함
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
                          className={`px-2.5 py-1 rounded text-xs transition-all ${
                            selected && useCarriers
                              ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_10px_rgba(0,210,184,0.3)] cursor-pointer'
                              : 'bg-white text-slate-600 font-bold border border-slate-200 cursor-pointer'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 간편결제 (페이) 영역 + 네이버/토스 멤버십 */}
                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={usePays}
                      onChange={(e) => setUsePays(e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800 select-none">
                      사용 간편결제 (페이) 선택
                    </span>
                  </label>

                  <div className={`space-y-2 transition-all ${usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    <div className="flex flex-wrap gap-1.5 pl-1">
                      {PAY_OPTIONS.map((p: string) => {
                        const selected = pays.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            disabled={!usePays}
                            onClick={() => handleToggleArray(setPays, p)}
                            className={`px-2.5 py-1 rounded text-xs transition-all ${
                              selected && usePays
                                ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_10px_rgba(0,210,184,0.3)] cursor-pointer'
                                : 'bg-white text-slate-600 font-bold border border-slate-200 cursor-pointer'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{p}
                          </button>
                        );
                      })}
                    </div>

                    {usePays && pays.includes('네이버페이') && (
                      <div className="pt-1 pl-1 w-full animate-fadeIn">
                        <label className="flex items-center space-x-2 p-2 bg-emerald-50/80 rounded border border-emerald-200 cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={useNaverMembership}
                            onChange={(e) => setUseNaverMembership(e.target.checked)}
                            className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 shrink-0"
                          />
                          <span className="text-xs font-bold text-emerald-900">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                        </label>
                      </div>
                    )}

                    {usePays && pays.includes('토스페이') && (
                      <div className="pt-1 pl-1 w-full animate-fadeIn">
                        <label className="flex items-center space-x-2 p-2 bg-blue-50/80 rounded border border-blue-200 cursor-pointer w-full">
                          <input
                            type="checkbox"
                            checked={useTossPrime}
                            onChange={(e) => setUseTossPrime(e.target.checked)}
                            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 shrink-0"
                          />
                          <span className="text-xs font-bold text-blue-900">토스프라임 구독 중 (+4% 추가 적립)</span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* 간편결제 (페이) 영역 + 네이버/토스 멤버십 */}
              <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usePays}
                    onChange={(e) => setUsePays(e.target.checked)}
                    className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0 cursor-pointer"
                  />
                  <span className="text-xs font-extrabold text-slate-800 select-none">
                    사용 간편결제 (페이) 선택
                  </span>
                </label>

                <div className={`space-y-2 transition-all ${usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {PAY_OPTIONS.map((p: string) => {
                      const selected = pays.includes(p);
                      return (
                        <button
                          key={p}
                          type="button"
                          disabled={!usePays}
                          onClick={() => handleToggleArray(setPays, p)}
                          className={`px-2.5 py-1 rounded text-xs transition-all ${
                            selected && usePays
                              ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_10px_rgba(0,210,184,0.3)] cursor-pointer'
                              : 'bg-white text-slate-600 font-bold border border-slate-200 cursor-pointer'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{p}
                        </button>
                      );
                    })}
                  </div>

                  {/* 네이버페이 선택 시 1자 패널 */}
                  {usePays && pays.includes('네이버페이') && (
                    <div className="pt-1 pl-1 w-full animate-fadeIn">
                      <label className="flex items-center space-x-2 p-2 bg-emerald-50/80 rounded border border-emerald-200 cursor-pointer w-full">
                        <input
                          type="checkbox"
                          checked={useNaverMembership}
                          onChange={(e) => setUseNaverMembership(e.target.checked)}
                          className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 shrink-0"
                        />
                        <span className="text-xs font-bold text-emerald-900">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}

                  {/* 토스페이 선택 시 1자 패널 */}
                  {usePays && pays.includes('토스페이') && (
                    <div className="pt-1 pl-1 w-full animate-fadeIn">
                      <label className="flex items-center space-x-2 p-2 bg-blue-50/80 rounded border border-blue-200 cursor-pointer w-full">
                        <input
                          type="checkbox"
                          checked={useTossPrime}
                          onChange={(e) => setUseTossPrime(e.target.checked)}
                          className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 shrink-0"
                        />
                        <span className="text-xs font-bold text-blue-900">토스프라임 구독 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}
                </div>
              </div>


                <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
                  <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useVoucherBypasses}
                      onChange={(e) => {
                        setUseVoucherBypasses(e.target.checked);
                        if (e.target.checked && vouchers.length === 0) {
                          setVouchers([...VOUCHER_OPTIONS]);
                        }
                      }}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0 cursor-pointer"
                    />
                    <span className="text-xs font-extrabold text-slate-800 select-none">
                      문화상품권 우회 충전 할인
                    </span>
                  </label>

                  <div className={`flex flex-wrap gap-1.5 pl-1 transition-all ${useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {VOUCHER_OPTIONS.map((v: string) => {
                      const selected = vouchers.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          disabled={!useVoucherBypasses}
                          onClick={() => handleToggleArray(setVouchers, v)}
                          className={`px-2.5 py-1 rounded text-xs transition-all ${
                            selected && useVoucherBypasses
                              ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_10px_rgba(0,210,184,0.3)] cursor-pointer'
                              : 'bg-white text-slate-600 font-bold border border-slate-200 cursor-pointer'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-800 block">제휴 카드 선택 (옵션)</span>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useSpecialOptions}
                      onChange={(e) => setUseSpecialOptions(e.target.checked)}
                      className="w-3.5 h-3.5 text-[#00D2B8] rounded border-slate-300 shrink-0"
                    />
                    <span className="text-[11px] font-bold text-[#00A896]">옵션 {useSpecialOptions ? '열림' : '닫힘'}</span>
                  </label>
                </div>

                {useSpecialOptions && (
                  <div className="space-y-2 pt-1">
                    <select
                      value={selectedSpecialCard}
                      onChange={(e) => setSelectedSpecialCard(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs rounded border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none"
                    >
                      {dynamicCardOptions.map((card) => (
                        <option key={card.value} value={card.value}>
                          {card.label}
                        </option>
                      ))}
                    </select>

                    {selectedSpecialCard !== 'NONE' && (
                      <label className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasPrevSpend}
                          onChange={(e) => setHasPrevSpend(e.target.checked)}
                          className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0"
                        />
                        <span className="text-xs font-bold text-slate-800">카드 전월 실적 충족 (20만~50만원)</span>
                      </label>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-3.5 shadow-2xs space-y-2.5">
                <span className="text-xs font-black text-slate-800 block">기타 혜택</span>

                <div className="space-y-1.5 text-xs font-bold text-slate-800">
                  <label className="flex items-center space-x-2.5 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useGameBenefits}
                      onChange={(e) => setUseGameBenefits(e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0"
                    />
                    <span>게임 전용 혜택 포함</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasPreApplied}
                      onChange={(e) => setHasPreApplied(e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0"
                    />
                    <span>사전 응모 완료 혜택</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isFirstPayment}
                      onChange={(e) => setIsFirstPayment(e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded border-slate-300 shrink-0"
                    />
                    <span>첫 결제 이벤트 대상</span>
                  </label>
                </div>
              </div>
            </fieldset>
          </form>

            {/* 하단 광고 배너 */}
            <div className="sticky top-36 p-6 bg-slate-900 rounded-lg border border-slate-800 h-[500px] w-full flex flex-col items-center justify-between text-center shadow-md">
              <span className="px-2.5 py-1 bg-slate-800 text-slate-300 font-bold text-[9px] rounded border border-slate-700 tracking-wider">
                ADVERTISEMENT
              </span>
              
              <div className="space-y-4 my-auto">
                <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-3xl shadow-inner border border-slate-700 mx-auto animate-pulse">
                  📢
                </div>
                
                <div className="space-y-1.5">
                  <h3 className="font-black text-white text-sm">협업 제휴 프로모션</h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed max-w-[150px] mx-auto font-medium">
                    게임별 스토어 & 제휴 카드사 전용 특별 혜택 및 광고 영역입니다.
                  </p>
                </div>
              </div>

              <button 
                type="button"
                onClick={() => setModalType('contact')}
                className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer"
              >
                신청하기
              </button>
            </div>
          </aside>

        </div>
      </div>

      <LegalModals type={modalType} onClose={() => setModalType(null)} />

      {isCriteriaModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
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
              className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-sm rounded transition-all cursor-pointer shadow-md"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

      {isCompareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
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
                  className={`p-4 rounded border flex flex-col justify-between space-y-2 ${
                    idx === 0
                      ? 'bg-amber-50/80 border-amber-300 shadow-2xs'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <span className="font-extrabold text-slate-900 text-xs">{store.platform}</span>
                    </div>
                  </div>

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
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {selectedResultForDetail && (
        <div
          onClick={() => setSelectedResultForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <span className="text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2 py-0.5 rounded border border-[#00D2B8]/30">
                  {selectedResultForDetail.rank}위 최저가 경로 상세 정보
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
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

            <div className="bg-gradient-to-r from-[#00D2B8]/10 to-[#00F5FF]/10 p-4 rounded border border-[#00D2B8]/30 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>정가</span>
                <span>{selectedResultForDetail.original_price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-rose-600 font-medium">
                <span>(-) 즉시 할인 금액 ({selectedResultForDetail.discountRatePercent}%)</span>
                <span>-{selectedResultForDetail.immediate_discount_total.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 font-bold border-t border-[#00D2B8]/20 pt-1.5">
                <span>실제 결제창 결제액</span>
                <span className="text-sm">{selectedResultForDetail.actual_payment_price.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-emerald-600 font-medium">
                <span>(-) 결제 후 적립 포인트 ({selectedResultForDetail.rewardRatePercent}%)</span>
                <span>-{selectedResultForDetail.reward_point.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between items-center text-slate-900 font-black border-t border-[#00D2B8]/30 pt-2 text-sm">
                <span>최종 체감가</span>
                <span className="text-base text-[#00A896] font-black">{selectedResultForDetail.final_price.toLocaleString()}원</span>
              </div>
            </div>

            <div className="p-3 bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 rounded border border-[#00D2B8]/30 text-xs font-extrabold text-slate-900 leading-relaxed shadow-2xs">
              {getUsageGuide(selectedResultForDetail.paymentRoute.join(' '))}
            </div>

            {selectedResultForDetail.discount_steps.length > 0 && (
              <div className="p-4 bg-rose-50/50 rounded border border-rose-200 space-y-2 text-xs">
                <h4 className="font-black text-rose-900 flex items-center gap-1.5 text-sm">
                  <span>결제 시 즉시 할인 이벤트</span>
                </h4>
                <div className="space-y-2 pt-1">
                  {selectedResultForDetail.discount_steps.map((step, idx) => (
                    <div key={idx} className="p-3 bg-white rounded border border-rose-100 space-y-1.5 shadow-2xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div className="flex items-center space-x-1.5 min-w-0 flex-1">
                          {step.isGameSpecific ? (
                            <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded shrink-0">
                              {step.targetGame} 전용
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                              공통 혜택
                            </span>
                          )}
                        <span className="text-xs font-extrabold text-slate-800 truncate break-keep">
                          {formatMethodName(step.eventName)}
                        </span>
                        </div>
                        <span className="text-xs font-black text-rose-600 shrink-0 self-end sm:self-auto">
                          -{step.amount.toLocaleString()}원 할인 {step.ratePercent ? `(${step.ratePercent}%)` : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed bg-slate-50/80 p-2 rounded border border-slate-100">
                        <strong>상세 조건:</strong> {step.conditionText}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedResultForDetail.reward_steps.length > 0 && (
              <div className="p-4 bg-emerald-50/80 rounded border border-emerald-200 space-y-2 text-xs">
                <h4 className="font-black text-emerald-900 flex items-center gap-1.5 text-sm">
                  <span>포인트 적립 세부 내역</span>
                </h4>
                <div className="space-y-1.5 pt-1">
                  {selectedResultForDetail.reward_steps.map((step, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-2 bg-white p-2.5 rounded border border-emerald-100/90 font-bold shadow-2xs">
                    <span className="text-slate-700 text-xs truncate min-w-0 flex-1">
                      • {formatMethodName(step.providerName)} ({step.eventName})
                    </span>
                    <span className="text-emerald-700 font-black text-xs shrink-0 whitespace-nowrap">
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