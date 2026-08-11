import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

// ==========================================
// 1. 단일 파일 내부 독립 상수 및 타입 정의
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

type SortOption = 'BEST_PRICE' | 'POINT_FIRST' | 'DISCOUNT_RATE';

interface RankResultItem {
  id: number;
  rank: number;
  isCrown: boolean;
  storeName: string;
  storeIcon: string;
  os: OsType;
  paymentRoute: string[];
  discountDetail: string;
  discountFactor: number;
  discountRate: string;
}

export default function SearchResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // URL 쿼리 파라미터 파싱
  const initialGame = searchParams.get('game') || '';
  const initialAmount = Number(searchParams.get('amount')) || 0;
  const initialOs = (searchParams.get('os') as OsType) || 'ANDROID';
  const initialStores = searchParams.get('stores') ? searchParams.get('stores')!.split(',') : [];
  const initialCarriers = searchParams.get('carriers') ? searchParams.get('carriers')!.split(',') : [];
  const initialPays = searchParams.get('pays') ? searchParams.get('pays')!.split(',') : [];
  const initialVouchers = searchParams.get('vouchers') ? searchParams.get('vouchers')!.split(',') : [];
  const initialSpecialCard = searchParams.get('specialCard') || 'NONE';
  const initialHasPrevSpend = searchParams.get('hasPrevSpend') === 'true';

  const initialUseGameBenefits = searchParams.get('useGameBenefits') === 'true';
  const initialHasPreApplied = searchParams.get('hasPreApplied') === 'true';
  const initialIsFirstPayment = searchParams.get('isFirstPayment') === 'true';

  // 스티키 필터 및 검색 폼 상태
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

  const allRankResults: RankResultItem[] = [
    {
      id: 1,
      rank: 1,
      isCrown: true,
      storeName: '원스토어',
      storeIcon: '🛍️',
      os: 'ANDROID',
      paymentRoute: ['컬쳐랜드 7% 우회 충전', '원스토어 수요일 30% 캐시백 쿠폰'],
      discountDetail: '컬쳐랜드 7% 우회 + 원스토어 캐시백 쿠폰 중첩 적용',
      discountFactor: 0.75,
      discountRate: '25% OFF',
    },
    {
      id: 2,
      rank: 2,
      isCrown: false,
      storeName: '구글 플레이 스토어',
      storeIcon: '🤖',
      os: 'ANDROID',
      paymentRoute: ['신한 인앱결제 카드 10% 청구할인', 'Play Points 골드 적립'],
      discountDetail: '카드 청구할인 10% + Play Points 골드 1.3% 적립',
      discountFactor: 0.82,
      discountRate: '18% OFF',
    },
    {
      id: 3,
      rank: 3,
      isCrown: false,
      storeName: '갤럭시 스토어',
      storeIcon: '🌌',
      os: 'ANDROID',
      paymentRoute: ['갤스 10% 첫결제 쿠폰', '삼성페이 5% 추가 페이백'],
      discountDetail: '쿠폰 10% + 페이백 5% 할인 총합',
      discountFactor: 0.85,
      discountRate: '15% OFF',
    },
    {
      id: 4,
      rank: 4,
      isCrown: false,
      storeName: '원스토어',
      storeIcon: '🛍️',
      os: 'ANDROID',
      paymentRoute: ['SKT 통신사 10% 멤버십', '네이버페이 4% 적립'],
      discountDetail: '통신사 청구할인 + 네이버플러스 멤버십 추가 적립',
      discountFactor: 0.86,
      discountRate: '14% OFF',
    },
    {
      id: 5,
      rank: 5,
      isCrown: false,
      storeName: '앱스토어 (iOS)',
      storeIcon: '🍎',
      os: 'IOS',
      paymentRoute: ['토스페이 5% 청구할인', '토스프라임 4% 적립'],
      discountDetail: '토스프라임 적립 + 이벤트 청구할인 적용',
      discountFactor: 0.89,
      discountRate: '11% OFF',
    },
  ];

  const filteredRankResults = allRankResults
    .filter((item) => item.os === osType)
    .map((item, idx) => ({ ...item, rank: idx + 1, isCrown: idx === 0 }));

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃: [메인 콘텐츠 8열] | [우측 스티키 사이드바 4열] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* [좌측 8열] 검색 결과 대시보드 */}
        <main className="lg:col-span-8 space-y-5">
          
          {/* 상단 타이틀 배너 (게임 이름 + 소형 기준금액 + 우측 다시검색 버튼) */}
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

              <div className="mt-1.5 flex items-center space-x-1 text-xs text-slate-500 font-bold">
                <span>기준 결제 금액:</span>
                <span className="text-slate-800 font-black">{payAmount.toLocaleString()}원</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => navigate('/search')}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>🔍</span>
                <span>다시 검색</span>
              </button>
            </div>
          </div>

          {/* 정렬 탭 바 */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs font-bold text-slate-500">
              총 <strong className="text-cyan-600">{filteredRankResults.length}개</strong>의 추천 결제 경로
            </span>

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

          {/* 최저가 결과 카드 리스트 */}
          <div className="space-y-3">
            {filteredRankResults.map((item) => {
              const calculatedFinalPrice = Math.round(payAmount * item.discountFactor);

              let cardContainerStyle = 'border-slate-200 bg-white';
              let rankBadgeStyle = 'bg-slate-200 text-slate-700';

              if (item.rank === 1) {
                cardContainerStyle = 'border-cyan-400 ring-2 ring-cyan-400/30 bg-white shadow-sm';
                rankBadgeStyle = 'bg-amber-500 text-white';
              } else if (item.rank === 2) {
                cardContainerStyle = 'border-slate-300 ring-1 ring-slate-300 bg-white shadow-sm';
                rankBadgeStyle = 'bg-slate-600 text-white';
              } else if (item.rank === 3) {
                cardContainerStyle = 'border-amber-700/40 ring-1 ring-amber-600/20 bg-white shadow-sm';
                rankBadgeStyle = 'bg-amber-700 text-white';
              }

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border transition-all hover:shadow-md grid grid-cols-1 md:grid-cols-12 overflow-hidden ${cardContainerStyle}`}
                >
                  <div className="md:col-span-3 p-5 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-black shadow-sm flex items-center gap-1 ${rankBadgeStyle}`}>
                        <span>{item.rank}등</span>
                        {item.isCrown && <span>👑</span>}
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
                        <span className="font-extrabold text-slate-800 text-sm">{item.storeName}</span>
                      </div>
                    </div>
                  </div>

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

                    <p className="text-xs text-slate-500 font-medium">
                      💡 <span className="font-bold text-slate-800">{item.discountDetail}</span>
                    </p>
                  </div>

                  <div className="md:col-span-3 p-5 bg-rose-50/50 border-t md:border-t-0 md:border-l border-rose-100 flex flex-col justify-between items-end text-right">
                    <span className="px-2.5 py-1 bg-red-500 text-white font-black text-xs rounded shadow-sm">
                      {item.discountRate}
                    </span>

                    <div className="mt-2">
                      <span className="text-xs text-slate-400 line-through font-bold block">
                        {payAmount.toLocaleString()}원
                      </span>
                      <span className="text-xl font-black text-slate-900 block">
                        {calculatedFinalPrice.toLocaleString()}원
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

        </main>

        {/* [우측 4열] 스티키 사이드바: [풀 필터 패널] + [광고] */}
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

            {/* 제휴 카드 선택 (옵션) */}
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
    </div>
  );
}