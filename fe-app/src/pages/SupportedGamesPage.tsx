import { useState, useEffect, useRef } from 'react';

export interface GameItem {
  id: string;
  name: string;
  company: string;
  genre_tags: string[];
  main_genre: string;
  description: string;
  icon_url: string;
  stores: string[];
}

// LocalStorage 캐시를 활용해 새로고침/재방문 시 0.001초 만에 즉시 로드
const getInitialGames = (): GameItem[] => {
  try {
    const localData = localStorage.getItem('cached_games_list');
    if (localData) {
      const parsed = JSON.parse(localData);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return [];
};

export default function SupportedGamesPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('전체');
  
  const initialData = getInitialGames();
  const [games, setGames] = useState<GameItem[]>(initialData);
  const [loading, setLoading] = useState<boolean>(initialData.length === 0);

  // 초기에 24개만 그려 화면 렌더링 렉을 제로화
  const [displayCount, setDisplayCount] = useState(24);
  const observerTargetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchGames = async () => {
      try {
        if (games.length === 0) setLoading(true);
        const res = await fetch('http://127.0.0.1:8000/games');
        if (!res.ok) throw new Error('서버 응답 오류');
        const result = await res.json();
        
        if (isMounted && result.status === 'ok' && Array.isArray(result.data)) {
          setGames(result.data);
          localStorage.setItem('cached_games_list', JSON.stringify(result.data));
        }
      } catch (err) {
        console.error('게임 데이터 로딩 실패:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchGames();

    return () => {
      isMounted = false;
    };
  }, []);

  // 검색어나 장르 변경 시 즉시 상단 24개로 리셋하여 0.01초 반응 속도 유지
  useEffect(() => {
    setDisplayCount(24);
  }, [searchQuery, selectedGenre]);

  // 스크롤 하단 도달 시 다음 24개 자동 추가
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => prev + 24);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTargetRef.current) {
      observer.observe(observerTargetRef.current);
    }

    return () => observer.disconnect();
  }, [games]);

  const genres = ['전체', 'RPG', '캐주얼', '스포츠', '액션', '전략', '시뮬레이션', '서브컬처'];

  // 검색 및 장르 필터링
  const filtered = games.filter((g) => {
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.genre_tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre =
      selectedGenre === '전체' ||
      g.main_genre.includes(selectedGenre) ||
      g.genre_tags.some((t) => t.includes(selectedGenre));

    return matchesSearch && matchesGenre;
  });

  const visibleGames = filtered.slice(0, displayCount);

  // 엔터 키 입력 시 검색창 포커스 해제 편의 기능
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6 relative">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 메인 게임 카탈로그 */}
        <div className="lg:col-span-10 space-y-6">
          <header className="space-y-3">
            <div className="flex items-center justify-between">
              {/* 💡 게임모양 아이콘 삭제 ➔ 깔끔한 볼드 타이틀 표출 */}
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                호갱탈출 지원 게임 목록
              </h2>

              {!loading && (
                <span className="text-xs font-black text-cyan-800 bg-cyan-50 px-3 py-1 rounded-full border border-cyan-200 shadow-2xs">
                  총 {filtered.length}개 게임 서비스 중
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500">
              실시간 최저가 연산 및 할인 혜택 조회가 가능한 모바일 게임 리스트입니다.
            </p>
            
            <div className="pt-2 space-y-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="게임 이름, 개발사 또는 장르(예: 넥슨, RPG)로 검색해보세요..."
                className="w-full max-w-md px-4 py-2.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm font-bold text-slate-800"
              />

              {/* 장르 선택 필터 바 */}
              <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                {genres.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedGenre(cat)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap ${
                      selectedGenre === cat
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {/* 스켈레톤 로더 */}
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-pulse">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="p-4 bg-slate-100 rounded-xl h-36 border border-slate-200" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {visibleGames.map((g, index) => (
                  <div
                    key={g.id || index}
                    className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-cyan-400 hover:shadow-md transition-all space-y-3 cursor-pointer flex flex-col justify-between"
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center space-x-3">
                        {g.icon_url ? (
                          <img
                            src={g.icon_url}
                            alt={g.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            decoding="async"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.style.display = 'none';
                            }}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs bg-slate-100"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 shrink-0">
                            GAME
                          </div>
                        )}
                        
                        <div className="min-w-0">
                          <span className="text-[9.5px] font-extrabold text-cyan-800 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200/80 truncate inline-block">
                            {g.company}
                          </span>
                          <h3 className="text-xs md:text-sm font-extrabold text-slate-900 mt-1 truncate">
                            {g.name}
                          </h3>
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {g.description}
                      </p>
                    </div>

                    <div className="border-t border-slate-100 pt-2.5 space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {g.stores.map((s) => (
                          <span key={s} className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-1">
                        {g.genre_tags.slice(0, 3).map((tag, tIdx) => (
                          <button
                            key={tIdx}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(tag);
                            }}
                            className="text-[9.5px] font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 active:scale-95 px-2 py-0.5 rounded-md border border-cyan-200/70 transition-all cursor-pointer"
                          >
                            #{tag}
                          </button>
                        ))}
                      </div>
                    </div>

                  </div>
                ))}
              </div>

              {/* 무한 스크롤 타겟 감지점 */}
              <div ref={observerTargetRef} className="h-10 w-full" />
            </>
          )}
        </div>

        {/* [우측 2열] 광고 배너 */}
        <aside className="lg:col-span-2 h-full">
          <div className="sticky top-28 h-[calc(100vh-140px)] min-h-[500px] w-full p-5 bg-slate-100 rounded-2xl border border-slate-200/80 flex flex-col items-center justify-between text-center shadow-inner">
            <span className="px-2.5 py-1 bg-slate-800 text-white font-bold text-[9px] rounded tracking-wider">
              ADVERTISEMENT
            </span>

            <div className="space-y-4 my-auto">
              {/* 💡 이전의 확성기 아이콘(📢)으로 정밀 복원 */}
              <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-slate-200 mx-auto animate-pulse">
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
                신규 게임 등록 및 배너 입점 문의 환영
              </div>
            </div>

            <button className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer">
              광고/제휴 신청하기
            </button>
          </div>
        </aside>

      </div>
    </div>
  );
}