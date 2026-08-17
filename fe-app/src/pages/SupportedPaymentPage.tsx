import { useState, useEffect } from 'react';

type MethodCategory = 'ALL' | 'PAY' | 'CARRIER' | 'CARD' | 'VOUCHER';

export interface BenefitDetailItem {
  benefit_id: string;
  title: string;
  condition: string;
  benefit_type: string;
  benefit_value: string;
  benefit_unit: string;
  target_game: string;
}

export interface PaymentMethodItem {
  id: number;
  code: string;
  name: string;
  icon: string;
  icon_url?: string;
  category: MethodCategory;
  tag: string;
  benefit_count: number;
  benefits: BenefitDetailItem[];
  stores: string[];
}

// 지원 게임 페이지와 동일한 초고속 캐시 로더
const getInitialPayments = (): PaymentMethodItem[] => {
  try {
    const localData = localStorage.getItem('cached_payments_list');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
};

export default function SupportedPaymentPage() {
  const [activeCategory, setActiveCategory] = useState<MethodCategory>('ALL');
  
  const initialData = getInitialPayments();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(initialData);
  const [loading, setLoading] = useState<boolean>(initialData.length === 0);
  const [selectedMethodForDetail, setSelectedMethodForDetail] = useState<PaymentMethodItem | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (paymentMethods.length === 0) setLoading(true);

    fetch('http://127.0.0.1:8000/payments')
      .then((res) => res.json())
      .then((result) => {
        if (isMounted && result.status === 'ok' && Array.isArray(result.data)) {
          setPaymentMethods(result.data);
          localStorage.setItem('cached_payments_list', JSON.stringify(result.data));
        }
      })
      .catch((err) => console.error('BigQuery 결제 수단 로드 실패:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filtered = activeCategory === 'ALL'
    ? paymentMethods
    : paymentMethods.filter((m) => m.category === activeCategory);

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
      <div className="absolute top-0 right-0 w-[550px] h-[550px] pointer-events-none opacity-[0.05] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,20 480,80 380,420 40,300" fill="#00D2B8" />
          <polygon points="480,80 380,420 490,480" fill="#0F172A" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          <div className="lg:col-span-10 space-y-6">
            {/* 💡 요청하신 불필요한 아래 문구 및 우측 태그 제거 */}
            <header className="space-y-2">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                호갱탈출 연동 결제 수단
              </h2>
            </header>

            {/* 카테고리 필터 탭 */}
            <div className="flex space-x-2 bg-slate-200/70 p-1.5 rounded-lg overflow-x-auto no-scrollbar">
              {(
                [
                  { id: 'ALL', label: '전체 결제수단' },
                  { id: 'PAY', label: '💸 간편결제 (페이)' },
                  { id: 'CARRIER', label: '📱 통신사 할인' },
                  { id: 'CARD', label: '💳 제휴 카드' },
                  { id: 'VOUCHER', label: '🎟️ 상품권 우회' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`flex-1 min-w-[110px] py-2.5 rounded text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                    activeCategory === tab.id
                      ? 'bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] text-slate-950 shadow-[0_2px_8px_rgba(0,210,184,0.3)]'
                      : 'text-slate-600 hover:bg-slate-300/60'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 스케일 상태 및 그리드 */}
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-5 bg-slate-100 rounded-lg h-36 border border-slate-200" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedMethodForDetail(item)}
                    className="p-5 bg-white rounded-lg border border-slate-200/90 shadow-xs hover:border-[#00D2B8] hover:shadow-[0_4px_14px_rgba(0,210,184,0.25)] transition-all space-y-3 flex flex-col justify-between cursor-pointer group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        {item.icon_url && item.icon_url.startsWith('http') ? (
                          <img
                            src={item.icon_url}
                            alt={item.name}
                            className="w-9 h-9 object-contain rounded shrink-0 border border-slate-100 p-0.5 bg-white shadow-2xs"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              if (e.currentTarget.nextElementSibling) {
                                (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'inline-block';
                              }
                            }}
                          />
                        ) : null}
                        <span
                          className="text-3xl"
                          style={{ display: item.icon_url && item.icon_url.startsWith('http') ? 'none' : 'inline-block' }}
                        >
                          {item.icon}
                        </span>

                        <span className="text-[10px] font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2 py-0.5 rounded border border-[#00D2B8]/30">
                          {item.tag}
                        </span>
                      </div>

                      <h3 className="font-extrabold text-slate-900 text-base group-hover:text-[#00A896] transition-colors">
                        {item.name}
                      </h3>

                      {/* 💡 지저분했던 긴 텍스트 대신 깔끔한 세부 혜택 확인 버튼 구조로 변경 */}
                      <div className="p-2.5 bg-slate-50 group-hover:bg-[#00D2B8]/10 rounded border border-slate-200/80 group-hover:border-[#00D2B8]/30 transition-all flex items-center justify-between text-xs font-bold text-slate-700">
                        <span>💡 연동 혜택 {item.benefit_count > 0 ? `${item.benefit_count}개 보유` : '상세보기'}</span>
                        <span className="text-[11px] text-[#00A896] font-black">확인 ➔</span>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-bold">지원 스토어:</span>
                      <div className="flex gap-1 flex-wrap">
                        {item.stores.map((s) => (
                          <span key={s} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold border border-slate-200/60">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <aside className="lg:col-span-2 sticky top-36 bg-slate-900 rounded-lg border border-slate-800 h-[650px] w-full p-5 flex flex-col items-center justify-between text-center shadow-md">
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 font-bold text-[9px] rounded border border-slate-700 tracking-wider">
              ADVERTISEMENT
            </span>

            <div className="space-y-4 my-auto">
              <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-3xl shadow-inner border border-slate-700 mx-auto animate-pulse">
                📢
              </div>
              <div className="space-y-1.5">
                <h3 className="font-black text-white text-sm">
                  협업 제휴 광고
                </h3>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-[130px] mx-auto">
                  결제수단별 스토어 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-slate-800/80 rounded border border-slate-700 text-[10px] text-slate-300 font-medium">
                💡 신규 결제수단 제휴 및 배너 입점 문의 환영
              </div>
            </div>

            <button className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer">
              광고/제휴 신청하기
            </button>
          </aside>

        </div>
      </div>

      {/* 💡 카드 클릭 시 열리는 개별 혜택 상세 팝업 모달 */}
      {selectedMethodForDetail && (
        <div
          onClick={() => setSelectedMethodForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl max-h-[80vh] overflow-y-auto cursor-default"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-3">
                {selectedMethodForDetail.icon_url && selectedMethodForDetail.icon_url.startsWith('http') ? (
                  <img src={selectedMethodForDetail.icon_url} alt={selectedMethodForDetail.name} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-2xl">{selectedMethodForDetail.icon}</span>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900">{selectedMethodForDetail.name}</h3>
                  <p className="text-[11px] font-bold text-[#00A896]">
                    지원 스토어: {selectedMethodForDetail.stores.join(', ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedMethodForDetail(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-800 border-l-4 border-[#00D2B8] pl-2">
                등록된 상세 혜택 및 조건 ({selectedMethodForDetail.benefits.length}개)
              </h4>

              {selectedMethodForDetail.benefits.length === 0 ? (
                <div className="p-4 bg-slate-50 rounded text-xs text-slate-500 text-center font-medium">
                  현재 기본 연산 할인 및 적립이 적용 중입니다.
                </div>
              ) : (
                selectedMethodForDetail.benefits.map((b, bIdx) => (
                  <div key={bIdx} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-slate-900">{b.title}</span>
                      {b.target_game !== 'ALL' && (
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded">
                          {b.target_game} 전용
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed bg-white p-2.5 rounded border border-slate-100 font-medium">
                      💡 {b.condition}
                    </p>
                  </div>
                ))
              )}
            </div>

            <button
              type="button"
              onClick={() => setSelectedMethodForDetail(null)}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition-all cursor-pointer"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}