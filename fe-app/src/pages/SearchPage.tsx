import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function SearchPage() {
  const navigate = useNavigate();
  
  // 1. 기본 디폴트 값: 게임명 빈값(""), 결제 금액 0원
  const [selectedGame, setSelectedGame] = useState('');
  const [amount, setAmount] = useState<number | ''>(0);

  // 2. 플랫폼/스토어 디폴트: 미선택 (NONE)
  const [selectedOs, setSelectedOs] = useState<'ANDROID' | 'IOS' | null>(null);
  const [selectedStores, setSelectedStores] = useState<string[]>([]);

  // 3. 결제수단 및 추가 혜택 디폴트: 모두 OFF (미선택)
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [useCarrier, setUseCarrier] = useState(false);
  const [useVoucher, setUseVoucher] = useState(false);
  const [useGameBenefit, setUseGameBenefit] = useState(false);

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

  // 스토어 체크박스 토글
  const toggleStore = (storeName: string) => {
    setSelectedStores((prev) =>
      prev.includes(storeName)
        ? prev.filter((s) => s !== storeName)
        : [...prev, storeName]
    );
  };

  // 결제수단 체크박스 토글
  const togglePayment = (payName: string) => {
    setSelectedPayments((prev) =>
      prev.includes(payName)
        ? prev.filter((p) => p !== payName)
        : [...prev, payName]
    );
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGame.trim()) {
      alert('게임을 선택하거나 입력해 주세요.');
      return;
    }
    const payAmt = amount === '' ? 0 : amount;

    // 선택된 모든 필터 조건을 Query Parameter로 전달
    const params = new URLSearchParams({
      game: selectedGame,
      amount: String(payAmt),
      os: selectedOs || '',
      stores: selectedStores.join(','),
      payments: selectedPayments.join(','),
      carrier: String(useCarrier),
      voucher: String(useVoucher),
      gameBenefit: String(useGameBenefit),
    });

    navigate(`/search-result?${params.toString()}`);
  };

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
      
      {/* 12열 레이아웃: [메인 대시보드 10열] | [우측 스티키 광고 2열] */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* [좌측 10열] 메인 최저가 연산 대시보드 */}
        <div className="lg:col-span-10 space-y-6">
          
          <header className="space-y-2">
            <span className="px-2.5 py-1 bg-cyan-100 text-cyan-800 font-extrabold text-xs rounded border border-cyan-200">
              🔍 실시간 최저가 연산
            </span>
            <h2 className="text-2xl font-black text-slate-900">호갱탈출 최저가 검색</h2>
            <p className="text-xs text-slate-500">
              게임, 결제금액과 사용 중인 플랫폼/결제수단을 체크하시면 가장 저렴한 최적 결제 경로를 계산해 드립니다.
            </p>
          </header>

          <form onSubmit={handleSearch} className="space-y-5">
            
            {/* =================================================== */}
            {/* 2열 나란히 구조: [좌측 입력 폼] | [우측 조건 필터 폼] */}
            {/* =================================================== */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* [좌측 6열] 게임 선택 및 예정 금액 입력 */}
              <div className="md:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5 flex flex-col justify-between">
                
                <div className="space-y-4">
                  {/* 게임 이름 입력 */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>🎮 결제할 게임 선택</span>
                      <span className="text-[10px] text-cyan-600 font-bold">* 필수</span>
                    </label>
                    <input
                      type="text"
                      value={selectedGame}
                      onChange={(e) => setSelectedGame(e.target.value)}
                      placeholder="게임 이름을 입력하세요 (예: 쿠키런, 원신)"
                      className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white transition-all"
                    />

                    {/* 인기 추천 게임 태그 */}
                    <div className="pt-1 space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400">인기 추천:</span>
                      <div className="flex flex-wrap gap-1">
                        {popularGames.map((g) => (
                          <button
                            key={g.name}
                            type="button"
                            onClick={() => setSelectedGame(g.name)}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all border cursor-pointer ${
                              selectedGame === g.name
                                ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {g.icon} {g.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* 결제 예정 금액 입력 */}
                  <div className="space-y-1.5 pt-3 border-t border-slate-100">
                    <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                      <span>💳 결제 예정 금액</span>
                      <span className="text-[10px] text-slate-400 font-normal">미입력 시 0원</span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="0"
                        className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:bg-white font-black text-slate-900 transition-all pr-8"
                      />
                      <span className="absolute right-3.5 text-xs font-bold text-slate-400">원</span>
                    </div>

                    {/* 금액 빠른 설정 태그 */}
                    <div className="flex flex-wrap gap-1 pt-1">
                      {[11000, 33000, 55000, 110000, 330000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setAmount(amt)}
                          className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded text-[10px] font-bold transition-all cursor-pointer"
                        >
                          +{amt.toLocaleString()}원
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setAmount(0)}
                        className="px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded text-[10px] font-bold transition-all cursor-pointer"
                      >
                        초기화
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100">
                  💡 게임과 금액 입력 후 오른쪽 필터를 설정하세요.
                </div>
              </div>

              {/* [우측 6열] 스마트폰 OS, 스토어 및 보유 결제수단 선택 필터 (디폴트: 모두 미선택) */}
              <div className="md:col-span-6 bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-5">
                
                {/* 1. OS 및 이용 가능 스토어 선택 */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">📱 이용 플랫폼 & 스토어 (기본 미선택)</span>
                  
                  {/* OS 선택 토글 */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedOs(selectedOs === 'ANDROID' ? null : 'ANDROID')}
                      className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedOs === 'ANDROID'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🤖</span>
                      <span>안드로이드</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedOs(selectedOs === 'IOS' ? null : 'IOS')}
                      className={`py-2 px-3 rounded-lg text-xs font-extrabold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        selectedOs === 'IOS'
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>🍎</span>
                      <span>iOS (앱스토어)</span>
                    </button>
                  </div>

                  {/* 세부 스토어 선택 태그 */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      { name: '구글플레이', icon: '🤖' },
                      { name: '원스토어', icon: '🛍️' },
                      { name: '갤럭시스토어', icon: '🌌' },
                    ].map((st) => {
                      const isSelected = selectedStores.includes(st.name);
                      return (
                        <button
                          key={st.name}
                          type="button"
                          onClick={() => toggleStore(st.name)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {st.icon} {st.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. 보유 간편결제 & 추가 혜택 선택 */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-800 block">💳 보유 결제 수단 및 혜택 (기본 미선택)</span>
                  
                  {/* 간편결제 다중 선택 */}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: '네이버페이', icon: '💸' },
                      { name: '카카오페이', icon: '💛' },
                      { name: '페이코', icon: '🔴' },
                      { name: '토스페이', icon: '🔵' },
                      { name: '삼성페이', icon: '📱' },
                    ].map((pay) => {
                      const isPaySelected = selectedPayments.includes(pay.name);
                      return (
                        <button
                          key={pay.name}
                          type="button"
                          onClick={() => togglePayment(pay.name)}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-bold border transition-all cursor-pointer ${
                            isPaySelected
                              ? 'bg-cyan-50 border-cyan-300 text-cyan-800'
                              : 'bg-white border-slate-200 text-slate-400'
                          }`}
                        >
                          {isPaySelected ? '✓ ' : '+ '}
                          {pay.icon} {pay.name}
                        </button>
                      );
                    })}
                  </div>

                  {/* 추가 할인 옵션 체크 */}
                  <div className="grid grid-cols-3 gap-1.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setUseCarrier(!useCarrier)}
                      className={`p-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer text-center ${
                        useCarrier
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      📶 통신사 할인 {useCarrier ? '켜짐' : '꺼짐'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseVoucher(!useVoucher)}
                      className={`p-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer text-center ${
                        useVoucher
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      🎟️ 문화상품권 {useVoucher ? '켜짐' : '꺼짐'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setUseGameBenefit(!useGameBenefit)}
                      className={`p-2 rounded-lg text-[10px] font-extrabold border transition-all cursor-pointer text-center ${
                        useGameBenefit
                          ? 'bg-cyan-500 text-white border-cyan-500'
                          : 'bg-slate-50 text-slate-500 border-slate-200'
                      }`}
                    >
                      🎮 게임전용혜택 {useGameBenefit ? '켜짐' : '꺼짐'}
                    </button>
                  </div>
                </div>

              </div>

            </div>

            {/* 연산 실행 대형 버튼 */}
            <button
              type="submit"
              className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-sm rounded-xl transition-all shadow-md shadow-cyan-500/20 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>🚀</span>
              <span>선택한 조건으로 최저가 결제 루트 연산하기</span>
            </button>

          </form>

        </div>

        {/* [우측 2열] 통일 규격 스티키 광고 배너 */}
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