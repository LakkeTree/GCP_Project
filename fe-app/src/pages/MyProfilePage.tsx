import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFilterState } from '../hooks/useFilterState';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  GOOGLE_PLAY_TIERS,
  GALAXY_STORE_TIERS,
  SPECIAL_CARD_OPTIONS,
} from '../constants/searchOptions';

interface GameItem {
  id: string;
  name: string;
  company: string;
  icon_url: string;
  stores?: string[];
}

export default function MyProfilePage() {
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState<'profile' | 'filter'>('profile');

  const profileRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // 1. 공통 필터 훅 (컴포넌트 최상단에서 단 1회 선언)
  const {
    filter,
    setFilter,
    saveFilterSettings,
    addFavoriteGame,
    removeFavoriteGame,
    selectAll,
    deselectAll,
    toggleArrayItem,
  } = useFilterState(false);

  // 2. 최상단 상태 선언
  const [userProfile, setUserProfile] = useState<{ email: string; nickname: string; provider: string }>({
    email: '불러오는 중...',
    nickname: '',
    provider: 'GOOGLE',
  });
  
  const [nicknameInput, setNicknameInput] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [gameSearchInput, setGameSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // 3. 게임 DB 목록 로드
  useEffect(() => {
    fetch('http://127.0.0.1:8000/games')
      .then((res) => res.json())
      .then((result) => {
        if (result.status === 'ok' && Array.isArray(result.data)) {
          setAllGames(result.data);
        }
      })
      .catch((err) => console.error('게임 DB 목록 로드 실패:', err));
  }, []);

  // 4. 유저 프로필 및 저장된 필터 로드 (단일 useEffect로 통합)
  useEffect(() => {
    // 1) LocalStorage 저장 필터 우선 로드
    const savedFilterStr = localStorage.getItem('user_filter_settings');
    if (savedFilterStr) {
      try {
        const parsed = JSON.parse(savedFilterStr);
        setFilter((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }

    // 2) Cloud SQL DB 서버 최신 프로필/즐겨찾기 조회
    const token = localStorage.getItem('google_token');
    if (token) {
      let googleNick = '유저';
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64).split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
        );
        const parsed = JSON.parse(jsonPayload);
        googleNick = parsed.given_name || parsed.name || '유저';
      } catch (e) {}

      fetch('http://127.0.0.1:8000/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then((res) => {
          if (!res.ok) throw new Error('Unauthorized');
          return res.json();
        })
        .then((result) => {
          if (result.status === 'success' && result.data) {
            const finalNick = result.data.nickname || googleNick;
            setUserProfile({
              email: result.data.email || '이메일 없음',
              nickname: finalNick,
              provider: result.data.provider || 'GOOGLE',
            });
            setNicknameInput(finalNick);
            setOriginalNickname(finalNick);
            
            if (result.data.favorite_games) {
              setFilter((prev) => ({ ...prev, favoriteGames: result.data.favorite_games }));
            }
          }
        })
        .catch((err) => {
          console.error("프로필 로드 실패/미인증:", err);
          setNicknameInput(googleNick);
          setOriginalNickname(googleNick);
        });
    } else {
      setUserProfile({ email: '로그인 필요', nickname: '게스트', provider: 'GOOGLE' });
    }
  }, []);

  // 5. 탭 파라미터 감지 스크롤
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'filter') {
      scrollToSection('filter');
    }
  }, [searchParams]);

  // 6. 검색창 외부 클릭시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 7. 스크롤 인터섹션 옵저버
  useEffect(() => {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px',
      threshold: 0,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          if (entry.target.id === 'profile-section') {
            setActiveSection('profile');
          } else if (entry.target.id === 'filter-section') {
            setActiveSection('filter');
          }
        }
      });
    }, observerOptions);

    if (profileRef.current) observer.observe(profileRef.current);
    if (filterRef.current) observer.observe(filterRef.current);

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (section: 'profile' | 'filter') => {
    setActiveSection(section);
    const targetRef = section === 'profile' ? profileRef : filterRef;
    if (targetRef.current) {
      const yOffset = -100;
      const y = targetRef.current.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  // 실시간 검색어 필터링
  const suggestedGames = gameSearchInput.trim()
    ? allGames.filter(
        (g) =>
          (g.name.toLowerCase().includes(gameSearchInput.trim().toLowerCase()) ||
           g.company.toLowerCase().includes(gameSearchInput.trim().toLowerCase())) &&
          !filter.favoriteGames.includes(g.name)
      )
    : [];

  const updateFilter = <K extends keyof typeof filter>(key: K, value: typeof filter[K]) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  // 즐겨찾기 추가 ➔ 자동 저장
  const handleSelectGame = (gameName: string) => {
    const updatedGames = [...filter.favoriteGames, gameName];
    addFavoriteGame(gameName);
    setGameSearchInput('');
    setIsSearchFocused(false);
    autoSaveFavoriteGames(updatedGames);
  };

  // 즐겨찾기 삭제 ➔ 자동 저장
  const handleRemoveGame = (gameToRemove: string) => {
    const updatedGames = filter.favoriteGames.filter((g) => g !== gameToRemove);
    removeFavoriteGame(gameToRemove);
    autoSaveFavoriteGames(updatedGames);
  };

  const autoSaveFavoriteGames = async (newFavoriteGames: string[]) => {
    const token = localStorage.getItem('google_token');
    if (!token) return;

    try {
      const payload = {
        nickname: nicknameInput,
        favorite_games: newFavoriteGames,
      };

      await fetch('http://127.0.0.1:8000/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      saveFilterSettings();
    } catch (err) {
      console.error("즐겨찾기 자동 저장 오류:", err);
    }
  };

  // 닉네임 저장
  const handleSaveNickname = async () => {
    const token = localStorage.getItem('google_token');
    if (!token) {
      alert('로그인이 필요합니다.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nickname: nicknameInput,
        favorite_games: filter.favoriteGames,
      };

      const res = await fetch('http://127.0.0.1:8000/user/profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setOriginalNickname(nicknameInput);
        setUserProfile((prev) => ({ ...prev, nickname: nicknameInput }));
        window.dispatchEvent(new Event('user_profile_updated'));
        alert('닉네임이 성공적으로 변경되었습니다! 🎉');
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    } catch (err) {
      console.error("저장 실패:", err);
      alert('서버 연결 실패');
    } finally {
      setIsSaving(false);
    }
  };

  // 필터 저장
  const handleSaveFilterSection = async () => {
    saveFilterSettings();

    const token = localStorage.getItem('google_token');
    if (token) {
      try {
        const payload = {
          nickname: nicknameInput,
          telecom: filter.useCarriers && filter.carriers.length > 0 ? filter.carriers[0] : null,
          use_t_membership: filter.useTMembership,
          held_epay: filter.usePays ? filter.pays : [],
          has_naver_plus: filter.useNaverMembership,
          has_toss_prime: filter.useTossPrime,
          held_cards: filter.useSpecialOptions && filter.selectedSpecialCard !== 'NONE' ? [filter.selectedSpecialCard] : [],
          held_vouchers: filter.useVoucherBypasses ? filter.voucherBypasses : [],
          favorite_games: filter.favoriteGames,
        };

        await fetch('http://127.0.0.1:8000/user/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } catch (err) {
        console.error("백엔드 필터 저장 실패:", err);
      }
    }
    alert('기본 필터 설정이 성공적으로 저장되었습니다! 🎉\n검색창(Search)에서도 [저장된 필터 불러오기]를 누르시면 이 세팅이 그대로 적용됩니다.');
  };

  const handleCancelNickname = () => {
    setNicknameInput(originalNickname);
  };

  const isNicknameChanged = nicknameInput.trim() !== '' && nicknameInput !== originalNickname;
  const isGoogleSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = filter.osType === 'ANDROID' && filter.androidStores.includes('갤럭시 스토어');
  const isOneStoreSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('원스토어');
  const isNaverPaySelected = filter.usePays && filter.pays.includes('네이버페이');
  const isTossPaySelected = filter.usePays && filter.pays.includes('토스페이');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      {/* 상단 타이틀 */}
      <div className="mb-8 border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
          <svg className="w-7 h-7 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>계정 및 기본 설정</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          개인 정보, 즐겨찾는 게임 및 최저가 자동 검색 기본 필터를 설정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        {/* 좌측 사이드바 */}
        <aside className="md:col-span-1 space-y-2 sticky top-24 z-10">
          <button
            type="button"
            onClick={() => scrollToSection('profile')}
            className={`w-full text-left px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'profile'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-200 font-black'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>개인 정보 & 즐겨찾기</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('filter')}
            className={`w-full text-left px-4 py-3.5 rounded-2xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
              activeSection === 'filter'
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-200 font-black'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <span>기본 검색 필터링</span>
          </button>
        </aside>

        {/* 우측 콘텐츠 영역 */}
        <main className="md:col-span-3 space-y-8">
          {/* SECTION 1: 개인 정보 & 즐겨찾기 */}
          <section id="profile-section" ref={profileRef} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6 scroll-mt-24">
            <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>개인 정보 및 즐겨찾기 게임</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Google 소셜 연동 카드 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">연동된 소셜 계정</label>
                <div className="flex items-center justify-between px-3.5 bg-slate-50 border border-slate-200 rounded-xl h-[58px]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                      </svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Google</span>
                      <span className="text-xs text-slate-500 font-medium truncate max-w-[150px] sm:max-w-[180px]">
                        {userProfile.email}
                      </span>
                    </div>
                  </div>

                  <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shrink-0">
                    ✓ 연동됨
                  </span>
                </div>
              </div>

              {/* 닉네임 설정 */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-600">닉네임</label>
                  <span className="text-[11px] text-slate-400 font-bold">{nicknameInput.length}/12자</span>
                </div>
                <input
                  type="text"
                  maxLength={12}
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  className="w-full px-4 bg-white border border-slate-300 rounded-xl text-slate-800 text-base font-bold focus:outline-none focus:border-cyan-500 transition-colors h-[58px]"
                />
              </div>
            </div>

            {/* 닉네임 변경시에만 노출되는 취소 / 설정 저장 버튼 */}
            {isNicknameChanged && (
              <div className="flex items-center justify-end gap-2 pt-1 animate-in fade-in duration-200">
                <button
                  type="button"
                  onClick={handleCancelNickname}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={handleSaveNickname}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? '저장 중...' : '설정 저장'}
                </button>
              </div>
            )}

            {/* 즐겨찾기 게임 영역 */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <label className="block text-xs font-bold text-slate-600 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>즐겨찾기할 게임</span>
                <span className="text-slate-400 font-normal">(클릭 시 자동 저장되며, 검색창에 우선 표시됩니다)</span>
              </label>

              {/* 게임 검색 입력창 */}
              <div className="relative w-full" ref={searchContainerRef}>
                <input
                  type="text"
                  placeholder="게임 이름을 입력해 보세요 (예: 원신, 트릭컬, 리니지)"
                  value={gameSearchInput}
                  onChange={(e) => {
                    setGameSearchInput(e.target.value);
                    setIsSearchFocused(true);
                  }}
                  onFocus={() => setIsSearchFocused(true)}
                  className="w-full px-4 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-800 focus:outline-none focus:border-cyan-500 h-[48px]"
                />

                {/* 드롭다운 */}
                {isSearchFocused && gameSearchInput.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-56 overflow-y-auto z-30 py-1.5 border-t-2 border-t-cyan-500 animate-in fade-in slide-in-from-top-1">
                    {suggestedGames.length > 0 ? (
                      suggestedGames.map((gameItem) => (
                        <button
                          key={gameItem.id || gameItem.name}
                          type="button"
                          onClick={() => handleSelectGame(gameItem.name)}
                          className="w-full text-left px-4 py-2 hover:bg-cyan-50/70 transition-colors cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            {gameItem.icon_url ? (
                              <img
                                src={gameItem.icon_url}
                                alt={gameItem.name}
                                referrerPolicy="no-referrer"
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://via.placeholder.com/32?text=🎮';
                                }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-xs shrink-0">
                                🎮
                              </div>
                            )}

                            <div className="flex flex-col leading-tight">
                              <span className="text-xs font-black text-slate-800">{gameItem.name}</span>
                              <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                {gameItem.company}
                              </span>
                            </div>
                          </div>

                          <span className="text-[11px] text-cyan-600 font-bold bg-cyan-50 px-2.5 py-1 rounded-lg border border-cyan-200 shrink-0">
                            + 즐겨찾기 추가
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="text-center py-4 text-xs font-bold text-slate-400">
                        검색 결과가 없거나 이미 즐겨찾기에 등록된 게임입니다.
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2열 즐겨찾기 리스트 */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl w-full">
                {filter.favoriteGames.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {filter.favoriteGames.map((gameName) => {
                      const matchedGame = allGames.find((g) => g.name === gameName);

                      return (
                        <div
                          key={gameName}
                          className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-xl shadow-2xs hover:border-cyan-300 transition-all"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {matchedGame?.icon_url ? (
                              <img
                                src={matchedGame.icon_url}
                                alt={gameName}
                                referrerPolicy="no-referrer"
                                className="w-7 h-7 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                                onError={(e) => {
                                  e.currentTarget.onerror = null;
                                  e.currentTarget.src = 'https://via.placeholder.com/28?text=🎮';
                                }}
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-100 text-cyan-600 flex items-center justify-center font-bold text-xs shrink-0">
                                🎮
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 leading-tight">
                              <span className="text-xs font-bold text-slate-800 truncate">{gameName}</span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {matchedGame?.company || '등록됨'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveGame(gameName)}
                            className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0 ml-2"
                            title="삭제"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-400">
                    즐겨찾기한 게임이 없습니다. 상단 입력창에서 게임을 검색하여 추가해 보세요.
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION 2: 기본 검색 조건 필터링 */}
          <section id="filter-section" ref={filterRef} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6 scroll-mt-24">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                <span>기본 검색 조건 필터링</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                검색 시 매번 재선택할 필요 없이 Cloud SQL DB에 저장되어 자동으로 적용되는 보유 조건입니다.
              </p>
            </div>

            {/* 한 번에 필터 설정 바 */}
            <div className="flex items-center justify-between bg-slate-100/90 p-3.5 rounded-xl border border-slate-200">
              <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                </svg>
                <span>한 번에 필터 설정:</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={selectAll}
                  className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  모든 결제수단 선택
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg border border-slate-300 transition-all cursor-pointer"
                >
                  모든 선택 취소
                </button>
              </div>
            </div>

            {/* 1. 스마트폰 OS 및 스토어 선택 */}
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">기본 스마트폰 OS</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['ANDROID', 'IOS'] as OsType[]).map((os) => (
                    <button
                      key={os}
                      type="button"
                      onClick={() => updateFilter('osType', os)}
                      className={`py-2.5 px-3 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        filter.osType === os
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {os === 'ANDROID' ? '안드로이드' : 'iOS'}
                    </button>
                  ))}
                </div>
              </div>

              {/* 안드로이드 전용 스토어 */}
              {filter.osType === 'ANDROID' && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <span className="text-xs font-bold text-slate-700 block">
                    이용 가능한 스토어 선택
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ANDROID_STORE_OPTIONS.map((store) => {
                      const selected = filter.androidStores.includes(store);
                      return (
                        <button
                          type="button"
                          key={store}
                          onClick={() => toggleArrayItem('androidStores', store)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{store}
                        </button>
                      );
                    })}
                  </div>

                  {isOneStoreSelected && (
                    <div className="pt-2 border-t border-slate-200">
                      <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.useTMembership}
                          onChange={(e) => updateFilter('useTMembership', e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-700">T멤버십 이용 중 (원스토어 10% 할인/적립 가능)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Google / Galaxy Store 등급 설정 */}
              {(isGoogleSelected || isGalaxySelected) && (
                <div className="p-3.5 bg-cyan-50/60 rounded-xl border border-cyan-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {isGoogleSelected && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-cyan-900 block">Google Play Points 등급</label>
                        <select
                          value={filter.googlePlayTier}
                          onChange={(e) => updateFilter('googlePlayTier', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-300 bg-white font-bold text-slate-800"
                        >
                          {GOOGLE_PLAY_TIERS.map((tier) => (
                            <option key={tier.value} value={tier.value}>{tier.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {isGalaxySelected && (
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-cyan-900 block">Galaxy Store 멤버십 등급</label>
                        <select
                          value={filter.galaxyStoreTier}
                          onChange={(e) => updateFilter('galaxyStoreTier', e.target.value)}
                          className="w-full px-3 py-2 text-xs rounded-xl border border-cyan-300 bg-white font-bold text-slate-800"
                        >
                          {GALAXY_STORE_TIERS.map((tier) => (
                            <option key={tier.value} value={tier.value}>{tier.label}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {isGoogleSelected && (
                    <div className="pt-2 border-t border-cyan-200">
                      <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-cyan-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.isPcVersion}
                          onChange={(e) => updateFilter('isPcVersion', e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-800">PC 버전 (Google Play Games) 접속 결제 대상</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. 보너스 이벤트 적용 여부 */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">보너스 이벤트 적용 여부</label>
              <div className="space-y-2">
                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useGameBenefits}
                    onChange={(e) => updateFilter('useGameBenefits', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">선택한 게임 전용 혜택 포함</span>
                </label>

                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.hasPreApplied}
                    onChange={(e) => updateFilter('hasPreApplied', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">사전 응모 완료 혜택 포함</span>
                </label>

                <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.isFirstPayment}
                    onChange={(e) => updateFilter('isFirstPayment', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">첫 결제 이벤트 대상</span>
                </label>
              </div>
            </div>

            {/* 3. 보유 결제 수단 필터 & 마일리지/구독 멤버십 */}
            <div className="space-y-4 pt-2 border-t border-slate-100">
              <label className="block text-xs font-bold text-slate-700">보유 결제 수단 & 마일리지/구독 멤버십</label>

              {/* 통신사 */}
              <div className="space-y-2">
                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useCarriers}
                    onChange={(e) => updateFilter('useCarriers', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">통신사 할인 사용하기</span>
                </label>
                <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {CARRIER_OPTIONS.map((c) => {
                    const selected = filter.carriers.includes(c);
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!filter.useCarriers}
                        onClick={() => toggleArrayItem('carriers', c)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                      >
                        {selected ? '✓ ' : '+ '}{c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 간편결제 + 네이버/토스 구독 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.usePays}
                    onChange={(e) => updateFilter('usePays', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">사용 간편결제 (페이) 선택</span>
                </label>
                <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {PAY_OPTIONS.map((p) => {
                    const selected = filter.pays.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        disabled={!filter.usePays}
                        onClick={() => toggleArrayItem('pays', p)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                      >
                        {selected ? '✓ ' : '+ '}{p}
                      </button>
                    );
                  })}
                </div>

                {isNaverPaySelected && (
                  <div className="pt-2 pl-2">
                    <label className="flex items-center space-x-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filter.useNaverMembership}
                        onChange={(e) => updateFilter('useNaverMembership', e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded"
                      />
                      <span className="text-xs font-bold text-emerald-800">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                    </label>
                  </div>
                )}

                {isTossPaySelected && (
                  <div className="pt-2 pl-2">
                    <label className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filter.useTossPrime}
                        onChange={(e) => updateFilter('useTossPrime', e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-xs font-bold text-blue-800">토스프라임 구독 중 (+4% 추가 적립)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* 문화상품권 우회 충전 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useVoucherBypasses}
                    onChange={(e) => updateFilter('useVoucherBypasses', e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-slate-800">문화상품권 우회 충전 할인</span>
                </label>
                <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                  {VOUCHER_OPTIONS.map((v) => {
                    const selected = filter.voucherBypasses.includes(v);
                    return (
                      <button
                        key={v}
                        type="button"
                        disabled={!filter.useVoucherBypasses}
                        onClick={() => toggleArrayItem('voucherBypasses', v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                      >
                        {selected ? '✓ ' : '+ '}{v}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 4. 카드 선택 (옵션) */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">카드 선택 (옵션)</label>
                <label className="flex items-center space-x-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useSpecialOptions}
                    onChange={(e) => updateFilter('useSpecialOptions', e.target.checked)}
                    className="w-3.5 h-3.5 text-cyan-600 rounded"
                  />
                  <span className="text-xs font-bold text-cyan-700">옵션 {filter.useSpecialOptions ? '열림' : '닫힘'}</span>
                </label>
              </div>

              {filter.useSpecialOptions && (
                <div className="space-y-3 pt-1">
                  <select
                    value={filter.selectedSpecialCard}
                    onChange={(e) => updateFilter('selectedSpecialCard', e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
                  >
                    {SPECIAL_CARD_OPTIONS.map((card) => (
                      <option key={card.value} value={card.value}>{card.label}</option>
                    ))}
                  </select>

                  {filter.selectedSpecialCard !== 'NONE' && (
                    <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.hasPrevSpend} 
                          onChange={(e) => updateFilter('hasPrevSpend', e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded"
                        />
                        <span className="text-xs font-bold text-slate-700">카드 전월 실적 충족 (20만~50만원)</span>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 필터 설정 전용 저장 버튼 */}
            <div className="pt-4 flex justify-end border-t border-slate-100">
              <button
                type="button"
                onClick={handleSaveFilterSection}
                className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
              >
                필터 설정 저장
              </button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}