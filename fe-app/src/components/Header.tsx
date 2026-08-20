import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

const parseGoogleToken = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate();

  const [user, setUser] = useState<any>(null);
  // 💡 1. 로딩 상태 추가 (토큰이 있으면 프로필 조회 완료 전까지 로딩 상태 유지)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    const token = localStorage.getItem('google_token');
    return !!(token && token !== 'undefined' && token !== 'null');
  });

  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // API BASE URL 선언 (환경변수 또는 로컬)
  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

  const fetchUserProfile = async (token: string) => {
    if (!token || token === 'undefined' || token === 'null') {
      setUser(null);
      setIsAuthLoading(false);
      return;
    }

    const googleData = parseGoogleToken(token);
    const googleNick = googleData?.given_name || googleData?.name || '유저';

    try {
      // 1. 프로필 정보 조회 (GET)
      const res = await fetch(`${API_BASE_URL}/user/profile`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        setUser({
          email: result.data?.email || googleData?.email || '이메일 없음',
          nickname: result.data?.nickname || googleNick,
          picture: googleData?.picture || null,
          provider: 'GOOGLE',
          role: result.data?.role || 'ROLE_USER',
        });
      } else if (res.status === 401 || res.status === 404) {
        // 2. 백엔드 DB에 유저가 없는 신규 회원일 경우 POST 요청으로 백엔드 자동 가입(Upsert) 실행
        const registerRes = await fetch(`${API_BASE_URL}/user/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ nickname: googleNick }),
        });

        if (registerRes.ok) {
          const regResult = await registerRes.json();
          setUser({
            email: regResult.data?.email || googleData?.email || '이메일 없음',
            nickname: regResult.data?.nickname || googleNick,
            picture: googleData?.picture || null,
            provider: 'GOOGLE',
            role: regResult.data?.role || 'ROLE_USER',
          });
        } else {
          setUser({
            email: googleData?.email || '이메일 없음',
            nickname: googleNick,
            picture: googleData?.picture || null,
            provider: 'GOOGLE',
            role: 'ROLE_USER',
          });
        }
      }
    } catch (error) {
      console.warn("백엔드 서버 미연결 (구글 로컬 정보 사용):", error);
      setUser({
        email: googleData?.email || '이메일 없음',
        nickname: googleNick,
        picture: googleData?.picture || null,
        provider: 'GOOGLE',
        role: 'ROLE_USER',
      });
    } finally {
      // 💡 2. 로딩 끝남 처리 (성공/실패 상관없이 실행)
      setIsAuthLoading(false);
    }
  };


  useEffect(() => {
    const token = localStorage.getItem('google_token');
    if (token && token !== 'undefined' && token !== 'null') {
      fetchUserProfile(token);
    }

    const handleProfileUpdate = () => {
      const currentToken = localStorage.getItem('google_token');
      if (currentToken && currentToken !== 'undefined' && currentToken !== 'null') {
        fetchUserProfile(currentToken);
      }
    };

    window.addEventListener('user_profile_updated', handleProfileUpdate);
    return () => window.removeEventListener('user_profile_updated', handleProfileUpdate);
  }, []);

  const handleGoogleSuccess = (credentialResponse: any) => {
    if (credentialResponse.credential) {
      const idToken = credentialResponse.credential;
      localStorage.setItem('google_token', idToken);
      fetchUserProfile(idToken);
    }
  };

  const handleLogout = () => {
    setIsProfileMenuOpen(false);
    localStorage.removeItem('google_token');
    setUser(null);
    navigate('/');
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setIsScrolled((prev) => {
            if (!prev && currentScrollY > 50) return true;
            if (prev && currentScrollY < 10) return false;
            return prev;
          });
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navItems = [
    { name: '오늘의 최고할인', path: '/' },
    { name: '지원하는 게임', path: '/supported-games' },
    { name: '지원하는 결제수단', path: '/supported-payment' },
    { name: '최저가 검색', path: '/search' },
  ];

  return (
    <header
      className={`bg-slate-900 border-b border-slate-800 sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'shadow-xl py-2.5' : 'shadow-lg py-4'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-3 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          
          {/* 메인페이지 이동 로고 (도미노 감소형 + 황금 수평 1자 맞춤) */}
          <Link
            to="/"
            title="메인페이지로 이동"
            className="group shrink-0 flex items-end transition-transform duration-200 active:scale-95 cursor-pointer select-none"
          >
            {/* 1. 호 (가장 큼, 바닥 1자선 기준점) */}
            <img 
              src="/logo.png" 
              alt="호" 
              className="h-13 md:h-15 w-auto object-contain shrink-0 block" 
            />

            {/* 2. 갱 (살짝 아래로 하향 조절) */}
            <span className="font-black text-3xl md:text-4xl bg-gradient-to-r from-[#00D2B8] to-[#00DCBD] bg-clip-text text-transparent tracking-tight -ml-2.5 md:-ml-3.5 leading-none -translate-y-[6px] md:-translate-y-[8px]">
              갱
            </span>

            {/* 3. 탈 (기준점 유지 - 딱 좋았던 값 그대로) */}
            <span className="font-black text-2xl md:text-3xl bg-gradient-to-r from-[#00DCBD] to-[#00E8DF] bg-clip-text text-transparent tracking-tight leading-none -translate-y-[8px] md:-translate-y-[10px]">
              탈
            </span>

            {/* 4. 출 (살짝 위로 상향 조절) */}
            <span className="font-black text-xl md:text-2xl bg-gradient-to-r from-[#00E8DF] to-[#00F5FF] bg-clip-text text-transparent tracking-tight leading-none -translate-y-[8px] md:-translate-y-[10px]">
              출
            </span>
          </Link>

          {/* 프로필 및 구글 로그인 버튼 */}
          <div className="shrink-0 flex items-center gap-2">
            {!isAuthLoading && user && user.role === 'ROLE_ADMIN' && (
              <Link
                to="/admin"
                className="flex items-center gap-1.5 bg-slate-800 border border-[#00D2B8]/50 rounded-md px-3 py-1.5 shadow-sm hover:bg-slate-750 hover:border-[#00D2B8] transition-all text-[11px] font-black text-[#00D2B8]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>관리자 대시보드</span>
              </Link>
            )}
            {isAuthLoading ? (
              /* 💡 프로필 불러오는 찰나의 순간 동안 보여줄 스켈레톤 로더 */
              <div className="w-28 h-9 bg-slate-800 animate-pulse rounded-md border border-slate-700/50" />
            ) : user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2.5 bg-slate-800 border border-slate-700 rounded-md pl-1.5 pr-3 py-1.5 shadow-sm hover:bg-slate-750 transition-all cursor-pointer"
                >
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt="프로필"
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded object-cover border border-slate-600 shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] flex items-center justify-center text-slate-950 font-black overflow-hidden shrink-0 text-xs">
                      {user.nickname ? user.nickname[0] : '👤'}
                    </div>
                  )}

                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-0.5 text-xs font-extrabold text-slate-100 leading-tight">
                      <span className="truncate max-w-[70px] sm:max-w-[90px] inline-block">{user.nickname}</span>
                      <span>님</span>
                    </div>
                    <span className="text-[10px] bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] bg-clip-text text-transparent font-black leading-tight">
                      GOOGLE
                    </span>
                  </div>

                  <svg
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      isProfileMenuOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* 프로필 드롭다운 패널 */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-3 w-70 bg-slate-950 rounded-lg shadow-[0_20px_50px_rgba(0,0,0,0.6)] border border-[#00D2B8]/50 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1.5">
                    <div className="absolute -top-1.5 right-6 w-3 h-3 bg-slate-950 border-l border-t border-[#00D2B8]/50 rotate-45 z-10" />

                    <div className="relative z-20 p-3 bg-slate-800 border border-slate-700/80 rounded-md flex items-center gap-3 shadow-sm">
                      {user.picture ? (
                        <img
                          src={user.picture}
                          alt="프로필"
                          referrerPolicy="no-referrer"
                          className="w-9 h-9 rounded object-cover border border-[#00D2B8]/60 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] flex items-center justify-center text-slate-950 font-black shrink-0 text-xs shadow-xs">
                          {user.nickname ? user.nickname[0] : '👤'}
                        </div>
                      )}
                      <div className="truncate">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-white truncate">{user.nickname}</span>
                          <span className="text-[9.5px] font-black text-slate-950 bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] px-1.5 py-0.2 rounded shrink-0">
                            GOOGLE
                          </span>
                        </div>
                        <p className="text-[11px] font-medium text-slate-300 truncate mt-0.5">{user.email}</p>
                      </div>
                    </div>

                    {/* 개인 정보 & 즐겨찾기 메뉴 */}
                    <div className="relative z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate('/profile?tab=profile');
                        }}
                        className="w-full text-left p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 hover:border-[#00D2B8] rounded-md text-xs font-extrabold text-slate-100 hover:text-[#00D2B8] flex items-center gap-2.5 transition-all cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4 text-[#00D2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>개인 정보 & 즐겨찾기</span>
                      </button>
                    </div>

                    {/* 기본 검색 필터링 메뉴 */}
                    <div className="relative z-20">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate('/profile?tab=filter');
                        }}
                        className="w-full text-left p-3 bg-slate-800 hover:bg-slate-750 border border-slate-700/80 hover:border-[#00D2B8] rounded-md text-xs font-extrabold text-slate-100 hover:text-[#00D2B8] flex items-center gap-2.5 transition-all cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4 text-[#00D2B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                        </svg>
                        <span>기본 검색 필터링</span>
                      </button>
                    </div>

                    {/* 로그아웃 메뉴 */}
                    <div className="relative z-20 pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left p-2.5 bg-slate-800 hover:bg-rose-950/50 border border-slate-700/80 hover:border-rose-500/50 rounded-md text-xs font-extrabold text-rose-400 flex items-center gap-2.5 transition-all cursor-pointer shadow-sm"
                      >
                        <svg className="w-4 h-4 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-md">
                <div className="bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] hover:brightness-105 text-slate-950 font-black transition-all duration-200 shadow-md flex items-center gap-2.5 pointer-events-none pl-2.5 pr-4 py-1.5 text-xs md:text-sm">
                  <div className="bg-slate-950 rounded p-1 flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                  </div>
                  <span>구글 로그인</span>
                </div>

                <div className="absolute inset-0 opacity-0 cursor-pointer scale-150">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={() => alert('구글 로그인 중 오류가 발생했습니다.')}
                    useOneTap={false}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 네비게이션 메뉴 (활성 탭 그라데이션 텍스트 적용) */}
        <nav className="flex items-center justify-start border-t border-slate-800 space-x-6 overflow-x-auto no-scrollbar pt-2">
          {navItems.map((item) => {
            const isSelected = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`font-bold text-sm whitespace-nowrap pb-1.5 border-b-2 transition-all ${
                  isSelected
                    ? 'bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] bg-clip-text text-transparent border-[#00D2B8] font-black'
                    : 'text-slate-400 border-transparent hover:text-[#00D2B8]'
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}