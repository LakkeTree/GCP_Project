import { useState, useEffect } from 'react';
import type { RankCategoryData } from '../constants/gameRankData';
import { FALLBACK_HOGAENG_RANK_DATA, fetchHogaengRankData } from '../constants/gameRankData';



export default function GameRankBoard() {
  const [rankData, setRankData] = useState<RankCategoryData>(FALLBACK_HOGAENG_RANK_DATA);
  const [loading, setLoading] = useState<boolean>(false);

  // 컴포넌트 마운트 시 DB에서 7일간 검색 랭킹 데이터 수집
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchHogaengRankData().then((data) => {
      if (isMounted) {
        setRankData(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const displayedList = rankData?.list || [];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-5 md:p-6 space-y-4">
      {/* 상단 타이틀 */}
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <h3 className="text-base md:text-lg font-black text-slate-900 flex items-center gap-2">
          <span>🔥</span>
          <span>호갱탈출 최근 7일간 검색 순위 TOP 20</span>
        </h3>
        {loading && (
          <span className="text-[11px] font-extrabold text-cyan-600 animate-pulse">
            DB 동기화 중...
          </span>
        )}
      </div>

      {/* 💡 [핵심] 카드 내부 고정 높이(max-h-[520px]) 및 세로 스크롤(overflow-y-auto) 적용 */}
      <div className="space-y-2.5 max-h-[520px] overflow-y-auto pr-1.5 custom-scrollbar">
        {displayedList.map((item) => {
          const isRank1 = item.rank === 1;
          const isRank2 = item.rank === 2;
          const isRank3 = item.rank === 3;

          let rankBadgeStyle = 'bg-slate-700 text-white';
          let cardBgStyle = 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100';

          if (isRank1) {
            rankBadgeStyle = 'bg-amber-500 text-white';
            cardBgStyle = 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400/30';
          } else if (isRank2) {
            rankBadgeStyle = 'bg-slate-600 text-white';
            cardBgStyle = 'bg-slate-100/80 border-slate-300 ring-1 ring-slate-300';
          } else if (isRank3) {
            rankBadgeStyle = 'bg-amber-700 text-white';
            cardBgStyle = 'bg-amber-100/40 border-amber-600/30 ring-1 ring-amber-600/20';
          }

          let rankChangeBadgeStyle = 'bg-slate-100 text-slate-500 border-slate-200';
          if (item.rankChange === 'UP') {
            rankChangeBadgeStyle = 'bg-red-50 text-red-600 border-red-200 font-extrabold';
          } else if (item.rankChange === 'DOWN') {
            rankChangeBadgeStyle = 'bg-blue-50 text-blue-600 border-blue-200 font-extrabold';
          } else if (item.rankChange === 'NEW') {
            rankChangeBadgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200 font-extrabold';
          }

          return (
            <div
              key={item.rank}
              className={`p-3 md:p-3.5 rounded-xl border flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${cardBgStyle}`}
            >
              <div className="flex items-center space-x-3">
                <span
                  className={`w-11 py-1 rounded-md text-xs md:text-sm font-black shadow-2xs flex items-center justify-center shrink-0 text-center ${rankBadgeStyle}`}
                >
                  {item.rank}등
                </span>

                {/* DB에 등록된 아이콘 표출 */}
                {item.icon ? (
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-slate-200 flex items-center justify-center text-sm shrink-0 border border-slate-300">
                    🎮
                  </div>
                )}

                <div className="space-y-0.5">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-extrabold text-slate-900 text-xs md:text-sm">
                      {item.name}
                    </h4>
                    {item.badge && (
                      <span
                        className={`text-[9.5px] font-black px-1.5 py-0.5 rounded ${
                          isRank1
                            ? 'bg-amber-200 text-amber-900'
                            : isRank2
                            ? 'bg-slate-300 text-slate-800'
                            : isRank3
                            ? 'bg-amber-200/80 text-amber-950'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-500">
                    🔍 최근 검색된 게임
                  </p>
                </div>
              </div>

              <div className="shrink-0 pl-2">
                <span className={`inline-block px-2.5 py-0.5 rounded-md border text-[11px] text-center min-w-[44px] shadow-2xs ${rankChangeBadgeStyle}`}>
                  {item.rankChangeText}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
