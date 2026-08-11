import GameRankBoard from '../components/GameRankBoard';

export default function GameRankPage() {
  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 메인 결제 순위 대시보드 */}
        <div className="lg:col-span-10 space-y-4">
          <div>
            <h2 className="text-2xl font-black text-slate-900">📊 GamerRank 실시간 순위 대시보드</h2>
            <p className="text-xs text-slate-500">
              스토어 크롤링 결제 순위 및 호갱탈출 유저 7일간 실시간 검색 순위입니다.
            </p>
          </div>

          {/* 통합 랭킹 보드 호출 (TOP 10 표출) */}
          <GameRankBoard limit={10} autoRotate={false} compact={false} />
        </div>

        {/* [우측 2열] 스티키 광고 배너 */}
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
                  실시간 게임 랭킹 & 카드사 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                💡 실시간 게임 랭킹 제휴 및 배너 입점 문의 환영
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