import { useState, useEffect } from 'react';
import type { RankCategoryData } from '../constants/gameRankData';
import { FALLBACK_HOGAENG_RANK_DATA, fetchHogaengRankData } from '../constants/gameRankData';

export default function GameRankBoard() {
  const [rankData, setRankData] = useState<RankCategoryData>(FALLBACK_HOGAENG_RANK_DATA);
  const [loading, setLoading] = useState<boolean>(false);

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
    <div className="bg-white rounded-lg border border-slate-200 shadow-xs p-5 md:p-6 space-y-4">
      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
        <h3 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
          호갱탈출 최근 7일간 검색 순위 TOP 20
        </h3>
        {loading && (
          <span className="text-[11px] font-extrabold text-[#00A896] animate-pulse">
            DB 동기화 중...
          </span>
        )}
      </div>

      <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1.5 custom-scrollbar">
        {displayedList.map((item) => {
          const isRank1 = item.rank === 1;
          const isRank2 = item.rank === 2;
          const isRank3 = item.rank === 3;

          let rankBadgeStyle = 'bg-slate-200 text-slate-700';
          let cardBgStyle = 'bg-white border-slate-200 hover:border-[#00D2B8] shadow-2xs';

          if (isRank1) {
            rankBadgeStyle = 'bg-amber-400 text-slate-950 font-black';
            cardBgStyle = 'bg-amber-50/60 border-amber-300 shadow-2xs';
          } else if (isRank2) {
            rankBadgeStyle = 'bg-sky-500 text-white font-black';
            cardBgStyle = 'bg-sky-50/60 border-sky-300 shadow-2xs';
          } else if (isRank3) {
            rankBadgeStyle = 'bg-purple-500 text-white font-black';
            cardBgStyle = 'bg-purple-50/60 border-purple-300 shadow-2xs';
          }

          let rankChangeBadgeStyle = 'bg-slate-100 text-slate-500 border-slate-200';
          if (item.rankChange === 'UP') {
            rankChangeBadgeStyle = 'bg-rose-50 text-rose-600 border-rose-200 font-extrabold';
          } else if (item.rankChange === 'DOWN') {
            rankChangeBadgeStyle = 'bg-sky-50 text-sky-600 border-sky-200 font-extrabold';
          } else if (item.rankChange === 'NEW') {
            rankChangeBadgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200 font-extrabold';
          }

          return (
            <div
              key={item.rank}
              className={`p-3 rounded border flex items-center justify-between transition-all hover:shadow-xs cursor-pointer ${cardBgStyle}`}
            >
              <div className="flex items-center space-x-3">
                <span
                  className={`w-10 py-1 rounded text-xs md:text-sm shadow-2xs flex items-center justify-center shrink-0 text-center ${rankBadgeStyle}`}
                >
                  {item.rank}등
                </span>

                {item.icon ? (
                  <img
                    src={item.icon}
                    alt={item.name}
                    className="w-8 h-8 md:w-9 md:h-9 rounded object-cover border border-slate-200 shrink-0 shadow-2xs"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-9 md:h-9 rounded bg-slate-100 flex items-center justify-center text-sm shrink-0 border border-slate-200">
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
                        className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-xs ${
                          isRank1
                            ? 'bg-amber-200 text-amber-950'
                            : isRank2
                            ? 'bg-sky-200 text-sky-950'
                            : isRank3
                            ? 'bg-purple-200 text-purple-950'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400">
                    최근 검색된 게임
                  </p>
                </div>
              </div>

              <div className="shrink-0 pl-2">
                <span className={`inline-block px-2 py-0.5 rounded border text-[11px] text-center min-w-[42px] shadow-2xs ${rankChangeBadgeStyle}`}>
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