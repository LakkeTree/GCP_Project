import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// ==========================================
// 1. 단일 파일 내 독립 타입 및 상수 정의
// ==========================================
export type OsType = 'ANDROID' | 'IOS';

export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
export const PAY_OPTIONS = ['네이버페이', '카카오페이', '페이코', '토스페이', '삼성페이', '애플페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프'
];

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

export interface StepDetail {
  layerName: string;
  providerName: string;
  type: string; // 'DISCOUNT', 'REWARD', 'CASHBACK', 'FEE'
  amount: number;
  ratePercent: number; // 혜택 퍼센트
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
  discountRatePercent: number; // 할인 %
  reward_point: number;
  rewardRatePercent: number; // 적립 %
  final_price: number;
  total_benefit_amount: number;
  discount_rate: number; // 실질 종합 할인율 %
  paymentRoute: string[];
  discountDetail: string;
  storeIcon: string;
  discount_steps: StepDetail[];
  reward_steps: StepDetail[];
  guide_text: string;
}

type SortOption = 'BEST_PRICE' | 'POINT_FIRST' | 'DISCOUNT_RATE';

export default function SearchResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL 쿼리 파라미터 파싱
  const initialGame = searchParams.get('game') || '쿠키런: 킹덤';
  const initialAmount = Number(searchParams.get('amount')) || 150000;
  const initialOs = (searchParams.get('os') as OsType) || 'ANDROID';
  const initialStores = searchParams.get('stores') ? searchParams.get('stores')!.split(',') : ANDROID_STORE_OPTIONS;
  const initialCarriers = searchParams.get('carriers') ? searchParams.get('carriers')!.split(',') : [];
  const initialPays = searchParams.get('pays') ? searchParams.get('pays')!.split(',') : PAY_OPTIONS;
  const initialVouchers = searchParams.get('vouchers') ? searchParams.get('vouchers')!.split(',') : VOUCHER_OPTIONS;
  const initialSpecialCard = searchParams.get('specialCard') || 'NONE';
  const initialHasPrevSpend = searchParams.get('hasPrevSpend') === 'true';

  const initialUseGameBenefits = searchParams.get('useGameBenefits') !== 'false';
  const initialHasPreApplied = searchParams.get('hasPreApplied') === 'true';
  const initialIsFirstPayment = searchParams.get('isFirstPayment') !== 'false';

  // 우측 스티키 필터 폼 상태
  const [gameTitle, setGameTitle] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);
  const [osType, setOsType] = useState<OsType>(initialOs);
  const [androidStores, setAndroidStores] = useState<string[]>(initialStores);

  const [useCarriers, setUseCarriers] = useState(initialCarriers.length > 0);
  const [carriers, setCarriers] = useState<string[]>(initialCarriers);

  const [usePays, setUsePays] = useState(initialPays.length > 0);
  const [pays, setPays] = useState<string[]>(initialPays);

  const [useVoucherBypasses, setUseVoucherBypasses] = useState(initialVouchers.length > 0);
  const [vouchers, setVouchers] = useState<string[]>(initialVouchers);

  const [useSpecialOptions, setUseSpecialOptions] = useState(initialSpecialCard !== 'NONE');
  const [selectedSpecialCard, setSelectedSpecialCard] = useState(initialSpecialCard);
  const [hasPrevSpend, setHasPrevSpend] = useState(initialHasPrevSpend);

  const [useGameBenefits, setUseGameBenefits] = useState(initialUseGameBenefits);
  const [hasPreApplied, setHasPreApplied] = useState(initialHasPreApplied);
  const [isFirstPayment, setIsFirstPayment] = useState(initialIsFirstPayment);

  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');

  // 모달 제어 상태
  const [isCriteriaModalOpen, setIsCriteriaModalOpen] = useState<boolean>(false);
  const [selectedResultForDetail, setSelectedResultForDetail] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    setGameTitle(initialGame);
    setPayAmount(initialAmount);
    setOsType(initialOs);
  }, [initialGame, initialAmount, initialOs]);

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
  };

  const handleToggleArray = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev: string[]) => (prev.includes(item) ? prev.filter((i: string) => i !== item) : [...prev, item]));
  };

  // ===================================================
  // 2. 다각화된 동적 결제 조합 연산 엔진 (Top 10+ 확장)
  // ===================================================
  const generateDynamicResults = (): OptimizationResult[] => {
    const amountNum = payAmount > 0 ? payAmount : 150000;
    const generated: OptimizationResult[] = [];

    if (osType === 'ANDROID') {
      // 1. 컬쳐랜드 우회 + 원스토어 수요일 캐시백
      if (useVoucherBypasses && vouchers.includes('컬쳐랜드(우회/캐시)') && androidStores.includes('원스토어')) {
        const cultureDiscount = Math.round(amountNum * 0.07);
        const onestoreCashback = Math.round((amountNum - cultureDiscount) * 0.20);
        const paidPrice = amountNum - cultureDiscount;
        const netCost = paidPrice - onestoreCashback;
        const totalBenefit = amountNum - netCost;

        generated.push({
          rank: 1,
          title: '[원스토어 + 컬쳐랜드] 최고 할인 루트',
          platform: '원스토어',
          storeIcon: '🛍️',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: cultureDiscount,
          discountRatePercent: 7,
          reward_point: onestoreCashback,
          rewardRatePercent: 18.6,
          final_price: netCost,
          total_benefit_amount: totalBenefit,
          discount_rate: Math.round((totalBenefit / amountNum) * 1000) / 10,
          paymentRoute: ['컬쳐랜드 7% 우회 충전', '원스토어 수요일 20% 캐시백 쿠폰'],
          discountDetail: '컬쳐랜드 우회 7% 할인 + 원스토어 캐시백 18.6% 적립',
          guide_text: '컬쳐랜드 상품권 7% 우회 충전 후 원스토어 캐시백 쿠폰으로 결제하는 최대 절감 경로입니다.',
          discount_steps: [
            {
              layerName: '상품권 우회',
              providerName: '컬쳐랜드',
              type: 'DISCOUNT',
              amount: cultureDiscount,
              ratePercent: 7,
              formattedAmountText: `-${cultureDiscount.toLocaleString()}원 할인 (7%)`,
              eventName: '컬쳐랜드 PIN 7% 할인 충전',
              conditionText: '주요 온라인 마켓 컬쳐랜드 7% 우회 핀번 구매 적용',
              comboText: '50,000원 x 3장',
              targetGame: gameTitle,
              isGameSpecific: true,
            },
          ],
          reward_steps: [
            {
              layerName: '스토어 적립',
              providerName: '원스토어',
              type: 'REWARD',
              amount: onestoreCashback,
              ratePercent: 18.6,
              formattedAmountText: `+${onestoreCashback.toLocaleString()}P 적립 (18.6%)`,
              eventName: '원스토어 수요일 캐시백 이벤트',
              conditionText: '원스토어 수요일 한정 결제액 캐시백 적립',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }

      // 2. 구글 플레이 + 카드 10% 청구할인 + Play Points 골드 1.3%
      if (androidStores.includes('구글 플레이 스토어')) {
        const cardDiscount = Math.round(amountNum * 0.10);
        const playPoints = Math.round(amountNum * 0.013);
        const paidPrice = amountNum - cardDiscount;
        const netCost = paidPrice - playPoints;
        const totalBenefit = amountNum - netCost;

        generated.push({
          rank: 2,
          title: '[구글 플레이 + 신한카드] 인앱 청구할인 조합',
          platform: '구글 플레이 스토어',
          storeIcon: '🤖',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: cardDiscount,
          discountRatePercent: 10,
          reward_point: playPoints,
          rewardRatePercent: 1.3,
          final_price: netCost,
          total_benefit_amount: totalBenefit,
          discount_rate: Math.round((totalBenefit / amountNum) * 1000) / 10,
          paymentRoute: ['신한 인앱결제 카드 10% 청구할인', 'Play Points 골드 1.3% 적립'],
          discountDetail: '카드 청구할인 10% + Play Points 골드 1.3% 적립',
          guide_text: '신한 인앱결제 특화 카드 청구할인과 Google Play Points 골드 등급 적립 조합입니다.',
          discount_steps: [
            {
              layerName: '카드사 혜택',
              providerName: '신한카드',
              type: 'DISCOUNT',
              amount: cardDiscount,
              ratePercent: 10,
              formattedAmountText: `-${cardDiscount.toLocaleString()}원 할인 (10%)`,
              eventName: '[신한] LineageM / 인앱결제 10% 청구할인',
              conditionText: '전월 실적 30만원 이상 충족 시 월 최대 15,000원 청구할인',
              targetGame: gameTitle,
              isGameSpecific: true,
            },
          ],
          reward_steps: [
            {
              layerName: '스토어 기본 적립',
              providerName: 'Google Play',
              type: 'REWARD',
              amount: playPoints,
              ratePercent: 1.3,
              formattedAmountText: `+${playPoints.toLocaleString()}원 상당 (1.3%)`,
              eventName: 'Google Play Points 골드 등급 적립 (1.3%)',
              conditionText: '구글 플레이 골드 회원 기본 적립 비율 자동 적용',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }

      // 3. 갤럭시 스토어 10% 첫결제 쿠폰 + 삼성페이 5% 페이백
      if (androidStores.includes('갤럭시 스토어') && (usePays && pays.includes('삼성페이'))) {
        const galCoupon = Math.round(amountNum * 0.10);
        const sampayPayback = Math.round((amountNum - galCoupon) * 0.05);
        const paidPrice = amountNum - galCoupon;
        const netCost = paidPrice - sampayPayback;
        const totalBenefit = amountNum - netCost;

        generated.push({
          rank: 3,
          title: '[갤럭시 스토어 + 삼성페이] 페이백 추천',
          platform: '갤럭시 스토어',
          storeIcon: '🌌',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: galCoupon,
          discountRatePercent: 10,
          reward_point: sampayPayback,
          rewardRatePercent: 4.5,
          final_price: netCost,
          total_benefit_amount: totalBenefit,
          discount_rate: Math.round((totalBenefit / amountNum) * 1000) / 10,
          paymentRoute: ['갤스 10% 첫결제 쿠폰', '삼성페이 5% 추가 페이백'],
          discountDetail: '스토어 쿠폰 10% 할인 + 삼성페이 4.5% 적립',
          guide_text: '갤럭시 스토어 첫결제 쿠폰 적용 후 삼성페이 추가 페이백을 수령하는 경로입니다.',
          discount_steps: [
            {
              layerName: '스토어 쿠폰',
              providerName: '갤럭시 스토어',
              type: 'DISCOUNT',
              amount: galCoupon,
              ratePercent: 10,
              formattedAmountText: `-${galCoupon.toLocaleString()}원 할인 (10%)`,
              eventName: '갤스 10% 첫 결제 감사 쿠폰',
              conditionText: '갤럭시 스토어 당월 인앱 결제 이력 없는 첫 결제 유저 대상',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '삼성페이',
              type: 'REWARD',
              amount: sampayPayback,
              ratePercent: 4.5,
              formattedAmountText: `+${sampayPayback.toLocaleString()}P 적립 (4.5%)`,
              eventName: '삼성페이 인앱결제 5% 페이백 이벤트',
              conditionText: '삼성페이 등록 카드로 갤럭시 스토어 결제 시 포인트 페이백',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }

      // 4. 원스토어 + SKT 통신사 10% 멤버십 + 네이버페이 4% 적립
      if (androidStores.includes('원스토어') && (useCarriers && carriers.includes('SKT')) && (usePays && pays.includes('네이버페이'))) {
        const sktDiscount = Math.round(amountNum * 0.10);
        const naverReward = Math.round((amountNum - sktDiscount) * 0.04);
        const paidPrice = amountNum - sktDiscount;
        const netCost = paidPrice - naverReward;
        const totalBenefit = amountNum - netCost;

        generated.push({
          rank: 4,
          title: '[원스토어 + SKT + 네이버페이] 통신사 적립 조합',
          platform: '원스토어',
          storeIcon: '🛍️',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: sktDiscount,
          discountRatePercent: 10,
          reward_point: naverReward,
          rewardRatePercent: 3.6,
          final_price: netCost,
          total_benefit_amount: totalBenefit,
          discount_rate: Math.round((totalBenefit / amountNum) * 1000) / 10,
          paymentRoute: ['SKT 통신사 10% 멤버십', '네이버페이 4% 적립'],
          discountDetail: '통신사 청구할인 10% + 네이버플러스 3.6% 적립',
          guide_text: 'SKT T멤버십 원스토어 할인과 네이버플러스 멤버십 추가 적립 중첩 경로입니다.',
          discount_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: 'SKT T멤버십',
              type: 'DISCOUNT',
              amount: sktDiscount,
              ratePercent: 10,
              formattedAmountText: `-${sktDiscount.toLocaleString()}원 할인 (10%)`,
              eventName: 'T멤버십 원스토어 10% 할인/적립',
              conditionText: 'SKT VIP/GOLD/SILVER 등급 일간 1회 차감 할인',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '네이버페이',
              type: 'REWARD',
              amount: naverReward,
              ratePercent: 3.6,
              formattedAmountText: `+${naverReward.toLocaleString()}P 적립 (3.6%)`,
              eventName: '네이버플러스 멤버십 +4% 추가 적립',
              conditionText: '네이버페이 결제 시 멤버십 가입자 기본 1% + 4% 추가 포인트 적립',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }

      // 5. 구글 핀번 기프트코드 7% 우회 할인
      if (useVoucherBypasses && vouchers.includes('구글 핀번 기프트코드')) {
        const pinDiscount = Math.round(amountNum * 0.07);
        const paidPrice = amountNum - pinDiscount;

        generated.push({
          rank: 5,
          title: '[구글 핀번 기프트코드] 우회 할인 경로',
          platform: '구글 플레이 스토어',
          storeIcon: '🤖',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: pinDiscount,
          discountRatePercent: 7,
          reward_point: 0,
          rewardRatePercent: 0,
          final_price: paidPrice,
          total_benefit_amount: pinDiscount,
          discount_rate: 7.0,
          paymentRoute: ['구글 핀번 7% 우회 구매', '인앱 기프트카드 결제'],
          discountDetail: '기프트코드 우회 7% 즉시 할인 (적립 없음)',
          guide_text: '온라인 오픈마켓 구글 기프트코드 7% 할인가 구매 후 충전 결제 경로입니다.',
          discount_steps: [
            {
              layerName: '상품권 우회',
              providerName: '구글 핀번 기프트코드',
              type: 'DISCOUNT',
              amount: pinDiscount,
              ratePercent: 7,
              formattedAmountText: `-${pinDiscount.toLocaleString()}원 할인 (7%)`,
              eventName: 'G마켓/11번가 구글 기프트코드 7% 우회 할인',
              conditionText: '모바일 PIN 번호 수신 후 구글 플레이 계정에 충전 적용',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [],
        });
      }

      // 6. 북앤라이프 5% 우회 충전
      if (useVoucherBypasses && vouchers.includes('북앤라이프')) {
        const bookDiscount = Math.round(amountNum * 0.05);
        const paidPrice = amountNum - bookDiscount;

        generated.push({
          rank: 6,
          title: '[북앤라이프] 상품권 우회 결제',
          platform: '원스토어',
          storeIcon: '🛍️',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: bookDiscount,
          discountRatePercent: 5,
          reward_point: 0,
          rewardRatePercent: 0,
          final_price: paidPrice,
          total_benefit_amount: bookDiscount,
          discount_rate: 5.0,
          paymentRoute: ['북앤라이프 5% 할인 구매', '원스토어 캐시 전환'],
          discountDetail: '북앤라이프 우회 5% 할인 (적립 없음)',
          guide_text: '북앤라이프 도서문화상품권 5% 할인 구매 후 원스토어 캐시 전환 결제 경로입니다.',
          discount_steps: [
            {
              layerName: '상품권 우회',
              providerName: '북앤라이프',
              type: 'DISCOUNT',
              amount: bookDiscount,
              ratePercent: 5,
              formattedAmountText: `-${bookDiscount.toLocaleString()}원 할인 (5%)`,
              eventName: '북앤라이프 도서문화상품권 5% 할인',
              conditionText: '온라인 상품권 마켓 할인 구매 적용',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [],
        });
      }

      // 7. 카카오페이 / 페이코 3% 간편결제 할인
      if (usePays && (pays.includes('카카오페이') || pays.includes('페이코'))) {
        const payDiscount = Math.round(amountNum * 0.03);
        const paidPrice = amountNum - payDiscount;

        generated.push({
          rank: 7,
          title: '[간편결제] 카카오페이/페이코 인앱 할인',
          platform: '구글 플레이 스토어',
          storeIcon: '🤖',
          os: 'ANDROID',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: payDiscount,
          discountRatePercent: 3,
          reward_point: 0,
          rewardRatePercent: 0,
          final_price: paidPrice,
          total_benefit_amount: payDiscount,
          discount_rate: 3.0,
          paymentRoute: ['카카오페이 / 페이코 3% 인앱 할인'],
          discountDetail: '간편결제 계좌/포인트 결제 3% 할인',
          guide_text: '구글 플레이 스토어 간편결제 즉시 할인 결제 경로입니다.',
          discount_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '카카오페이',
              type: 'DISCOUNT',
              amount: payDiscount,
              ratePercent: 3,
              formattedAmountText: `-${payDiscount.toLocaleString()}원 할인 (3%)`,
              eventName: '간편결제 인앱 결제 3% 할인 이벤트',
              conditionText: '등록된 간편결제 수단으로 수시 적용',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [],
        });
      }
    } else {
      // iOS 전용 루트 생성
      if (usePays && pays.includes('토스페이')) {
        const tossDiscount = Math.round(amountNum * 0.05);
        const tossPrimePoint = Math.round((amountNum - tossDiscount) * 0.04);
        const paidPrice = amountNum - tossDiscount;
        const netCost = paidPrice - tossPrimePoint;
        const totalBenefit = amountNum - netCost;

        generated.push({
          rank: 1,
          title: '[앱스토어 + 토스페이] 토스프라임 최적 경로',
          platform: '앱스토어 (iOS)',
          storeIcon: '🍎',
          os: 'IOS',
          original_price: amountNum,
          actual_payment_price: paidPrice,
          immediate_discount_total: tossDiscount,
          discountRatePercent: 5,
          reward_point: tossPrimePoint,
          rewardRatePercent: 3.8,
          final_price: netCost,
          total_benefit_amount: totalBenefit,
          discount_rate: Math.round((totalBenefit / amountNum) * 1000) / 10,
          paymentRoute: ['토스페이 5% 청구할인', '토스프라임 4% 적립'],
          discountDetail: '청구할인 5% + 토스프라임 3.8% 적립',
          guide_text: 'App Store 토스페이 결제 청구할인과 토스프라임 +4% 적립 중첩 경로입니다.',
          discount_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '토스페이',
              type: 'DISCOUNT',
              amount: tossDiscount,
              ratePercent: 5,
              formattedAmountText: `-${tossDiscount.toLocaleString()}원 할인 (5%)`,
              eventName: '토스페이 앱스토어 5% 첫 결제 할인',
              conditionText: '토스 앱 내 애플 인앱결제 이벤트 응모 완료 계정',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
          reward_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '토스프라임',
              type: 'REWARD',
              amount: tossPrimePoint,
              ratePercent: 3.8,
              formattedAmountText: `+${tossPrimePoint.toLocaleString()}P 적립 (3.8%)`,
              eventName: '토스프라임 멤버십 +4% 포인트 적립',
              conditionText: '토스프라임 유료 구독자 대상 결제 금액 4% 토스포인트 자동 적립',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }

      if (usePays && pays.includes('카카오페이')) {
        const kakaoPayback = Math.round(amountNum * 0.05);
        const netCost = amountNum - kakaoPayback;

        generated.push({
          rank: 2,
          title: '[앱스토어 + 카카오페이] 페이백 혜택',
          platform: '앱스토어 (iOS)',
          storeIcon: '🍎',
          os: 'IOS',
          original_price: amountNum,
          actual_payment_price: amountNum,
          immediate_discount_total: 0,
          discountRatePercent: 0,
          reward_point: kakaoPayback,
          rewardRatePercent: 5,
          final_price: netCost,
          total_benefit_amount: kakaoPayback,
          discount_rate: 5.0,
          paymentRoute: ['카카오페이 5% 포인트 페이백'],
          discountDetail: '할인 없음 + 카카오페이포인트 5% 적립',
          guide_text: 'App Store 카카오페이 결제 수단 등록 시 제공되는 포인트 페이백 경로입니다.',
          discount_steps: [],
          reward_steps: [
            {
              layerName: '간편결제/통신사',
              providerName: '카카오페이',
              type: 'REWARD',
              amount: kakaoPayback,
              ratePercent: 5,
              formattedAmountText: `+${kakaoPayback.toLocaleString()}P 적립 (5%)`,
              eventName: '카카오페이 앱스토어 5% 카카오페이포인트 페이백',
              conditionText: '결제 완료 후 익월 10일 페이포인트 일괄 지급',
              targetGame: 'ALL',
              isGameSpecific: false,
            },
          ],
        });
      }
    }

    generated.sort((a, b) => a.final_price - b.final_price);
    return generated.map((item, idx) => ({ ...item, rank: idx + 1 }));
  };

  const resultsList = generateDynamicResults();

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃: [메인 콘텐츠 8열] | [우측 스티키 사이드바 4열] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* =================================================== */}
        {/* [좌측 8열] 메인 검색 타이틀 & 복원된 3단 카드 리스트 */}
        {/* =================================================== */}
        <main className="lg:col-span-8 space-y-5">
          
          {/* 상단 타이틀 배너 (소형 기준금액 + 우측 통합 [🔄 다시 검색 (재연산)] 버튼) */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-black text-cyan-800 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-200">
                실시간 최저가 연산 완료
              </span>
              
              <div className="mt-2 flex items-baseline space-x-2">
                <input
                  type="text"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  className="text-2xl md:text-3xl font-black text-cyan-600 bg-transparent border-b-2 border-cyan-400 focus:outline-none focus:border-cyan-600 px-1 py-0.5"
                  placeholder="게임명 입력"
                />
                <span className="text-2xl md:text-3xl font-black text-slate-900">에 관한 검색 결과</span>
              </div>

              {/* 게임 이름 아래 조그만하게 배치된 기준 결제 금액 */}
              <div className="mt-1.5 flex items-center space-x-1 text-xs text-slate-500 font-bold">
                <span>기준 결제 금액:</span>
                <span className="text-slate-800 font-black">{payAmount.toLocaleString()}원</span>
              </div>
            </div>

            {/* 통합 [🔄 다시 검색 (재연산)] 버튼 */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={(e) => handleReSearch(e)}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🔄</span>
                <span>다시 검색 (재연산)</span>
              </button>
            </div>
          </div>

          {/* 정렬 탭 바 & 환산 기준 모달 오픈 버튼 */}
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

          {/* =================================================== */}
          {/* 3. 복원된 3단 카드 레이아웃 + % 할인/% 적립 상세 구조 */}
          {/* =================================================== */}
          <div className="space-y-3">
            {resultsList.map((item) => {
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
                  className={`rounded-xl border transition-all hover:shadow-md grid grid-cols-1 md:grid-cols-12 overflow-hidden cursor-pointer ${cardStyle}`}
                >
                  {/* [좌측 3열] 등수 배지 및 스토어 */}
                  <div className="md:col-span-3 p-5 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black shadow-sm flex items-center gap-1 ${rankStyle}`}>
                        <span>{item.rank}등</span>
                        {item.rank === 1 && <span>👑</span>}
                      </span>

                      {item.rank === 1 && (
                        <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          최고 추천
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">사용 스토어</span>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        <span className="text-xl">{item.storeIcon}</span>
                        <span className="font-extrabold text-slate-800 text-sm">{item.platform}</span>
                      </div>
                    </div>
                  </div>

                  {/* [중앙 6열] 결제 수단 경로 및 % 할인/% 적립 상세 요약 */}
                  <div className="md:col-span-6 p-5 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                        결제 진행 수단 및 경로
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.paymentRoute.map((step: string, idx: number) => (
                          <React.Fragment key={idx}>
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-bold text-xs rounded border border-slate-200">
                              {step}
                            </span>
                            {idx < item.paymentRoute.length - 1 && (
                              <span className="text-slate-300 font-bold text-xs">➔</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>

                    {/* 👈 [요청 반영] 몇 % 할인 및 몇 % 어떤 걸로 적립인지 명시된 실질 할인율 내역 */}
                    <div className="pt-2 border-t border-slate-100 space-y-1">
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-700">
                        {item.discountRatePercent > 0 && (
                          <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                            할인 {item.discountRatePercent}% (-{item.immediate_discount_total.toLocaleString()}원)
                          </span>
                        )}
                        {item.rewardRatePercent > 0 && (
                          <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            적립 {item.rewardRatePercent}% (+{item.reward_point.toLocaleString()}P)
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 font-medium">
                        💡 <span className="font-bold text-slate-800">{item.discountDetail}</span>
                      </p>
                    </div>
                  </div>

                  {/* [우측 3열] 할인율 및 최종 체감가 */}
                  <div className="md:col-span-3 p-5 bg-rose-50/50 border-t md:border-t-0 md:border-l border-rose-100 flex flex-col justify-between items-end text-right">
                    <div className="text-right space-y-0.5">
                      <span className="px-2.5 py-1 bg-red-500 text-white font-black text-xs rounded shadow-sm inline-block">
                        실질 {item.discount_rate}% OFF
                      </span>
                    </div>

                    <div className="mt-2">
                      <span className="text-xs text-slate-400 line-through font-bold block">
                        {payAmount.toLocaleString()}원
                      </span>
                      <span className="text-xl font-black text-slate-900 block">
                        {item.final_price.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </main>

        {/* =================================================== */}
        {/* [우측 4열] 스티키 사이드바: [풀 필터 패널] + [광고] */}
        {/* =================================================== */}
        <aside className="lg:col-span-4 h-full space-y-5 sticky top-28">
          
          <form
            onSubmit={handleReSearch}
            className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 max-h-[78vh] overflow-y-auto"
          >
            <div className="border-b border-slate-100 pb-2.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <span>🎛️</span>
                <span>실시간 필터 조절</span>
              </h3>
              <button
                type="submit"
                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-xs rounded-md shadow-sm transition-all cursor-pointer"
              >
                재연산하기
              </button>
            </div>

            {/* 스마트폰 OS */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 block">스마트폰 OS</span>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setOsType('ANDROID');
                    handleReSearch();
                  }}
                  className={`py-1.5 rounded transition-all cursor-pointer ${
                    osType === 'ANDROID'
                      ? 'bg-slate-900 text-white font-black shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  안드로이드
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOsType('IOS');
                    handleReSearch();
                  }}
                  className={`py-1.5 rounded transition-all cursor-pointer ${
                    osType === 'IOS'
                      ? 'bg-slate-900 text-white font-black shadow-sm'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  iOS
                </button>
              </div>
            </div>

            {/* 결제 금액 수정 */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-700 block">결제 금액 수정</span>
              <div className="relative flex items-center">
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-slate-50 font-black text-slate-900 focus:outline-none focus:bg-white transition-all pr-8"
                />
                <span className="absolute right-3 text-xs font-bold text-slate-400">원</span>
              </div>
            </div>

            {/* 이용 스토어 필터 */}
            {osType === 'ANDROID' && (
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[11px] font-bold text-slate-700 block">이용 스토어 필터</span>
                <div className="flex flex-wrap gap-1">
                  {ANDROID_STORE_OPTIONS.map((st: string) => {
                    const selected = androidStores.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleToggleArray(setAndroidStores, st)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer ${
                          selected
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{st}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 보유 결제 수단 필터 */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <span className="text-[11px] font-black text-slate-800 block">보유 결제 수단 필터</span>

              {/* 통신사 */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 p-1.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="resCarriersToggle"
                    checked={useCarriers}
                    onChange={(e) => setUseCarriers(e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="resCarriersToggle" className="text-[11px] font-bold text-slate-800 cursor-pointer select-none">
                    통신사 할인 사용하기
                  </label>
                </div>
                <div className={`flex flex-wrap gap-1 pl-2 transition-all ${useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {CARRIER_OPTIONS.map((c: string) => {
                    const selected = carriers.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!useCarriers}
                        onClick={() => handleToggleArray(setCarriers, c)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                          selected && useCarriers
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 간편결제 */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 p-1.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="resPaysToggle"
                    checked={usePays}
                    onChange={(e) => setUsePays(e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="resPaysToggle" className="text-[11px] font-bold text-slate-800 cursor-pointer select-none">
                    사용 간편결제 (페이) 선택
                  </label>
                </div>
                <div className={`flex flex-wrap gap-1 pl-2 transition-all ${usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {PAY_OPTIONS.map((p: string) => {
                    const selected = pays.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!usePays}
                        onClick={() => handleToggleArray(setPays, p)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                          selected && usePays
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{p}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 문화상품권 */}
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2 p-1.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="resVoucherToggle"
                    checked={useVoucherBypasses}
                    onChange={(e) => setUseVoucherBypasses(e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="resVoucherToggle" className="text-[11px] font-bold text-slate-800 cursor-pointer select-none">
                    문화상품권 우회 충전 할인
                  </label>
                </div>
                <div className={`flex flex-wrap gap-1 pl-2 transition-all ${useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {VOUCHER_OPTIONS.map((v: string) => {
                    const selected = vouchers.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!useVoucherBypasses}
                        onClick={() => handleToggleArray(setVouchers, v)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all ${
                          selected && useVoucherBypasses
                            ? 'bg-cyan-500 text-white border-cyan-500 cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{v}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 제휴 카드 선택 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-800">카드 선택 (옵션)</span>
                <input
                  type="checkbox"
                  checked={useSpecialOptions}
                  onChange={(e) => setUseSpecialOptions(e.target.checked)}
                  className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300 cursor-pointer"
                />
              </div>

              {useSpecialOptions && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <select
                    value={selectedSpecialCard}
                    onChange={(e) => setSelectedSpecialCard(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-[11px] rounded border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none"
                  >
                    {SPECIAL_CARD_OPTIONS.map((card: { label: string; value: string }) => (
                      <option key={card.value} value={card.value}>
                        {card.label}
                      </option>
                    ))}
                  </select>

                  {selectedSpecialCard !== 'NONE' && (
                    <label className="flex items-center space-x-1.5 p-1.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={hasPrevSpend}
                        onChange={(e) => setHasPrevSpend(e.target.checked)}
                        className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300"
                      />
                      <span className="text-[10px] font-bold text-slate-700">카드 전월 실적 충족 (20만~50만원)</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* 보너스 이벤트 토글 옵션 */}
            <div className="space-y-1 pt-2 border-t border-slate-100 text-xs font-bold text-slate-700">
              <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={useGameBenefits}
                  onChange={(e) => setUseGameBenefits(e.target.checked)}
                  className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300"
                />
                <span className="text-[11px]">🎮 게임 전용 혜택 포함</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={hasPreApplied}
                  onChange={(e) => setHasPreApplied(e.target.checked)}
                  className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300"
                />
                <span className="text-[11px]">📝 사전 응모 완료 혜택</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={isFirstPayment}
                  onChange={(e) => setIsFirstPayment(e.target.checked)}
                  className="w-3.5 h-3.5 text-cyan-600 rounded border-slate-300"
                />
                <span className="text-[11px]">🎉 첫 결제 이벤트 대상</span>
              </label>
            </div>
          </form>

          {/* 광고 영역 */}
          <div className="p-4 bg-slate-100 rounded-xl border border-slate-200/80 flex flex-col items-center justify-between text-center space-y-3 shadow-inner">
            <span className="px-2.5 py-0.5 bg-slate-800 text-white font-bold text-[9px] rounded tracking-wider">ADVERTISEMENT</span>
            <div className="space-y-1.5 my-auto">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-lg font-black text-slate-400 shadow-sm border border-slate-200 mx-auto">AD</div>
              <h3 className="font-extrabold text-slate-800 text-xs">협업 제휴 광고</h3>
            </div>
            <button className="w-full py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-[11px] rounded-lg transition-all shadow-md">신청하기</button>
          </div>

        </aside>

      </div>

      {/* =================================================== */}
      {/* 4. 환산 기준 안내 모달 */}
      {/* =================================================== */}
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

      {/* =================================================== */}
      {/* 5. 카드 클릭 시 오픈되는 세부 결제 경로 모달 */}
      {/* =================================================== */}
      {selectedResultForDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
            
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

            {/* 💳 즉시 할인 단계 */}
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
                        -{step.amount.toLocaleString()}원 할인 ({step.ratePercent}%)
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-100">
                      📝 <strong>상세 조건:</strong> {step.conditionText}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 🎁 결제 후 적립 단계 */}
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

            <button
              type="button"
              onClick={() => setSelectedResultForDetail(null)}
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-bold text-sm rounded-xl transition-all cursor-pointer shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}

    </div>
  );
}