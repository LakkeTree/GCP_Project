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

  const [userProfile, setUserProfile] = useState<{ email: string; nickname: string; provider: string }>({
    email: '불러오는 중...',
    nickname: '',
    provider: 'GOOGLE',
  });
  
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

  const [nicknameInput, setNicknameInput] = useState('');
  const [originalNickname, setOriginalNickname] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [gameSearchInput, setGameSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchFocused || suggestedGames.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < suggestedGames.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestedGames.length - 1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && selectedIndex < suggestedGames.length) {
        e.preventDefault();
        handleSelectGame(suggestedGames[selectedIndex].name);
        setSelectedIndex(-1);
      }
    } else if (e.key === 'Escape') {
      setIsSearchFocused(false);
      setSelectedIndex(-1);
    }
  };

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

  useEffect(() => {
    const savedFilterStr = localStorage.getItem('user_filter_settings');
    if (savedFilterStr) {
      try {
        const parsed = JSON.parse(savedFilterStr);
        setFilter((prev) => ({ ...prev, ...parsed }));
      } catch (e) {}
    }

    const token = localStorage.getItem('google_token');
    
    // 💡 유효한 토큰이 있을 때만 서버에 프로필을 요청하도록 수정 (401 에러 완전 차단)
    if (token && token !== 'undefined' && token !== 'null') {
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
              const favList = Array.isArray(result.data.favorite_games) ? result.data.favorite_games : [];
              setFilter((prev) => ({ ...prev, favoriteGames: favList }));

              const savedFilter = localStorage.getItem('user_filter_settings');
              const parsed = savedFilter ? JSON.parse(savedFilter) : {};
              parsed.favoriteGames = favList;
              localStorage.setItem('user_filter_settings', JSON.stringify(parsed));
            }
          }
        })
        .catch((err) => {
          console.error("프로필 로드 실패/미인증:", err);
          setUserProfile({ email: '로그인 필요', nickname: '게스트', provider: 'GOOGLE' });
          setNicknameInput(googleNick);
          setOriginalNickname(googleNick);
        });
    } else {
      // 💡 토큰이 없는 게스트 상태일 때는 서버 요청을 보내지 않고 게스트 상태 설정
      setUserProfile({ email: '로그인 필요', nickname: '게스트', provider: 'GOOGLE' });
    }
  }, []);

  
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'filter') {
      scrollToSection('filter');
    }
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const handleSelectGame = (gameName: string) => {
    const updatedGames = [...filter.favoriteGames, gameName];
    addFavoriteGame(gameName);
    setGameSearchInput('');
    setIsSearchFocused(false);
    autoSaveFavoriteGames(updatedGames);
  };

  const handleRemoveGame = (gameToRemove: string) => {
    const updatedGames = filter.favoriteGames.filter((g) => g !== gameToRemove);
    removeFavoriteGame(gameToRemove);
    autoSaveFavoriteGames(updatedGames);
  };

  const autoSaveFavoriteGames = async (newFavoriteGames: string[]) => {
    const savedFilter = localStorage.getItem('user_filter_settings');
    const parsed = savedFilter ? JSON.parse(savedFilter) : {};
    parsed.favoriteGames = newFavoriteGames;
    localStorage.setItem('user_filter_settings', JSON.stringify(parsed));

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
    } catch (err) {
      console.error("즐겨찾기 자동 저장 오류:", err);
    }
  };

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
    <div className="bg-[#F8FAFC] min-h-screen py-8 relative">
      
      {/* 수직 다층 SVG 기하학 모듈 */}
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

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 relative z-10 space-y-8">
        
        {/* 상단 타이틀 */}
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <svg className="w-7 h-7 text-[#00D2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>계정 및 기본 설정</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            개인 정보, 즐겨찾는 게임 및 최저가 자동 검색 기본 필터를 설정합니다.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
          
          {/* 💡 [요청 반영] 좌측 사이드바 선택 탭: 화이트 바탕 + 민트 테두리 + 민트 그림자 스타일 */}
          <aside className="md:col-span-1 space-y-2 sticky top-36 self-start z-20">
            <button
              type="button"
              onClick={() => scrollToSection('profile')}
              className={`w-full text-left px-4 py-3.5 rounded-lg text-sm flex items-center gap-3 transition-all cursor-pointer ${
                activeSection === 'profile'
                  ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_4px_14px_rgba(0,210,184,0.3)]'
                  : 'bg-white text-slate-600 font-bold border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>개인 정보 & 즐겨찾기</span>
            </button>

            <button
              type="button"
              onClick={() => scrollToSection('filter')}
              className={`w-full text-left px-4 py-3.5 rounded-lg text-sm flex items-center gap-3 transition-all cursor-pointer ${
                activeSection === 'filter'
                  ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_4px_14px_rgba(0,210,184,0.3)]'
                  : 'bg-white text-slate-600 font-bold border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <svg className="w-5 h-5 text-[#00A896]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              <span>기본 검색 필터링</span>
            </button>
          </aside>

          {/* 우측 콘텐츠 영역 */}
          <main className="md:col-span-3 space-y-8">
            
            {/* SECTION 1: 개인 정보 & 즐겨찾기 */}
            <section id="profile-section" ref={profileRef} className="bg-white rounded-lg border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-6 scroll-mt-24">
              <h2 className="text-lg font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-[#00D2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>개인 정보 및 즐겨찾기 게임</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* 1. 닉네임 설정 */}
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
                    className="w-full px-4 bg-white border border-slate-300 rounded-lg text-slate-800 text-base font-bold focus:outline-none focus:border-[#00D2B8] transition-colors h-[58px]"
                  />
                </div>

                {/* 2. 연동된 소셜 계정 + 바로 옆 로그아웃 버튼 */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">연동된 소셜 계정</label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-between px-3.5 bg-slate-50 border border-slate-200 rounded-lg h-[58px] min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-xs">
                          <svg className="w-4 h-4" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                          </svg>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-800">Google</span>
                          <span className="text-[11px] text-slate-500 font-medium truncate">
                            {userProfile.email}
                          </span>
                        </div>
                      </div>

                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded shrink-0">
                        ✓ 연동됨
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (confirm('로그아웃 하시겠습니까?')) {
                          localStorage.removeItem('google_token');
                          window.location.href = '/';
                        }
                      }}
                      className="px-3.5 h-[58px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg transition-colors cursor-pointer shrink-0 border border-slate-200 shadow-2xs"
                    >
                      로그아웃
                    </button>
                  </div>
                </div>
              </div>

              {/* 닉네임 변경 저장 버튼 */}
              {isNicknameChanged && (
                <div className="flex items-center justify-end gap-2 pt-1 animate-in fade-in duration-200">
                  <button
                    type="button"
                    onClick={handleCancelNickname}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveNickname}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded shadow-xs transition-all cursor-pointer disabled:opacity-50"
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

                <div className="relative w-full" ref={searchContainerRef}>
                  <input
                    type="text"
                    placeholder="게임 이름을 입력해 보세요 (예: 원신, 트릭컬, 리니지)"
                    value={gameSearchInput}
                    onChange={(e) => {
                      setGameSearchInput(e.target.value);
                      setIsSearchFocused(true);
                      setSelectedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setIsSearchFocused(true)}
                    className="w-full px-4 bg-white border border-slate-300 rounded-lg text-sm font-bold text-slate-800 focus:outline-none focus:border-[#00D2B8] h-[48px]"
                  />

                  {isSearchFocused && gameSearchInput.trim().length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-56 overflow-y-auto z-30 py-1.5 border-t-2 border-t-[#00D2B8] animate-in fade-in slide-in-from-top-1">
                      {suggestedGames.length > 0 ? (
                        suggestedGames.map((gameItem, idx) => (
                          <button
                            key={gameItem.id || gameItem.name}
                            type="button"
                            onClick={() => handleSelectGame(gameItem.name)}
                            onMouseEnter={() => setSelectedIndex(idx)}
                            className={`w-full text-left px-4 py-2 transition-colors cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0 ${
                              idx === selectedIndex ? 'bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 font-black' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {gameItem.icon_url ? (
                                <img
                                  src={gameItem.icon_url}
                                  alt={gameItem.name}
                                  referrerPolicy="no-referrer"
                                  className="w-8 h-8 rounded object-cover border border-slate-200 shrink-0 shadow-2xs"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[10px] font-black text-slate-400 shrink-0">
                                  GAME
                                </div>
                              )}

                              <div className="flex flex-col leading-tight">
                                <span className="text-xs font-black text-slate-800">{gameItem.name}</span>
                                <span className="text-[10px] font-semibold text-slate-400 mt-0.5">
                                  {gameItem.company}
                                </span>
                              </div>
                            </div>

                            <span className="text-[11px] text-[#00A896] font-bold bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 px-2.5 py-1 rounded border border-[#00D2B8]/30 shrink-0">
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

                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg w-full">
                  {filter.favoriteGames.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filter.favoriteGames.map((gameName) => {
                        const matchedGame = allGames.find((g) => g.name === gameName);

                        return (
                          <div
                            key={gameName}
                            className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded shadow-2xs hover:border-[#00D2B8] transition-all"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {matchedGame?.icon_url ? (
                                <img
                                  src={matchedGame.icon_url}
                                  alt={gameName}
                                  referrerPolicy="no-referrer"
                                  className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0 shadow-2xs"
                                  onError={(e) => {
                                    e.currentTarget.onerror = null;
                                    e.currentTarget.src = 'https://via.placeholder.com/28?text=🎮';
                                  }}
                                />
                              ) : (
                                <div className="w-7 h-7 rounded bg-[#00D2B8]/15 border border-[#00D2B8]/30 text-[#00A896] flex items-center justify-center font-bold text-xs shrink-0">
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
                              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer shrink-0 ml-2"
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
            <section id="filter-section" ref={filterRef} className="bg-white rounded-lg border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-6 scroll-mt-24">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5 text-[#00D2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <span>기본 검색 조건 필터링</span>
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  검색 시 매번 재선택할 필요 없이 Cloud SQL DB에 저장되어 자동으로 적용되는 보유 조건입니다.
                </p>
              </div>

              {/* 일괄 필터 설정 바 */}
              <div className="flex items-center justify-between bg-slate-100/90 p-3.5 rounded-lg border border-slate-200">
                <span className="text-xs font-extrabold text-slate-700">
                  한 번에 필터 설정:
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-xs cursor-pointer"
                  >
                    모든 결제수단 선택
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded border border-slate-300 transition-all cursor-pointer"
                  >
                    모든 선택 취소
                  </button>
                </div>
              </div>

              {/* 스마트폰 OS 및 스토어 선택 */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">기본 스마트폰 OS</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ANDROID', 'IOS'] as OsType[]).map((os) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => updateFilter('osType', os)}
                        className={`py-2.5 px-3 rounded text-xs font-extrabold border transition-all cursor-pointer ${
                          filter.osType === os
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {os === 'ANDROID' ? '안드로이드' : 'iOS'}
                      </button>
                    ))}
                  </div>
                </div>

                {filter.osType === 'ANDROID' && (
                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
                    <span className="text-xs font-bold text-slate-700 block">
                      이용 가능한 스토어 선택
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ANDROID_STORE_OPTIONS.map((store) => {
                        const selected = filter.androidStores.includes(store);
                        return (
                          /* 💡 [요청 반영] 화이트 바탕 + 민트 보더 + 민트 후광 그림자 스타일 적용 */
                          <button
                            type="button"
                            key={store}
                            onClick={() => toggleArrayItem('androidStores', store)}
                            className={`px-3 py-1.5 rounded text-xs transition-all cursor-pointer ${
                              selected
                                ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                                : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{store}
                          </button>
                        );
                      })}
                    </div>

                    {isOneStoreSelected && (
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

                {/* 💡 서브 등급 선택 박스 약한 그라데이션 틴트 적용 */}
                {(isGoogleSelected || isGalaxySelected) && (
                  <div className="p-3.5 bg-gradient-to-r from-[#00D2B8]/10 via-slate-50 to-[#00F5FF]/10 rounded-lg border border-[#00D2B8]/30 space-y-3 shadow-2xs">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {isGoogleSelected && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-900 block">Google Play Points 등급</label>
                          <select
                            value={filter.googlePlayTier}
                            onChange={(e) => updateFilter('googlePlayTier', e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-800"
                          >
                            {GOOGLE_PLAY_TIERS.map((tier) => (
                              <option key={tier.value} value={tier.value}>{tier.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isGalaxySelected && (
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-slate-900 block">Galaxy Store 멤버십 등급</label>
                          <select
                            value={filter.galaxyStoreTier}
                            onChange={(e) => updateFilter('galaxyStoreTier', e.target.value)}
                            className="w-full px-3 py-2 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-800"
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

              {/* 보너스 이벤트 적용 여부 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">보너스 이벤트 적용 여부</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useGameBenefits}
                      onChange={(e) => updateFilter('useGameBenefits', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">선택한 게임 전용 혜택 포함</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.hasPreApplied}
                      onChange={(e) => updateFilter('hasPreApplied', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">사전 응모 완료 혜택 포함</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.isFirstPayment}
                      onChange={(e) => updateFilter('isFirstPayment', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">첫 결제 이벤트 대상</span>
                  </label>
                </div>
              </div>

              {/* 보유 결제 수단 필터 */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">보유 결제 수단 & 마일리지/구독 멤버십</label>

                {/* 통신사 버블 칩 */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useCarriers}
                      onChange={(e) => updateFilter('useCarriers', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">통신사 할인 사용하기</span>
                  </label>
                  <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {CARRIER_OPTIONS.map((c) => {
                      const selected = filter.carriers.includes(c);
                      return (
                        /* 💡 [요청 반영] 화이트 바탕 + 민트 보더 + 민트 후광 그림자 스타일 */
                        <button
                          key={c}
                          type="button"
                          disabled={!filter.useCarriers}
                          onClick={() => toggleArrayItem('carriers', c)}
                          className={`px-3 py-1.5 rounded text-xs transition-all ${
                            selected
                              ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                              : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
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
                    <input
                      type="checkbox"
                      checked={filter.usePays}
                      onChange={(e) => updateFilter('usePays', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">사용 간편결제 (페이) 선택</span>
                  </label>
                  <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {PAY_OPTIONS.map((p) => {
                      const selected = filter.pays.includes(p);
                      return (
                        /* 💡 [요청 반영] 화이트 바탕 + 민트 보더 + 민트 후광 그림자 스타일 */
                        <button
                          key={p}
                          type="button"
                          disabled={!filter.usePays}
                          onClick={() => toggleArrayItem('pays', p)}
                          className={`px-3 py-1.5 rounded text-xs transition-all ${
                            selected
                              ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                              : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
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
                        <input
                          type="checkbox"
                          checked={filter.useNaverMembership}
                          onChange={(e) => updateFilter('useNaverMembership', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-xs font-bold text-emerald-900">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}

                  {isTossPaySelected && (
                    <div className="pt-2 pl-2">
                      <label className="flex items-center space-x-2 p-2 bg-blue-50/80 rounded border border-blue-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.useTossPrime}
                          onChange={(e) => updateFilter('useTossPrime', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs font-bold text-blue-900">토스프라임 구독 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 문화상품권 우회 버블 칩 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useVoucherBypasses}
                      onChange={(e) => updateFilter('useVoucherBypasses', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">문화상품권 우회 충전 할인</span>
                  </label>
                  <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {VOUCHER_OPTIONS.map((v) => {
                      const selected = filter.voucherBypasses.includes(v);
                      return (
                        /* 💡 [요청 반영] 화이트 바탕 + 민트 보더 + 민트 후광 그림자 스타일 */
                        <button
                          key={v}
                          type="button"
                          disabled={!filter.useVoucherBypasses}
                          onClick={() => toggleArrayItem('voucherBypasses', v)}
                          className={`px-3 py-1.5 rounded text-xs transition-all ${
                            selected
                              ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                              : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 카드 선택 */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">카드 선택 (옵션)</label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useSpecialOptions}
                      onChange={(e) => updateFilter('useSpecialOptions', e.target.checked)}
                      className="w-3.5 h-3.5 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-[#00A896]">옵션 {filter.useSpecialOptions ? '열림' : '닫힘'}</span>
                  </label>
                </div>

                {filter.useSpecialOptions && (
                  <div className="space-y-3 pt-1">
                    <select
                      value={filter.selectedSpecialCard}
                      onChange={(e) => updateFilter('selectedSpecialCard', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      {dynamicCardOptions.map((card) => (
                        <option key={card.value} value={card.value}>{card.label}</option>
                      ))}
                    </select>

                    {filter.selectedSpecialCard !== 'NONE' && (
                      <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.hasPrevSpend} 
                            onChange={(e) => updateFilter('hasPrevSpend', e.target.checked)}
                            className="w-4 h-4 text-[#00D2B8] rounded"
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
                  className="px-6 py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded shadow-xs transition-all cursor-pointer"
                >
                  필터 설정 저장
                </button>
              </div>
            </section>

            {/* 계정 탈퇴 카드 */}
            <section className="bg-white rounded-lg border border-slate-200/90 p-6 md:p-8 shadow-xs space-y-4">
              <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>계정 탈퇴</span>
              </h2>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-rose-50/50 rounded-lg border border-rose-100">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-800 block">계정 삭제 및 데이터 초기화</span>
                  <p className="text-[11px] text-slate-500 font-medium">
                    탈퇴 시 저장된 모든 즐겨찾기 게임 목록과 기본 검색 필터 조건이 완전히 삭제됩니다.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={async () => {
                    if (confirm('정말로 계정을 삭제(탈퇴)하시겠습니까?\n저장된 모든 정보가 완전히 삭제됩니다.')) {
                      const token = localStorage.getItem('google_token');
                      if (token) {
                        try {
                          await fetch('http://127.0.0.1:8000/user/profile', {
                            method: 'DELETE',
                            headers: { 'Authorization': `Bearer ${token}` }
                          });
                        } catch (e) {}
                      }
                      localStorage.removeItem('google_token');
                      localStorage.removeItem('user_search_filter_settings');
                      alert('계정이 성공적으로 삭제되었습니다.');
                      window.location.href = '/';
                    }
                  }}
                  className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-lg transition-all cursor-pointer shadow-xs shrink-0"
                >
                  계정 탈퇴
                </button>
              </div>
            </section>

          </main>
        </div>

      </div>
    </div>
  );
}