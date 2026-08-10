import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ==========================================
// 1. 단일 파일 내부 상수 및 타입 정의
// ==========================================
export type OsType = 'ANDROID' | 'IOS';

export const ANDROID_STORE_OPTIONS = ['구글 플레이 스토어', '원스토어', '갤럭시 스토어'];
export const CARRIER_OPTIONS = ['SKT', 'KT', 'LGU+'];
export const PAY_OPTIONS = ['네이버페이', '카카오페이', '페이코', '토스페이', '삼성페이', '애플페이'];
export const VOUCHER_OPTIONS = [
  '컬쳐랜드(우회/캐시)',
  '구글 핀번 기프트코드',
  '원스토어 핀번 기프트코드',
  '북앤라이프'
];

export const GOOGLE_PLAY_TIERS = [
  { label: '브론즈 (기본 1.0% 적립)', value: 'BRONZE' },
  { label: '실버 (1.1% 적립)', value: 'SILVER' },
  { label: '골드 (1.3% 적립)', value: 'GOLD' },
  { label: '플래티넘 (1.6% 적립)', value: 'PLATINUM' },
  { label: '다이아몬드 (최상위 2.0% 적립)', value: 'DIAMOND' },
];

export const GALAXY_STORE_TIERS = [
  { label: '기본 / 상시 (0.2% 적립)', value: 'STANDARD' },
  { label: '프레스티지 (1.1% 적립)', value: 'PRESTIGE' },
  { label: '로열블루 (2.1% 적립)', value: 'ROYAL_BLUE' },
];

export const SUBSCRIPTION_OPTIONS = [
  '네이버플러스 멤버십 (+4% 적립)',
  '토스프라임 (+4% 적립)',
  'T멤버십 (원스토어 10% 할인/적립)',
];

export const SPECIAL_CARD_OPTIONS = [
  { label: '선택 안 함 (일반 신용/체크카드 / 기본 결제)', value: 'NONE' },
  { label: '[신한] LineageM 신한카드 (인앱 10% 할인)', value: 'SHINHAN_CARD_LINEAGE' },
  { label: '[신한] LineageM 신한 체크카드 (인앱 5% 할인)', value: 'SHINHAN_CARD_CHECK' },
  { label: '[삼성] 삼성 모바일 플러스 (갤스 5% 할인)', value: 'SAMSUNG_CARD_MOBILE' },
  { label: '[삼성] 삼성 iD SELECT ON (인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_SELECT' },
  { label: '[삼성] 삼성 iD GLOBAL (해외/인앱 50% 할인)', value: 'SAMSUNG_CARD_ID_GLOBAL' },
  { label: '[국민] KB국민 노리2 체크카드 (Play) (10% 할인)', value: 'KB_KOOKMIN_CARD_NORI' },
  { label: '[농협] NH농협 zgm.play (10% 할인)', value: 'NH_NONGHYUP_CARD_PLAY' },
  { label: '[농협] NH농협 zgm.streaming (10% 할인)', value: 'NH_NONGHYUP_CARD_STREAMING' },
  { label: '[하나] 원스토어 1 하나카드 (원스토어 2% 할인)', value: 'HANA_CARD_ONESTORE' },
];

export default function SearchPage() {
  const navigate = useNavigate();

  // 로그인 상태 제어
  const [isLoggedIn] = useState(true);

  // 기본 상태값 (디폴트: 게임명 빈값, 금액 0원)
  const [gameTitle, setGameTitle] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);
  const [osType, setOsType] = useState<OsType>('ANDROID');
  const [androidStores, setAndroidStores] = useState<string[]>([]);

  // 보너스 토글 옵션 (기본 선택 안 함)
  const [useGameBenefits, setUseGameBenefits] = useState(false);
  const [hasPreApplied, setHasPreApplied] = useState(false);
  const [isFirstPayment, setIsFirstPayment] = useState(false);

  // 멤버십 등급
  const [googlePlayTier, setGooglePlayTier] = useState('GOLD');
  const [galaxyStoreTier, setGalaxyStoreTier] = useState('STANDARD');

  // 결제 수단 사용 여부 & 선택된 항목
  const [useCarriers, setUseCarriers] = useState(false);
  const [carriers, setCarriers] = useState<string[]>([]);

  const [usePays, setUsePays] = useState(false);
  const [pays, setPays] = useState<string[]>([]);

  const [useVoucherBypasses, setUseVoucherBypasses] = useState(false);
  const [voucherBypasses, setVoucherBypasses] = useState<string[]>([]);

  // 구독 및 카드 옵션
  const [useSpecialOptions, setUseSpecialOptions] = useState(true);
  const [subscriptions, setSubscriptions] = useState<string[]>([]);
  const [selectedSpecialCard, setSelectedSpecialCard] = useState('NONE');
  const [hasPrevSpend, setHasPrevSpend] = useState(false);
  const [isPcVersion, setIsPcVersion] = useState(false);

  const popularGames = [
    { name: '쿠키런: 킹덤', icon: '🍪' },
    { name: '리니지M', icon: '⚔️' },
    { name: '원신', icon: '✨' },
    { name: '붕괴: 스타레일', icon: '🚀' },
    { name: '오딘: 발할라 라이징', icon: '🛡️' },
    { name: '나 혼자만 레벨업:어라이즈', icon: '🗡️' },
    { name: 'AFK : 새로운 여정', icon: '🏹' },
    { name: 'FC 모바일', icon: '⚽' },
  ];

  const handleToggleArrayItem = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string
  ) => {
    setter((prev: string[]) => (prev.includes(item) ? prev.filter((i: string) => i !== item) : [...prev, item]));
  };

  const handleSaveFilter = () => {
    alert('현재 설정하신 결제 필터 조건이 계정에 저장되었습니다.');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameTitle.trim()) {
      alert('게임을 선택하거나 입력해 주세요.');
      return;
    }
    const payAmt = amount === '' ? 0 : amount;

    const params = new URLSearchParams({
      game: gameTitle,
      amount: String(payAmt),
      os: osType,
      stores: androidStores.join(','),
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
      subscriptions: useSpecialOptions ? subscriptions.join(',') : '',
      hasPrevSpend: String(hasPrevSpend),
      isPcVersion: String(isPcVersion),
    });

    navigate(`/search-result?${params.toString()}`);
  };

  const isGoogleSelected = osType === 'ANDROID' && androidStores.includes('구글 플레이 스토어');
  const isGalaxySelected = osType === 'ANDROID' && androidStores.includes('갤럭시 스토어');

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 3열 레이아웃 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 4열] 스티키 제어 카드 */}
        <aside className="lg:col-span-4 h-full">
          <form
            onSubmit={handleSearch}
            className="sticky top-28 bg-white rounded-xl border-2 border-cyan-400 p-5 shadow-lg space-y-6 ring-4 ring-cyan-400/10 min-h-[640px] flex flex-col justify-between"
          >
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-3.5 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🎮</span>
                  <span>게임 & 금액 설정</span>
                </h3>
                <span className="text-[11px] font-extrabold text-cyan-700 bg-cyan-50 px-2.5 py-0.5 rounded border border-cyan-200">
                  1단계
                </span>
              </div>

              {/* 게임 입력 */}
              <div className="space-y-2.5">
                <label className="text-xs font-bold text-slate-800 block">
                  게임 이름
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
                    {popularGames.map((g: { name: string; icon: string }) => (
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
                        {g.icon} {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 결제 금액 입력 및 단일 행 정렬 숏컷 버튼 */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-800 block">
                  결제 예정 금액 (원)
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

                {/* 👈 [개선] +100,000원 포함 7개 버튼이 한 줄에 모두 들어가도록 7열 그리드 적용 */}
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
                <span>🚀</span>
                <span>최저가 연산하기</span>
              </button>
            </div>
          </form>
        </aside>

        {/* [중앙 6열] 필터 옵션들 */}
        <div className="lg:col-span-6 space-y-5">
          <header className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-extrabold text-xs rounded border border-cyan-200">
                🎛️ 2단계 필터
              </span>

              {isLoggedIn && (
                <button
                  type="button"
                  onClick={handleSaveFilter}
                  className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-all shadow-sm cursor-pointer flex items-center gap-1.5"
                >
                  <span>💾</span>
                  <span>필터링 조건 저장</span>
                </button>
              )}
            </div>

            <h2 className="text-xl font-black text-slate-900">내 결제 조건 필터링</h2>
            <p className="text-xs text-slate-500">
              보유 중인 스토어, 결제수단, 구독 서비스 조건을 체크해 최저가를 계산하세요.
            </p>
          </header>

          {/* 2-1. OS & 스토어 선택 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span>📱</span>
              <span>스마트폰 OS & 이용 스토어 선택</span>
            </h3>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {(['ANDROID', 'IOS'] as OsType[]).map((os: OsType) => (
                  <button
                    key={os}
                    type="button"
                    onClick={() => setOsType(os)}
                    className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer text-center ${
                      osType === os
                        ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {os === 'ANDROID' ? '🤖 안드로이드' : '🍎 iOS (앱스토어)'}
                  </button>
                ))}
              </div>

              {osType === 'ANDROID' && (
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="text-[11px] font-bold text-slate-700 block">
                    🛒 이용 가능한 스토어 선택 (기본 선택 안 함)
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
                </div>
              )}
            </div>

            {(isGoogleSelected || isGalaxySelected) && (
              <div className="p-3 bg-cyan-50/50 rounded-lg border border-cyan-200/60 grid grid-cols-1 md:grid-cols-2 gap-3">
                {isGoogleSelected && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-cyan-900 block">
                      💎 Google Play Points 등급
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
                      🌌 Galaxy Store 멤버십 등급
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
            )}
          </div>

          {/* 2-2. 보너스 혜택 옵션 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span>🎯</span>
              <span>보너스 이벤트 적용 여부</span>
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
                  🎮 선택한 게임 전용 혜택 포함
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
                  📝 사전 응모 완료 혜택 포함
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
                  🎉 첫 결제 이벤트 대상
                </label>
              </div>
            </div>
          </div>

          {/* 2-3. 보유 결제 수단 필터 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2.5">
              <span>💳</span>
              <span>보유 결제 수단 필터</span>
            </h3>

            <div className="space-y-3.5">
              {/* 통신사 */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="useCarriersToggle"
                    checked={useCarriers}
                    onChange={(e) => setUseCarriers(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="useCarriersToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    📱 통신사 할인 사용하기
                  </label>
                </div>

                {useCarriers && (
                  <div className="flex flex-wrap gap-1.5 pt-1 animate-fadeIn">
                    {CARRIER_OPTIONS.map((c: string) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => handleToggleArrayItem(setCarriers, c)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                          carriers.includes(c)
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {carriers.includes(c) ? '✓ ' : '+ '}{c}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 간편결제 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="usePaysToggle"
                    checked={usePays}
                    onChange={(e) => setUsePays(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="usePaysToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    💸 사용 간편결제 (페이) 선택
                  </label>
                </div>

                {usePays && (
                  <div className="flex flex-wrap gap-1.5 pt-1 animate-fadeIn">
                    {PAY_OPTIONS.map((p: string) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => handleToggleArrayItem(setPays, p)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                          pays.includes(p)
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {pays.includes(p) ? '✓ ' : '+ '}{p}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 문화상품권 우회 */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-2 p-2 bg-slate-50 rounded border border-slate-200">
                  <input
                    type="checkbox"
                    id="useVoucherToggle"
                    checked={useVoucherBypasses}
                    onChange={(e) => setUseVoucherBypasses(e.target.checked)}
                    className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                  />
                  <label htmlFor="useVoucherToggle" className="text-xs font-extrabold text-slate-800 cursor-pointer select-none">
                    🎟️ 문화상품권 우회 충전 할인
                  </label>
                </div>

                {useVoucherBypasses && (
                  <div className="flex flex-wrap gap-1.5 pt-1 animate-fadeIn">
                    {VOUCHER_OPTIONS.map((v: string) => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => handleToggleArrayItem(setVoucherBypasses, v)}
                        className={`px-3 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                          voucherBypasses.includes(v)
                            ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {voucherBypasses.includes(v) ? '✓ ' : '+ '}{v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 2-4. 구독 및 게이밍 제휴 카드 */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <span>⭐</span>
                <span>구독 서비스 및 카드 선택</span>
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
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-700 block">유료 구독 서비스 (기본 선택 안 함)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SUBSCRIPTION_OPTIONS.map((sub: string) => {
                      const selected = subscriptions.includes(sub);
                      return (
                        <button
                          type="button"
                          key={sub}
                          onClick={() => handleToggleArrayItem(setSubscriptions, sub)}
                          className={`px-3 py-1.5 rounded text-xs font-bold border transition-all cursor-pointer ${
                            selected
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {selected ? '✓ ' : ''}{sub}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1 pt-2 border-t border-slate-100">
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

                {/* 카드가 선택되었을 때만 전월 실적 충족 박스 노출 */}
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

                {/* 구글 플레이가 선택되었을 때만 PC 버전 접속 결제 대상 노출 */}
                {isGoogleSelected && (
                  <div className="p-2.5 bg-slate-50 rounded border border-slate-200 animate-fadeIn">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="isPcVersion"
                        checked={isPcVersion}
                        onChange={(e) => setIsPcVersion(e.target.checked)}
                        className="w-4 h-4 text-cyan-600 rounded border-slate-300 cursor-pointer shrink-0"
                      />
                      <label htmlFor="isPcVersion" className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                        💻 PC 버전 (Google Play Games) 접속 결제 대상
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* [우측 2열] 협업 광고 배너 */}
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
                  실시간 최저가 검색 전용 프로모션 공간입니다.
                </p>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-slate-200/80 text-[10px] text-slate-600 font-medium">
                💡 최저가 검색 배너 입점 및 제휴 문의 환영
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