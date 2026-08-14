import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';

// 구글 ID 토큰(JWT) 파서 헬퍼
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
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 백엔드 및 구글 토큰 정보 파싱하여 프로필 설정
  const fetchUserProfile = async (token: string) => {
    try {
      const googleData = parseGoogleToken(token);
      const googleNick = googleData?.given_name || googleData?.name || '유저';

      const res = await fetch('http://127.0.0.1:8000/user/profile', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const result = await res.json();
        // 💡 백엔드 DB에 변경 저장된 닉네임이 없으면 구글 계정 이름(googleNick)을 기본으로 사용
        setUser({
          email: result.data?.email || googleData?.email || '이메일 없음',
          nickname: result.data?.nickname || googleNick,
          picture: googleData?.picture || null,
          provider: 'GOOGLE',
        });
      } else {
        // 백엔드 미응답 시 구글 기본 데이터로 표출
        setUser({
          email: googleData?.email || '이메일 없음',
          nickname: googleNick,
          picture: googleData?.picture || null,
          provider: 'GOOGLE',
        });
      }
    } catch (error) {
      console.error("백엔드 서버 연동 실패:", error);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('google_token');
    if (token) {
      fetchUserProfile(token);
    }

    // 💡 마이페이지에서 닉네임 저장 시 실시간 반영되는 커스텀 이벤트 핸들러
    const handleProfileUpdate = () => {
      const currentToken = localStorage.getItem('google_token');
      if (currentToken) {
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
      className={`bg-white border-b border-slate-200 sticky top-0 z-50 transition-all duration-300 ${
        isScrolled ? 'shadow-md py-2' : 'shadow-sm py-3.5'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 space-y-2.5 transition-all duration-300">
        <div className="flex items-center justify-between gap-4">
          
          <Link
            to="/"
            className={`font-black text-cyan-600 tracking-tight shrink-0 flex items-center gap-2 transition-all duration-300 ${
              isScrolled ? 'text-2xl' : 'text-3xl md:text-4xl'
            }`}
          >
            <span className={isScrolled ? 'text-2xl' : 'text-4xl'}>🛡️</span>
            <span>호갱탈출</span>
          </Link>

          <div className="shrink-0 flex items-center gap-2">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                  className="flex items-center gap-2.5 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 shadow-sm hover:bg-slate-100 transition-all cursor-pointer"
                >
                  {/* 구글 프로필 사진 또는 첫 글자 */}
                  {user.picture ? (
                    <img
                      src={user.picture}
                      alt="프로필"
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold overflow-hidden border border-slate-200 shrink-0 text-xs">
                      {user.nickname ? user.nickname[0] : '👤'}
                    </div>
                  )}

                  {/* 💡 일정 길이를 초과하면 ... 으로 잘리는 닉네임 박스 */}
                  <div className="flex flex-col text-left">
                    <div className="flex items-center gap-0.5 text-xs font-bold text-slate-800 leading-tight">
                      <span className="truncate max-w-[70px] sm:max-w-[90px] inline-block">{user.nickname}</span>
                      <span>님</span>
                    </div>
                    <span className="text-[10px] text-slate-400 leading-tight">
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

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2 border-b border-slate-100 flex items-center gap-2.5">
                      {user.picture && (
                        <img src={user.picture} alt="프로필" referrerPolicy="no-referrer" className="w-7 h-7 rounded-full object-cover" />
                      )}
                      <div className="truncate">
                        <p className="text-[11px] font-semibold text-slate-400">접속 계정</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
                          navigate('/profile?tab=profile');
                        }}
                        className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <span className="text-sm">👤</span>
                        <span>개인 정보 & 즐겨찾기</span>
                      </button>
                    </div>

                    <div className="border-t border-slate-100 pt-1 mt-1">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
                      >
                        <span className="text-sm">🚪</span>
                        <span>로그아웃</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-full">
                <div className={`bg-cyan-600 hover:bg-cyan-700 text-white font-bold transition-all duration-200 shadow-sm flex items-center gap-2.5 pointer-events-none ${
                  isScrolled ? 'pl-2 pr-4 py-1 text-xs' : 'pl-2.5 pr-5 py-1.5 text-sm'
                }`}>
                  <div className="bg-white rounded-full p-1 flex items-center justify-center shrink-0 shadow-xs">
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
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex items-center justify-start border-t border-slate-100 space-x-6 overflow-x-auto no-scrollbar pt-1.5">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`font-bold text-sm whitespace-nowrap pb-1 border-b-2 ${
                location.pathname === item.path
                  ? 'text-cyan-600 border-cyan-500 font-black'
                  : 'text-slate-600 border-transparent hover:text-cyan-600'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}