import { useState, useEffect } from 'react';
import type { StoreCategory, RankCategoryData } from '../constants/gameRankData';
import {
  STORE_TAB_OPTIONS,
  FALLBACK_RANK_DATA,
  fetchRankData,
} from '../constants/gameRankData';
import { getGameIcon } from '../constants/searchOptions';

interface GameRankBoardProps {
  limit?: number;
  autoRotate?: boolean;
  compact?: boolean;
}

export default function GameRankBoard({
  limit = 10,
  autoRotate = false,
  compact = false,
}: GameRankBoardProps) {
  const [activeTab, setActiveTab] = useState<StoreCategory>('HOGAENG');
  const [rankData, setRankData] = useState<RankCategoryData>(FALLBACK_RANK_DATA['HOGAENG']);
  const [loading, setLoading] = useState<boolean>(false);

  // activeTab 변경 시 DB 데이터 실시간 수집
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    fetchRankData(activeTab).then((data) => {
      if (isMounted) {
        setRankData(data);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  // 5초 자동 탭 순환
  useEffect(() => {
    if (!autoRotate) return;
    const categories: StoreCategory[] = ['HOGAENG', 'GOOGLE', 'ONESTORE', 'GALAXY', 'APPLE'];
    const interval = setInterval(() => {
      setActiveTab((prevTab) => {
        const currentIndex = categories.indexOf(prevTab);
        return categories[(currentIndex + 1) % categories.length];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRotate]);

  const displayedList = (rankData?.list || []).slice(0, limit);

  return (
    <div className="space-y-4">
      {/* 탭 버튼 영역 */}
      <div
        className={`flex space-x-1.5 p-1.5 rounded-xl border overflow-x-auto no-scrollbar ${
          compact ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {STORE_TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              // 스토어 탭 변경 시 화면 최상단으로 부드럽게 이동
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition-all cursor-pointer whitespace-nowrap text-center ${
              activeTab === tab.id
                ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                : compact
                ? 'text-slate-500 hover:text-slate-900'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            {compact ? tab.shortLabel : tab.label}
          </button>
        ))}
      </div>

      {/* 메인 순위 카드 패널 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-md p-5 md:p-6 space-y-4">
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h3 className="text-base font-black text-slate-900">
            {rankData?.title || '순위 대시보드'} TOP {limit}
          </h3>
          {loading && (
            <span className="text-[11px] font-bold text-cyan-600 animate-pulse">
              DB 동기화 중...
            </span>
          )}
        </div>

        {/* 결과 리스트 (내부 스크롤 제거, 1~10위 전체 시원하게 노출) */}
        <div className="space-y-2.5">
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
                className={`p-3.5 md:p-4 rounded-xl border flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${cardBgStyle}`}
              >
                <div className="flex items-center space-x-3 md:space-x-4">
                  <span
                    className={`w-12 py-1 rounded-md text-xs md:text-sm font-black shadow-sm flex items-center justify-center shrink-0 text-center ${rankBadgeStyle}`}
                  >
                    {item.rank}등
                  </span>

                  {/* DB에 저장된 커스텀 이미지 URL이 있으면 우선 표시, 없으면 헬퍼 이모티콘 표출 */}
                  {item.icon ? (
                    <img
                      src={item.icon}
                      alt={item.name}
                      className="w-8 h-8 md:w-9 md:h-9 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                  ) : (
                    <span className="text-2xl md:text-3xl shrink-0 leading-none">
                      {getGameIcon(item.name)}
                    </span>
                  )}

                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h4 className="font-extrabold text-slate-900 text-sm md:text-base">
                        {item.name}
                      </h4>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded ${
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
                    <p className="text-xs font-medium text-slate-600">
                      💡 <span className="font-bold text-slate-800">{item.benefitText}</span>
                    </p>
                  </div>
                </div>

                <div className="shrink-0 pl-3">
                  <span className={`inline-block px-3 py-1 rounded-lg border text-xs text-center min-w-[50px] shadow-2xs ${rankChangeBadgeStyle}`}>
                    {item.rankChangeText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}