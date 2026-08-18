import { useState, useEffect } from 'react';
import GameRankBoard from '../components/GameRankBoard';

export interface EventDetailItem {
  id: number;
  title: string;
  tag: string;
  game: string;
  provider: string;
  condition?: string;
  valueText?: string;
}

export default function MainPage() {
  // 💡 0초 즉시 로딩 및 고정 4개 이벤트 캐시 로더
  const getInitialEvents = (): EventDetailItem[] => {
    try {
      const cached = localStorage.getItem('cached_main_events');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    return [
      {
        id: 1,
        title: '원스토어 수요일 30% 캐시백',
        tag: '⏰ 기간한정',
        game: '쿠키런: 킹덤',
        provider: '원스토어 (ONE_STORE)',
        condition: '매주 수요일 원스토어 인앱 결제 시 30% 게임 캐시백 적립',
        valueText: '30% 캐시백',
      },
      {
        id: 2,
        title: '쿠키런: 킹덤 스토어 한정 쿠폰',
        tag: '⏰ 기간한정',
        game: '쿠키런: 킹덤',
        provider: '원스토어 / 갤럭시 스토어',
        condition: '선착순 쿠폰 발급 후 인앱 결제 시 즉시 할인 적용',
        valueText: '15% 할인',
      },
      {
        id: 3,
        title: '갤럭시 스토어 한여름 WAVE 쿠폰',
        tag: '⏰ 기간한정',
        game: '트릭컬 리바이브',
        provider: '갤럭시 스토어 (GALAXY_STORE)',
        condition: '이벤트 응모 시 구간별 금액 할인 쿠폰 패크 즉시 지급',
        valueText: '최대 2만원 할인',
      },
      {
        id: 4,
        title: 'SKT 휴대폰결제 첫 결제 5천원 할인',
        tag: '⏰ 기간한정',
        game: '리니지M',
        provider: 'SKT 통신사 결제',
        condition: 'SKT 휴대폰 결제로 첫 3만원 이상 결제 시 5,000원 즉시 할인',
        valueText: '5,000원 할인',
      },
    ];
  };

  const [events, setEvents] = useState<EventDetailItem[]>(getInitialEvents);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // 💡 상세보기 팝업 모달 관리 State
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<EventDetailItem | null>(null);

  useEffect(() => {
    let registeredGames: { id: string; name: string }[] = [];
    try {
      const cachedGames = localStorage.getItem('cached_games_list');
      if (cachedGames) {
        registeredGames = JSON.parse(cachedGames);
      }
    } catch (e) {}

    fetch('http://127.0.0.1:8000/payments')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          const limitedBenefits: EventDetailItem[] = [];
          const generalBenefits: EventDetailItem[] = [];

          result.data.forEach((m: any) => {
            if (m.benefits && m.benefits.length > 0) {
              m.benefits.forEach((b: any) => {
                const titleText = b.title || `${m.name} 특별 혜택`;
                const condText = b.condition || '상세 조건은 해당 결제사 및 스토어 프로모션 페이지를 참고하세요.';
                const combinedText = `${titleText} ${condText} ${m.name}`.toLowerCase();

                const val = parseFloat(b.benefit_value) || 0;
                const unit = b.benefit_unit === 'PERCENT' ? '%' : '원';
                const typeText = b.benefit_type === 'DISCOUNT' ? '할인' : '적립';
                const valueStr = val > 0 ? `${val.toLocaleString()}${unit} ${typeText}` : '혜택 적용';

                const isLimited =
                  b.is_limited_time === true ||
                  b.end_date ||
                  ['한정', '기간', '선착순', '이벤트', '수요일', '월간', 'wave', '프로모션', '특가', '첫 결제', '첫결제', '쿠폰', '차'].some(
                    (kw) => combinedText.includes(kw)
                  );

                let matchedGameName = '공통 (전체 게임 지원)';
                const rawTargetGame = b.target_game || 'ALL';

                if (rawTargetGame !== 'ALL') {
                  const found = registeredGames.find(
                    (g) =>
                      g.name.toLowerCase().includes(rawTargetGame.toLowerCase()) ||
                      rawTargetGame.toLowerCase().includes(g.name.toLowerCase())
                  );
                  matchedGameName = found ? found.name : rawTargetGame;
                }

                const item: EventDetailItem = {
                  id: 0,
                  title: titleText,
                  tag: isLimited ? '⏰ 기간한정' : (val > 0 ? `${val}${unit} ${typeText}` : (m.tag || '특별 혜택')),
                  provider: m.name || m.code,
                  game: matchedGameName,
                  condition: condText,
                  valueText: valueStr,
                };

                if (isLimited) {
                  limitedBenefits.push(item);
                } else {
                  generalBenefits.push(item);
                }
              });
            }
          });

          // 고정 키 기준 일관 정렬
          limitedBenefits.sort((a, b) => a.title.localeCompare(b.title));
          generalBenefits.sort((a, b) => a.title.localeCompare(b.title));

          const combinedPool = [...limitedBenefits, ...generalBenefits];
          const uniqueTitles = new Set<string>();
          const final4Events: EventDetailItem[] = [];

          combinedPool.forEach((b) => {
            if (final4Events.length < 4 && !uniqueTitles.has(b.title)) {
              uniqueTitles.add(b.title);
              final4Events.push({
                ...b,
                id: final4Events.length + 1,
              });
            }
          });

          if (final4Events.length > 0) {
            setEvents(final4Events);
            localStorage.setItem('cached_main_events', JSON.stringify(final4Events));
          }
        }
      })
      .catch((err) => console.error('오늘의 고정 이벤트 로드 실패:', err));
  }, []);

  useEffect(() => {
    if (isPaused || selectedEventForDetail !== null) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % events.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPaused, events.length, selectedEventForDetail]);

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative overflow-hidden">
      
      {/* 백그라운드 SVG 조각 */}
      <div className="absolute top-0 right-0 w-[550px] h-[550px] pointer-events-none opacity-[0.05] z-0">
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg">
          <polygon points="120,20 480,80 380,420 40,300" fill="#00D2B8" />
          <polygon points="480,80 380,420 490,480" fill="#0F172A" />
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
                    className={`shrink-0 h-64 bg-white rounded-lg p-5 flex flex-col justify-between transition-all duration-300 ease-in-out cursor-pointer ${
                      isActive
                        ? 'border-2 border-[#00D2B8] shadow-[0_4px_14px_rgba(0,210,184,0.35)] scale-102 z-10'
                        : 'border border-slate-200/90 hover:border-[#00D2B8]/60 scale-98 shadow-xs opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
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
                        클릭 시 이벤트 상세 정보 및 조건을 확인합니다.
                      </p>

                      {/* 💡 [수정] 상세보기 버튼 클릭 시 팝업 열기 */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEventForDetail(evt);
                        }}
                        className={`w-full py-2.5 font-black text-xs rounded transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isActive
                            ? 'bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 shadow-[0_2px_8px_rgba(0,210,184,0.3)]'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>상세보기</span>
                        <span>➔</span>
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

      {/* 💡 [추가] 이벤트 카드 [상세보기] 클릭 시 뜨는 상세 정보 팝업 모달 */}
      {selectedEventForDetail && (
        <div
          onClick={() => setSelectedEventForDetail(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-lg max-w-md w-full p-6 space-y-5 shadow-2xl cursor-default"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2.5 py-1 rounded-full border border-[#00D2B8]/40">
                  {selectedEventForDetail.tag}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForDetail(null)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-black text-slate-900 leading-snug">
                {selectedEventForDetail.title}
              </h3>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-bold text-slate-500">제공 결제 수단 / 스토어:</span>
                  <span className="font-extrabold text-slate-900">{selectedEventForDetail.provider}</span>
                </div>
                
                <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/60 pt-2">
                  <span className="font-bold text-slate-500">적용 게임 대상:</span>
                  <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200/60">
                    {selectedEventForDetail.game}
                  </span>
                </div>

                {selectedEventForDetail.valueText && (
                  <div className="flex justify-between items-center text-slate-600 border-t border-slate-200/60 pt-2">
                    <span className="font-bold text-slate-500">혜택 수치:</span>
                    <span className="font-black text-rose-600 text-sm">
                      {selectedEventForDetail.valueText}
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-gradient-to-r from-[#00D2B8]/10 to-[#00F5FF]/10 rounded-lg border border-[#00D2B8]/30 space-y-1.5 text-xs">
                <span className="font-black text-[#00A896] block">💡 상세 참여 조건 & 안내</span>
                <p className="text-slate-700 font-medium leading-relaxed">
                  {selectedEventForDetail.condition}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEventForDetail(null)}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded transition-all cursor-pointer shadow-md"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}