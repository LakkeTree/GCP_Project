import { useState } from 'react';

export default function SupportedGamesPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const games = [
    { id: 1, name: '쿠키런: 킹덤', icon: '🍪', category: '수집형 RPG', stores: ['구글', '원스', '갤스', '앱스토어'] },
    { id: 2, name: '리니지M', icon: '⚔️', category: 'MMORPG', stores: ['구글', '앱스토어'] },
    { id: 3, name: '오딘: 발할라 라이징', icon: '🛡️', category: 'MMORPG', stores: ['구글', '원스', '앱스토어'] },
    { id: 4, name: '나 혼자만 레벨업:어라이즈', icon: '🗡️', category: '액션 RPG', stores: ['구글', '갤스', '앱스토어'] },
    { id: 5, name: '붕괴: 스타레일', icon: '🚀', category: '턴제 RPG', stores: ['구글', '갤스', '앱스토어'] },
    { id: 6, name: '원신', icon: '✨', category: '오픈월드 RPG', stores: ['구글', '갤스', '앱스토어'] },
    { id: 7, name: 'AFK : 새로운 여정', icon: '🏹', category: '방치형 RPG', stores: ['구글', '앱스토어'] },
    { id: 8, name: 'FC 모바일', icon: '⚽', category: '스포츠', stores: ['구글', '앱스토어'] },
    { id: 9, name: '메이플스토리M', icon: '🍁', category: 'MMORPG', stores: ['구글', '원스', '앱스토어'] },
    { id: 10, name: '승리의 여신: 니케', icon: '🔫', category: 'TPS 건슈팅', stores: ['구글', '원스', '앱스토어'] },
    { id: 11, name: '트릭컬 리바이브', icon: '🍰', category: '수집형 RPG', stores: ['구글', '갤스', '원스'] },
    { id: 12, name: '젠레스 존 제로', icon: '⚡', category: 'ARPG', stores: ['구글', '갤스', '앱스토어'] },
  ];

  const filtered = games.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃 (items-start 필수) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 메인 게임 영역 */}
        <div className="lg:col-span-10 space-y-6">
          <header className="space-y-2">
            <h2 className="text-2xl font-black text-slate-900">🎮 호갱탈출 지원 게임 목록</h2>
            <p className="text-xs text-slate-500">실시간 스토어 결제 최적가 연산을 지원하는 게임 리스트입니다.</p>
            
            <div className="pt-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="지원 게임 이름으로 검색해 보세요..."
                className="w-full max-w-md px-4 py-2.5 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-sm"
              />
            </div>
          </header>

          {/* 게임 카드 그리드 (세미 샤프 적용) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {filtered.map((g) => (
              <div
                key={g.id}
                className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-cyan-400 hover:shadow-md transition-all space-y-3 cursor-pointer"
              >
                <div className="text-4xl">{g.icon}</div>
                <div>
                  <span className="text-[10px] font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                    {g.category}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-800 mt-1.5">{g.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                  {g.stores.map((s) => (
                    <span key={s} className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* [우측 2열] 위치 및 스티키 개선 광고 배너 */}
        <aside className="lg:col-span-2 h-full">
          <div className="sticky top-28 h-[650px] w-full p-5 bg-slate-100 rounded-xl border border-slate-200/80 flex flex-col items-center justify-between text-center shadow-inner">
            <span className="px-2.5 py-1 bg-slate-800 text-white font-bold text-[9px] rounded tracking-wider">
              ADVERTISEMENT
            </span>

            <div className="space-y-4 my-auto">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-3xl shadow-sm border border-slate-200 mx-auto animate-pulse">
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
                💡 신규 게임 등록 및 배너 입점 문의 환영
              </div>
            </div>

            <button className="w-full py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg transition-all shadow-md shadow-cyan-500/20 cursor-pointer">
              광고/제휴 신청하기
            </button>
          </div>
        </aside>

      </div>

    </div>
  );
}
// finish