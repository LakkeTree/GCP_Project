import React, { useState, useEffect } from 'react';

type RankCategory = 'ALL' | 'GOOGLE' | 'ONESTORE' | 'GALAXY' | 'APPLE';

interface RankGame {
  rank: number;
  name: string;
  benefitText: string;
  tag: string;
}

export default function MainPage() {
  const [activeTab, setActiveTab] = useState<RankCategory>('ALL');

  const rankDataByCategory: Record<RankCategory, { title: string; list: RankGame[] }> = {
    ALL: {
      title: '🏆 전체 결제순위 TOP 5',
      list: [
        { rank: 1, name: '쿠키런: 킹덤', benefitText: '최대 25% 할인', tag: '전체 1위' },
        { rank: 2, name: '리니지M', benefitText: '최대 18% 할인', tag: '인기' },
        { rank: 3, name: '오딘: 발할라 라이징', benefitText: '최대 15% 할인', tag: '상승' },
        { rank: 4, name: '나 혼자만 레벨업:어라이즈', benefitText: '최대 12% 할인', tag: '급상승' },
        { rank: 5, name: '붕괴: 스타레일', benefitText: '최대 10% 적립', tag: '유지' },
      ],
    },
    GOOGLE: {
      title: '🤖 구글 플레이 결제순위 TOP 5',
      list: [
        { rank: 1, name: '리니지M', benefitText: 'Play Points 2배', tag: '구글 1위' },
        { rank: 2, name: '쿠키런: 킹덤', benefitText: '기프트코드 5% 할인', tag: '인기' },
        { rank: 3, name: '원신', benefitText: '포인트 적립 혜택', tag: '상승' },
        { rank: 4, name: 'AFK : 새로운 여정', benefitText: '10% 결제 할인', tag: 'NEW' },
        { rank: 5, name: 'FC 모바일', benefitText: 'Play Points 적립', tag: '유지' },
      ],
    },
    ONESTORE: {
      title: '🛍️ 원스토어 결제순위 TOP 5',
      list: [
        { rank: 1, name: '쿠키런: 킹덤', benefitText: '수요일 30% 캐시백', tag: '원스 1위' },
        { rank: 2, name: '승리의 여신: 니케', benefitText: 'T멤버십 10% 할인', tag: '인기' },
        { rank: 3, name: '메이플스토리M', benefitText: '쿠폰 20% 적용', tag: '상승' },
        { rank: 4, name: '오딘: 발할라 라이징', benefitText: '매일 첫 결제 할인', tag: '유지' },
        { rank: 5, name: '기적의 검', benefitText: '전용 포인트 적립', tag: '유지' },
      ],
    },
    GALAXY: {
      title: '🌌 갤럭시 스토어 결제순위 TOP 5',
      list: [
        { rank: 1, name: '붕괴: 스타레일', benefitText: '갤스 10% 쿠폰', tag: '갤스 1위' },
        { rank: 2, name: '원신', benefitText: '삼성카드 5% 청구할인', tag: '인기' },
        { rank: 3, name: '쿠키런: 킹덤', benefitText: '출석체크 페이백', tag: '상승' },
        { rank: 4, name: '나 혼자만 레벨업', benefitText: '1,000원 쿠폰', tag: 'NEW' },
        { rank: 5, name: '리니지W', benefitText: '갤스 멤버십 적립', tag: '유지' },
      ],
    },
    APPLE: {
      title: '🍎 앱스토어 결제순위 TOP 5',
      list: [
        { rank: 1, name: '원신', benefitText: '카카오페이 10% 할인', tag: '애플 1위' },
        { rank: 2, name: '붕괴: 스타레일', benefitText: '페이코 5% 적립', tag: '인기' },
        { rank: 3, name: '쿠키런: 킹덤', benefitText: '첫 결제 혜택', tag: '상승' },
        { rank: 4, name: '나 혼자만 레벨업', benefitText: '인앱 할인 이벤트', tag: 'NEW' },
        { rank: 5, name: 'FC 모바일', benefitText: '애플페이 적립', tag: '유지' },
      ],
    },
  };

  useEffect(() => {
    const categories: RankCategory[] = ['ALL', 'GOOGLE', 'ONESTORE', 'GALAXY', 'APPLE'];
    const interval = setInterval(() => {
      setActiveTab((prevTab) => {
        const currentIndex = categories.indexOf(prevTab);
        return categories[(currentIndex + 1) % categories.length];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentRank = rankDataByCategory[activeTab];

  const events = [
    { id: 1, title: '쿠키런: 킹덤 8월 특별 혜택', tag: '스토어 15% 쿠폰', bg: 'bg-cyan-50 border-cyan-200' },
    { id: 2, title: '원스토어 수요일 30% 캐시백', tag: '선착순 응모', bg: 'bg-sky-50 border-sky-200' },
    { id: 3, title: '구글 플레이 인앱 결제 적립', tag: '2배 포인트', bg: 'bg-blue-50 border-blue-200' },
    { id: 4, title: '갤럭시 스토어 혜택 모음', tag: '출석체크', bg: 'bg-purple-50 border-purple-200' },
  ];

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-10">
      
      {/* 상단 오늘의 이벤트 */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
            <span>🔥</span> 오늘의 이벤트
          </h2>
          <span className="text-xs text-slate-400 font-medium">👉 옆으로 넘겨서 체크</span>
        </div>

        <div className="flex space-x-4 overflow-x-auto pb-4 no-scrollbar scroll-smooth">
          {events.map((evt) => (
            <div
              key={evt.id}
              className={`shrink-0 w-80 h-64 ${evt.bg} rounded-xl border p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all cursor-pointer`}
            >
              <div className="space-y-3">
                <span className="inline-block px-3 py-1 bg-white/90 rounded-full text-xs font-black text-cyan-800 shadow-sm">
                  {evt.tag}
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 leading-snug">
                  {evt.title}
                </h3>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-600 font-medium">
                  클릭 시 추천 결제수단 및 할인 조합으로 자동 연결됩니다.
                </p>
                <button className="w-full py-2.5 bg-slate-900 text-white font-bold text-xs rounded-lg hover:bg-slate-800 transition-all cursor-pointer">
                  이벤트 자세히 보기
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 하단 TOP 5 랭킹 + 우측 광고 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-slate-200">
        
        <div className="lg:col-span-9 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span>{currentRank.title.split(' ')[0]}</span>
              <span>{currentRank.title.split(' ').slice(1).join(' ')}</span>
            </h2>

            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg shrink-0 overflow-x-auto">
              {(
                [
                  { id: 'ALL', label: '전체' },
                  { id: 'GOOGLE', label: '구글' },
                  { id: 'ONESTORE', label: '원스토어' },
                  { id: 'GALAXY', label: '갤스' },
                  { id: 'APPLE', label: '앱스토어' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20 font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2.5">
            {currentRank.list.map((item) => (
              <div
                key={item.rank}
                className="p-4 bg-white rounded-lg border border-slate-200 flex items-center justify-between shadow-sm hover:border-cyan-400 transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3.5">
                  <span
                    className={`w-7 h-7 rounded-lg font-black text-xs flex items-center justify-center shrink-0 ${
                      item.rank === 1
                        ? 'bg-amber-500 text-white'
                        : item.rank === 2
                        ? 'bg-cyan-500 text-white'
                        : item.rank === 3
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.rank}
                  </span>
                  <div>
                    <h4 className="font-extrabold text-slate-800 text-sm">{item.name}</h4>
                    <span className="text-[11px] text-slate-400 font-medium">{item.tag}</span>
                  </div>
                </div>

                <span className="px-3 py-1 bg-cyan-50 text-cyan-800 font-black text-xs rounded-lg border border-cyan-200">
                  {item.benefitText}
                </span>
              </div>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-3">
          <div className="h-full min-h-[320px] p-6 bg-slate-100 rounded-xl border border-slate-200 flex flex-col items-center justify-center text-center space-y-3 shadow-inner">
            <span className="text-4xl animate-bounce">📢</span>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-800 text-base">협업 광고 영역</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                제휴 스토어 및 카드사 프로모션 배너 공간입니다.
              </p>
            </div>
            <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg shadow-md shadow-cyan-500/20 transition-all cursor-pointer">
              신청하기
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}