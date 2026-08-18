import { useState, useEffect } from 'react';
import GameRankBoard from '../components/GameRankBoard';

export default function MainPage() {
  const events = [
    { id: 1, title: '쿠키런: 킹덤 8월 특별 혜택', tag: '스토어 15% 쿠폰' },
    { id: 2, title: '원스토어 수요일 30% 캐시백', tag: '선착순 응모' },
    { id: 3, title: '구글 플레이 인앱 결제 적립', tag: '2배 포인트' },
    { id: 4, title: '갤럭시 스토어 혜택 모음', tag: '출석체크' },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPaused, events.length]);

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative overflow-hidden">
      
      {/* 화면 가장자리 불규칙 SVG 기하학 백그라운드 조각 */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] pointer-events-none opacity-[0.05] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,20 480,80 380,420 40,300" fill="#00D2B8" />
          <polygon points="480,80 380,420 490,480" fill="#0F172A" />
        </svg>
      </div>
      <div className="absolute bottom-10 -left-20 w-[600px] h-[600px] pointer-events-none opacity-[0.04] z-0 rotate-45">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,50 450,120 300,450 100,380" fill="#00D2B8" />
        </svg>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-10 relative z-10">
        
        {/* 오늘의 이벤트 섹션 */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              오늘의 이벤트
            </h2>
          </div>

          <div
            className="relative py-2"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
              {events.map((evt, index) => {
                const isActive = index === activeIndex;

                return (
                  <div
                    key={evt.id}
                    onClick={() => setActiveIndex(index)}
                    /* 💡 과한 번짐 대신 축소된 섬세한 민트 글로우 shadow-[0_4px_14px_rgba(0,210,184,0.35)] 적용 */
                    className={`shrink-0 h-64 bg-white rounded-lg p-5 flex flex-col justify-between transition-all duration-300 ease-in-out cursor-pointer ${
                      isActive
                        ? 'border-2 border-[#00D2B8] shadow-[0_4px_14px_rgba(0,210,184,0.35)] scale-102 z-10'
                        : 'border border-slate-200/90 hover:border-[#00D2B8]/60 scale-98 shadow-xs opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        {/* 이미지와 동일한 톤의 약한 그라데이션 뱃지 */}
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded text-xs font-black border ${
                            isActive
                              ? 'bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 text-[#00A896] border-[#00D2B8]/40'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {evt.tag}
                        </span>
                        {isActive && (
                          <span className="text-[10px] font-black text-slate-950 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] px-2 py-0.5 rounded shadow-2xs">
                            HOT
                          </span>
                        )}
                      </div>

                      <h3 className="text-lg font-black leading-snug text-slate-900">
                        {evt.title}
                      </h3>
                    </div>

                    <div className="space-y-2.5">
                      <p className="text-xs font-medium text-slate-500">
                        클릭 시 추천 결제수단 및 할인 조합으로 자동 연결됩니다.
                      </p>
                      
                      {/* 💡 요청하신 색감(from-[#00D2B8] to-[#00F5FF])이 정확히 반영된 버튼 */}
                      <button
                        type="button"
                        className={`w-full py-2.5 font-black text-xs rounded transition-all cursor-pointer ${
                          isActive
                            ? 'bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 shadow-[0_2px_8px_rgba(0,210,184,0.3)]'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        이벤트 자세히 보기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 인디케이터 바 */}
          <div className="flex items-center justify-center space-x-2 pt-1">
            {events.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={`h-1.5 transition-all cursor-pointer rounded-full ${
                  idx === activeIndex
                    ? 'w-6 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF]'
                    : 'w-2 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`${idx + 1}번 이벤트 보기`}
              />
            ))}
          </div>
        </section>

        {/* TOP 20 검색 순위 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4 border-t border-slate-200">
          <div className="lg:col-span-9">
            <GameRankBoard />
          </div>

          <aside className="lg:col-span-3">
            <div className="h-full min-h-[320px] p-6 bg-slate-900 rounded-lg border border-slate-800 flex flex-col items-center justify-center text-center space-y-4 shadow-sm">
              <span className="text-3xl animate-bounce">📢</span>
              <div className="space-y-1">
                <h3 className="font-black text-white text-base">협업 광고 영역</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  제휴 스토어 및 카드사 프로모션 배너 공간입니다.
                </p>
              </div>
              <button className="px-5 py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all cursor-pointer shadow-md">
                신청하기
              </button>
            </div>
          </aside>
        </div>

      </div>
    </div>
  );
}