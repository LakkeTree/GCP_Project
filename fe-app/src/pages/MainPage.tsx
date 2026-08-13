import { useState, useEffect } from 'react';
import GameRankBoard from '../components/GameRankBoard';

export default function MainPage() {
  const events = [
    { id: 1, title: '쿠키런: 킹덤 8월 특별 혜택', tag: '스토어 15% 쿠폰', bg: 'bg-cyan-50 border-cyan-200', activeRing: 'ring-cyan-400' },
    { id: 2, title: '원스토어 수요일 30% 캐시백', tag: '선착순 응모', bg: 'bg-sky-50 border-sky-200', activeRing: 'ring-sky-400' },
    { id: 3, title: '구글 플레이 인앱 결제 적립', tag: '2배 포인트', bg: 'bg-blue-50 border-blue-200', activeRing: 'ring-blue-400' },
    { id: 4, title: '갤럭시 스토어 혜택 모음', tag: '출석체크', bg: 'bg-purple-50 border-purple-200', activeRing: 'ring-purple-400' },
  ];

  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 3.5초마다 다음 카드로 자동 순환 (마우스 호버 시 백그라운드 정지)
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPaused, events.length]);

  return (
    <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-10">
      
      {/* 상단 오늘의 이벤트 (우측 안내 문구 및 버튼 삭제) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>🔥</span>
            <span>오늘의 이벤트</span>
          </h2>
        </div>

        {/* 이벤트 카드 슬라이드 & 확대 영역 */}
        <div
          className="relative py-4"
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
                  className={`shrink-0 h-64 ${evt.bg} rounded-2xl border p-6 flex flex-col justify-between transition-all duration-500 ease-in-out cursor-pointer ${
                    isActive
                      ? `scale-105 shadow-xl ring-4 ${evt.activeRing} ring-offset-2 z-10 opacity-100`
                      : 'scale-95 shadow-sm opacity-50 hover:opacity-85 grayscale-[30%] hover:grayscale-0'
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-block px-3 py-1 bg-white/90 rounded-full text-xs font-black shadow-sm ${
                          isActive ? 'text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {evt.tag}
                      </span>
                      {isActive && (
                        <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200 animate-pulse">
                          HOT
                        </span>
                      )}
                    </div>

                    <h3
                      className={`text-xl font-extrabold leading-snug transition-all ${
                        isActive ? 'text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {evt.title}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs text-slate-600 font-medium">
                      클릭 시 추천 결제수단 및 할인 조합으로 자동 연결됩니다.
                    </p>
                    <button
                      type="button"
                      className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-md hover:bg-slate-800'
                          : 'bg-white/80 text-slate-700 hover:bg-white border border-slate-200'
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

        {/* 하단 순환 인디케이터 바 */}
        <div className="flex items-center justify-center space-x-2 pt-1">
          {events.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === activeIndex
                  ? 'w-6 bg-cyan-500'
                  : 'w-2 bg-slate-300 hover:bg-slate-400'
              }`}
              aria-label={`${idx + 1}번 이벤트 보기`}
            />
          ))}
        </div>
      </section>

      {/* 하단 TOP 20 최근 7일간 검색 순위 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2 border-t border-slate-200">
        <div className="lg:col-span-9">
          <GameRankBoard />
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