import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// 타입은 'import type'으로 명시 
import type { OsType } from '../constants/searchOptions';
// 일반 상수는 'import'로 분리
import {
  ANDROID_STORE_OPTIONS,
  CARRIER_OPTIONS,
  PAY_OPTIONS,
  VOUCHER_OPTIONS,
  GOOGLE_PLAY_TIERS,
  GALAXY_STORE_TIERS,
  SPECIAL_CARD_OPTIONS,
} from '../constants/searchOptions';

export default function SearchPage() {
  const navigate = useNavigate();

  // 로그인 상태 제어
  const [isLoggedIn] = useState(true);

  // 기본 상태값 (초기 접속 시 전체 미선택 상태)
  const [gameTitle, setGameTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [osType, setOsType] = useState<OsType>('ANDROID');
  const [androidStores, setAndroidStores] = useState<string[]>([]);

  // 보너스 토글 옵션
  const [useGameBenefits, setUseGameBenefits] = useState(false);
  const [hasPreApplied, setHasPreApplied] = useState(false);
  const [isFirstPayment, setIsFirstPayment] = useState(false);

  // 멤버십 등급 및 PC 버전
  const [googlePlayTier, setGooglePlayTier] = useState('GOLD');
  const [galaxyStoreTier, setGalaxyStoreTier] = useState('STANDARD');
  const [isPcVersion, setIsPcVersion] = useState(false);

  // 구독 관련 맥락별 옵션 상태
  const [useTMembership, setUseTMembership] = useState(false);
  const [useNaverMembership, setUseNaverMembership] = useState(false);
  const [useTossPrime, setUseTossPrime] = useState(false);

  // 결제 수단 사용 여부 & 선택 항목
  const [useCarriers, setUseCarriers] = useState(false);
  const [carriers, setCarriers] = useState<string[]>([]);

  const [usePays, setUsePays] = useState(false);
  const [pays, setPays] = useState<string[]>([]);

  const [useVoucherBypasses, setUseVoucherBypasses] = useState(false);
  const [voucherBypasses, setVoucherBypasses] = useState<string[]>([]);

  // 카드 옵션 전용
  const [useSpecialOptions, setUseSpecialOptions] = useState(false);
  const [selectedSpecialCard, setSelectedSpecialCard] = useState('NONE');
  const [hasPrevSpend, setHasPrevSpend] = useState(false);

  const popularGames = [
    { name: '쿠키런: 킹덤' },
    { name: '리니지M' },
    { name: '원신' },
    { name: '붕괴: 스타레일' },
    { name: '오딘: 발할라 라이징' },
    { name: '나 혼자만 레벨업:어라이즈' },
    { name: 'AFK : 새로운 여정' },
    { name: 'FC 모바일' },
  ];

  const handleOsChange = (targetOs: OsType) => {
    setOsType(targetOs);
    if (targetOs === 'IOS') {
      setAndroidStores([]);
      setIsPcVersion(false);
      setUseTMembership(false);
    }
  };

  const handleToggleArrayItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev: string[]) => (prev.includes(item) ? prev.filter((i: string) => i !== item) : [...prev, item]));
  };

  // 모든 결제수단 선택 일괄 적용 (유료 플러스/멤버십/프라임은 제외)
  const handleSelectAllPaymentMethods = () => {
    if (osType === 'IOS') {
      setAndroidStores([]);
    } else {
      setAndroidStores([...ANDROID_STORE_OPTIONS]);
    }

    setUseGameBenefits(true);
    setHasPreApplied(false);
    setIsFirstPayment(true);

    setUseCarriers(false);
    setCarriers([]);

    setUsePays(true);
    setPays([...PAY_OPTIONS]);

    setUseVoucherBypasses(true);
    setVoucherBypasses([...VOUCHER_OPTIONS]);

    // 유료 플러스 및 멤버십 구독 옵션은 미포함(false) 설정
    setUseTMembership(false);
    setUseNaverMembership(false);
    setUseTossPrime(false);

    setSelectedSpecialCard('NONE');
    setHasPrevSpend(false);
  };

  const handleSaveFilterSettings = () => {
    alert('현재 설정하신 결제 필터 조건이 회원 계정에 성공적으로 저장되었습니다.');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    if (!gameTitle.trim()) {
      alert('게임을 선택하거나 입력해 주세요.');
      return;
    }

    if (amount === '' || Number(amount) <= 0) {
      alert('결제 예정 금액을 1원 이상 입력해 주세요.');
      return;
    }

    if (osType === 'ANDROID' && androidStores.length === 0) {
      alert('이용할 스토어를 최소 1개 이상 선택해 주세요.');
      return;
    }

    const totalSelectedPayments =
      (useCarriers ? carriers.length : 0) +
      (usePays ? pays.length : 0) +
      (useVoucherBypasses ? voucherBypasses.length : 0);

    if (totalSelectedPayments === 0) {
      alert('보유 결제 수단을 최소 1개 이상 선택해 주세요.');
      return;
    }

    const activeSubscriptions: string[] = [];
    if (useTMembership && osType === 'ANDROID') activeSubscriptions.push('T멤버십 (원스토어 10% 할인/적립)');
    if (useNaverMembership) activeSubscriptions.push('네이버플러스 멤버십 (+4% 적립)');
    if (useTossPrime) activeSubscriptions.push('토스프라임 (+4% 적립)');

    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(amount),
      os: osType,
      stores: osType === 'IOS' ? '앱스토어' : androidStores.join(','),
      useGameBenefits: String(useGameBenefits),
      hasPreApplied: String(hasPreApplied),
      isFirstPayment: String(isFirstPayment),
      googleTier: googlePlayTier,
      galaxyTier: galaxyStoreTier,
      carriers: useCarriers ? carriers.join(',') : '',
      pays: usePays ? pays.join(',') : '',
      vouchers: useVoucherBypasses ? voucherBypasses.join(',') : '',
      useSpecialOptions: String(useSpecialOptions),
      specialCard: selectedSpecialCard,
      subscriptions: activeSubscriptions.join(','),
      hasPrevSpend: String(hasPrevSpend),
      isPcVersion: String(isPcVersion),
    });

    navigate(`/search-result?${params.toString()}`);
  };

  const isGoogleSelected = osType === 'ANDROID' && androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = osType === 'ANDROID' && androidStores.includes('갤럭시 스토어');
  const isOneStoreSelected = osType === 'ANDROID' && androidStores.includes('원스토어');

  const isNaverPaySelected = usePays && pays.includes('네이버페이');
  const isTossPaySelected = usePays && pays.includes('토스페이');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 3열 고정 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 4열] 스티키 제어 카드 */}
        <aside className="lg:col-span-4 h-full">
          <form
            onSubmit={handleSearch}
            className="sticky top-28 bg-white rounded-xl border-2 border-cyan-500 p-5 shadow-lg space-y-6 ring-4 ring-cyan-500/10 min-h-[640px] flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900">
                  게임 및 금액 설정
                </h3>
                <span className="text-[11px] font-extrabold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-200">
                  1단계
                </span>
              </div>

              {/* 게임 입력 */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>게임 이름</span>
                  <span className="text-[10px] text-cyan-600 font-extrabold">* 필수</span>
                </label>
                <input
                  type="text"
                  value={gameTitle}
                  onChange={(e) => setGameTitle(e.target.value)}
                  placeholder="게임을 입력해 보세요 (예: 쿠키런: 킹덤)"
                  className="w-full px-4 py-3 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-bold text-slate-900 transition-all shadow-inner"
                />

                {/* 인기 추천 태그 */}
                <div className="pt-1 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400">자주 찾는 게임:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {popularGames.map((g: { name: string }) => (
                      <button
                        key={g.name}
                        type="button"
                        onClick={() => setGameTitle(g.name)}
                        className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          gameTitle === g.name
                            ? 'bg-cyan-500 text-white border-cyan-500 font-black shadow-sm'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 결제 금액 입력 */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>결제 예정 금액 (원)</span>
                  <span className="text-[10px] text-cyan-600 font-extrabold">* 필수</span>
                </label>
                <div className="relative flex items-center">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-4 py-3 text-sm rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-black text-slate-900 transition-all pr-8 shadow-inner"
                  />
                  <span className="absolute right-4 text-xs font-bold text-slate-400">원</span>
                </div>

                <div className="grid grid-cols-7 gap-1 pt-1">
                  {[1000, 5000, 10000, 30000, 50000, 100000].map((amt: number) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount((prev) => (typeof prev === 'number' ? prev + amt : amt))}
                      className="py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[9.5px] font-bold transition-all cursor-pointer border border-slate-200 text-center whitespace-nowrap px-0.5"
                    >
                      +{amt.toLocaleString()}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAmount(0)}
                    className="py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[9.5px] font-bold transition-all cursor-pointer border border-rose-200 text-center whitespace-nowrap px-0.5"
                  >
                    초기화
                  </button>
                </div>
              </div>
            </div>

            {/* 최저가 연산 버튼 */}
            <div className="pt-6 mt-auto">
              <button
                type="submit"
                className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-sm rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>최저가 연산하기</span>
              </button>
            </div>
          </form>
        </aside>

        {/* [중앙 6열] 필터 옵션들 */}
        <div className="lg:col-span-6 space-y-5">
          <header className="space-y-1.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-extrabold text-xs rounded border border-cyan-200">
                2단계 필터
              </span>

              <div className="flex items-center space-x-2">
                {/* 버튼 명칭 변경: 모든 결제수단 선택 */}
                <button
                  type="button"
                  onClick={handleSelectAllPaymentMethods}
                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-600 text-white font-extrabold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                >
                  모든 결제수단 선택
                </button>

                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={handleSaveFilterSettings}
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer"
                  >
                    필터 세팅 저장
                  </button>
                )}
              </div>
            </div>

            <h2 className="text-xl font-black text-slate-900">결제 조건 필터링</h2>
            <p className="text-xs text-slate-500">
              보유 중인 스토어, 결제수단, 구독 서비스 조건을 체크해 최저가를 계산하세요.
            </p>
          </header>

          {/* 2-1. OS & 스토어 선택 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <span>스마트폰 OS 및 이용 스토어 선택</span>
              <span className="text-[10px] text-cyan-600 font-extrabold">* 필수</span>
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['ANDROID', 'IOS'] as OsType[]).map((os: OsType) => (
                  <button
                    key={os}
                    type="button"
                    onClick={() => handleOsChange(os)}
                    className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer text-center ${
                      osType === os
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {os === 'ANDROID' ? '안드로이드' : 'iOS (앱스토어)'}
                  </button>
                ))}
              </div>

              {/* 안드로이드 전용 스토어 선택 상자 */}
              {osType === 'ANDROID' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-fadeIn">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    이용 가능한 스토어 선택 (최소 1개 선택 필수)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {ANDROID_STORE_OPTIONS.map((store: string) => {
                      const selected = androidStores.includes(store);
                      return (
                        <button
                          type="button"
                          key={store}
                          onClick={() => handleToggleArrayItem(setAndroidStores, store)}
                          className={`px-2.5 py-1 rounded text-xs font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {selected ? '✓ ' : '+ '}{store}
                        </button>
                      );
                    })}
                  </div>

                  {isOneStoreSelected && (
                    <div className="pt-2 border-t border-slate-200 animate-fadeIn">
                      <div className="flex items-center space-x-2 p-2 bg-white rounded border border-slate-200">
                        <input
                          type="checkbox"
                          id="useTMembershipToggle"
                          checked={useTMembership}
                          onChange={(e) => setUseTMembership(e.target.checked)}
                          className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                        />
                        <label htmlFor="useTMembershipToggle" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                          T멤버십 이용 중 (원스토어 10% 할인/적립 가능)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 애플(iOS) 전용 스토어 상자 */}
              {osType === 'IOS' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2 animate-fadeIn">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    이용 가능한 스토어 선택
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      className="px-3 py-1 rounded text-xs font-bold border transition-all bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-default"
                    >
                      ✓ 앱스토어
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 스토어 등급 및 구글 PC 버전 선택 영역 */}
            {(isGoogleSelected || isGalaxySelected) && (
              <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-200/60 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {isGoogleSelected && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-cyan-900 block">
                        Google Play Points 등급
                      </label>
                      <select
                        value={googlePlayTier}
                        onChange={(e) => setGooglePlayTier(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-cyan-300 bg-white font-medium text-slate-800 focus:outline-none"
                      >
                        {GOOGLE_PLAY_TIERS.map((tier: { label: string; value: string }) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {isGalaxySelected && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-cyan-900 block">
                        Galaxy Store 멤버십 등급
                      </label>
                      <select
                        value={galaxyStoreTier}
                        onChange={(e) => setGalaxyStoreTier(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs rounded border border-cyan-300 bg-white font-medium text-slate-800 focus:outline-none"
                      >
                        {GALAXY_STORE_TIERS.map((tier: { label: string; value: string }) => (
                          <option key={tier.value} value={tier.value}>
                            {tier.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isGoogleSelected && (
                  <div className="pt-2 border-t border-cyan-200/80 animate-fadeIn">
                    <div className="flex items-center space-x-2 p-2 bg-white rounded border border-cyan-200">
                      <input
                        type="checkbox"
                        id="isPcVersion"
                        checked={isPcVersion}
                        onChange={(e) => setIsPcVersion(e.target.checked)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                      />
                      <label htmlFor="isPcVersion" className="text-xs font-bold text-slate-800 cursor-pointer select-none">
                        PC 버전 (Google Play Games) 접속 결제 대상
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2-2. 보너스 혜택 옵션 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2.5">
              보너스 이벤트 적용 여부
            </h3>

            <div className="space-y-2">
              <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <input
                  type="checkbox"
                  id="useGameBenefits"
                  checked={useGameBenefits}
                  onChange={(e) => setUseGameBenefits(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                />
                <label htmlFor="useGameBenefits" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  선택한 게임 전용 혜택 포함
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <input
                  type="checkbox"
                  id="hasPreApplied"
                  checked={hasPreApplied}
                  onChange={(e) => setHasPreApplied(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                />
                <label htmlFor="hasPreApplied" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  사전 응모 완료 혜택 포함
                </label>
              </div>

              <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                <input
                  type="checkbox"
                  id="firstPayment"
                  checked={isFirstPayment}
                  onChange={(e) => setIsFirstPayment(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                />
                <label htmlFor="firstPayment" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  첫 결제 이벤트 대상
                </label>
              </div>
            </div>
          </div>

          {/* 2-3. 보유 결제 수단 필터 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 border-b border-slate-100 pb-2.5 flex items-center justify-between">
              <span>보유 결제 수단 필터</span>
              <span className="text-[10px] text-cyan-600 font-extrabold">* 최소 1개 필수</span>
            </h3>

            <div className="space-y-4">
              {/* 통신사 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="useCarriersToggle"
                    checked={useCarriers}
                    onChange={(e) => setUseCarriers(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="useCarriersToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    통신사 할인 사용하기
                  </label>
                </div>

                <div
                  className={`flex flex-wrap gap-1.5 pt-1 transition-all ${
                    useCarriers ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  {CARRIER_OPTIONS.map((c: string) => {
                    const selected = carriers.includes(c);
                    return (
                      <button
                        type="button"
                        key={c}
                        disabled={!useCarriers}
                        onClick={() => handleToggleArrayItem(setCarriers, c)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                          selected && useCarriers
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{c}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 간편결제 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="usePaysToggle"
                    checked={usePays}
                    onChange={(e) => setUsePays(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="usePaysToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    사용 간편결제 (페이) 선택
                  </label>
                </div>

                <div
                  className={`flex flex-wrap gap-1.5 pt-1 transition-all ${
                    usePays ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  {PAY_OPTIONS.map((p: string) => {
                    const selected = pays.includes(p);
                    return (
                      <button
                        type="button"
                        key={p}
                        disabled={!usePays}
                        onClick={() => handleToggleArrayItem(setPays, p)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                          selected && usePays
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer'
                        }`}
                      >
                        {selected ? '✓ ' : '+ '}{p}
                      </button>
                    );
                  })}
                </div>

                {isNaverPaySelected && (
                  <div className="pt-2 pl-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 p-2 bg-emerald-50 rounded border border-emerald-200">
                      <input
                        type="checkbox"
                        id="useNaverMembershipToggle"
                        checked={useNaverMembership}
                        onChange={(e) => setUseNaverMembership(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 cursor-pointer shrink-0"
                      />
                      <label htmlFor="useNaverMembershipToggle" className="text-xs font-bold text-emerald-800 cursor-pointer select-none">
                        네이버플러스 멤버십 가입 중 (+4% 추가 적립)
                      </label>
                    </div>
                  </div>
                )}

                {isTossPaySelected && (
                  <div className="pt-2 pl-2 animate-fadeIn">
                    <div className="flex items-center space-x-2 p-2 bg-blue-50 rounded border border-blue-200">
                      <input
                        type="checkbox"
                        id="useTossPrimeToggle"
                        checked={useTossPrime}
                        onChange={(e) => setUseTossPrime(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 cursor-pointer shrink-0"
                      />
                      <label htmlFor="useTossPrimeToggle" className="text-xs font-bold text-blue-800 cursor-pointer select-none">
                        토스프라임 구독 중 (+4% 추가 적립)
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* 문화상품권 우회 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 p-2.5 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="useVoucherToggle"
                    checked={useVoucherBypasses}
                    onChange={(e) => setUseVoucherBypasses(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="useVoucherToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    문화상품권 우회 충전 할인
                  </label>
                </div>

                <div
                  className={`flex flex-wrap gap-1.5 pt-1 transition-all ${
                    useVoucherBypasses ? 'opacity-100' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  {VOUCHER_OPTIONS.map((v: string) => {
                    const selected = voucherBypasses.includes(v);
                    return (
                      <button
                        type="button"
                        key={v}
                        disabled={!useVoucherBypasses}
                        onClick={() => handleToggleArrayItem(setVoucherBypasses, v)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all ${
                          selected && useVoucherBypasses
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm cursor-pointer'
                            : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100 cursor-pointer'
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

          {/* 2-4. 카드 선택 (옵션) */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800">
                카드 선택 (옵션)
              </h3>
              
              <div className="flex items-center space-x-1.5">
                <input
                  type="checkbox"
                  id="useSpecialToggle"
                  checked={useSpecialOptions}
                  onChange={(e) => setUseSpecialOptions(e.target.checked)}
                  className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                />
                <label htmlFor="useSpecialToggle" className="text-xs font-bold text-cyan-700 cursor-pointer select-none">
                  옵션 {useSpecialOptions ? '열림' : '닫힘'}
                </label>
              </div>
            </div>

            {useSpecialOptions && (
              <div className="space-y-3 pt-1 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-700 block">제휴 카드 선택</label>
                  <select
                    value={selectedSpecialCard}
                    onChange={(e) => setSelectedSpecialCard(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded border border-slate-300 bg-white font-medium text-slate-800 focus:outline-none"
                  >
                    {SPECIAL_CARD_OPTIONS.map((card: { label: string; value: string }) => (
                      <option key={card.value} value={card.value}>
                        {card.label}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedSpecialCard !== 'NONE' && (
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 animate-fadeIn">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="hasPrevSpend"
                        checked={hasPrevSpend}
                        onChange={(e) => setHasPrevSpend(e.target.checked)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                      />
                      <label htmlFor="hasPrevSpend" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        카드 전월 실적 충족 (20만~50만원)
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 로그인 회원 전용 필터 세팅 저장 버튼 */}
          {isLoggedIn && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveFilterSettings}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                <span>내 결제 필터 세팅 저장하기 (로그인 회원 전용)</span>
              </button>
            </div>
          )}

        </div>

        {/* [우측 2열] 협업 광고 배너 */}
        <aside className="lg:col-span-2 h-full">
          <div className="sticky top-28 h-[650px] w-full p-5 bg-slate-100 rounded-xl border border-slate-200/80 flex flex-col items-center justify-between text-center shadow-inner">
            <span className="px-2.5 py-1 bg-slate-800 text-white font-bold text-[9px] rounded tracking-wider">
              ADVERTISEMENT
            </span>

            <div className="space-y-4 my-auto">
              <div className="w-14 h-14 bg-white rounded-xl flex items-center justify-center text-2xl font-black text-slate-400 shadow-sm border border-slate-200 mx-auto">
                AD
              </div>
              <div className="space-y-1.5">
                <h3 className="font-extrabold text-slate-800 text-sm">
                  협업 제휴 광고
                </h3>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-[130px] mx-auto">
                  실시간 최저가 검색 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                최저가 검색 배너 입점 및 제휴 문의 환영
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