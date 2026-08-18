import { useState, useEffect, useRef } from 'react';

export interface GameItem {
  id: string;
  name: string;
  company: string;
  genre_tags: any;
  main_genre: string;
  description: string;
  icon_url: string;
  stores: string[];
}

const parseGenreTags = (tags: any): string[] => {
  if (!tags) return [];

  const rawStr = typeof tags === 'string' ? tags : JSON.stringify(tags);

  const matches = [...rawStr.matchAll(/['"]v['"]\s*:\s*['"]([^'"]+)['"]/g)];
  if (matches.length > 0) {
    return matches.map((m) => m[1]);
  }

  if (Array.isArray(tags)) {
    return tags.map((t) => (typeof t === 'object' && t?.v ? t.v : String(t)));
  }

  return typeof tags === 'string' && tags.trim() !== '' ? [tags] : [];
};

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
          const processed = result.data.map((g: any) => ({
            ...g,
            genre_tags: parseGenreTags(g.genre_tags),
          }));

          setGames(processed);
          localStorage.setItem('cached_games_list', JSON.stringify(processed));
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

  useEffect(() => {
    setDisplayCount(24);
  }, [searchQuery, selectedGenre]);

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

  const filtered = games.filter((g) => {
    const cleanTags = parseGenreTags(g.genre_tags);
    const matchesSearch =
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cleanTags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesGenre =
      selectedGenre === '전체' ||
      (g.main_genre && g.main_genre.includes(selectedGenre)) ||
      cleanTags.some((t) => t.includes(selectedGenre));

    return matchesSearch && matchesGenre;
  });

  const visibleGames = filtered.slice(0, displayCount);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
      
      {/* 💡 [수직 다층 기하학 모듈] 스크롤 깊이별로 배치된 5개의 은은한 SVG 다각형 무늬 */}
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
                  호갱탈출 지원 게임 목록
                </h2>

                {!loading && (
                  <span className="text-xs font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-3 py-1 rounded border border-[#00D2B8]/30 shadow-2xs">
                    총 {filtered.length}개 게임 서비스 중
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 font-medium">
                실시간 최저가 연산 및 할인 혜택 조회가 가능한 모바일 게임 리스트입니다.
              </p>
              
              <div className="pt-2 space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="게임 이름, 개발사 또는 장르(예: 넥슨, RPG)로 검색해보세요..."
                  className="w-full max-w-md px-4 py-2.5 text-xs rounded border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#00D2B8] shadow-xs font-bold text-slate-800"
                />

                <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {genres.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedGenre(cat)}
                      className={`px-3 py-1.5 rounded text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                        selectedGenre === cat
                          ? 'bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] text-slate-950 shadow-[0_2px_8px_rgba(0,210,184,0.3)]'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </header>

            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-pulse">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="p-4 bg-slate-100 rounded-lg h-36 border border-slate-200" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {visibleGames.map((g, index) => {
                    const cleanTags = parseGenreTags(g.genre_tags);

                    return (
                      <div
                        key={g.id || index}
                        className="p-4 bg-white rounded-lg border border-slate-200/90 shadow-xs hover:border-[#00D2B8] hover:shadow-[0_4px_14px_rgba(0,210,184,0.25)] transition-all space-y-3 cursor-pointer flex flex-col justify-between"
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
                                className="w-12 h-12 rounded object-cover border border-slate-200 shrink-0 shadow-2xs bg-slate-100"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 shrink-0">
                                GAME
                              </div>
                            )}
                            
                            <div className="min-w-0">
                              <span className="text-[9.5px] font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-1.5 py-0.5 rounded border border-[#00D2B8]/30 truncate inline-block">
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
                            {(g.stores || []).map((s) => (
                              <span key={s} className="text-[9px] font-bold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200/60">
                                {s}
                              </span>
                            ))}
                          </div>

                          <div className="flex flex-wrap gap-1">
                            {cleanTags.slice(0, 3).map((tag, tIdx) => (
                              <button
                                key={tIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSearchQuery(tag);
                                }}
                                className="text-[9.5px] font-bold text-[#00A896] bg-gradient-to-r from-[#00D2B8]/10 to-[#00F5FF]/10 hover:bg-[#00D2B8]/20 active:scale-95 px-2 py-0.5 rounded border border-[#00D2B8]/30 transition-all cursor-pointer"
                              >
                                #{tag}
                              </button>
                            ))}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>

                <div ref={observerTargetRef} className="h-10 w-full" />
              </>
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
                  게임별 스토어 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-slate-800/80 rounded border border-slate-700 text-[10px] text-slate-300 font-medium">
                신규 게임 등록 및 배너 입점 문의 환영
              </div>
            </div>

            <button className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer">
              광고/제휴 신청하기
            </button>
          </aside>

        </div>
      </div>
    </div>
  );
}