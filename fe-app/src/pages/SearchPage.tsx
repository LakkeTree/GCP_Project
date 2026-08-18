import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFilterState } from '../hooks/useFilterState';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  GOOGLE_PLAY_TIERS,
  GALAXY_STORE_TIERS,
} from '../constants/searchOptions';

export default function SearchPage() {
  const navigate = useNavigate();
  const [isLoggedIn] = useState(true);

  const {
    filter,
    setFilter,
    saveFilterSettings,
    loadSavedFilter,
    addRecentGame,
    removeRecentGame,
    selectAll,
    deselectAll,
    toggleArrayItem,
  } = useFilterState(true);

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
  }, [gameTitle, selectedGame]);

  const [isDirty, setIsDirty] = useState(false);

  const updateFilter = <K extends keyof typeof filter>(key: K, value: typeof filter[K]) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

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

  const handleOsChange = (targetOs: OsType) => {
    updateFilter('osType', targetOs);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

  const [dynamicCardOptions, setDynamicCardOptions] = useState<{ label: string; value: string }[]>([
    { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' }
  ]);

  useEffect(() => {
    fetch('http://127.0.0.1:8000/payments')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          const EXCLUDE_KEYWORDS = [
            'GIFTCARD', 'GIFT_CARD', 'SSG', '11STREET', 'GMARKET',
            'CONVENIENCE', 'CU_', 'GS25', 'SEVEN', 'ZEROPIN', 'NAVER_STORE', 'APPLE_GIFT',
            'CREDIT_CHECK_CARD', 'CREDIT'
          ];

          const EXCLUDE_TITLES = [
            'CREDIT CHECK CARD', '삼성페이', '결제수단별', '기본 적립률', '기본/이벤트 혜택'
          ];

          const genuineCardMethods = result.data.filter((m: any) => {
            const isCardCategory = m.category === 'CARD' || m.code.includes('CARD');
            const isExcluded = EXCLUDE_KEYWORDS.some((kw) => m.code.toUpperCase().includes(kw));
            return isCardCategory && !isExcluded;
          });

          const cardOptions: { label: string; value: string }[] = [
            { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' }
          ];

          const addedCardTitles = new Set<string>();

          genuineCardMethods.forEach((c: any) => {
            if (c.benefits && c.benefits.length > 0) {
              c.benefits.forEach((b: any) => {
                const cardName = b.title || c.name;
                const isTitleExcluded = EXCLUDE_TITLES.some((t) => cardName.includes(t));

                if (!addedCardTitles.has(cardName) && !isTitleExcluded) {
                  addedCardTitles.add(cardName);
                  cardOptions.push({
                    label: cardName,
                    value: c.code,
                  });
                }
              });
            } else {
              const isTitleExcluded = EXCLUDE_TITLES.some((t) => c.name.includes(t));
              if (!addedCardTitles.has(c.name) && !isTitleExcluded) {
                addedCardTitles.add(c.name);
                cardOptions.push({
                  label: c.name,
                  value: c.code,
                });
              }
            }
          });

          setDynamicCardOptions(cardOptions);
        }
      })
      .catch((err) => console.error('제휴 카드 동적 로드 실패:', err));
  }, []);

  const isGoogleSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = filter.osType === 'ANDROID' && filter.androidStores.includes('갤럭시 스토어');
  const isOneStoreSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('원스토어');
  const isNaverPaySelected = filter.usePays && filter.pays.includes('네이버페이');
  const isTossPaySelected = filter.usePays && filter.pays.includes('토스페이');

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
              <div className="p-4 bg-amber-50/80 rounded-lg border border-amber-300 text-amber-900 font-extrabold text-xs flex items-center gap-2.5 shadow-xs animate-pulse">
                <span className="text-lg">🎮</span>
                <span>좌측 [1단계]에서 게임을 먼저 검색하여 선택하시면 2단계 결제 필터링이 활성화됩니다.</span>
              </div>
            )}

            <div className={`space-y-5 transition-all ${!selectedGame ? 'opacity-40 pointer-events-none select-none filter blur-[0.6px]' : ''}`}>
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100/90 p-3.5 rounded-lg border border-slate-200 gap-2">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  ⚡ 한 번에 필터 설정:
                </span>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <button
                    type="button"
                    onClick={handleLoadSavedFilter}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs rounded transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>📥</span>
                    <span>저장된 필터 불러오기</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => { selectAll(); setIsDirty(true); }}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded cursor-pointer shadow-xs"
                  >
                    모든 결제수단 선택
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => { deselectAll(); setIsDirty(true); }}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded border border-slate-300 cursor-pointer"
                  >
                    모든 선택 취소
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
                  <span>스마트폰 OS 및 이용 스토어 선택</span>
                  <span className="text-[10px] text-[#00A896] font-black">* 필수</span>
                </h3>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {(['ANDROID', 'IOS'] as OsType[]).map((os) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => handleOsChange(os)}
                        className={`py-2 px-3 rounded text-xs font-extrabold border transition-all cursor-pointer text-center ${
                          filter.osType === os ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {os === 'ANDROID' ? '안드로이드' : 'iOS'}
                      </button>
                    ))}
                  </div>

                  {filter.osType === 'IOS' && (() => {
                    const isIosSupported = isStoreSupported('앱스토어', selectedGame?.stores);
                    return (
                      <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          이용 가능한 스토어 선택 <span className="text-[#00A896] font-black">* 필수</span>
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={!isIosSupported}
                            className={`px-3 py-1 rounded text-xs font-bold border transition-all ${
                              !isIosSupported
                                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed blur-[0.6px] opacity-40 line-through'
                                : 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-default'
                            }`}
                            title={!isIosSupported ? '해당 게임은 iOS 앱스토어를 지원하지 않습니다.' : ''}
                          >
                            {!isIosSupported ? '✕ ' : '✓ '}앱스토어
                          </button>
                        </div>
                        {!isIosSupported && (
                          <p className="text-[10px] font-extrabold text-rose-500">
                            ⚠️ 선택하신 게임은 iOS(앱스토어)를 지원하지 않는 게임입니다.
                          </p>
                        )}
                      </div>
                    );
                  })()}

                  {filter.osType === 'ANDROID' && (
                    <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-2">
                      <span className="text-[11px] font-bold text-slate-700 block">
                        이용 가능한 스토어 선택 <span className="text-[#00A896] font-black">* 필수</span>
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {ANDROID_STORE_OPTIONS.map((store) => {
                          const isSupported = isStoreSupported(store, selectedGame?.stores);
                          const selected = filter.androidStores.includes(store);
                          return (
                            /* 💡 [개선] 입체감 있는 소프트 그라데이션 + 민트 보더 버블 칩 스타일 적용 */
                            <button
                              type="button"
                              key={store}
                              disabled={!isSupported}
                              onClick={() => {
                                if (isSupported) {
                                  toggleArrayItem('androidStores', store);
                                  setIsDirty(true);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded text-xs transition-all ${
                                !isSupported
                                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed blur-[0.6px] opacity-40 line-through select-none'
                                  : selected
                                  ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                                  : 'bg-slate-50 text-slate-600 font-bold border border-slate-200 cursor-pointer hover:border-[#00D2B8]/60'
                              }`}
                              title={!isSupported ? '선택한 게임에서 지원하지 않는 스토어입니다.' : ''}
                            >
                              {!isSupported ? '✕ ' : selected ? '✓ ' : '+ '}{store}
                            </button>
                          );
                        })}
                      </div>

                      {isOneStoreSelected && isStoreSupported('원스토어', selectedGame?.stores) && (
                        <div className="pt-2 border-t border-slate-200">
                          <label className="flex items-center space-x-2 p-2 bg-white rounded border border-slate-200 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={filter.useTMembership}
                              onChange={(e) => updateFilter('useTMembership', e.target.checked)}
                              className="w-4 h-4 text-[#00D2B8] rounded"
                            />
                            <span className="text-xs font-bold text-slate-700">T멤버십 이용 중 (원스토어 10% 할인/적립 가능)</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 💡 [개선] 등급 선택 서브 박스 그라데이션 틴트 적용 */}
                {(isGoogleSelected || isGalaxySelected) && (
                  <div className="p-3 bg-gradient-to-r from-[#00D2B8]/10 via-slate-50 to-[#00F5FF]/10 rounded border border-[#00D2B8]/30 space-y-3 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {isGoogleSelected && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-900 block">Google Play Points 등급</label>
                          <select
                            value={filter.googlePlayTier}
                            onChange={(e) => updateFilter('googlePlayTier', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#00D2B8]/40 bg-white font-medium text-slate-800"
                          >
                            {GOOGLE_PLAY_TIERS.map((tier) => (
                              <option key={tier.value} value={tier.value}>{tier.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isGalaxySelected && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-900 block">Galaxy Store 멤버십 등급</label>
                          <select
                            value={filter.galaxyStoreTier}
                            onChange={(e) => updateFilter('galaxyStoreTier', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded border border-[#00D2B8]/40 bg-white font-medium text-slate-800"
                          >
                            {GALAXY_STORE_TIERS.map((tier) => (
                              <option key={tier.value} value={tier.value}>{tier.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {isGoogleSelected && (
                      <div className="pt-2 border-t border-[#00D2B8]/20">
                        <label className="flex items-center space-x-2 p-2 bg-white rounded border border-[#00D2B8]/30 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.isPcVersion}
                            onChange={(e) => updateFilter('isPcVersion', e.target.checked)}
                            className="w-4 h-4 text-[#00D2B8] rounded"
                          />
                          <span className="text-xs font-bold text-slate-800">PC 버전 (Google Play Games) 접속 결제 대상</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">보너스 이벤트 적용 여부</h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={filter.useGameBenefits} onChange={(e) => updateFilter('useGameBenefits', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                    <span className="text-xs font-bold text-slate-700">선택한 게임 전용 혜택 포함</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={filter.hasPreApplied} onChange={(e) => updateFilter('hasPreApplied', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                    <span className="text-xs font-bold text-slate-700">사전 응모 완료 혜택 포함</span>
                  </label>
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input type="checkbox" checked={filter.isFirstPayment} onChange={(e) => updateFilter('isFirstPayment', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                    <span className="text-xs font-bold text-slate-700">첫 결제 이벤트 대상</span>
                  </label>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
                  <span>보유 결제 수단 필터</span>
                  <span className="text-[10px] text-[#00A896] font-black">* 최소 1개 필수</span>
                </h3>

                <div className="space-y-4">
                  {/* 통신사 버블 칩 */}
                  <div className="space-y-2">
                    <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={filter.useCarriers} onChange={(e) => updateFilter('useCarriers', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                      <span className="text-xs font-extrabold text-slate-800">통신사 할인 사용하기</span>
                    </label>
                    <div className={`flex flex-wrap gap-1.5 ${filter.useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      {CARRIER_OPTIONS.map((c) => {
                        const selected = filter.carriers.includes(c);
                        return (
                          <button
                            type="button"
                            key={c}
                            disabled={!filter.useCarriers}
                            onClick={() => {
                              toggleArrayItem('carriers', c);
                              setIsDirty(true);
                            }}
                            className={`px-3 py-1.5 rounded text-xs transition-all ${
                              selected
                                ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                                : 'bg-slate-50 text-slate-600 font-bold border border-slate-200 cursor-pointer hover:border-[#00D2B8]/60'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{c}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 간편결제 버블 칩 */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={filter.usePays} onChange={(e) => updateFilter('usePays', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                      <span className="text-xs font-extrabold text-slate-800">사용 간편결제 (페이) 선택</span>
                    </label>
                    <div className={`flex flex-wrap gap-1.5 ${filter.usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      {PAY_OPTIONS.map((p) => {
                        const selected = filter.pays.includes(p);
                        return (
                          <button
                            type="button"
                            key={p}
                            disabled={!filter.usePays}
                            onClick={() => {
                              toggleArrayItem('pays', p);
                              setIsDirty(true);
                            }}
                            className={`px-3 py-1.5 rounded text-xs transition-all ${
                              selected
                                ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                                : 'bg-slate-50 text-slate-600 font-bold border border-slate-200 cursor-pointer hover:border-[#00D2B8]/60'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{p}
                          </button>
                        );
                      })}
                    </div>

                    {isNaverPaySelected && (
                      <div className="pt-2 pl-2">
                        <label className="flex items-center space-x-2 p-2 bg-emerald-50/80 rounded border border-emerald-200 cursor-pointer">
                          <input type="checkbox" checked={filter.useNaverMembership} onChange={(e) => updateFilter('useNaverMembership', e.target.checked)} className="w-4 h-4 text-emerald-600 rounded" />
                          <span className="text-xs font-bold text-emerald-900">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                        </label>
                      </div>
                    )}

                    {isTossPaySelected && (
                      <div className="pt-2 pl-2">
                        <label className="flex items-center space-x-2 p-2 bg-blue-50/80 rounded border border-blue-200 cursor-pointer">
                          <input type="checkbox" checked={filter.useTossPrime} onChange={(e) => updateFilter('useTossPrime', e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                          <span className="text-xs font-bold text-blue-900">토스프라임 구독 중 (+4% 추가 적립)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* 문화상품권 버블 칩 */}
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                      <input type="checkbox" checked={filter.useVoucherBypasses} onChange={(e) => updateFilter('useVoucherBypasses', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                      <span className="text-xs font-extrabold text-slate-800">문화상품권 우회 충전 할인</span>
                    </label>
                    <div className={`flex flex-wrap gap-1.5 ${filter.useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                      {VOUCHER_OPTIONS.map((v) => {
                        const selected = filter.voucherBypasses.includes(v);
                        return (
                          <button
                            type="button"
                            key={v}
                            disabled={!filter.useVoucherBypasses}
                            onClick={() => {
                              toggleArrayItem('voucherBypasses', v);
                              setIsDirty(true);
                            }}
                            className={`px-3 py-1.5 rounded text-xs transition-all ${
                              selected
                                ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                                : 'bg-slate-50 text-slate-600 font-bold border border-slate-200 cursor-pointer hover:border-[#00D2B8]/60'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{v}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-900">카드 선택 (옵션)</h3>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input type="checkbox" checked={filter.useSpecialOptions} onChange={(e) => updateFilter('useSpecialOptions', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                    <span className="text-xs font-bold text-[#00A896]">옵션 {filter.useSpecialOptions ? '열림' : '닫힘'}</span>
                  </label>
                </div>

                {filter.useSpecialOptions && (
                  <div className="space-y-3 pt-1">
                    <select value={filter.selectedSpecialCard} onChange={(e) => updateFilter('selectedSpecialCard', e.target.value)} className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-medium text-slate-800">
                      {dynamicCardOptions.map((card) => (
                        <option key={card.value} value={card.value}>{card.label}</option>
                      ))}
                    </select>

                    {filter.selectedSpecialCard !== 'NONE' && (
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input type="checkbox" checked={filter.hasPrevSpend} onChange={(e) => updateFilter('hasPrevSpend', e.target.checked)} className="w-4 h-4 text-[#00D2B8] rounded" />
                          <span className="text-xs font-bold text-slate-700">카드 전월 실적 충족 (20만~50만원)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-4 space-y-3 border-t border-slate-200">
                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleSaveAndClearDirty}
                    className="w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold text-xs md:text-sm rounded border border-slate-300 cursor-pointer flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <span>💾</span>
                    <span>내 결제 필터 세팅 저장하기</span>
                  </button>
                )}

                <button
                  type="submit"
                  className="w-full py-4 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 active:scale-[0.99] text-slate-950 font-black text-base md:text-lg rounded-lg shadow-[0_4px_14px_rgba(0,210,184,0.3)] cursor-pointer flex items-center justify-center gap-2 transition-all"
                >
                  <span>⚡</span>
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
            <button className="w-full py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer">광고/제휴 신청하기</button>
          </aside>

        </div>
      </div>
    </form>
  );
}