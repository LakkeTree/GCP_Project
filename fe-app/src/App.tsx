import React, { useState, useEffect } from 'react';

// ==========================================
// [1단계] 데이터베이스 스키마 기반 타입 정의
// ==========================================

/**
 * 4대 핵심 결제 카테고리 구분
 * - CARD: 신용/체크카드 (신한, KB국민, 삼성, NH농협, 하나 등)
 * - TELECOM: 통신사 결제 및 멤버십 (SKT, KT, LGU+)
 * - E_PAYMENT: 간편 페이 결제 (네이버페이, 페이코, 토스페이, 카카오페이, 삼성페이 등)
 * - CULTURE_BYPASS: 문화상품권 우회 및 기프트코드 충전 (컬쳐랜드, 북앤라이프, 핀번 기프트코드 등)
 */
export type BenefitCategory = 'CARD' | 'TELECOM' | 'E_PAYMENT' | 'CULTURE_BYPASS';

/**
 * 모바일 스토어 플랫폼
 */
export type Platform = 'GOOGLE_PLAY' | 'GALAXY_STORE' | 'ONE_STORE' | 'APP_STORE';

/**
 * 간편_결제수단_데이터_플랫폼_결제_호환성DB 인터페이스
 */
export interface PaymentMethodCompatibility {
  payment_method: string;
  platform: Platform;
  is_supported: boolean;
  note?: string;
}

/**
 * 간편_결제수단_데이터_통합_혜택_계산DB 인터페이스
 */
export interface BenefitItem {
  benefit_id: string;
  category: string;
  provider_or_retailer: string;
  item_or_event_name: string;
  target_platform: Platform | 'ALL';
  benefit_type: 'DISCOUNT' | 'REWARD' | 'FEE' | 'CASHBACK';
  benefit_value: number;
  benefit_unit: 'PERCENT' | 'KRW';
  min_spend_krw: number;
  max_benefit_krw?: number;
  payment_route_type: 'DIRECT_PAY' | 'GIFTCODE_CHARGE' | 'DIRECT_LINK' | 'INDIRECT_CONVERSION';
  condition_raw_text: string;
}

/**
 * 최저가 계산 결과 개별 항목 인터페이스
 */
export interface OptimizationResult {
  rank: number; // 순위 (1~3위)
  category: BenefitCategory; // 분리된 4대 결제 카테고리
  category_label: string; // 카테고리 한글명 (카드 / 통신사 / 페이 / 문화상품권 우회)
  platform: Platform; // 스토어 플랫폼
  platform_label: string; // 스토어 한글명
  provider_name: string; // 카드사/통신사/페이/상품권 서비스명
  original_price: number; // 기존 정가 (원)
  final_price: number; // 실 결제 금액 (원)
  reward_point: number; // 결제 후 적립 포인트 (원)
  fee_amount: number; // 우회/전환 시 발생 수수료 (원)
  apply_steps: string[]; // 유저가 결제 시 따라해야 하는 순서별 즉시 적용 단계
  guide_text: string; // 유저를 위한 결제 팁 및 주의사항
}

/**
 * 백엔드 API 응답 통일 규격 인터페이스
 */
export interface ApiResponse {
  status: 'SUCCESS' | 'ERROR';
  data?: OptimizationResult[];
  errorMessage?: string;
}

/**
 * 사용자 입력 폼 데이터 인터페이스 (4대 수단 독립 관리)
 */
export interface FormData {
  gameTitle: string; // 대상 게임명
  osType: 'ANDROID' | 'IOS'; // OS 환경
  platform: Platform | 'ALL'; // 선택된 스토어 플랫폼
  amount: number | ''; // 결제 예정 금액
  isFirstPayment: boolean; // 해당 스토어 첫 결제 여부
  // 4개 카테고리 분리 선택 상태
  selectedCards: string[]; // 선택된 카드사
  selectedTelecoms: string[]; // 선택된 통신사
  selectedPays: string[]; // 선택된 페이 수단
  selectedBypasses: string[]; // 선택된 문화상품권/우회 수단
  sortOption: 'immediate' | 'perceived'; // 정렬 옵션
}

/**
 * 폼 유효성 검사 에러 인터페이스
 */
export interface FormErrors {
  gameTitle?: string;
  amount?: string;
}
// ==========================================
// [2단계] DB 기반 모의 연동 규격 & 통신 모듈
// ==========================================

/**
 * [플랫폼 호환성 DB Mock] 간편_결제수단_데이터_플랫폼_결제_호환성DB 기반
 */
export const MOCK_COMPATIBILITY_DB: PaymentMethodCompatibility[] = [
  { payment_method: 'CULTURELAND_CASH', platform: 'GALAXY_STORE', is_supported: true, note: '컬쳐랜드 직접 연동 (수수료 0%)' },
  { payment_method: 'CULTURELAND_CASH', platform: 'GOOGLE_PLAY', is_supported: true, note: '구글 Play 기프트코드 바로충전 (수수료 3%)' },
  { payment_method: 'CULTURELAND_CASH', platform: 'ONE_STORE', is_supported: false, note: '원스토어 컬쳐랜드 직접 결제 불가' },
  { payment_method: 'CULTURELAND_CASH', platform: 'APP_STORE', is_supported: false, note: '앱스토어 컬쳐랜드 미지원' },
  { payment_method: 'PAYCO', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'PAYCO', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'PAYCO', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'PAYCO', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'NAVER_PAY', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'NAVER_PAY', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'NAVER_PAY', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'NAVER_PAY', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'SAMSUNG_PAY', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'SAMSUNG_PAY', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'SAMSUNG_PAY', platform: 'GOOGLE_PLAY', is_supported: false },
  { payment_method: 'SAMSUNG_PAY', platform: 'APP_STORE', is_supported: false },
  { payment_method: 'TOSS_PAY', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'TOSS_PAY', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'TOSS_PAY', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'TOSS_PAY', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'KAKAO_PAY', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'KAKAO_PAY', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'KAKAO_PAY', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'KAKAO_PAY', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'SKT', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'SKT', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'SKT', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'SKT', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'KT', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'KT', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'LGU_PLUS', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'SHINHAN_CARD', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'SHINHAN_CARD', platform: 'ONE_STORE', is_supported: true },
  { payment_method: 'SHINHAN_CARD', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'SAMSUNG_CARD', platform: 'GALAXY_STORE', is_supported: true },
  { payment_method: 'SAMSUNG_CARD', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'SAMSUNG_CARD', platform: 'APP_STORE', is_supported: true },
  { payment_method: 'KB_KOOKMIN_CARD', platform: 'GOOGLE_PLAY', is_supported: true },
  { payment_method: 'KB_KOOKMIN_CARD', platform: 'APP_STORE', is_supported: true }
];

/**
 * [통합 혜택 계산 DB Mock] 간편_결제수단_데이터_통합_혜택_계산DB 기반 계산 로직
 */
export const fetchLowestPriceRecommendations = async (
  formData: FormData
): Promise<ApiResponse> => {
  // 백엔드 연동 시:
  // const response = await fetch('https://your-cloud-run-url.a.run.app/api/v1/optimize', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(formData)
  // });
  // return await response.json();

  return new Promise((resolve) => {
    setTimeout(() => {
      const amount = typeof formData.amount === 'number' ? formData.amount : 55000;
      const results: OptimizationResult[] = [];

      // 1. 카드 (CARD) 경로 계산
      if (formData.selectedCards.length > 0) {
        if (formData.selectedCards.includes('삼성카드') && (formData.osType === 'ANDROID' || formData.osType === 'IOS')) {
          const discount = Math.min(amount * 0.5, 27500); // 삼성 iD SELECT ON 50% 할인 (최대 27,500원)
          results.push({
            rank: 0,
            category: 'CARD',
            category_label: '💳 카드',
            platform: formData.osType === 'IOS' ? 'APP_STORE' : 'GOOGLE_PLAY',
            platform_label: formData.osType === 'IOS' ? '애플 앱스토어' : '구글 플레이',
            provider_name: '삼성카드 (iD SELECT ON)',
            original_price: amount,
            final_price: amount - discount,
            reward_point: Math.round(amount * 0.01),
            fee_amount: 0,
            apply_steps: [
              '삼성카드 앱에서 [삼성 iD SELECT ON] 인앱결제 혜택 등록',
              '스토어 결제 수단으로 삼성카드 등록 후 즉시 결제',
              '결제 청구 시 50% 할인 (최대 27,500원) 자동 차감'
            ],
            guide_text: '카드사 전월 실적 및 월 할인 한도 충족 시 즉시 반영됩니다.'
          });
        }

        if (formData.selectedCards.includes('신한카드')) {
          const discount = Math.round(amount * 0.1); // 리니지M/게임 특화 신한카드 10% 청구할인
          results.push({
            rank: 0,
            category: 'CARD',
            category_label: '💳 카드',
            platform: formData.osType === 'IOS' ? 'APP_STORE' : 'ONE_STORE',
            platform_label: formData.osType === 'IOS' ? '애플 앱스토어' : '원스토어',
            provider_name: '신한카드 (게임 특화)',
            original_price: amount,
            final_price: amount - discount,
            reward_point: Math.round(amount * 0.005),
            fee_amount: 0,
            apply_steps: [
              '신한 Play 앱에서 게임 특화 결제 할인 쿠폰 활성화',
              '스토어 결제 창에서 신한카드로 즉시 결제 진행',
              '10% 청구 할인 적용'
            ],
            guide_text: '신한 마이신한포인트 차감 결제와 중복 적용이 가능합니다.'
          });
        }
      }

      // 2. 통신사 (TELECOM) 경로 계산
      if (formData.selectedTelecoms.length > 0 && formData.osType === 'ANDROID') {
        if (formData.selectedTelecoms.includes('SKT')) {
          const discount = 20000; // BNF_0016: SKT 구글 플레이 20,000원 즉시 할인
          results.push({
            rank: 0,
            category: 'TELECOM',
            category_label: '📶 통신사',
            platform: 'GOOGLE_PLAY',
            platform_label: '구글 플레이',
            provider_name: 'SKT 통신사 결제',
            original_price: amount,
            final_price: Math.max(0, amount - discount),
            reward_point: 0,
            fee_amount: 0,
            apply_steps: [
              'T world 앱에서 [구글 플레이 SKT 결제 혜택] 이벤트 신청',
              '구글 플레이 결제 수단을 [SKT 휴대폰 결제]로 선택',
              '결제 진행 시 20,000원 즉시 차감 청구'
            ],
            guide_text: 'SKT 소액결제 한도 차감 방식으로 즉시 할인됩니다.'
          });
        }

        if (formData.selectedTelecoms.includes('KT')) {
          const discount = 10000; // BNF_0012: KT 10,000원 할인
          results.push({
            rank: 0,
            category: 'TELECOM',
            category_label: '📶 통신사',
            platform: 'GOOGLE_PLAY',
            platform_label: '구글 플레이',
            provider_name: 'KT 콘텐츠이용료',
            original_price: amount,
            final_price: Math.max(0, amount - discount),
            reward_point: 0,
            fee_amount: 0,
            apply_steps: [
              '마이KT 앱에서 콘텐츠이용료 즉시 할인 쿠폰 수령',
              '구글 플레이 결제 수단으로 KT 선택 후 즉시 결제'
            ],
            guide_text: 'KT 통신사 멤버십 등급에 따라 추가 확정 적립이 제공됩니다.'
          });
        }
      }

      // 3. 페이 (E_PAYMENT) 경로 계산
      if (formData.selectedPays.length > 0) {
        if (formData.selectedPays.includes('삼성페이') && formData.osType === 'ANDROID') {
          const discount = 5000; // BNF_0006: 갤럭시 스토어 삼성페이 5,000원 할인
          const reward = Math.round((amount - discount) * 0.1); // 10% 삼성전자 포인트 적립
          results.push({
            rank: 0,
            category: 'E_PAYMENT',
            category_label: '📱 페이',
            platform: 'GALAXY_STORE',
            platform_label: '갤럭시 스토어',
            provider_name: '삼성페이 (SAMSUNG PAY)',
            original_price: amount,
            final_price: amount - discount,
            reward_point: reward,
            fee_amount: 0,
            apply_steps: [
              '갤럭시 스토어 진입 후 [삼성페이 첫 결제 5,000원 할인 쿠폰] 적용',
              '결제 수단으로 삼성페이 선택하여 실시간 결제',
              '결제 완료 즉시 10% 삼성전자 포인트 자동 적립'
            ],
            guide_text: '출석체크 미션 없이 결제 즉시 5,000원 쿠폰 적용이 가능합니다.'
          });
        }

        if (formData.selectedPays.includes('네이버페이')) {
          const reward = Math.round(amount * 0.05); // BNF_0064 + BNF_0065: 1% + 플러스 멤버십 4%
          results.push({
            rank: 0,
            category: 'E_PAYMENT',
            category_label: '📱 페이',
            platform: formData.osType === 'IOS' ? 'APP_STORE' : 'ONE_STORE',
            platform_label: formData.osType === 'IOS' ? '애플 앱스토어' : '원스토어',
            provider_name: '네이버페이 (NAVER PAY)',
            original_price: amount,
            final_price: amount,
            reward_point: reward,
            fee_amount: 0,
            apply_steps: [
              '스토어 결제 수단으로 네이버페이 선택',
              '네이버 머니/포인트로 즉시 결제 진행',
              '결제 완료 시 네이버페이 포인트 5% (최대 적립) 즉시 지급'
            ],
            guide_text: '네이버플러스 멤버십 이용 시 4% 추가 적립 혜택이 자동 합산됩니다.'
          });
        }
      }

      // 4. 문화상품권 우회 결제 (CULTURE_BYPASS) 경로 계산
      if (formData.selectedBypasses.length > 0) {
        if (formData.selectedBypasses.includes('컬쳐랜드 (우회/캐시)')) {
          // BNF_0087: 3% 상품권 구매 할인, BNF_0094: 갤럭시스토어 전환수수료 0%
          const purchaseDiscountRate = 0.03; // 3% 할인 구매
          const feeRate = formData.osType === 'IOS' ? 0.08 : 0.0; // 갤스 0%, 구글 3%, iOS 불가(0.08)
          
          const purchasedVoucherPrice = amount * (1 - purchaseDiscountRate); // 55,000 * 0.97 = 53,350원
          const fee = amount * feeRate;
          const finalCost = purchasedVoucherPrice + fee;

          results.push({
            rank: 0,
            category: 'CULTURE_BYPASS',
            category_label: '🎟️ 문화상품권 우회',
            platform: formData.osType === 'ANDROID' ? 'GALAXY_STORE' : 'APP_STORE',
            platform_label: formData.osType === 'ANDROID' ? '갤럭시 스토어' : '애플 앱스토어',
            provider_name: '컬쳐랜드 우회 충전 결제',
            original_price: amount,
            final_price: Math.round(finalCost),
            reward_point: Math.round(amount * 0.05), // BNF_0078: 5% 캐시백
            fee_amount: Math.round(fee),
            apply_steps: [
              '온라인 오픈마켓에서 컬쳐랜드 상품권 3% 할인 구매',
              '컬쳐랜드 앱에 상품권 PIN 번호 충전',
              '갤럭시 스토어 결제창에서 [컬쳐랜드 캐시] 직접 연동 결제 (수수료 0%)',
              '충전 및 결제 시 5% 추가 페이백 받기'
            ],
            guide_text: '원스토어 직접 결제 폐지로 인해 갤럭시 스토어 연동 결제 경로가 최저가를 형성합니다.'
          });
        }

        if (formData.selectedBypasses.includes('구글/원스토어 핀번 기프트코드')) {
          const discount = Math.round(amount * 0.04); // BNF_0027: 4% 할인 기프트코드
          results.push({
            rank: 0,
            category: 'CULTURE_BYPASS',
            category_label: '🎟️ 문화상품권 우회',
            platform: 'GOOGLE_PLAY',
            platform_label: '구글 플레이',
            provider_name: '핀번 기프트코드 충전',
            original_price: amount,
            final_price: amount - discount,
            reward_point: 0,
            fee_amount: 0,
            apply_steps: [
              '제로핀/오픈마켓에서 구글 플레이 기프트코드 4% 할인 구매',
              '구글 플레이 스토어 [코드 사용] 메뉴에 PIN 번호 입력하여 잔액 충전',
              '인게임 결제 시 구글 잔액으로 즉시 결제'
            ],
            guide_text: '카드 결제 없이 상품권 할인가로 즉시 충전하여 결제하는 경로입니다.'
          });
        }
      }

      // 결과가 없을 경우 기본 디폴트 혜택 생성
      if (results.length === 0) {
        results.push({
          rank: 1,
          category: 'E_PAYMENT',
          category_label: '📱 페이',
          platform: formData.osType === 'IOS' ? 'APP_STORE' : 'GOOGLE_PLAY',
          platform_label: formData.osType === 'IOS' ? '애플 앱스토어' : '구글 플레이',
          provider_name: '기본 페이 결제',
          original_price: amount,
          final_price: Math.round(amount * 0.97),
          reward_point: Math.round(amount * 0.01),
          fee_amount: 0,
          apply_steps: ['스토어 기본 결제 수단 선택', '즉시 할인 쿠폰 적용'],
          guide_text: '선택하신 수단 외 기본 간편결제 혜택이 적용되었습니다.'
        });
      }

      // 최종 가격순 정렬 및 순위 부여
      results.sort((a, b) => a.final_price - b.final_price);
      const top3Results = results.slice(0, 3).map((item, index) => ({
        ...item,
        rank: index + 1
      }));

      resolve({
        status: 'SUCCESS',
        data: top3Results
      });
    }, 1500); // 1.5초 네트워크 지연 시뮬레이션
  });
};
// ==========================================
// [3단계] 메인 컴포넌트 & 병렬 선택 폼 UI
// ==========================================

export default function App() {
  // --- [State 관리] ---
  const [formData, setFormData] = useState<FormData>({
    gameTitle: '쿠키런: 킹덤',
    osType: 'ANDROID',
    platform: 'ALL',
    amount: 55000,
    isFirstPayment: false,
    selectedCards: ['삼성카드', '신한카드'],
    selectedTelecoms: ['SKT'],
    selectedPays: ['삼성페이', '네이버페이'],
    selectedBypasses: ['컬쳐랜드 (우회/캐시)'],
    sortOption: 'immediate'
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // --- [4대 카테고리별 선택 옵션 데이터] ---
  const CARD_OPTIONS = ['삼성카드', '신한카드', 'KB국민카드', 'NH농협카드', '하나카드'];
  const TELECOM_OPTIONS = ['SKT', 'KT', 'LGU+'];
  const PAY_OPTIONS = ['삼성페이', '네이버페이', '페이코', '토스페이', '카카오페이'];
  const BYPASS_OPTIONS = ['컬쳐랜드 (우회/캐시)', '구글/원스토어 핀번 기프트코드', '북앤라이프'];

  // OS 변경 시 플랫폼 제어
  useEffect(() => {
    if (formData.osType === 'IOS') {
      setFormData((prev) => ({ ...prev, platform: 'APP_STORE' }));
    } else if (formData.platform === 'APP_STORE') {
      setFormData((prev) => ({ ...prev, platform: 'ALL' }));
    }
  }, [formData.osType]);

  // 카테고리별 토글 핸들러
  const toggleSelection = (
    field: 'selectedCards' | 'selectedTelecoms' | 'selectedPays' | 'selectedBypasses',
    item: string
  ) => {
    setFormData((prev) => {
      const currentList = prev[field];
      const exists = currentList.includes(item);
      return {
        ...prev,
        [field]: exists ? currentList.filter((i) => i !== item) : [...currentList, item]
      };
    });
  };

  // 유효성 검사
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.gameTitle.trim()) {
      newErrors.gameTitle = '게임명을 입력해 주세요.';
    } else if (formData.gameTitle !== '쿠키런: 킹덤') {
      newErrors.gameTitle = "현재 프로토타입은 '쿠키런: 킹덤'만 지원합니다.";
    }

    if (formData.amount === '' || isNaN(Number(formData.amount))) {
      newErrors.amount = '결제 예정 금액을 입력해 주세요.';
    } else if (Number(formData.amount) <= 0) {
      newErrors.amount = '결제 금액은 1원 이상이어야 합니다.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setResults(null);

    try {
      const response = await fetchLowestPriceRecommendations(formData);
      if (response.status === 'SUCCESS' && response.data) {
        setResults(response.data);
      } else {
        alert(response.errorMessage || '최저가 경로 계산 중 오류가 발생했습니다.');
      }
    } catch (error) {
      alert('네트워크 연동 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-20">
      {/* 1. 최상단 고정 배너 */}
      <header className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 text-white py-2.5 px-4 text-center text-xs md:text-sm font-bold shadow-md">
        🚀 [쿠키런: 킹덤 DB 연동] 카드·통신사·페이·문화상품권 우회 분리 실시간 최저가 스캐너
      </header>

      <main className="max-w-5xl mx-auto px-4 mt-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white mb-2">
            쿠키런: 킹덤 <span className="text-amber-400">즉시 결제 최저가</span> 경로
          </h1>
          <p className="text-slate-400 text-xs md:text-base">
            출석체크/장기 미션 없이 지금 당장 적용 가능한 실시간 결제 수단별 최저가를 안내합니다.
          </p>
        </div>

        {/* 메인 입력 폼 */}
        <form onSubmit={handleSubmit} className="bg-slate-800 rounded-2xl p-6 border border-slate-700 shadow-xl mb-8 space-y-6">
          
          {/* [영역 1] 결제 환경 선택 카드 */}
          <section className="bg-slate-900/90 rounded-xl p-5 border border-amber-500/40 shadow-inner">
            <h2 className="text-base font-bold text-amber-400 mb-3 flex items-center gap-2">
              <span>📱</span> [영역 1] 모바일 환경 및 스토어 고정
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">모바일 OS 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, osType: 'ANDROID' })}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition-all border ${
                      formData.osType === 'ANDROID'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    🤖 안드로이드
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, osType: 'IOS' })}
                    className={`py-3 px-4 rounded-lg font-bold text-sm transition-all border ${
                      formData.osType === 'IOS'
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-750'
                    }`}
                  >
                    🍎 iOS (아이폰)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">대상 스토어 플랫폼</label>
                <div className="flex flex-wrap gap-2">
                  {formData.osType === 'ANDROID' ? (
                    [
                      { id: 'ALL', label: '전체 스토어' },
                      { id: 'GALAXY_STORE', label: '갤럭시 스토어' },
                      { id: 'GOOGLE_PLAY', label: '구글 플레이' },
                      { id: 'ONE_STORE', label: '원스토어' }
                    ].map((st) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, platform: st.id as Platform | 'ALL' })}
                        className={`py-2 px-3 rounded-md text-xs font-medium transition-all ${
                          formData.platform === st.id
                            ? 'bg-orange-500 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="py-2 px-3 rounded-md text-xs font-medium bg-orange-500 text-white font-bold cursor-default"
                    >
                      애플 앱스토어 (iOS 고정)
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* [영역 2] 병렬 옵션 입력 그리드 */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 좌측 그리드: 결제 기본 정보 */}
            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-sm font-bold text-slate-200 border-b border-slate-700 pb-2 flex items-center gap-1.5">
                <span>💳</span> 결제 기본 조건
              </h3>

              <div>
                <label className="block text-xs text-slate-400 mb-1">대상 게임명</label>
                <input
                  type="text"
                  value={formData.gameTitle}
                  onChange={(e) => setFormData({ ...formData, gameTitle: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                {errors.gameTitle && <p className="text-red-400 text-xs mt-1">{errors.gameTitle}</p>}
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">결제 예정 금액 (원)</label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      amount: e.target.value === '' ? '' : Number(e.target.value)
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                {errors.amount && <p className="text-red-400 text-xs mt-1">{errors.amount}</p>}
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-300 font-medium">스토어 첫 결제 혜택 포함</span>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isFirstPayment: !formData.isFirstPayment })}
                  className={`w-12 h-6 flex items-center rounded-full p-1 transition-colors ${
                    formData.isFirstPayment ? 'bg-amber-500 justify-end' : 'bg-slate-700 justify-start'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-md" />
                </button>
              </div>
            </div>

            {/* 우측 그리드: 4개 결제 수단 분리 선택 */}
            <div className="space-y-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <h3 className="text-sm font-bold text-amber-400 border-b border-slate-700 pb-2 flex items-center gap-1.5">
                <span>🎯</span> 보유 결제 수단 선택 (4대 분리 카테고리)
              </h3>

              {/* 1. 카드 수단 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">💳 카드 (Card)</label>
                <div className="flex flex-wrap gap-1.5">
                  {CARD_OPTIONS.map((card) => {
                    const selected = formData.selectedCards.includes(card);
                    return (
                      <button
                        key={card}
                        type="button"
                        onClick={() => toggleSelection('selectedCards', card)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          selected
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/60 font-semibold'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{card}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 통신사 수단 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">📶 통신사 (Telecom)</label>
                <div className="flex flex-wrap gap-1.5">
                  {TELECOM_OPTIONS.map((tel) => {
                    const selected = formData.selectedTelecoms.includes(tel);
                    return (
                      <button
                        key={tel}
                        type="button"
                        onClick={() => toggleSelection('selectedTelecoms', tel)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          selected
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 font-semibold'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{tel}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 페이 수단 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">📱 페이 (Easy Pay)</label>
                <div className="flex flex-wrap gap-1.5">
                  {PAY_OPTIONS.map((pay) => {
                    const selected = formData.selectedPays.includes(pay);
                    return (
                      <button
                        key={pay}
                        type="button"
                        onClick={() => toggleSelection('selectedPays', pay)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          selected
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/60 font-semibold'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{pay}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 문화상품권 우회 수단 */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">🎟️ 문화상품권 우회 결제 (Voucher Bypass)</label>
                <div className="flex flex-wrap gap-1.5">
                  {BYPASS_OPTIONS.map((bypass) => {
                    const selected = formData.selectedBypasses.includes(bypass);
                    return (
                      <button
                        key={bypass}
                        type="button"
                        onClick={() => toggleSelection('selectedBypasses', bypass)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                          selected
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/60 font-semibold'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {selected ? '✓ ' : ''}{bypass}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-lg rounded-xl shadow-lg shadow-orange-500/25 transition-all transform active:scale-[0.99] disabled:opacity-50"
            >
              ⚡ 실시간 최저가 경로 계산하기
            </button>
          </div>
        </form>
        {/* ========================================== */}
        {/* [4단계] 로딩 처리, 최저가 순위 카드 & 모달  */}
        {/* ========================================== */}

        {/* 1.5초 스피너 로딩 UI */}
        {isLoading && (
          <div className="bg-slate-800 rounded-2xl p-12 border border-slate-700 text-center shadow-2xl my-8">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-amber-500 border-t-transparent mb-4" />
            <h3 className="text-lg font-bold text-white mb-1">
              DB 기반 최적 최저가 경로 계산 중...
            </h3>
            <p className="text-slate-400 text-xs">
              카드·통신사·페이·문화상품권 수수료 차감 및 실결제액 산출 중 (1.5초 소요)
            </p>
          </div>
        )}

        {/* 최저가 결과 카드 리스트 */}
        {results && !isLoading && (
          <section className="space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🏆</span> [실시간 즉시 결제] 추천 순위 TOP 3
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs text-amber-400 hover:underline bg-amber-500/10 px-3 py-1.5 rounded-lg border border-amber-500/30"
              >
                ℹ️ 우회 결제 수수료 및 포인트 기준
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4">
              {results.map((item) => {
                const isTop1 = item.rank === 1;
                return (
                  <div
                    key={item.rank}
                    className={`relative rounded-2xl p-6 transition-all border ${
                      isTop1
                        ? 'bg-slate-800/90 border-amber-500 ring-2 ring-amber-500/50 shadow-2xl shadow-amber-500/10'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {isTop1 && (
                      <span className="absolute -top-3 left-6 bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-black px-3 py-1 rounded-full shadow-md">
                        👑 압도적 1위 최저가 경로
                      </span>
                    )}

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-lg font-black ${isTop1 ? 'text-amber-400' : 'text-slate-400'}`}>
                            #{item.rank}위
                          </span>
                          {/* 카테고리 태그 */}
                          <span className="bg-slate-700 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded-md border border-slate-600">
                            {item.category_label}
                          </span>
                          <span className="text-xs text-slate-300 font-medium bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            {item.platform_label}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{item.provider_name}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{item.guide_text}</p>
                      </div>

                      <div className="text-left md:text-right">
                        <div className="text-xs text-slate-500 line-through">
                          정가 {item.original_price.toLocaleString()}원
                        </div>
                        <div className="text-2xl font-black text-amber-400">
                          {item.final_price.toLocaleString()}원
                          <span className="text-xs font-normal text-slate-300 ml-1">
                            ({Math.round((1 - item.final_price / item.original_price) * 100)}% 절감)
                          </span>
                        </div>
                        {item.fee_amount > 0 && (
                          <div className="text-xs text-red-400 font-medium">
                            (전환/우회 수수료 {item.fee_amount.toLocaleString()}원 포함)
                          </div>
                        )}
                        <div className="text-xs text-emerald-400 font-medium">
                          + {item.reward_point.toLocaleString()}P 추가 적립
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-700/50">
                      <h4 className="text-xs font-bold text-slate-300 mb-2 flex items-center gap-1">
                        <span>📌</span> 즉시 적용 실행 단계
                      </h4>
                      <ol className="list-decimal list-inside text-xs text-slate-300 space-y-1.5">
                        {item.apply_steps.map((step, idx) => (
                          <li key={idx} className="leading-relaxed">
                            <span className="text-amber-400 font-semibold">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => {
                  setResults(null);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 transition-colors"
              >
                🔄 조건 재설정 및 다시 검색
              </button>
            </div>
          </section>
        )}

        {/* 모달 팝업 UI */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <span>ℹ️</span> 우회 수수료 및 포인트 계산 기준
              </h3>
              <div className="text-xs text-slate-300 space-y-3 leading-relaxed border-t border-b border-slate-700 py-4 my-2">
                <p>
                  • <strong>문화상품권 우회 결제 계산식</strong>:
                  <br />
                  $P_{"{final}"} = P_{"{original}"} \times (1 - d_{"{voucher}"}) + F_{"{conversion}"}$
                  <br />
                  (상품권 구매 할인가에 플랫폼별 전환 수수료를 반영합니다)
                </p>
                <p>
                  • <strong>1P = 1원 환산 원칙</strong>: 네이버페이, 삼성 전자 포인트 등 모든 적립 포인트는 현금 동일 가치로 계산됩니다.
                </p>
                <p>
                  • <strong>출석 미션 배제</strong>: 장기 출석체크 조건 없이 지금 당장 즉시 결제할 때 적용되는 확정 혜택만 다룹니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs transition-colors mt-2"
              >
                확인 및 닫기
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}