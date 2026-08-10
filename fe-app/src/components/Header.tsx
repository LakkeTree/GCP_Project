import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LoginModal from './LoginModal';

export default function Header() {
  const location = useLocation();

  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<string | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  // 스크롤 감지 및 여유 임계값 적용 (덜컹거림 완벽 방지)
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

  // 5대 핵심 메뉴 (최저가 검색 탭 독립 신설)
  const navItems = [
    { name: '오늘의 최고할인', path: '/' },
    { name: '게임랭킹', path: '/rank' },
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
          
          {/* 1행: [로고 (좌측 끝)] ------------------ [로그인 버튼 (우측 끝)] */}
          <div className="flex items-center justify-between gap-4">
            
            {/* 브랜드 로고 */}
            <Link
              to="/"
              className={`font-black text-cyan-600 tracking-tight shrink-0 flex items-center gap-2 transition-all duration-300 ${
                isScrolled ? 'text-xl' : 'text-2xl md:text-3xl'
              }`}
            >
              <span className={isScrolled ? 'text-xl' : 'text-3xl'}>🛡️</span>
              <span>호갱탈출</span>
            </Link>

            {/* 우측 로그인 / 프로필 버튼 */}
            <div className="shrink-0">
              {loggedInUser ? (
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
                    👤 {loggedInUser.split('@')[0]}님
                  </span>
                  <button
                    type="button"
                    onClick={() => setLoggedInUser(null)}
                    className="px-3 py-1.5 border border-slate-300 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-lg transition-all cursor-pointer"
                  >
                    로그아웃
                  </button>
                </div>
              ) : (
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
              )}
            </div>
          </div>

          {/* 2행: 네비게이션 메뉴 탭 (5개 메뉴 구성) */}
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

      {/* 로그인 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(email) => setLoggedInUser(email)}
      />
    </>
  );
}