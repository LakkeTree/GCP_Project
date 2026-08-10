import React, { useState, useEffect } from 'react';
// 타입(type)은 'import type'으로 명시하여 런타임 모듈 번들링 에러 방지
import type { StoreCategory } from '../constants/gameRankData'; // 👈 import type 으로 수정
import {
  STORE_TAB_OPTIONS,
  TOP_10_RANK_DATA,
} from '../constants/gameRankData';

interface GameRankBoardProps {
  limit?: number;
  autoRotate?: boolean;
  compact?: boolean;
  showScrollNotice?: boolean;
}

export default function GameRankBoard({
  limit = 10,
  autoRotate = false,
  compact = false,
  showScrollNotice = false,
}: GameRankBoardProps) {
  // ... (이하 기존 GameRankBoard 로직 100% 동일)
  const [activeTab, setActiveTab] = useState<StoreCategory>('ALL');

  // 5초 자동 탭 순환 (autoRotate가 true일 때만 작동)
  useEffect(() => {
    if (!autoRotate) return;
    const categories: StoreCategory[] = ['ALL', 'GOOGLE', 'ONESTORE', 'GALAXY', 'APPLE'];
    const interval = setInterval(() => {
      setActiveTab((prevTab) => {
        const currentIndex = categories.indexOf(prevTab);
        return categories[(currentIndex + 1) % categories.length];
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoRotate]);

  const currentRank = TOP_10_RANK_DATA[activeTab];
  const displayedList = currentRank.list.slice(0, limit);

  return (
    <div className="space-y-4">
      {/* 스토어 선택 탭 */}
      <div
        className={`flex space-x-1.5 p-1.5 rounded-xl border overflow-x-auto no-scrollbar ${
          compact ? 'bg-slate-100 border-slate-200' : 'bg-slate-900 border-slate-800'
        }`}
      >
        {STORE_TAB_OPTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
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
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900">
            {currentRank.title} TOP {limit}
          </h3>
          {showScrollNotice && (
            <span className="text-xs font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-3 py-1 rounded-full">
              Scroll for 6~10th ↓
            </span>
          )}
        </div>

        {/* 결과 리스트 (limit 및 scroll 설정 반영) */}
        <div
          className={`space-y-2.5 ${
            limit > 5 ? 'max-h-[410px] overflow-y-auto pr-2 custom-scrollbar' : ''
          }`}
        >
          {displayedList.map((item) => {
            const isRank1 = item.rank === 1;
            const isRank2 = item.rank === 2;
            const isRank3 = item.rank === 3;

            return (
              <div
                key={item.rank}
                className={`p-3.5 md:p-4 rounded-lg border flex items-center justify-between transition-all hover:shadow-md cursor-pointer ${
                  isRank1
                    ? 'bg-amber-50/70 border-amber-300'
                    : isRank2
                    ? 'bg-cyan-50/70 border-cyan-300'
                    : isRank3
                    ? 'bg-purple-50/70 border-purple-300'
                    : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <span
                    className={`w-7 h-7 md:w-8 md:h-8 rounded-lg font-black text-xs md:text-sm flex items-center justify-center shrink-0 shadow-sm ${
                      isRank1
                        ? 'bg-amber-500 text-white'
                        : isRank2
                        ? 'bg-cyan-500 text-white'
                        : isRank3
                        ? 'bg-purple-500 text-white'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {item.rank}
                  </span>

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
                              ? 'bg-cyan-200 text-cyan-900'
                              : isRank3
                              ? 'bg-purple-200 text-purple-900'
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

                {!compact && (
                  <div className="text-right shrink-0 pl-3">
                    <span className="inline-block px-3 py-1 bg-red-500 text-white font-black text-xs rounded-lg shadow-sm">
                      {item.discountRate}
                    </span>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      누적 {item.searchCount}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {showScrollNotice && (
          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-bold flex items-center justify-center gap-1.5">
              <span>👇</span>
              <span>아래로 스크롤하시면 6~10위 상세 혜택을 보실 수 있습니다.</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}