import { useFilterState } from '../hooks/useFilterState';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  GOOGLE_PLAY_TIERS,
  GALAXY_STORE_TIERS,
} from '../constants/searchOptions';

interface FilterSectionProps {
  filterState: ReturnType<typeof useFilterState>;
  onFilterChange?: () => void;
  showSaveButton?: boolean;
  onSave?: () => void;
  onLoadSaved?: () => void;
  /** 현재 선택된 게임이 지원하는 스토어 목록(예: ['구글', '원스', '앱스토어']).
   *  전달되지 않으면(undefined) 게임 미선택 상태로 보고 전부 선택 가능하게 둔다. */
  supportedStores?: string[];
}

export default function FilterSection({
  filterState,
  onFilterChange,
  showSaveButton = false,
  onSave,
  onLoadSaved,
  supportedStores,
}: FilterSectionProps) {
  const {
    filter,
    setFilter,
    cardOptions: dynamicCardOptions,
    selectAll,
    deselectAll,
    toggleArrayItem,
  } = filterState;

  const updateFilter = <K extends keyof typeof filter>(key: K, value: typeof filter[K]) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
    if (onFilterChange) onFilterChange();
  };

  const handleToggle = (key: 'androidStores' | 'carriers' | 'pays' | 'voucherBypasses', item: string) => {
    toggleArrayItem(key, item);
    if (onFilterChange) onFilterChange();
  };

  const isGoogleSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = filter.osType === 'ANDROID' && filter.androidStores.includes('갤럭시 스토어');
  const isNaverPaySelected = filter.usePays && filter.pays.includes('네이버페이');
  const isTossPaySelected = filter.usePays && filter.pays.includes('토스페이');

  // 💡 선택한 게임이 지원하지 않는 스토어/OS는 아예 고를 수 없도록 비활성화한다.
  //    supportedStores가 없으면(게임 미선택 등) 전부 지원하는 것으로 간주한다.
  //    (SearchPage.tsx/SearchResultPage.tsx의 isStoreSupported 퍼지 매칭과 동일한 로직)
  const isStoreSupported = (storeName: string) => {
    if (!supportedStores || supportedStores.length === 0) return true;
    return supportedStores.some((s) => {
      const normS = s.trim().toLowerCase();
      const normStore = storeName.trim().toLowerCase();
      if (normStore.includes('구글') && (normS.includes('구글') || normS.includes('google'))) return true;
      if (normStore.includes('원스') && (normS.includes('원스') || normS.includes('one'))) return true;
      if (normStore.includes('갤럭시') && (normS.includes('갤스') || normS.includes('갤럭시') || normS.includes('galaxy'))) return true;
      if ((normStore.includes('앱스토어') || normStore.includes('ios')) && (normS.includes('앱스토어') || normS.includes('ios') || normS.includes('애플') || normS.includes('apple'))) return true;
      return normS.includes(normStore) || normStore.includes(normS);
    });
  };
  const isIosSupported = isStoreSupported('앱스토어');
  const isAndroidSupported = ANDROID_STORE_OPTIONS.some((store) => isStoreSupported(store));

  return (
    <div className="space-y-5">
      {/* 일괄 필터 설정 바 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-100/90 p-3.5 rounded-lg border border-slate-200 gap-2">
        <span className="text-xs font-extrabold text-slate-700">한 번에 필터 설정:</span>
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {onLoadSaved && (
            <button
              type="button"
              onClick={onLoadSaved}
              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300/80 text-amber-900 font-extrabold text-xs rounded transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>저장된 필터 불러오기</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => { selectAll(); if (onFilterChange) onFilterChange(); }}
            className="px-3.5 py-1.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-xs cursor-pointer"
          >
            모든 결제수단 선택
          </button>
          <button
            type="button"
            onClick={() => { deselectAll(); if (onFilterChange) onFilterChange(); }}
            className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded border border-slate-300 transition-all cursor-pointer"
          >
            모든 선택 취소
          </button>
        </div>
      </div>

      {/* 스마트폰 OS 및 스토어 선택 */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
          <span>스마트폰 OS 및 이용 스토어 선택</span>
          <span className="text-[10px] text-[#00A896] font-black">* 필수</span>
        </h3>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['ANDROID', 'IOS'] as OsType[]).map((os) => {
              const osSupported = os === 'ANDROID' ? isAndroidSupported : isIosSupported;
              return (
                <button
                  key={os}
                  type="button"
                  disabled={!osSupported}
                  title={osSupported ? undefined : '현재 선택한 게임이 지원하지 않는 OS입니다.'}
                  onClick={() => osSupported && updateFilter('osType', os)}
                  className={`py-2.5 px-3 rounded text-xs font-extrabold border transition-all text-center ${
                    !osSupported
                      ? 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                      : filter.osType === os
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs cursor-pointer'
                      : 'bg-slate-50 text-slate-600 border-slate-200 cursor-pointer'
                  }`}
                >
                  {os === 'ANDROID' ? '안드로이드' : 'iOS'}
                </button>
              );
            })}
          </div>

          {filter.osType === 'ANDROID' && (
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
              <span className="text-xs font-bold text-slate-700 block">이용 가능한 스토어 선택</span>
              <div className="flex flex-wrap gap-1.5">
                {ANDROID_STORE_OPTIONS.map((store) => {
                  const selected = filter.androidStores.includes(store);
                  const storeSupported = isStoreSupported(store);
                  return (
                    <button
                      type="button"
                      key={store}
                      disabled={!storeSupported}
                      title={storeSupported ? undefined : '현재 선택한 게임이 지원하지 않는 스토어입니다.'}
                      onClick={() => storeSupported && handleToggle('androidStores', store)}
                      className={`px-3 py-1.5 rounded text-xs transition-all ${
                        !storeSupported
                          ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                          : selected
                          ? 'bg-white text-slate-900 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                          : 'bg-slate-50 text-slate-500 font-bold border border-slate-200 cursor-pointer'
                      }`}
                    >
                      {selected ? '✓ ' : '+ '}{store}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 등급 선택 옵션 */}
          {(isGoogleSelected || isGalaxySelected) && (
            <div className="p-3.5 bg-gradient-to-r from-[#00D2B8]/10 via-slate-50 to-[#00F5FF]/10 rounded-lg border border-[#00D2B8]/30 space-y-3 shadow-2xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {isGoogleSelected && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-900 block">Google Play Points 등급</label>
                    <select
                      value={filter.googlePlayTier}
                      onChange={(e) => updateFilter('googlePlayTier', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-800"
                    >
                      {GOOGLE_PLAY_TIERS.map((tier) => (
                        <option key={tier.value} value={tier.value}>{tier.label}</option>
                      ))}
                    </select>
                  </div>
                )}

                {isGalaxySelected && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-900 block">Galaxy Store 멤버십 등급</label>
                    <select
                      value={filter.galaxyStoreTier}
                      onChange={(e) => updateFilter('galaxyStoreTier', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded border border-[#00D2B8]/40 bg-white font-bold text-slate-800"
                    >
                      {GALAXY_STORE_TIERS.map((tier) => (
                        <option key={tier.value} value={tier.value}>{tier.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isGoogleSelected && (
                <div className="pt-2 border-t border-[#00D2B8]/20">
                  <label className="flex items-center space-x-2 p-2 bg-white rounded border border-[#00D2B8]/30 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.isPcVersion}
                      onChange={(e) => updateFilter('isPcVersion', e.target.checked)}
                      className="w-4 h-4 text-[#00D2B8] rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">PC 버전 (Google Play Games) 접속 결제 대상</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 보너스 및 혜택 적용 여부 */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-3">
        <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5">보너스 및 혜택 적용 여부</h3>
        <div className="space-y-2">
          <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.useGameBenefits}
              onChange={(e) => updateFilter('useGameBenefits', e.target.checked)}
              className="w-4 h-4 text-[#00D2B8] rounded"
            />
            <span className="text-xs font-bold text-slate-700">선택한 게임 전용 혜택 포함</span>
          </label>

          <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.hasPreApplied}
              onChange={(e) => updateFilter('hasPreApplied', e.target.checked)}
              className="w-4 h-4 text-[#00D2B8] rounded"
            />
            <span className="text-xs font-bold text-slate-700">사전 응모 완료 혜택 포함</span>
          </label>

          <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.isFirstPayment}
              onChange={(e) => updateFilter('isFirstPayment', e.target.checked)}
              className="w-4 h-4 text-[#00D2B8] rounded"
            />
            <span className="text-xs font-bold text-slate-700">첫 결제 이벤트 대상</span>
          </label>
        </div>
      </div>

      {/* 보유 결제 수단 필터 */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-4">
        <h3 className="text-xs font-black text-slate-900 border-b border-slate-100 pb-2.5 flex items-center justify-between">
          <span>보유 결제 수단 필터</span>
          <span className="text-[10px] text-[#00A896] font-black">* 최소 1개 필수</span>
        </h3>

        <div className="space-y-4">
          {/* 1. 통신사 멤버십 및 휴대폰 결제 통합 선택 영역 */}
          <div className="space-y-2">
            <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.useCarriers}
                onChange={(e) => {
                  const val = e.target.checked;
                  setFilter((prev) => ({ ...prev, useCarriers: val, useTMembership: val }));
                  if (onFilterChange) onFilterChange();
                }}
                className="w-4 h-4 text-[#00D2B8] rounded cursor-pointer"
              />
              <span className="text-xs font-extrabold text-slate-800">통신사 멤버십 및 휴대폰 결제 사용</span>
            </label>

            <div className={`flex flex-wrap gap-1.5 pl-1 transition-all ${filter.useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {CARRIER_OPTIONS.map((c) => {
                const selected = filter.carriers.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    disabled={!filter.useCarriers}
                    onClick={() => handleToggle('carriers', c)}
                    className={`px-3 py-1.5 rounded text-xs transition-all ${
                      selected
                        ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)] cursor-pointer'
                        : 'bg-slate-50 text-slate-500 font-bold border border-slate-200 cursor-pointer'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}{c}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 간편결제 페이 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.usePays}
                onChange={(e) => updateFilter('usePays', e.target.checked)}
                className="w-4 h-4 text-[#00D2B8] rounded"
              />
              <span className="text-xs font-bold text-slate-800">사용 간편결제 (페이) 선택</span>
            </label>

            <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {PAY_OPTIONS.map((p) => {
                const selected = filter.pays.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    disabled={!filter.usePays}
                    onClick={() => handleToggle('pays', p)}
                    className={`px-3 py-1.5 rounded text-xs transition-all ${
                      selected
                        ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                        : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}{p}
                  </button>
                );
              })}
            </div>

            {isNaverPaySelected && (
              <div className="pt-2 pl-2">
                <label className="flex items-center space-x-2 p-2 bg-emerald-50/80 rounded border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useNaverMembership}
                    onChange={(e) => updateFilter('useNaverMembership', e.target.checked)}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span className="text-xs font-bold text-emerald-900">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                </label>
              </div>
            )}

            {isTossPaySelected && (
              <div className="pt-2 pl-2">
                <label className="flex items-center space-x-2 p-2 bg-blue-50/80 rounded border border-blue-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.useTossPrime}
                    onChange={(e) => updateFilter('useTossPrime', e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-bold text-blue-900">토스프라임 구독 중 (+4% 추가 적립)</span>
                </label>
              </div>
            )}
          </div>

          {/* 문화상품권 우회 충전 */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={filter.useVoucherBypasses}
                onChange={(e) => updateFilter('useVoucherBypasses', e.target.checked)}
                className="w-4 h-4 text-[#00D2B8] rounded"
              />
              <span className="text-xs font-bold text-slate-800">문화상품권 우회 충전 할인</span>
            </label>

            <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              {VOUCHER_OPTIONS.map((v) => {
                const selected = filter.voucherBypasses.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    disabled={!filter.useVoucherBypasses}
                    onClick={() => handleToggle('voucherBypasses', v)}
                    className={`px-3 py-1.5 rounded text-xs transition-all ${
                      selected
                        ? 'bg-white text-slate-950 font-black border-2 border-[#00D2B8] shadow-[0_2px_8px_rgba(0,210,184,0.35)]'
                        : 'bg-slate-50 text-slate-500 font-bold border border-slate-200'
                    }`}
                  >
                    {selected ? '✓ ' : '+ '}{v}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* 카드 선택 */}
      <div className="bg-white rounded-lg border border-slate-200/90 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h3 className="text-xs font-black text-slate-900">제휴 카드 선택 (옵션)</h3>
          <label className="flex items-center space-x-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={filter.useSpecialOptions}
              onChange={(e) => updateFilter('useSpecialOptions', e.target.checked)}
              className="w-4 h-4 text-[#00D2B8] rounded"
            />
            <span className="text-xs font-bold text-[#00A896]">옵션 {filter.useSpecialOptions ? '열림' : '닫힘'}</span>
          </label>
        </div>

        {filter.useSpecialOptions && (
          <div className="space-y-3 pt-1">
            <select
              value={
                filter.selectedSpecialCard.includes('NORI2')
                  ? 'KB_NORI2_CARD'
                  : filter.selectedSpecialCard
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === 'KB_NORI2_CARD') {
                  const targetCard =
                    filter.osType === 'IOS'
                      ? 'KB_NORI2_APPSTORE'
                      : 'KB_NORI2_PLAYSTORE';
                  updateFilter('selectedSpecialCard', targetCard);
                } else {
                  updateFilter('selectedSpecialCard', val);
                }
              }}
              className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-medium text-slate-800"
            >
              {(() => {
                const filtered = dynamicCardOptions.filter(
                  (card) =>
                    card.value !== 'SAMSUNG_PAY' &&
                    card.value !== 'SAMSUNG_PAYMENT' &&
                    card.label.toUpperCase() !== 'SAMSUNG PAY' &&
                    card.label !== '삼성페이' &&
                    !card.value.includes('NORI2')
                );

                const hasNori2 = dynamicCardOptions.some((card) =>
                  card.value.includes('NORI2')
                );

                if (hasNori2) {
                  filtered.splice(2, 0, {
                    value: 'KB_NORI2_CARD',
                    label: 'KB국민 노리2 체크카드 (구글플레이/앱스토어)',
                  });
                }

                return filtered.map((card, idx) => (
                  <option key={`${card.value}-${idx}`} value={card.value}>
                    {card.label}
                  </option>
                ));
              })()}
            </select>

            {filter.selectedSpecialCard !== 'NONE' && (
              <div className="p-2.5 bg-slate-50 rounded border border-slate-200">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filter.hasPrevSpend}
                    onChange={(e) => updateFilter('hasPrevSpend', e.target.checked)}
                    className="w-4 h-4 text-[#00D2B8] rounded"
                  />
                  <span className="text-xs font-bold text-slate-700">카드 전월 실적 충족</span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 저장 버튼 옵션 */}
      {showSaveButton && (
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onSave}
            className="px-6 py-2.5 bg-gradient-to-r from-[#00D2B8] to-[#00F5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded shadow-xs transition-all cursor-pointer"
          >
            필터 설정 저장
          </button>
        </div>
      )}
    </div>
  );
}