import React, { useState } from 'react';

type StoreCategory = 'ALL' | 'GOOGLE' | 'ONESTORE' | 'GALAXY' | 'APPLE';

interface RankGameDetail {
  rank: number;
  name: string;
  benefitText: string;
  searchCount: string;
  discountRate: string;
  badge?: string;
}

export default function GameRankPage() {
  const [activeStore, setActiveStore] = useState<StoreCategory>('ALL');

  const top10DataByCategory: Record<StoreCategory, { title: string; list: RankGameDetail[] }> = {
    ALL: {
      title: '🏆 전체 결제순위 TOP 10',
      list: [
        { rank: 1, name: '쿠키런: 킹덤', benefitText: '스토어 15% 쿠폰 + 문화상품권 10% 우회 결제', searchCount: '12,450회', discountRate: '25% OFF', badge: 'TOP 1' },
        { rank: 2, name: '리니지M', benefitText: '신한 인앱결제 제휴카드 10% 청구할인', searchCount: '9,820회', discountRate: '18% OFF', badge: '인기' },
        { rank: 3, name: '오딘: 발할라 라이징', benefitText: '원스토어 수요일 15% 캐시백 이벤트', searchCount: '7,110회', discountRate: '15% OFF', badge: '상승' },
        { rank: 4, name: '나 혼자만 레벨업:어라이즈', benefitText: '갤스 10% 쿠폰 + 삼성카드 5% 페이백', searchCount: '6,500회', discountRate: '12% OFF' },
        { rank: 5, name: '붕괴: 스타레일', benefitText: 'Play Points 골드등급 2배 적립', searchCount: '5,400회', discountRate: '10% 적립' },
        { rank: 6, name: '원신', benefitText: '카카오페이 10% 즉시할인 행사', searchCount: '4,900회', discountRate: '10% OFF' },
        { rank: 7, name: 'AFK : 새로운 여정', benefitText: 'T멤버십 8% 차감 할인 혜택', searchCount: '4,100회', discountRate: '8% OFF' },
        { rank: 8, name: 'FC 모바일', benefitText: 'KB국민 노리2 체크카드 10% 할인', searchCount: '3,800회', discountRate: '8% OFF' },
        { rank: 9, name: '메이플스토리M', benefitText: '컬쳐랜드 우회 충전 5% 적립', searchCount: '3,200회', discountRate: '5% 적립' },
        { rank: 10, name: '승리의 여신: 니케', benefitText: '토스프라임 구독 서비스 4% 추가적립', searchCount: '2,900회', discountRate: '5% OFF' },
      ],
    },
    GOOGLE: {
      title: '🤖 구글 플레이 결제순위 TOP 10',
      list: [
        { rank: 1, name: '리니지M', benefitText: 'Play Points 다이아몬드 등급 2배 적립', searchCount: '8,900회', discountRate: '20% OFF', badge: '구글 1위' },
        { rank: 2, name: '쿠키런: 킹덤', benefitText: '구글 기프트코드 5% 할인 구매', searchCount: '7,200회', discountRate: '15% OFF' },
        { rank: 3, name: '원신', benefitText: '포인트 적립 특별 이벤트', searchCount: '5,100회', discountRate: '12% 적립' },
        { rank: 4, name: 'AFK : 새로운 여정', benefitText: '10% 인앱 결제 할인', searchCount: '4,300회', discountRate: '10% OFF' },
        { rank: 5, name: 'FC 모바일', benefitText: 'Play Points 부스트 적립', searchCount: '3,900회', discountRate: '8% 적립' },
        { rank: 6, name: '오딘: 발할라 라이징', benefitText: '구글 핀번 추가 적립', searchCount: '3,400회', discountRate: '8% 적립' },
        { rank: 7, name: '붕괴: 스타레일', benefitText: 'Play Points 1.5배 적립', searchCount: '3,100회', discountRate: '7% 적립' },
        { rank: 8, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', searchCount: '2,800회', discountRate: '6% OFF' },
        { rank: 9, name: '리니지W', benefitText: '통신사 소액결제 혜택', searchCount: '2,200회', discountRate: '5% OFF' },
        { rank: 10, name: '세븐나이츠 키우기', benefitText: '출석 쿠폰 지급 이벤트', searchCount: '1,900회', discountRate: '5% OFF' },
      ],
    },
    ONESTORE: {
      title: '🛍️ 원스토어 결제순위 TOP 10',
      list: [
        { rank: 1, name: '쿠키런: 킹덤', benefitText: '원스 수요일 30% 캐시백 행사', searchCount: '9,100회', discountRate: '30% OFF', badge: '원스 1위' },
        { rank: 2, name: '승리의 여신: 니케', benefitText: 'T멤버십 10% 차감 할인', searchCount: '6,400회', discountRate: '15% OFF' },
        { rank: 3, name: '메이플스토리M', benefitText: '원스 쿠폰 20% 즉시 적용', searchCount: '4,800회', discountRate: '20% OFF' },
        { rank: 4, name: '오딘: 발할라 라이징', benefitText: '매일 첫 결제 10% 할인', searchCount: '3,900회', discountRate: '10% OFF' },
        { rank: 5, name: '기적의 검', benefitText: '원스 전용 포인트 적립', searchCount: '3,100회', discountRate: '10% 적립' },
        { rank: 6, name: '삼국지 전략판', benefitText: '원스 캐시 10% 페이백', searchCount: '2,700회', discountRate: '10% OFF' },
        { rank: 7, name: '뮤 아크엔젤', benefitText: '하나 카드 원스 할인', searchCount: '2,100회', discountRate: '8% OFF' },
        { rank: 8, name: '바람의나라: 연', benefitText: 'T멤버십 전용 쿠폰', searchCount: '1,800회', discountRate: '8% OFF' },
        { rank: 9, name: '라그나로크M', benefitText: '주말 20% 할인 쿠폰', searchCount: '1,500회', discountRate: '7% OFF' },
        { rank: 10, name: '히트2', benefitText: '원스 1,000p 포인트 지급', searchCount: '1,200회', discountRate: '5% OFF' },
      ],
    },
    GALAXY: {
      title: '🌌 갤럭시 스토어 결제순위 TOP 10',
      list: [
        { rank: 1, name: '붕괴: 스타레일', benefitText: '갤스 10% 쿠폰 페이백', searchCount: '5,800회', discountRate: '15% OFF', badge: '갤스 1위' },
        { rank: 2, name: '원신', benefitText: '삼성 모바일카드 5% 청구할인', searchCount: '4,900회', discountRate: '12% OFF' },
        { rank: 3, name: '쿠키런: 킹덤', benefitText: '출석체크 이벤트 페이백', searchCount: '3,800회', discountRate: '10% OFF' },
        { rank: 4, name: '나 혼자만 레벨업', benefitText: '갤스 1,000원 즉시 할인', searchCount: '3,100회', discountRate: '8% OFF' },
        { rank: 5, name: '리니지W', benefitText: '갤스 멤버십 로열블루 적립', searchCount: '2,600회', discountRate: '7% 적립' },
        { rank: 6, name: '붕괴3rd', benefitText: '삼성페이 5% 추가 할인', searchCount: '2,100회', discountRate: '5% OFF' },
        { rank: 7, name: '명조: 워더링 웨이브', benefitText: '갤스 전용 페이백 행사', searchCount: '1,900회', discountRate: '5% OFF' },
        { rank: 8, name: '검은사막 모바일', benefitText: '쿠폰 패키지 번들', searchCount: '1,500회', discountRate: '5% OFF' },
        { rank: 9, name: 'R2M', benefitText: '갤스 누적 결제 리워드', searchCount: '1,100회', discountRate: '5% OFF' },
        { rank: 10, name: '에픽세븐', benefitText: '갤스 멤버십 포인트 2배', searchCount: '900회', discountRate: '4% 적립' },
      ],
    },
    APPLE: {
      title: '🍎 앱스토어 결제순위 TOP 10',
      list: [
        { rank: 1, name: '원신', benefitText: '카카오페이 결제 10% 할인', searchCount: '6,200회', discountRate: '10% OFF', badge: '애플 1위' },
        { rank: 2, name: '붕괴: 스타레일', benefitText: '페이코 5% 포인트 적립', searchCount: '5,100회', discountRate: '8% 적립' },
        { rank: 3, name: '쿠키런: 킹덤', benefitText: '앱스토어 첫 결제 이벤트', searchCount: '4,200회', discountRate: '8% OFF' },
        { rank: 4, name: '나 혼자만 레벨업', benefitText: '인앱 결제 프로모션', searchCount: '3,500회', discountRate: '7% OFF' },
        { rank: 5, name: 'FC 모바일', benefitText: '애플페이 카드 추가 적립', searchCount: '2,900회', discountRate: '5% 적립' },
        { rank: 6, name: '승리의 여신: 니케', benefitText: '카카오페이 전용 쿠폰', searchCount: '2,400회', discountRate: '5% OFF' },
        { rank: 7, name: 'AFK : 새로운 여정', benefitText: '토스페이 결제 할인', searchCount: '2,000회', discountRate: '5% OFF' },
        { rank: 8, name: '클래시 로얄', benefitText: '애플 기프트 카드 구매적용', searchCount: '1,600회', discountRate: '4% OFF' },
        { rank: 9, name: '로블록스', benefitText: '인앱 결제 특별 적립', searchCount: '1,300회', discountRate: '4% OFF' },
        { rank: 10, name: '꿈의 정원', benefitText: '페이코 3% 추가 적립', searchCount: '1,000회', discountRate: '3% 적립' },
      ],
    },
  };

  const currentRankData = top10DataByCategory[activeStore];

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃 (items-start 필수) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

        {/* [좌측 10열] 메인 결제 순위 대시보드 */}
        <div className="lg:col-span-10 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-2xl font-black text-slate-900">📊 GamerRank 실시간 결제 순위</h2>
              <p className="text-xs text-slate-500">스토어별 최적 결제 경로 순위입니다. (기본 TOP 5 표시 / 아래로 드래그 시 TOP 10 노출)</p>
            </div>
          </div>

          {/* 스토어 선택 탭 (세미 샤프 라운딩) */}
          <div className="flex space-x-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'ALL', label: '🏆 전체 결제 순위' },
                { id: 'GOOGLE', label: '🤖 구글 플레이' },
                { id: 'ONESTORE', label: '🛍️ 원스토어' },
                { id: 'GALAXY', label: '🌌 갤럭시 스토어' },
                { id: 'APPLE', label: '🍎 앱스토어' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveStore(tab.id)}
                className={`flex-1 py-2.5 px-3 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
                  activeStore === tab.id
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20 font-black'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 메인 결제 순위 대형 카드 표 (rounded-xl 적용) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-md p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">
                {currentRankData.title}
              </h3>
              <span className="text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
                Scroll for 6~10th ↓
              </span>
            </div>

            {/* max-h-[410px] 세로 고정 */}
            <div className="max-h-[410px] overflow-y-auto pr-2 space-y-2.5 custom-scrollbar">
              {currentRankData.list.map((item) => {
                const isRank1 = item.rank === 1;
                const isRank2 = item.rank === 2;
                const isRank3 = item.rank === 3;

                return (
                  <div
                    key={item.rank}
                    className={`p-4 rounded-lg border flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${
                      isRank1
                        ? 'bg-amber-50/70 border-amber-300'
                        : isRank2
                        ? 'bg-cyan-50/70 border-cyan-300'
                        : isRank3
                        ? 'bg-purple-50/70 border-purple-300'
                        : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* 순위 배지 */}
                      <span
                        className={`w-8 h-8 rounded-lg font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                          isRank1
                            ? 'bg-amber-500 text-white'
                            : isRank2
                            ? 'bg-cyan-500 text-white'
                            : isRank3
                            ? 'bg-purple-500 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.rank}
                      </span>

                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="font-extrabold text-slate-900 text-base">{item.name}</h4>
                          {item.badge && (
                            <span
                              className={`text-[10px] font-black px-2 py-0.5 rounded ${
                                isRank1
                                  ? 'bg-amber-200 text-amber-900'
                                  : isRank2
                                  ? 'bg-cyan-200 text-cyan-900'
                                  : isRank3
                                  ? 'bg-purple-200 text-purple-900'
                                  : 'bg-slate-200 text-slate-700'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-600">
                          💡 <span className="font-bold text-slate-800">{item.benefitText}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-4">
                      <span className="inline-block px-3 py-1.5 bg-red-500 text-white font-black text-xs rounded-lg shadow-sm">
                        {item.discountRate}
                      </span>
                      <p className="text-[10px] text-slate-400 font-bold mt-1">
                        누적 검색 {item.searchCount}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 하단 드래그 안내 바 */}
            <div className="text-center pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
                <span>👇</span>
                <span>아래로 마우스 스크롤 또는 터치 드래그를 하시면 6~10위 상세 혜택을 볼 수 있습니다.</span>
              </p>
            </div>
          </div>

        </div>

        {/* [우측 2열] 스티키 작동 보완 광고 배너 (top-28 & rounded-xl) */}
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
                  실시간 게임 랭킹 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                💡 실시간 게임 랭킹 제휴 및 배너 입점 문의 환영
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