import { useState, useEffect } from 'react';
import LegalModals from '../components/LegalModals';

const KOREAN_PAYMENT_MAP: Record<string, { name: string }> = {
  // 🔽 한국어로 변환할 수단들
  CULTURELAND_VOUCHER: { name: '컬쳐랜드 문화상품권' },
  CU_CONVENIENCE_STORE: { name: 'CU 편의점 기프트카드' },
  GOOGLE_PLAY_NAVER_STORE: { name: '구글플레이 네이버스토어' },
  KCP_BANK_ACCOUNT: { name: 'KCP 계좌이체' },

  // 기존 한글 매핑 목록
  CULTURELAND_CASH: { name: '컬쳐랜드 캐시 (우회)' },
  CULTURELAND_BYPASS: { name: '컬쳐랜드 상품권 우회' },
  GALAXY_STORE_GIFTCARD: { name: '갤럭시 스토어 기프트카드' },
  GOOGLE_PLAY_GIFTCARD: { name: '구글 플레이 기프트카드' },
  ONESTORE_GIFTCARD: { name: '원스토어 기프트카드' },
  APPLE_GIFTCARD: { name: '애플 기프트카드' },
  TELECOM_DISCOUNT: { name: '통신사 멤버십 / 소액결제' },
  CREDIT_CHECK_CARD: { name: '일반 신용/체크카드' },
  QUICK_BANK_TRANSFER: { name: '실시간 계좌이체 / 무통장입금' },
  KAKAO_PAY: { name: '카카오페이' },
  NAVER_PAY: { name: '네이버페이' },
  TOSS_PAY: { name: '토스페이' },
  PAYCO: { name: '페이코' },
  SAMSUNG_PAY: { name: '삼성페이' },
  APPLE_PAY: { name: '애플페이' },
  SKT: { name: 'SKT 통신사' },
  KT: { name: 'KT 통신사' },
  LGU_PLUS: { name: 'LGU+ 통신사' },
  LGU: { name: 'LGU+ 통신사' },
  BOOKNLIFE_VOUCHER: { name: '북앤라이프 도서문화상품권' },
  '11STREET': { name: '11번가 기프트코드' },
  GMARKET: { name: 'G마켓 기프트코드' },
  GALAXY_STORE: { name: '갤럭시 스토어 인앱결제' },
  GOOGLE_PLAY: { name: '구글 플레이 인앱결제' },
  SHINHAN_CARD: { name: '신한카드' },
  HANA_CARD: { name: '하나카드' },
  KB_KOOKMIN_CARD: { name: 'KB국민카드' },
  NH_NONGHYUP_CARD: { name: 'NH농협카드' },
  SAMSUNG_CARD: { name: '삼성카드' },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MethodCategory>('ALL');
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'contact' | null>(null);
  
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
          // SupportedPaymentPage.tsx 내부 useEffect 데이터 처리 로직 수정

        const VOUCHER_KEYWORDS = [
          'GIFTCARD', 'GIFT_CARD', 'GIFT', 'SSG', '11STREET', 'GMARKET',
          'CONVENIENCE', 'CU_', 'GS25', 'SEVEN', 'ZEROPIN', 'NAVER_STORE', 'APPLE_GIFT', 'VOUCHER', 'CULTURELAND', 'BOOKNLIFE'
        ];

        // SupportedPaymentPage.tsx 의 useEffect 내부 처리 부분

        const processedData = result.data.map((m: PaymentMethodItem) => {
          const codeUpper = (m.code || '').toUpperCase();
          const mappedInfo = KOREAN_PAYMENT_MAP[codeUpper];

          // 💡 특정 게임 전용 혜택(target_game !== 'ALL') 제거 및 공통 혜택만 유지
          const commonBenefits = (m.benefits || []).filter(
            (b) => !b.target_game || b.target_game === 'ALL'
          );

          const isVoucher = VOUCHER_KEYWORDS.some(
            (kw) => codeUpper.includes(kw) || m.name.toUpperCase().includes(kw)
          );

          const isPay = codeUpper.includes('PAY') || codeUpper === 'SAMSUNG_PAY';

          const isCard = !isVoucher && !isPay && (
            m.category === 'CARD' ||
            codeUpper.includes('CARD') ||
            codeUpper.includes('SHINHAN') ||
            codeUpper.includes('KB') ||
            codeUpper.includes('HANA') ||
            codeUpper.includes('NH')
          );

          let finalCategory: MethodCategory = m.category;
          let finalTag = m.tag;

          if (isVoucher) {
            finalCategory = 'VOUCHER';
            finalTag = '상품권 우회';
          } else if (isPay) {
            finalCategory = 'PAY';
            finalTag = '간편결제';
          } else if (isCard) {
            finalCategory = 'CARD';
            finalTag = '제휴 카드';
          }

          return {
            ...m,
            name: mappedInfo ? mappedInfo.name : m.name,
            category: finalCategory,
            tag: finalTag,
            benefits: commonBenefits, // 공통 혜택으로 교체
            benefit_count: commonBenefits.length, // 혜택 개수 재집계
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

  const categories = [
    { id: 'ALL', label: '전체' },
    { id: 'PAY', label: '간편결제 (페이)' },
    { id: 'CARRIER', label: '통신사 할인' },
    { id: 'CARD', label: '제휴 카드' },
    { id: 'VOUCHER', label: '상품권 우회' },
  ] as const;

  const filtered = paymentMethods.filter((m) => {
    // 💡 1. 스토어 자체 수단 및 더미 결제수단 코드 제외
    const EXCLUDE_CODES = [
      'CREDIT_CHECK_CARD',
      'STORE_MEMBERSHIP_REWARD',
      'CULTURELAND_PAYMENT',
      'TELECOM_DISCOUNT',
      'QUICK_BANK_TRANSFER',
      'ONE_STORE',       // 원스토어 자체 수단 제외
      'GOOGLE_PLAY',     // 구글플레이 자체 수단 제외
      'GALAXY_STORE',    // 갤럭시스토어 자체 수단 제외
      'APP_STORE'        // 앱스토어 자체 수단 제외
    ];
    if (EXCLUDE_CODES.includes(m.code.toUpperCase())) return false;

    // 2. 공통 혜택이 0개인 결제 수단 제외
    const benefitCount = m.benefit_count || (m.benefits ? m.benefits.length : 0);
    if (benefitCount === 0) return false;

    // 3. 카테고리 및 검색어 필터링
    const matchesCategory = activeCategory === 'ALL' || m.category === activeCategory;
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.tag && m.tag.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesCategory && matchesSearch;
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-10 space-y-6">
            <header className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                  호갱탈출 연동 결제 수단
                </h2>

                {!loading && (
                  <span className="text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-3 py-1 rounded border border-[#00D2B8]/30 shadow-2xs">
                    총 {filtered.length}개 연동 결제 수단 적용 가능
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium">
                실시간 최저가 연산 및 혜택 중첩이 가능한 결제 수단 리스트입니다.
              </p>
              
              <div className="pt-2 space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="결제 수단, 카드사 또는 혜택명으로 검색해보세요..."
                  className="w-full max-w-md px-4 py-2.5 text-xs rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D2B8] shadow-xs font-bold text-slate-800"
                />

                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {categories.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveCategory(tab.id as MethodCategory)}
                      className={`px-3 py-1.5 rounded text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        activeCategory === tab.id
                          ? 'bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] text-slate-950 shadow-[0_2px_8px_rgba(0,210,184,0.3)]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-4 animate-pulse">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="p-5 bg-slate-100 rounded-lg h-36 border border-slate-200" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {filtered.map((item) => {
                  const benefitCount = item.benefit_count || (item.benefits ? item.benefits.length : 0);
                  const hasBenefits = benefitCount > 0;

                  return (
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
                              className="w-10 h-10 object-contain rounded shrink-0 border border-slate-100 p-0.5 bg-white shadow-2xs"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                if (e.currentTarget.nextElementSibling) {
                                  (e.currentTarget.nextElementSibling as HTMLElement).style.display = 'flex';
                                }
                              }}
                            />
                          ) : null}

                          <div
                            className="w-10 h-10 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 items-center justify-center text-slate-700 border border-slate-300/80 shrink-0 shadow-xs"
                            style={{ display: item.icon_url && item.icon_url.startsWith('http') ? 'none' : 'flex' }}
                          >
                            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                              <rect x="2" y="5" width="20" height="14" rx="3" ry="3" />
                              <line x1="2" y1="10" x2="22" y2="10" />
                              <line x1="6" y1="15" x2="10" y2="15" strokeWidth="2" strokeLinecap="round" />
                            </svg>
                          </div>

                          <span className="text-[10px] font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2 py-0.5 rounded border border-[#00D2B8]/30">
                            {item.tag}
                          </span>
                        </div>

                        <h3 className="font-extrabold text-slate-900 text-base group-hover:text-[#00A896] transition-colors">
                          {item.name}
                        </h3>

                        {hasBenefits && (
                          <div className="p-2.5 bg-slate-50 group-hover:bg-[#00D2B8]/10 rounded border border-slate-200/80 group-hover:border-[#00D2B8]/30 transition-all flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                              <span>연동 혜택 {benefitCount}개 보유</span>
                            </span>
                            <span className="text-[11px] text-[#00A896] font-black">확인 ➔</span>
                          </div>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-2.5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 font-bold">지원 스토어:</span>
                        <div className="flex gap-1 flex-wrap">
                          {(item.stores || []).map((s) => (
                            <span
                              key={s}
                              className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
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

            <button 
              type="button"
              onClick={() => setModalType('contact')}
              className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer"
            >
              광고/제휴 신청하기
            </button>
          </aside>
        </div>
      </div>

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
                  <div className="w-8 h-8 rounded bg-slate-100 flex items-center justify-center text-slate-600 border border-slate-200">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
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
                  현재 진행 중인 특별 프로모션 이벤트가 없습니다. 기본 최저가 연산 엔진이 지속적으로 적용 중입니다.
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
                      {b.condition}
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

      {/* 제휴 및 광고 문의 모달 */}
      <LegalModals type={modalType} onClose={() => setModalType(null)} />
    </div>
  );
}