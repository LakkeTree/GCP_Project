import React, { useState } from 'react';

// ==========================================
// 1. 최저가 연산 결과 데이터 타입 (백엔드 응답 형태)
// ==========================================
export interface OptimizationResult {
  rank: number;                  // 순위 (1, 2, 3)
  platform: string;              // 플랫폼 명 (예: "원스토어", "갤럭시 스토어", "구글 플레이")
  original_price: number;        // 정가 (원)
  final_price: number;           // 실 결제 금액 (원)
  reward_point: number;          // 적립 예정 포인트/캐시 (원)
  apply_steps: string[];         // 즉시 할인/적립 적용 단계 리스트
  guide_text: string;            // 결제 시 주의사항 및 팁
}

// ==========================================
// 2. API 공통 응답 규격
// ==========================================
export interface ApiResponse {
  status: 'SUCCESS' | 'ERROR';
  message?: string;
  data: OptimizationResult[];
}

// ==========================================
// 3. 사용자 입력 폼 데이터 타입 (안드로이드 세부 스토어 선택 배열 추가)
// ==========================================
export type OsType = 'ANDROID' | 'IOS';
export type SortOption = 'perceived' | 'immediate';

export interface FormData {
  gameTitle: string;             // 게임명 (예: 쿠키런: 킹덤)
  osType: OsType;                // OS 선택 ('ANDROID' | 'IOS')
  androidStores: string[];       // 안드로이드 선택 시 세부 스토어 리스트 (구글 플레이, 원스토어, 갤럭시 스토어)
  amount: number | '';           // 결제 예정 금액
  isFirstPayment: boolean;       // 해당 마켓 첫 결제 여부
  
  // 카테고리 제목 바로 옆 체크박스 플래그 및 선택 리스트
  useCards: boolean;             // 카드 결제 카테고리 활성화
  cards: string[];               // 보유 카드사 리스트
  
  useCarriers: boolean;          // 통신사 할인 카테고리 활성화
  carriers: string[];            // 통신사 리스트
  
  usePays: boolean;              // 간편결제 카테고리 활성화
  pays: string[];                // 간편결제(페이) 리스트
  
  useVoucherBypasses: boolean;   // 문화상품권 & 우회 결제 카테고리 활성화
  voucherBypasses: string[];     // 문화상품권 우회 결제 수단 리스트
  
  sortOption: SortOption;        // 정렬 기준 ('perceived': 체감가 기준, 'immediate': 즉시할인가 기준)
}

// ==========================================
// 4. 입력 UI 옵션 상수 정의
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
// Mock 데이터: 실시간 "즉시 결제" 최저가 경로 결과
// ==========================================
const MOCK_API_RESPONSE: ApiResponse = {
  status: 'SUCCESS',
  data: [
    {
      rank: 1,
      platform: '원스토어 (ONE store)',
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
      platform: '갤럭시 스토어 (Galaxy Store)',
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
      platform: '구글 플레이 (Google Play)',
      original_price: 55000,
      final_price: 53350,
      reward_point: 1650,
      apply_steps: [
        '구글 플레이 인앱 결제 선택',
        '네이버페이 포인트/머니 결제 시 3% 포인트 적립'
      ],
      guide_text: '추가 우회 절차 없이 즉시 결제 가능한 경로 중 가장 적립율이 높습니다.'
    }
  ]
};

/**
 * 최저가 경로 연산 API 통신 모듈 (Mock)
 * @param formData 선택된 안드로이드 스토어 목록 및 결제 수단이 포함된 폼 데이터
 * @returns Promise<ApiResponse>
 */
export const fetchLowestPriceRecommendations = async (
  formData: FormData
): Promise<ApiResponse> => {
  // 백엔드 연산 지연 1.5초
  await new Promise((resolve) => setTimeout(resolve, 1500));

  // 백엔드 전송용 파라미터 구조화
  const payload = {
    ...formData,
    androidStores: formData.osType === 'ANDROID' ? formData.androidStores : ['앱스토어'],
    cards: formData.useCards ? formData.cards : [],
    carriers: formData.useCarriers ? formData.carriers : [],
    pays: formData.usePays ? formData.pays : [],
    voucherBypasses: formData.useVoucherBypasses ? formData.voucherBypasses : [],
  };

  // [실제 백엔드 연동 교체용 지점]
  /*
  const response = await fetch('https://api.yourbackend.com/v1/optimize-price', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error('최저가 연산 중 오류가 발생했습니다.');
  return await response.json();
  */

  if (formData.osType === 'IOS') {
    return {
      status: 'SUCCESS',
      data: [
        {
          rank: 1,
          platform: '애플 앱스토어 (Apple App Store)',
          original_price: Number(formData.amount) || 55000,
          final_price: (Number(formData.amount) || 55000) * 0.95,
          reward_point: 0,
          apply_steps: [
            '카카오페이 / 네이버페이 앱스토어 결제 수단 등록',
            '페이별 수시 5% 즉시할인/페이백 프로모션 적용'
          ],
          guide_text: 'iOS 환경 특성상 제휴 페이 결제 수단을 활용하는 것이 최선입니다.'
        }
      ]
    };
  }

  // 선택된 안드로이드 스토어에 맞게 Mock 데이터 필터링 예시
  const filteredData = MOCK_API_RESPONSE.data.filter((item) => {
    if (!formData.androidStores.includes('원스토어') && item.platform.includes('원스토어')) return false;
    if (!formData.androidStores.includes('갤럭시 스토어') && item.platform.includes('갤럭시 스토어')) return false;
    if (!formData.androidStores.includes('구글 플레이 스토어') && item.platform.includes('구글 플레이')) return false;
    return true;
  }).map((item, idx) => ({ ...item, rank: idx + 1 }));

  return {
    status: 'SUCCESS',
    data: filteredData.length > 0 ? filteredData : MOCK_API_RESPONSE.data
  };
};

export default function App() {
  // 1. Form 및 UI 상태 관리
  const [formData, setFormData] = useState<FormData>({
    gameTitle: '쿠키런: 킹덤',
    osType: 'ANDROID',
    androidStores: ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'], // 기본 전체 선택
    amount: 55000,
    isFirstPayment: false,
    
    useCards: true,
    cards: ['하나카드'],
    
    useCarriers: true,
    carriers: ['SKT'],
    
    usePays: true,
    pays: ['네이버페이'],
    
    useVoucherBypasses: true,
    voucherBypasses: ['컬쳐랜드(우회/캐시)'],
    
    sortOption: 'perceived',
  });

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<OptimizationResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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
          
          {/* [영역 1] OS 선택 및 안드로이드 세부 스토어 선택 조건부 UI */}
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

            {/* 안드로이드 선택 시 하위 세부 스토어 체크박스/버튼 선택 영역 */}
            {formData.osType === 'ANDROID' && (
              <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2 transition-all">
                <span className="text-xs font-bold text-amber-900 block">
                  🛒 이용할 안드로이드 스토어 선택 (다중 선택 가능)
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

          {/* [영역 3] 보유 결제 수단 선택 (제목 바로 옆 체크박스) */}
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

            {/* 카테고리 4: 문화상품권 & 기타 결제 수단 */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-700">🎟️ 문화상품권 & 기타 결제 수단</span>
                <label className="inline-flex items-center space-x-1 cursor-pointer text-xs font-semibold text-orange-600 hover:text-orange-700">
                  <input
                    type="checkbox"
                    checked={formData.useVoucherBypasses}
                    onChange={(e) => setFormData({ ...formData, useVoucherBypasses: e.target.checked })}
                    className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-400 border-slate-300"
                  />
                  <span>사용하기</span>
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
            className="w-full py-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-base rounded-xl shadow-md transition-all transform active:scale-95 disabled:opacity-50"
          >
            {loading ? '실시간 최저가 경로 계산 중...' : '⚡ 실시간 최저가 경로 연산하기'}
          </button>
        </form>

        {/* 비동기 1.5초 로딩 상태 UI */}
        {loading && (
          <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-100 text-center space-y-4">
            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-amber-500 border-t-transparent"></div>
            <p className="text-slate-600 font-bold">
              선택한 마켓 및 결제 수단 기반 실시간 최저가 경로 계산 중...
            </p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-200 text-sm font-semibold">
            {error}
          </div>
        )}

        {/* 연산 결과 상위 3개 경로 카드 렌더링 */}
        {!loading && results && (
          <section className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">
                🏆 실시간 최저가 결제 경로 TOP {results.length}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="text-xs font-semibold text-slate-500 hover:text-amber-600 underline"
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
                    className={`p-6 rounded-2xl bg-white transition-all border ${
                      isFirst
                        ? 'border-amber-400 ring-2 ring-amber-400 shadow-xl relative'
                        : 'border-slate-200 shadow-sm'
                    }`}
                  >
                    {/* 1위 강조 배지 */}
                    {isFirst && (
                      <span className="absolute -top-3 right-6 bg-amber-500 text-white text-xs font-extrabold px-3 py-1 rounded-full shadow-md">
                        👑 최저가 추천
                      </span>
                    )}

                    {/* 카드 헤더: 순위 및 플랫폼 */}
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

                    {/* 실용 혜택 단계 안내 */}
                    <div className="space-y-2 text-xs text-slate-600 mb-4">
                      <p className="font-bold text-slate-700">📌 즉시 적용 혜택 단계:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        {item.apply_steps.map((step, idx) => (
                          <li key={idx}>{step}</li>
                        ))}
                      </ul>
                    </div>

                    {/* 적립 포인트 및 팁 */}
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

            {/* 조건 재설정 버튼 */}
            <button
              type="button"
              onClick={() => setResults(null)}
              className="w-full py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-sm rounded-xl transition-all"
            >
              🔄 결제 조건 다시 설정하기
            </button>
          </section>
        )}

        {/* [환산 기준 모달 팝업] */}
        {isModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-slate-800 border-b pb-2">
                💡 실시간 최저가 연산 기준 안내
              </h3>
              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>• <strong>즉시 결제 원칙</strong>: 출석체크, 누적 미션, 선착순 마감 가능성이 있는 조건은 모두 제외되어 있습니다.</p>
                <p>• <strong>1P = 1원 환산</strong>: 적립되는 네이버페이/T멤버십/스토어 포인트는 현금과 동일한 1원 가치로 단순 산산됩니다.</p>
                <p>• <strong>마켓 및 수단 조합</strong>: 사용자가 선택한 안드로이드 스토어와 결제 수단 카테고리 내에서만 최저가 경로를 탐색합니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-all"
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