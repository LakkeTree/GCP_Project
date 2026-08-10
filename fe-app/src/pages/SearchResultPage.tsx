import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

type SortOption = 'BEST_PRICE' | 'POINT_FIRST' | 'DISCOUNT_RATE';

export default function SearchResultPage() {
  const [searchParams] = useSearchParams();

  // URL 쿼리스트링 추출 (기본값: 게임명 빈값, 금액 0원)
  const initialGame = searchParams.get('game') || '';
  const initialAmount = Number(searchParams.get('amount')) || 0;

  const [selectedGame] = useState(initialGame);
  const [payAmount, setPayAmount] = useState<number>(initialAmount);
  const [osType, setOsType] = useState<'ANDROID' | 'IOS'>('ANDROID');
  const [sortOption, setSortOption] = useState<SortOption>('BEST_PRICE');

  // 디폴트 혜택 토글 (모두 미사용 OFF 상태)
  const [useCarrier, setUseCarrier] = useState(false);
  const [useVoucher, setUseVoucher] = useState(false);
  const [useGameBenefit, setUseGameBenefit] = useState(false);

  // 최저가 결제 루트 데이터
  const rankResults = [
    {
      id: 1,
      rank: 1,
      isCrown: true,
      storeName: '원스토어',
      storeIcon: '🛍️',
      paymentRoute: ['컬쳐랜드 7% 우회 충전', '원스토어 수요일 30% 캐시백 쿠폰'],
      discountDetail: '컬쳐랜드 7% + 원스토어 캐시백 쿠폰 적용',
      discountFactor: 0.75, // 25% OFF
      discountRate: '25% OFF',
    },
    {
      id: 2,
      rank: 2,
      isCrown: false,
      storeName: '구글 플레이',
      storeIcon: '🤖',
      paymentRoute: ['신한 인앱결제 카드 10% 청구할인', 'Play Points 골드적립'],
      discountDetail: '카드 청구할인 10% + Play Points 적립',
      discountFactor: 0.82, // 18% OFF
      discountRate: '18% OFF',
    },
    {
      id: 3,
      rank: 3,
      isCrown: false,
      storeName: '갤럭시 스토어',
      storeIcon: '🌌',
      paymentRoute: ['갤스 10% 쿠폰', '삼성페이 5% 추가 페이백'],
      discountDetail: '쿠폰 10% + 페이백 5% 할인 총합',
      discountFactor: 0.85, // 15% OFF
      discountRate: '15% OFF',
    },
  ];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃: [메인 결과 10열] | [우측 스티키 광고 2열] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 검색 결과 대시보드 */}
        <div className="lg:col-span-10 space-y-5">
          
          {/* 상단 검색 결과 헤더 배너 */}
          <div className="bg-slate-100 rounded-xl border border-slate-200 p-6 space-y-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              <div>
                <span className="text-[11px] font-black text-cyan-800 bg-cyan-100 px-2.5 py-1 rounded border border-cyan-200">
                  실시간 최저가 연산 결과
                </span>
                <h2 className="text-2xl font-black text-slate-900 mt-1">
                  {selectedGame ? (
                    <>
                      <span className="text-cyan-600">{selectedGame}</span>에 관한 검색 결과
                    </>
                  ) : (
                    <span className="text-slate-400">선택된 게임이 없습니다</span>
                  )}
                </h2>
              </div>

              {/* 우측 옵션 조정 바 */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-white p-1 rounded-lg border border-slate-200 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setOsType('ANDROID')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      osType === 'ANDROID'
                        ? 'bg-slate-900 text-white font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🤖 안드로이드
                  </button>
                  <button
                    type="button"
                    onClick={() => setOsType('IOS')}
                    className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                      osType === 'IOS'
                        ? 'bg-slate-900 text-white font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    🍎 iOS
                  </button>
                </div>

                <div className="flex items-center space-x-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold">
                  <span className="text-slate-400">결제금액:</span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Number(e.target.value))}
                    className="w-24 font-black text-slate-900 focus:outline-none text-right"
                  />
                  <span>원</span>
                </div>
              </div>

            </div>

            {/* 하단 적용 옵션 태그 요약 (디폴트: 모두 미사용 OFF) */}
            <div className="border-t border-slate-200/80 pt-3 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
              <span className="text-[11px] text-slate-400 font-medium">적용 옵션:</span>
              
              <button
                type="button"
                onClick={() => setUseCarrier(!useCarrier)}
                className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                  useCarrier
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-white border-slate-200 text-slate-400 opacity-70'
                }`}
              >
                <span>{useCarrier ? '🟢' : '🔴'}</span>
                <span>통신사 {useCarrier ? '사용' : '미사용'}</span>
              </button>

              <button
                type="button"
                onClick={() => setUseVoucher(!useVoucher)}
                className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                  useVoucher
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-white border-slate-200 text-slate-400 opacity-70'
                }`}
              >
                <span>{useVoucher ? '🟢' : '🔴'}</span>
                <span>문화상품권 {useVoucher ? '사용' : '미사용'}</span>
              </button>

              <button
                type="button"
                onClick={() => setUseGameBenefit(!useGameBenefit)}
                className={`px-2.5 py-1 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 ${
                  useGameBenefit
                    ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                    : 'bg-white border-slate-200 text-slate-400 opacity-70'
                }`}
              >
                <span>{useGameBenefit ? '🟢' : '🔴'}</span>
                <span>게임전용혜택 {useGameBenefit ? '포함' : '미포함'}</span>
              </button>
            </div>
          </div>

          {/* 정렬 탭 바 */}
          <div className="flex items-center justify-end space-x-2 border-b border-slate-200 pb-2">
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

          {/* 최저가 결과 카드 리스트 */}
          <div className="space-y-3">
            {rankResults.map((item) => {
              const calculatedFinalPrice = Math.round(payAmount * item.discountFactor);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border transition-all hover:shadow-md grid grid-cols-1 md:grid-cols-12 overflow-hidden ${
                    item.rank === 1
                      ? 'border-cyan-400 ring-2 ring-cyan-400/30 bg-white'
                      : 'border-slate-200 bg-white'
                  }`}
                >
                  {/* [좌측 3열] 1등 + 왕관옵션 및 사용 스토어 */}
                  <div className="md:col-span-3 p-5 bg-slate-50/80 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-between space-y-3">
                    <div className="flex items-center space-x-2">
                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-black shadow-sm flex items-center gap-1 ${
                          item.rank === 1
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        <span>{item.rank}등</span>
                        {item.isCrown && <span>👑</span>}
                      </span>
                      {item.isCrown && (
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

                  {/* [중앙 6열] 결제 경로 및 세부 할인 내역 */}
                  <div className="md:col-span-6 p-5 flex flex-col justify-between space-y-3">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block mb-1.5">
                        결제 진행 수단 및 경로
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.paymentRoute.map((step, idx) => (
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

                  {/* [우측 3열 포인트 박스] 원가, 최종 금액, 할인율 태그 */}
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

        </div>

        {/* [우측 2열] 스티키 광고 */}
        <aside className="lg:col-span-2 h-full">
          <div className="sticky top-28 h-[650px] w-full p-5 bg-slate-100 rounded-xl border border-slate-200/80 flex flex-col items-center justify-between text-center shadow-inner">
            <span className="px-2.5 py-1 bg-slate-800 text-white font-bold text-[9px] rounded tracking-wider">
              ADVERTISEMENT
            </span>

            <div className="space-y-4 my-auto">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-sm border border-slate-200 mx-auto animate-pulse">
                📢
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  협업 제휴 광고
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-[130px] mx-auto">
                  게임별 스토어 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                💡 실시간 최저가 연산 배너 입점 문의 환영
              </div>
            </div>

            <button className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/20 cursor-pointer">
              광고/제휴 신청하기
            </button>
          </div>
        </aside>

      </div>

    </div>
  );
}