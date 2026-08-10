import React, { useState } from 'react';

type MethodCategory = 'ALL' | 'PAY' | 'CARRIER' | 'CARD' | 'VOUCHER';

export default function SupportedPaymentPage() {
  const [activeCategory, setActiveCategory] = useState<MethodCategory>('ALL');

  const paymentMethods = [
    { id: 1, name: '네이버페이', icon: '💸', category: 'PAY', tag: '간편결제', benefit: '기본 4% 네이버플러스 적립', stores: ['구글', '원스', '갤스', '앱스토어'] },
    { id: 2, name: '카카오페이', icon: '💛', category: 'PAY', tag: '간편결제', benefit: '앱스토어/구글 10% instant 할인', stores: ['구글', '앱스토어'] },
    { id: 3, name: '페이코 (PAYCO)', icon: '🔴', category: 'PAY', tag: '간편결제', benefit: '5% 페이코 포인트 추가 적립', stores: ['구글', '원스', '갤스'] },
    { id: 4, name: '토스페이', icon: '🔵', category: 'PAY', tag: '간편결제', benefit: '토스프라임 +4% 적립', stores: ['구글', '원스', '앱스토어'] },
    { id: 5, name: '삼성페이', icon: '📱', category: 'PAY', tag: '간편결제', benefit: '갤럭시 스토어 전용 결제 캐시백', stores: ['갤스'] },
    { id: 6, name: 'SKT T멤버십 / 소액결제', icon: '📶', category: 'CARRIER', tag: '통신사', benefit: '원스토어 10% 차감할인 / 소액결제 이벤트', stores: ['구글', '원스'] },
    { id: 7, name: 'KT 콘텐츠이용료', icon: '📶', category: 'CARRIER', tag: '통신사', benefit: '구글/원스토어 결제 시 최대 1만원 청구할인', stores: ['구글', '원스'] },
    { id: 8, name: 'LGU+ 통신사 결제', icon: '📶', category: 'CARRIER', tag: '통신사', benefit: '5,000원 상당 첫 결제 할인', stores: ['구글', '원스'] },
    { id: 9, name: '신한 LineageM / 인앱 카드', icon: '💳', category: 'CARD', tag: '신용/체크카드', benefit: '인앱 결제 최대 10% 청구할인', stores: ['구글', '원스', '갤스', '앱스토어'] },
    { id: 10, name: 'KB국민 노리2 체크카드 (Play)', icon: '💳', category: 'CARD', tag: '체크카드', benefit: '인앱 결제 10% 환급할인', stores: ['구글', '앱스토어'] },
    { id: 11, name: '삼성 iD GLOBAL / SELECT ON', icon: '💳', category: 'CARD', tag: '신용카드', benefit: '해외/인앱 결제 최대 50% 할인', stores: ['구글', '갤스', '앱스토어'] },
    { id: 12, name: 'NH농협 zgm.play / streaming', icon: '💳', category: 'CARD', tag: '신용카드', benefit: '게임 인앱 결제 10% 적립', stores: ['구글', '원스', '갤스'] },
    { id: 13, name: '컬쳐랜드 (문화상품권 우회)', icon: '🎟️', category: 'VOUCHER', tag: '상품권 우회', benefit: 'G마켓/11번가 7~9% 할인 구매 후 충전', stores: ['구글', '원스'] },
    { id: 14, name: '구글 핀번 기프트코드', icon: '🎁', category: 'VOUCHER', tag: '기프트코드', benefit: '편의점/나한카 5% 할인 충전', stores: ['구글'] },
    { id: 15, name: '북앤라이프 캐시', icon: '📖', category: 'VOUCHER', tag: '상품권 우회', benefit: '6% 할인 구매 후 인앱 충전', stores: ['원스'] },
  ];

  const filtered = activeCategory === 'ALL'
    ? paymentMethods
    : paymentMethods.filter((m) => m.category === activeCategory);

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 메인 연동 결제 수단 */}
        <div className="lg:col-span-10 space-y-6">
          <header className="space-y-2">
            <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-extrabold text-xs rounded border border-cyan-200">
              💳 결제 수단 가이드
            </span>
            <h2 className="text-2xl font-black text-slate-900">호갱탈출 연동 결제 수단</h2>
            <p className="text-xs text-slate-500">
              실시간 최저가 연산에 자동 조합되어 적용되는 스토어별 간편결제, 통신사, 카드사, 우회 상품권 목록입니다.
            </p>
          </header>

          {/* 카테고리 필터 탭 (세미 샤프 라운딩) */}
          <div className="flex space-x-2 bg-slate-200/80 p-1.5 rounded-xl overflow-x-auto no-scrollbar">
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
                className={`flex-1 min-w-[110px] py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  activeCategory === tab.id
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'text-slate-600 hover:bg-slate-300/60'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 결제 수단 카드 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {filtered.map((item) => (
              <div
                key={item.id}
                className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-cyan-400 hover:shadow-md transition-all space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{item.icon}</span>
                    <span className="text-[10px] font-extrabold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-slate-800 text-base">{item.name}</h3>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    💡 {item.benefit}
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-2 flex items-center justify-between text-[10px]">
                  <span className="text-slate-400 font-bold">지원 스토어:</span>
                  <div className="flex gap-1">
                    {item.stores.map((s) => (
                      <span key={s} className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* [우측 2열] 규격 통일 스티키 광고 */}
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
                  결제수단별 스토어 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                💡 신규 결제수단 제휴 및 배너 입점 문의 환영
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