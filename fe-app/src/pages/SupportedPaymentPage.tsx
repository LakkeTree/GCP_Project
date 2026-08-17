import { useState, useEffect } from 'react';

// 영문 수단 코드를 한글 명칭 및 이모지 아이콘으로 변환하는 사전
const KOREAN_PAYMENT_MAP: Record<string, { name: string; icon: string }> = {
  CULTURELAND_CASH: { name: '컬쳐랜드 캐시 (우회)', icon: '🎟️' },
  CULTURELAND_BYPASS: { name: '컬쳐랜드 상품권 우회', icon: '🎟️' },
  GALAXY_STORE_GIFTCARD: { name: '갤럭시 스토어 기프트카드', icon: '🎁' },
  GOOGLE_PLAY_GIFTCARD: { name: '구글 플레이 기프트카드', icon: '🎁' },
  ONESTORE_GIFTCARD: { name: '원스토어 기프트카드', icon: '🎁' },
  APPLE_GIFTCARD: { name: '애플 기프트카드', icon: '🎁' },
  TELECOM_DISCOUNT: { name: '통신사 멤버십 / 소액결제', icon: '📱' },
  CREDIT_CHECK_CARD: { name: '일반 신용/체크카드', icon: '💳' },
  QUICK_BANK_TRANSFER: { name: '실시간 계좌이체 / 무통장입금', icon: '🏦' },
  KAKAO_PAY: { name: '카카오페이', icon: '💛' },
  NAVER_PAY: { name: '네이버페이', icon: '💚' },
  TOSS_PAY: { name: '토스페이', icon: '🔵' },
  PAYCO: { name: '페이코', icon: '🔴' },
  SAMSUNG_PAY: { name: '삼성페이', icon: '🟦' },
  APPLE_PAY: { name: '애플페이', icon: '🍎' },
  SKT: { name: 'SKT 통신사', icon: '📶' },
  KT: { name: 'KT 통신사', icon: '📶' },
  LGU_PLUS: { name: 'LGU+ 통신사', icon: '📶' },
  LGU: { name: 'LGU+ 통신사', icon: '📶' },
  BOOKNLIFE_VOUCHER: { name: '북앤라이프 도서문화상품권', icon: '📚' },
  '11STREET': { name: '11번가 기프트코드', icon: '🛒' },
  GMARKET: { name: 'G마켓 기프트코드', icon: '🛒' },
  GALAXY_STORE: { name: '갤럭시 스토어 인앱결제', icon: '🌌' },
  GOOGLE_PLAY: { name: '구글 플레이 인앱결제', icon: '▶️' },
  SHINHAN_CARD: { name: '신한카드', icon: '💳' },
  HANA_CARD: { name: '하나카드', icon: '💳' },
  KB_KOOKMIN_CARD: { name: 'KB국민카드', icon: '💳' },
  NH_NONGHYUP_CARD: { name: 'NH농협카드', icon: '💳' },
  SAMSUNG_CARD: { name: '삼성카드', icon: '💳' },
};

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
          // 기프트카드 및 우회 수단 키워드
          const VOUCHER_KEYWORDS = [
            'GIFTCARD', 'GIFT_CARD', 'GIFT', 'SSG', '11STREET', 'GMARKET',
            'CONVENIENCE', 'CU_', 'GS25', 'SEVEN', 'ZEROPIN', 'NAVER_STORE', 'APPLE_GIFT', 'VOUCHER'
          ];

          const processedData = result.data.map((m: PaymentMethodItem) => {
            const isVoucher = VOUCHER_KEYWORDS.some(
              (kw) => m.code.toUpperCase().includes(kw) || m.name.toUpperCase().includes(kw)
            );

            // 한글 명칭 및 이모지 아이콘 매핑
            const mappedInfo = KOREAN_PAYMENT_MAP[m.code.toUpperCase()] || {
              name: m.name.replace(/_/g, ' '),
              icon: m.icon || '💸',
            };

            return {
              ...m,
              name: mappedInfo.name,
              icon: m.icon_url && m.icon_url.startsWith('http') ? m.icon : mappedInfo.icon,
              category: isVoucher
                ? ('VOUCHER' as MethodCategory)
                : (m.category === 'CARD' || m.code.includes('CARD') ? 'CARD' : m.category),
              tag: isVoucher
                ? '상품권/기프트카드'
                : (m.category === 'CARD' || m.code.includes('CARD') ? '제휴 카드' : m.tag),
            };
          });

          setPaymentMethods(processedData);
          
          localStorage.setItem('cached_payments_list', JSON.stringify(processedData));
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
            {/* 상단 타이틀 및 총 연동 갯수 뱃지 */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                호갱탈출 연동 결제 수단
              </h2>
              <span className="inline-flex items-center gap-1.5 text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 via-cyan-50 to-[#00F5FF]/15 px-3.5 py-2 rounded-full border border-[#00D2B8]/40 shadow-2xs self-start sm:self-auto">
                <span>✨</span>
                <span>총 {filtered.length}개의 연동 결제 수단 적용 가능</span>
              </span>
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