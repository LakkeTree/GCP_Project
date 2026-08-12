import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useFilterState } from '../hooks/useFilterState';
import type { OsType } from '../constants/searchOptions';
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  GOOGLE_PLAY_TIERS,
  GALAXY_STORE_TIERS,
  SPECIAL_CARD_OPTIONS,
} from '../constants/searchOptions';

export default function MyProfilePage() {
  const [searchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as 'profile' | 'security' | 'filter') || 'profile';
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'filter'>(initialTab);

  // URL 파라미터 변경 감지 (헤더 메뉴 클릭 대응)
  useEffect(() => {
    const tabParam = searchParams.get('tab') as 'profile' | 'security' | 'filter';
    if (tabParam) setActiveTab(tabParam);
  }, [searchParams]);

  // 2. 공통 필터 훅 연결
// 2. 공통 필터 훅 연결 (즐겨찾기 함수 추가 구출)
  const {
  filter,
  setFilter,
  saveFilterSettings,
  addFavoriteGame,
  removeFavoriteGame,
  selectAll,
  deselectAll,
  toggleArrayItem,
  } = useFilterState();
  
  // 3. 즐겨찾기할 게임 목록 및 검색 상태
  const [gameSearchInput, setGameSearchInput] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  // 임시 게임 DB
  const mockGameDatabase = [
    '쿠키런: 킹덤', '원신', '붕괴: 스타레일', '리니지M', '오딘: 발할라 라이징',
    '나 혼자만 레벨업:어라이즈', 'AFK: 새로운 여정', 'FC 모바일', '승리의 여신: 니케', '메이플스토리M'
  ];

  const searchResults = gameSearchInput.trim()
  ? mockGameDatabase.filter(game => 
      game.toLowerCase().includes(gameSearchInput.toLowerCase()) && !filter.favoriteGames.includes(game)
    )
  : [];

  // 4. 비밀번호 변경 상태
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 필터 개별 항목 값 변경 헬퍼 함수
  const updateFilter = <K extends keyof typeof filter>(key: K, value: typeof filter[K]) => {
    setFilter((prev) => ({ ...prev, [key]: value }));
  };

  // 즐겨찾기 게임 추가/삭제
  // 공통 훅(useFilterState)과 연결된 즐겨찾기 게임 추가/삭제
  const handleSelectGame = (gameName: string) => {
    addFavoriteGame(gameName);
    setGameSearchInput('');
    setIsSearchFocused(false);
  };

  const handleRemoveGame = (gameToRemove: string) => {
    removeFavoriteGame(gameToRemove);
  };
  // 비밀번호 변경 처리
  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.currentPassword) {
      alert('현재 비밀번호를 입력해주세요.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('새 비밀번호와 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    alert('비밀번호가 성공적으로 변경되었습니다!');
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const isGoogleSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = filter.osType === 'ANDROID' && filter.androidStores.includes('갤럭시 스토어');
  const isOneStoreSelected = filter.osType === 'ANDROID' && filter.androidStores.includes('원스토어');
  const isNaverPaySelected = filter.usePays && filter.pays.includes('네이버페이');
  const isTossPaySelected = filter.usePays && filter.pays.includes('토스페이');

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
      {/* 상단 헤더 */}
      <div className="mb-8 border-b border-slate-200 pb-5">
        <h1 className="text-2xl font-black text-slate-800">⚙️ 계정 및 기본 설정</h1>
        <p className="text-sm text-slate-500 mt-1">
          개인 정보, 비밀번호 변경 및 최저가 자동 검색 기본 필터를 설정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* 좌측 구글 스타일 사이드바 */}
        <aside className="md:col-span-1 space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">👤</span>
            <span>개인 정보 & 즐겨찾기</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === 'security'
                ? 'bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">🔒</span>
            <span>계정 보안 & 비밀번호</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('filter')}
            className={`w-full text-left px-4 py-3 rounded-xl font-bold text-sm flex items-center gap-3 transition-all cursor-pointer ${
              activeTab === 'filter'
                ? 'bg-cyan-50 text-cyan-600 border border-cyan-200 shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <span className="text-base">🔖</span>
            <span>기본 검색 필터링</span>
          </button>
        </aside>

        {/* 우측 콘텐츠 영역 */}
        <main className="md:col-span-3">
          
          {/* TAB 1: 개인 정보 & 즐겨찾기할 게임 */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3">
                👤 개인 정보 및 즐겨찾기 게임
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">이메일 계정</label>
                  <input
                    type="text"
                    disabled
                    value="dev_user@example.com"
                    className="w-full px-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 text-sm font-medium cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">닉네임</label>
                  <input
                    type="text"
                    defaultValue="dev_user"
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-sm font-medium focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              {/* 즐겨찾기 게임 영역 */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <label className="block text-xs font-bold text-slate-600">
                  ⭐ 즐겨찾기할 게임 <span className="text-slate-400 font-normal">(검색창의 '자주 찾는 게임' 태그에 자동으로 추가됩니다)</span>
                </label>

                <div className="flex flex-wrap gap-2 items-center min-h-[46px] p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  {filter.favoriteGames.map((game) => (
                    <span key={game} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-cyan-200 text-cyan-700 font-bold text-xs rounded-lg shadow-sm">
                      <span>{game}</span>
                      <button type="button" onClick={() => handleRemoveGame(game)} className="hover:text-red-500 font-bold ml-1 text-slate-400 cursor-pointer">✕</button>
                    </span>
                  ))}
                  {filter.favoriteGames.length === 0 && (
                    <span className="text-xs text-slate-400 px-2">즐겨찾기한 게임이 없습니다.</span>
                  )}
                </div>

                <div className="relative max-w-md">
                  <input
                    type="text"
                    placeholder="게임 이름을 대충 입력해 보세요 (예: 쿠키, 원신, 리니지)"
                    value={gameSearchInput}
                    onChange={(e) => {
                      setGameSearchInput(e.target.value);
                      setIsSearchFocused(true);
                    }}
                    onFocus={() => setIsSearchFocused(true)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-cyan-500"
                  />

                  {isSearchFocused && searchResults.length > 0 && (
                    <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 py-1">
                      {searchResults.map((game) => (
                        <button
                          key={game}
                          type="button"
                          onClick={() => handleSelectGame(game)}
                          className="w-full text-left px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-cyan-50 hover:text-cyan-600 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>{game}</span>
                          <span className="text-[10px] text-cyan-500 font-bold">+ 즐겨찾기 추가</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button type="button" onClick={() => alert('설정이 저장되었습니다!')} className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm">
                  저장하기
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: 계정 보안 & 비밀번호 변경 */}
          {activeTab === 'security' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
              <h2 className="text-lg font-black text-slate-800 border-b border-slate-100 pb-3">
                🔒 계정 보안 및 비밀번호 변경
              </h2>

              <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">현재 비밀번호</label>
                  <input
                    type="password"
                    placeholder="현재 비밀번호를 입력하세요"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">새 비밀번호</label>
                  <input
                    type="password"
                    placeholder="영문, 숫자 포함 8자리 이상"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">새 비밀번호 확인</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호를 다시 입력하세요"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="pt-4 flex justify-end border-t border-slate-100">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm"
                  >
                    비밀번호 변경하기
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: 통합 기본 검색 조건 필터링 */}
          {activeTab === 'filter' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-lg font-black text-slate-800">🔖 기본 검색 조건 필터링</h2>
                <p className="text-xs text-slate-500 mt-1">
                  검색을 수행할 때 매번 선택할 필요 없이, 아래 설정한 보유 수단 조건이 자동으로 적용됩니다.
                </p>
              </div>

            {/* ⚠️ 미저장 이탈 경고 안내 문구 */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center gap-2">
                <span className="text-sm">⚠️</span>
                <span>옵션을 변경한 후 하단의 <strong>[기본 필터 설정 저장하기]</strong> 버튼을 누르지 않고 페이지를 벗어나면 변경 사항이 저장되지 않습니다.</span>
              </div>

              {/* ⚡ 한 번에 필터 설정 바 */}
              <div className="flex items-center justify-between bg-slate-100/90 p-3.5 rounded-xl border border-slate-200">
                <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>한 번에 필터 설정:</span>
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-3.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    모든 결제수단 선택
                  </button>
                  <button
                    type="button"
                    onClick={deselectAll}
                    className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-lg border border-slate-300 transition-all cursor-pointer"
                  >
                    모든 선택 취소
                  </button>
                </div>
              </div>

              {/* 1. 스마트폰 OS 및 이용 가능 스토어 선택 */}
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">기본 스마트폰 OS</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['ANDROID', 'IOS'] as OsType[]).map((os) => (
                      <button
                        key={os}
                        type="button"
                        onClick={() => updateFilter('osType', os)}
                        className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer ${
                          filter.osType === os
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {os === 'ANDROID' ? '안드로이드' : 'iOS'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* iOS 전용 필수 앱스토어 선택 상자 */}
                {filter.osType === 'IOS' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">
                      이용 가능한 스토어 선택 <span className="text-cyan-600 font-extrabold">* 필수</span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-all bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-default"
                      >
                        ✓ 앱스토어
                      </button>
                    </div>
                  </div>
                )}

                {/* 안드로이드 전용 스토어 선택 */}
                {filter.osType === 'ANDROID' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-700 block">
                      이용 가능한 스토어 선택
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ANDROID_STORE_OPTIONS.map((store) => {
                        const selected = filter.androidStores.includes(store);
                        return (
                          <button
                            type="button"
                            key={store}
                            onClick={() => toggleArrayItem('androidStores', store)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                              selected
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                                : 'bg-white text-slate-500 border-slate-200'
                            }`}
                          >
                            {selected ? '✓ ' : '+ '}{store}
                          </button>
                        );
                      })}
                    </div>

                    {/* T멤버십 가입 여부 */}
                    {isOneStoreSelected && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.useTMembership}
                            onChange={(e) => updateFilter('useTMembership', e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-700">T멤버십 이용 중 (원스토어 10% 할인/적립 가능)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* 구글/갤럭시 스토어 멤버십 등급 설정 */}
                {(isGoogleSelected || isGalaxySelected) && (
                  <div className="p-3 bg-cyan-50/50 rounded-xl border border-cyan-200 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {isGoogleSelected && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-cyan-900 block">Google Play Points 등급</label>
                          <select
                            value={filter.googlePlayTier}
                            onChange={(e) => updateFilter('googlePlayTier', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-cyan-300 bg-white font-medium text-slate-800"
                          >
                            {GOOGLE_PLAY_TIERS.map((tier) => (
                              <option key={tier.value} value={tier.value}>{tier.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {isGalaxySelected && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-cyan-900 block">Galaxy Store 멤버십 등급</label>
                          <select
                            value={filter.galaxyStoreTier}
                            onChange={(e) => updateFilter('galaxyStoreTier', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-cyan-300 bg-white font-medium text-slate-800"
                          >
                            {GALAXY_STORE_TIERS.map((tier) => (
                              <option key={tier.value} value={tier.value}>{tier.label}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {isGoogleSelected && (
                      <div className="pt-2 border-t border-cyan-200">
                        <label className="flex items-center space-x-2 p-2 bg-white rounded-lg border border-cyan-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.isPcVersion}
                            onChange={(e) => updateFilter('isPcVersion', e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-800">PC 버전 (Google Play Games) 접속 결제 대상</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. 보너스 이벤트 적용 여부 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">기본 보너스 이벤트 옵션</label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useGameBenefits}
                      onChange={(e) => updateFilter('useGameBenefits', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">🎮 선택한 게임 전용 혜택 포함</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.hasPreApplied}
                      onChange={(e) => updateFilter('hasPreApplied', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">📝 사전 응모 완료 혜택 포함</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.isFirstPayment}
                      onChange={(e) => updateFilter('isFirstPayment', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-700">🎉 첫 결제 이벤트 대상</span>
                  </label>
                </div>
              </div>

              {/* 3. 보유 결제 수단 필터 & 마일리지/멤버십 추가 적립 옵션 */}
              <div className="space-y-4 pt-2 border-t border-slate-100">
                <label className="block text-xs font-bold text-slate-700">보유 결제 수단 & 마일리지/구독 멤버십</label>

                {/* 통신사 */}
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useCarriers}
                      onChange={(e) => updateFilter('useCarriers', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">통신사 할인 사용하기</span>
                  </label>
                  <div className={`flex flex-wrap gap-1.5 pl-1 ${filter.useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                    {CARRIER_OPTIONS.map((c) => {
                      const selected = filter.carriers.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={!filter.useCarriers}
                          onClick={() => toggleArrayItem('carriers', c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                        >
                          {selected ? '✓ ' : '+ '}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 간편결제 + 멤버십 마일리지 적립 옵션 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.usePays}
                      onChange={(e) => updateFilter('usePays', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
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
                          onClick={() => toggleArrayItem('pays', p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                        >
                          {selected ? '✓ ' : '+ '}{p}
                        </button>
                      );
                    })}
                  </div>

                  {/* 네이버플러스 멤버십 마일리지 추가 적립 */}
                  {isNaverPaySelected && (
                    <div className="pt-2 pl-2">
                      <label className="flex items-center space-x-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.useNaverMembership}
                          onChange={(e) => updateFilter('useNaverMembership', e.target.checked)}
                          className="w-4 h-4 text-emerald-600 rounded"
                        />
                        <span className="text-xs font-bold text-emerald-800">네이버플러스 멤버십 가입 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}

                  {/* 토스프라임 마일리지 추가 적립 */}
                  {isTossPaySelected && (
                    <div className="pt-2 pl-2">
                      <label className="flex items-center space-x-2 p-2 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={filter.useTossPrime}
                          onChange={(e) => updateFilter('useTossPrime', e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded"
                        />
                        <span className="text-xs font-bold text-blue-800">토스프라임 구독 중 (+4% 추가 적립)</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* 문화상품권 우회 충전 */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useVoucherBypasses}
                      onChange={(e) => updateFilter('useVoucherBypasses', e.target.checked)}
                      className="w-4 h-4 text-cyan-600 rounded"
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
                          onClick={() => toggleArrayItem('voucherBypasses', v)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${selected ? 'bg-cyan-500 text-white border-cyan-500' : 'bg-slate-50 text-slate-500'}`}
                        >
                          {selected ? '✓ ' : '+ '}{v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* 4. 제휴 카드 선택 (옵션) */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">제휴 카드 선택 (옵션)</label>
                  <label className="flex items-center space-x-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filter.useSpecialOptions}
                      onChange={(e) => updateFilter('useSpecialOptions', e.target.checked)}
                      className="w-3.5 h-3.5 text-cyan-600 rounded"
                    />
                    <span className="text-xs font-bold text-cyan-700">옵션 {filter.useSpecialOptions ? '열림' : '닫힘'}</span>
                  </label>
                </div>

                {filter.useSpecialOptions && (
                  <div className="space-y-3 pt-1">
                    <select
                      value={filter.selectedSpecialCard}
                      onChange={(e) => updateFilter('selectedSpecialCard', e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium text-slate-800"
                    >
                      {SPECIAL_CARD_OPTIONS.map((card) => (
                        <option key={card.value} value={card.value}>{card.label}</option>
                      ))}
                    </select>

                    {filter.selectedSpecialCard !== 'NONE' && (
                      <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.hasPrevSpend}
                            onChange={(e) => updateFilter('hasPrevSpend', e.target.checked)}
                            className="w-4 h-4 text-cyan-600 rounded"
                          />
                          <span className="text-xs font-bold text-slate-700">카드 전월 실적 충족 (20만~50만원)</span>
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 필터 저장 버튼 */}
              <div className="pt-4 flex justify-end border-t border-slate-100">
                <button
                  type="button"
                  onClick={saveFilterSettings}
                  className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-sm rounded-xl cursor-pointer shadow-sm"
                >
                  기본 필터 설정 저장하기
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}