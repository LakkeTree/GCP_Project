import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom'; // 👈 useNavigate 추가
import LoginModal from './LoginModal';

export default function Header() {
  const location = useLocation();
  const navigate = useNavigate(); // 👈 navigate 사용 함수 정의

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 스크롤 감지
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
    <>
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
                isScrolled ? 'text-xl' : 'text-2xl md:text-3xl'
              }`}
            >
              <span className={isScrolled ? 'text-xl' : 'text-3xl'}>🛡️</span>
              <span>호갱탈출</span>
            </Link>

            <div className="shrink-0">
              {loggedInUser ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                    className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-full pl-1.5 pr-3 py-1 shadow-sm hover:bg-slate-100 hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-600 font-bold overflow-hidden border border-slate-200 shrink-0">
                      <svg className="w-5 h-5 text-slate-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                    </div>

                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-slate-800 leading-tight">
                        {loggedInUser.split('@')[0]}님
                      </span>
                      <span className="text-[10px] text-slate-400 leading-tight">
                        {loggedInUser.includes('@') ? loggedInUser : '일반 계정'}
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

                  {/* 프로필 클릭 시 나타나는 드롭다운 메뉴 */}
                  {isProfileMenuOpen && (
                    <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="text-[11px] font-semibold text-slate-400">접속 계정</p>
                        <p className="text-xs font-bold text-slate-800 truncate">{loggedInUser}</p>
                      </div>

                      <div className="py-1">
                        {/* 1. 개인 정보 & 즐겨찾기 */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate('/profile?tab=profile');
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="text-sm">👤</span>
                          <span>본인 정보 & 즐겨찾기</span>
                        </button>

                        {/* 2. 계정 보안 & 비밀번호 (신규 추가!) */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate('/profile?tab=security');
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="text-sm">🔒</span>
                          <span>계정 보안 & 비밀번호</span>
                        </button>

                        {/* 3. 저장한 검색 조건 필터링 */}
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            navigate('/profile?tab=filter');
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-cyan-600 flex items-center gap-2.5 transition-colors cursor-pointer"
                        >
                          <span className="text-sm">🔖</span>
                          <span>저장한 검색 조건 필터링</span>
                        </button>
                      </div>

                      {/* 4. 로그아웃 */}
                      <div className="border-t border-slate-100 pt-1 mt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileMenuOpen(false);
                            setLoggedInUser(null);
                            navigate('/');
                          }}
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
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setLoggedInUser('dev_user@example.com')}
                    className={`bg-amber-500 hover:bg-amber-600 text-white font-black rounded-lg transition-all duration-300 shadow-sm cursor-pointer ${
                      isScrolled
                        ? 'px-3 py-1 text-xs'
                        : 'px-3.5 py-1.5 text-sm'
                    }`}
                  >
                    ⚡ 개발자 로그인
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLoginModalOpen(true)}
                    className={`border-2 border-cyan-500 text-cyan-600 hover:bg-cyan-50 font-black rounded-lg transition-all duration-300 shadow-sm cursor-pointer ${
                      isScrolled
                        ? 'px-3.5 py-1 text-xs'
                        : 'px-4.5 py-1.5 text-sm'
                    }`}
                  >
                    로그인
                  </button>
                </div>
              )}
            </div>
          </div>

          <nav
            className={`flex items-center justify-start border-t border-slate-100 space-x-6 md:space-x-8 overflow-x-auto no-scrollbar transition-all duration-300 ${
              isScrolled ? 'pt-1' : 'pt-2'
            }`}
          >
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`font-bold whitespace-nowrap transition-all border-b-2 ${
                    isScrolled ? 'py-1 text-xs' : 'py-1.5 text-sm'
                  } ${
                    isActive
                      ? 'text-cyan-600 border-cyan-500 font-black'
                      : 'text-slate-600 border-transparent hover:text-cyan-600 hover:border-slate-300'
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

        </div>
      </header>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(email) => setLoggedInUser(email)}
      />
    </>
  );
}