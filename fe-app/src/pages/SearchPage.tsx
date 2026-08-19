import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilterState } from '../hooks/useFilterState';
import LegalModals from '../components/LegalModals';
import FilterSection from '../components/FilterSection';

export default function SearchPage() {
  const navigate = useNavigate();
  const [isLoggedIn] = useState(true);
  const [modalType, setModalType] = useState<'terms' | 'privacy' | 'contact' | null>(null);

  const filterState = useFilterState(true);
  const {
    filter,
    setFilter,
    saveFilterSettings,
    loadSavedFilter,
    addRecentGame,
    removeRecentGame,
  } = filterState;

  const [gameTitle, setGameTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);

  const getInitialGames = (): { id: string; name: string; company: string; icon_url: string; stores?: string[] }[] => {
    try {
      const localData = localStorage.getItem('cached_games_list');
      if (localData) {
        const parsed = JSON.parse(localData);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  };

  const [allGames, setAllGames] = useState<{ id: string; name: string; company: string; icon_url: string; stores?: string[] }[]>(getInitialGames);
  const [showDropdown, setShowDropdown] = useState(false);

  // 💡 검색 페이지 진입 시 LocalStorage의 최신 즐겨찾기 실시간 불러오기
  useEffect(() => {
    const savedFilter = localStorage.getItem('user_filter_settings');
    if (savedFilter) {
      try {
        const parsed = JSON.parse(savedFilter);
        if (parsed.favoriteGames) {
          setFilter((prev) => ({ ...prev, favoriteGames: parsed.favoriteGames }));
        }
      } catch (e) {}
    }
  }, [setFilter]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/games')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          setAllGames(result.data);
          localStorage.setItem('cached_games_list', JSON.stringify(result.data));
        }
      })
      .catch((err) => console.error('자동완성 게임 목록 로드 실패:', err));
  }, []);

  const suggestedGames = gameTitle.trim()
    ? allGames.filter(
        (g) =>
          g.name.toLowerCase().includes(gameTitle.toLowerCase()) ||
          g.company.toLowerCase().includes(gameTitle.toLowerCase())
      )
    : [];

  const selectedGame = allGames.find((g) => g.name === gameTitle);

  const isStoreSupported = (storeName: string, supportedStores?: string[]) => {
    if (!supportedStores || supportedStores.length === 0) return true;
    return supportedStores.some((s) => {
      const normS = s.trim().toLowerCase();
      const normStore = storeName.trim().toLowerCase();
      if (normStore.includes('구글') && (normS.includes('구글') || normS.includes('google'))) return true;
      if (normStore.includes('원스') && (normS.includes('원스') || normS.includes('one'))) return true;
      if (normStore.includes('갤럭시') && (normS.includes('갤스') || normS.includes('갤럭시') || normS.includes('galaxy'))) return true;
      if ((normStore.includes('앱스토어') || normStore.includes('ios')) && (normS.includes('앱스토어') || normS.includes('ios') || normS.includes('애플') || normS.includes('apple'))) return true;
      return normS.includes(normStore) || normStore.includes(normS);
    });
  };

  useEffect(() => {
    if (selectedGame?.stores && selectedGame.stores.length > 0) {
      setFilter((prev) => ({
        ...prev,
        androidStores: prev.androidStores.filter((st) => isStoreSupported(st, selectedGame.stores)),
      }));
    }
  }, [gameTitle, selectedGame, setFilter]);

  const [isDirty, setIsDirty] = useState(false);

  const handleLoadSavedFilter = () => {
    const success = loadSavedFilter();
    if (success) {
      setIsDirty(false);
      alert('저장된 최신 결제 필터 조건을 불러왔습니다!');
    } else {
      alert('저장된 필터 조건이 없습니다. 마이페이지에서 먼저 필터를 저장해 주세요.');
    }
  };

  const handleSaveAndClearDirty = () => {
    saveFilterSettings();
    setIsDirty(false);
  };

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '수정하신 필터 조건이 저장되지 않았습니다. 저장하지 않고 나가시겠습니까?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameTitle.trim()) {
      alert('게임을 선택하거나 입력해 주세요.');
      return;
    }

    if (amount === '' || Number(amount) <= 0) {
      alert('결제 예정 금액을 1원 이상 입력해 주세요.');
      return;
    }

    if (filter.osType === 'ANDROID' && filter.androidStores.length === 0) {
      alert('이용할 스토어를 최소 1개 이상 선택해 주세요.');
      return;
    }

    const totalSelectedPayments =
      (filter.useCarriers ? filter.carriers.length : 0) +
      (filter.usePays ? filter.pays.length : 0) +
      (filter.useVoucherBypasses ? filter.voucherBypasses.length : 0);

    if (totalSelectedPayments === 0) {
      alert('보유 결제 수단을 최소 1개 이상 선택해 주세요.');
      return;
    }

    addRecentGame(gameTitle);

    const activeSubscriptions: string[] = [];
    if (filter.useTMembership && filter.osType === 'ANDROID') activeSubscriptions.push('T멤버십 (원스토어 10% 할인/적립)');
    if (filter.useNaverMembership) activeSubscriptions.push('네이버플러스 멤버십 (+4% 적립)');
    if (filter.useTossPrime) activeSubscriptions.push('토스프라임 (+4% 적립)');

    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(amount),
      os: filter.osType,
      stores: filter.osType === 'IOS' ? '앱스토어' : filter.androidStores.join(','),
      useGameBenefits: String(filter.useGameBenefits),
      hasPreApplied: String(filter.hasPreApplied),
      isFirstPayment: String(filter.isFirstPayment),
      googleTier: filter.googlePlayTier,
      galaxyTier: filter.galaxyStoreTier,
      carriers: filter.useCarriers ? filter.carriers.join(',') : '',
      pays: filter.usePays ? filter.pays.join(',') : '',
      vouchers: filter.useVoucherBypasses ? filter.voucherBypasses.join(',') : '',
      useSpecialOptions: String(filter.useSpecialOptions),
      specialCard: filter.selectedSpecialCard,
      subscriptions: activeSubscriptions.join(','),
      hasPrevSpend: String(filter.hasPrevSpend),
      isPcVersion: String(filter.isPcVersion),
    });

    navigate(`/search-result?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSearch} className="bg-[#F8FAFC] min-h-screen py-6 md:py-8 relative">
      
      {/* 💡 [수직 다층 기하학 모듈] 스크롤 시 끝까지 계속 노출되는 5개의 은은한 SVG 백그라운드 무늬 */}
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
          
          {/* [좌측 4열] 스티키 입력 카드 */}
          <aside className="lg:col-span-4 sticky top-36 bg-white rounded-lg border-2 border-[#00D2B8] p-5 shadow-[0_4px_14px_rgba(0,210,184,0.25)] space-y-6">
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">게임 및 금액 설정</h3>
                <span className="text-[11px] font-black text-[#00A896] bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2.5 py-0.5 rounded border border-[#00D2B8]/30">1단계</span>
              </div>

              <div className="space-y-2.5 relative">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>게임 이름</span>
                  <span className="text-[10px] text-[#00A896] font-black">* 필수</span>
                </label>

                {selectedGame ? (
                  <div className="flex items-center justify-between p-2.5 bg-gradient-to-r from-[#00D2B8]/10 to-[#00F5FF]/10 border-2 border-[#00D2B8] rounded-lg shadow-2xs">
                    <div className="flex items-center space-x-3 min-w-0">
                      {selectedGame.icon_url ? (
                        <img
                          src={selectedGame.icon_url}
                          alt={selectedGame.name}
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded object-cover border border-slate-200 shrink-0 shadow-2xs"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://via.placeholder.com/36?text=🎮';
                          }}
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-slate-100 flex items-center justify-center text-base border border-slate-200 shrink-0">
                          🎮
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="text-[9px] font-black text-[#00A896] bg-white px-1.5 py-0.5 rounded border border-[#00D2B8]/30 truncate inline-block">
                          {selectedGame.company}
                        </span>
                        <h4 className="text-xs font-black text-slate-900 truncate mt-0.5">
                          {selectedGame.name}
                        </h4>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setGameTitle('')}
                      className="w-7 h-7 flex items-center justify-center rounded bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-300 active:scale-95 transition-all font-black text-xs cursor-pointer shrink-0 ml-2 shadow-2xs"
                      title="선택 취소"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      value={gameTitle}
                      onChange={(e) => {
                        setGameTitle(e.target.value);
                        setShowDropdown(true);
                      }}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                      placeholder="게임을 입력해 보세요 (예: 쿠키런: 킹덤)"
                      className="w-full px-4 py-3 text-xs rounded border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00D2B8] focus:bg-white font-bold text-slate-900 transition-all shadow-inner"
                    />

                    {showDropdown && suggestedGames.length > 0 && (
                      <ul className="absolute left-0 right-0 top-[48px] z-30 bg-white border border-slate-200 rounded-lg shadow-xl max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {suggestedGames.map((game) => (
                          <li
                            key={game.id}
                            onMouseDown={() => {
                              setGameTitle(game.name);
                              setShowDropdown(false);
                            }}
                            className="p-2.5 hover:bg-gradient-to-r hover:from-[#00D2B8]/10 hover:to-[#00F5FF]/10 cursor-pointer flex items-center space-x-2.5 transition-colors"
                          >
                            {game.icon_url ? (
                              <img
                                src={game.icon_url}
                                alt={game.name}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://via.placeholder.com/28?text=🎮';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded bg-slate-100 flex items-center justify-center text-xs shrink-0">
                                🎮
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-900 truncate">{game.name}</p>
                              <p className="text-[10px] font-medium text-slate-400 truncate">{game.company}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div className="pt-2 space-y-1.5 border-t border-slate-100">
                  <span className="text-[10.5px] font-bold text-slate-500 block">⭐ 즐겨찾는 게임:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {(filter.favoriteGames || []).map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGameTitle(g)}
                        className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all border cursor-pointer ${
                          gameTitle === g
                            ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                            : 'bg-gradient-to-r from-[#00D2B8]/10 to-[#00F5FF]/10 text-[#00A896] border-[#00D2B8]/30 hover:bg-[#00D2B8]/20'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                    {(!filter.favoriteGames || filter.favoriteGames.length === 0) && (
                      <span className="text-[10px] text-slate-400">마이페이지에서 즐겨찾기 게임을 추가해보세요.</span>
                    )}
                  </div>
                </div>

                {filter.recentGames && filter.recentGames.length > 0 && (
                  <div className="pt-2 space-y-1.5 border-t border-slate-100">
                    <span className="text-[10.5px] font-bold text-slate-500 block">🕒 최근 찾은 게임:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {filter.recentGames.map((g) => (
                        <span
                          key={g}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold bg-slate-100 border border-slate-200 text-slate-700"
                        >
                          <button
                            type="button"
                            onClick={() => setGameTitle(g)}
                            className="hover:text-[#00A896] cursor-pointer"
                          >
                            {g}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRecentGame(g)}
                            className="text-[9px] text-slate-400 hover:text-rose-500 font-bold ml-1 cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>결제 예정 금액 (원)</span>
                  <span className="text-[10px] text-[#00A896] font-black">* 필수</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-4 py-3 text-sm rounded border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#00D2B8] focus:bg-white font-black text-slate-900 transition-all pr-8 shadow-inner"
                  />
                  <span className="absolute right-4 text-xs font-bold text-slate-400">원</span>
                </div>

                <div className="grid grid-cols-7 gap-1 pt-1">
                  {[1000, 5000, 10000, 30000, 50000, 100000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount((prev) => (typeof prev === 'number' ? prev + amt : amt))}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-bold transition-all cursor-pointer border border-slate-200 text-center whitespace-nowrap px-0.5"
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(0)}
                    className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[9.5px] font-bold transition-all cursor-pointer border border-rose-200 text-center whitespace-nowrap px-0.5"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>
          </aside>

          {/* [중앙 6열] 필터 옵션 영역 */}
          <div className="lg:col-span-6 space-y-5">
            <header className="space-y-1.5">
              <div><span className="px-2.5 py-1 bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 text-[#00A896] font-black text-xs rounded border border-[#00D2B8]/30">2단계 필터</span></div>
              <h2 className="text-xl font-black text-slate-900">결제 조건 필터링</h2>
              <p className="text-xs text-slate-500 font-medium">보유 중인 스토어, 결제수단, 구독 서비스 조건을 체크해 최저가를 계산하세요.</p>
            </header>

            {!selectedGame && (
              <div className="p-4 bg-amber-50/90 rounded-lg border border-amber-300/80 text-amber-900 font-extrabold text-xs shadow-xs animate-pulse">
                <span>좌측 [1단계]에서 게임을 먼저 검색하여 선택하시면 2단계 결제 필터링이 활성화됩니다.</span>
              </div>
            )}

            <div className={`space-y-5 transition-all ${!selectedGame ? 'opacity-40 pointer-events-none select-none filter blur-[0.6px]' : ''}`}>
              
              {/* 💡 공통 필터 컴포넌트 적용 (중복 바 없이 단 1개만 노출) */}
              <FilterSection
                filterState={filterState}
                onFilterChange={() => setIsDirty(true)}
                onLoadSaved={handleLoadSavedFilter}
              />

              {/* 💡 공통 필터 컴포넌트 적용 */}
              <FilterSection
                filterState={filterState}
                onFilterChange={() => setIsDirty(true)}
              />

              <div className="pt-4 space-y-3 border-t border-slate-200">
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleSaveAndClearDirty}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs md:text-sm rounded border border-slate-300/80 cursor-pointer flex items-center justify-center gap-2 shadow-2xs transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>내 결제 필터 세팅 저장하기</span>
                  </button>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 active:scale-[0.99] text-slate-950 font-black text-base md:text-lg rounded-lg shadow-[0_4px_14px_rgba(0,210,184,0.3)] cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <svg className="w-5 h-5 text-slate-950 fill-slate-950" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                  </svg>
                  <span>최저가 연산하기</span>
                </button>
              </div>

            </div>
          </div>

          {/* [우측 2열] 스티키 광고 패널 */}
          <aside className="lg:col-span-2 sticky top-36 bg-slate-900 rounded-lg border border-slate-800 h-[650px] w-full p-5 flex flex-col items-center justify-between text-center shadow-md">
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 font-bold text-[9px] rounded border border-slate-700 tracking-wider">ADVERTISEMENT</span>
            <div className="space-y-4 my-auto">
              <div className="w-14 h-14 bg-slate-800 rounded-lg flex items-center justify-center text-xs font-black text-slate-400 border border-slate-700 mx-auto">AD</div>
              <div className="space-y-1.5">
                <h3 className="font-black text-white text-sm">협업 제휴 광고</h3>
                <p className="text-[11px] text-slate-400 leading-relaxed max-w-[130px] mx-auto">실시간 최저가 검색 전용 프로모션 공간입니다.</p>
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

      <LegalModals type={modalType} onClose={() => setModalType(null)} />
    </form>
  );
}