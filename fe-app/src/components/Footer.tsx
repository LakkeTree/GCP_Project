import React, { useState } from 'react';

export default function Footer() {
  const [inquiryText, setInquiryText] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleInquirySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryText.trim() || !inquiryEmail.trim()) {
      alert('이메일과 문의 내용을 모두 입력해 주세요.');
      return;
    }
    setIsSubmitted(true);
    setTimeout(() => {
      setIsSubmitted(false);
      setInquiryText('');
      setInquiryEmail('');
      alert('문의사항이 정상적으로 접수되었습니다. 담당자 검토 후 답변드리겠습니다.');
    }, 500);
  };

  return (
    <footer className="bg-slate-900 text-slate-300 mt-20 border-t border-slate-800">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-12 space-y-10">
        
        {/* 하단 1단: 실시간 문의사항 및 문제 제보 폼 (세미-샤프 rounded-xl 적용) */}
        <div className="bg-slate-800/80 p-6 md:p-8 rounded-xl border border-slate-700/80 grid grid-cols-1 md:grid-cols-12 gap-6 items-center shadow-lg">
          <div className="md:col-span-5 space-y-2">
            <span className="px-2.5 py-1 bg-cyan-500/20 text-cyan-400 font-bold text-xs rounded border border-cyan-500/30">
              💬 24시간 피드백
            </span>
            <h3 className="text-lg md:text-xl font-black text-white">
              잘못된 할인 정보나 문의사항이 있으신가요?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              할인율 오차 제보, 신규 카드/결제수단 추가 요청 등 의견을 남겨주시면 빠르게 반영하겠습니다.
            </p>
          </div>

          <form onSubmit={handleInquirySubmit} className="md:col-span-7 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="email"
                value={inquiryEmail}
                onChange={(e) => setInquiryEmail(e.target.value)}
                placeholder="답변받으실 이메일 주소"
                className="px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={isSubmitted}
                className="py-2.5 bg-cyan-500 hover:bg-cyan-600 text-white font-black text-xs rounded-lg transition-all shadow-md shadow-cyan-500/20 cursor-pointer disabled:opacity-50"
              >
                {isSubmitted ? '제출 중...' : '✉️ 문의 및 제보 보내기'}
              </button>
            </div>
            <textarea
              rows={2}
              value={inquiryText}
              onChange={(e) => setInquiryText(e.target.value)}
              placeholder="문의사항 또는 오류 제보 내용을 입력하세요..."
              className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
          </form>
        </div>

        {/* 하단 2단: 브랜드 및 하단 메뉴 정보 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-slate-800 pt-8 text-xs text-slate-400">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-base font-black text-cyan-500 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>호갱탈출</span>
              </span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-400 border border-slate-700">v1.0.0</span>
            </div>
            <p className="text-[11px] opacity-70">
              호갱탈출은 스토어/카드사/상품권 우회 혜택을 실시간 조합해 최적가를 비교 안내합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-4 text-slate-400 font-semibold text-[11px]">
            <a href="#terms" className="hover:text-cyan-400 transition-colors">이용약관</a>
            <a href="#privacy" className="hover:text-cyan-400 font-bold text-slate-300 transition-colors">개인정보처리방침</a>
            <a href="#partnership" className="hover:text-cyan-400 transition-colors">제휴/광고 문의</a>
          </div>
        </div>
 
        <p className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-800/60">
          © 2026 호갱탈출 Project. All rights reserved.
        </p>

      </div>
    </footer>
  );
}