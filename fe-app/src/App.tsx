export default function App() {
  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <div className="max-w-xl mx-auto bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-700">
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-4 py-3 rounded-lg mb-6 text-sm">
          📢 본 페이지는 검색 및 최저가 연산 기능 검증을 위한 프로토타입으로, 현재 <strong className="underline">[쿠키런 킹덤]</strong> 1개 게임만 검색 가능합니다.
        </div>
        <h1 className="text-2xl font-bold text-blue-400 mb-2">🎮 모바일 게임 결제 혜택 최저가 추천</h1>
        <p className="text-slate-400 text-sm">Tailwind CSS 설정이 정상적으로 작동 중입니다!</p>
      </div>
    </div>
  );
}