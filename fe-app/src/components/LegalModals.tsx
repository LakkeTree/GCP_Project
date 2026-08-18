import { useState } from 'react';

type ModalType = 'terms' | 'privacy' | 'contact' | null;

interface LegalModalsProps {
  type: ModalType;
  onClose: () => void;
}

export default function LegalModals({ type, onClose }: LegalModalsProps) {
  const [contactEmail, setContactEmail] = useState('');
  const [contactCompany, setContactCompany] = useState('');
  const [contactContent, setContactContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!type) return null;

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactEmail || !contactContent) {
      alert('이메일과 제휴/광고 문의 내용을 입력해 주세요.');
      return;
    }
    setIsSubmitting(true);
    setTimeout(() => {
      alert('제휴 및 광고 문의가 성공적으로 접수되었습니다. 담당자 검토 후 회신드리겠습니다.');
      setIsSubmitting(false);
      setContactEmail('');
      setContactCompany('');
      setContactContent('');
      onClose();
    }, 600);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn cursor-pointer"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-xl max-w-2xl w-full p-6 md:p-8 space-y-6 shadow-2xl cursor-default max-h-[85vh] flex flex-col border border-slate-200"
      >
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4 shrink-0">
          <h3 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
            {type === 'terms' && '서비스 이용약관'}
            {type === 'privacy' && '개인정보처리방침'}
            {type === 'contact' && '제휴 및 광고 문의'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold text-xl px-2 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 모달 본문 */}
        <div className="overflow-y-auto pr-2 space-y-4 text-xs md:text-sm text-slate-600 leading-relaxed custom-scrollbar">
          {type === 'terms' && (
            <div className="space-y-4">
              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">제 1 조 (목적)</h4>
                <p>본 약관은 '호갱탈출'(이하 "서비스")이 제공하는 게임 결제 최저가 비교, 혜택 조회 및 관련 부가 서비스의 이용조건과 절차, 이용자와 서비스의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">제 2 조 (용어의 정의)</h4>
                <p>1. "서비스"란 회사가 제공하는 모바일 게임별 스토어 및 결제수단 혜택 연산 최적가 안내 플랫폼을 의미합니다.</p>
                <p>2. "이용자"란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">제 3 조 (서비스 제공 및 면책)</h4>
                <p>1. 서비스가 제공하는 스토어 및 결제수단의 할인·적립 혜택 정보는 각 제휴사 및 제3자의 사정에 따라 실시간으로 변경될 수 있습니다.</p>
                <p>2. 서비스는 최신 정밀 데이터를 제공하기 위해 최선을 다하나, 결제 시점의 제휴사 정책 변경으로 발생한 실제 결제 금액과의 오차에 대해 법적 책임을 지지 않으며, 최종 결제 전 금액 확인 책임은 이용자 본인에게 있습니다.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">제 4 조 (지적재산권의 귀속)</h4>
                <p>서비스 내에 표출되는 각 게임의 상표권, 이미지, 로고 및 스토어 상표는 원저작권자 및 해당 제휴 기업에 귀속됩니다.</p>
              </section>
            </div>
          )}

          {type === 'privacy' && (
            <div className="space-y-4">
              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">1. 개인정보 수집 및 이용 목적</h4>
                <p>'호갱탈출'은 다음의 목적을 위해 최소한의 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음 목적 이외의 용도로는 사용되지 않습니다.</p>
                <ul className="list-disc pl-5 space-y-0.5 text-slate-500 mt-1">
                  <li>구글 소셜 로그인 이용자 식별 및 회원 관리</li>
                  <li>제휴·광고 문의 및 오류 제보에 대한 피드백 응대</li>
                  <li>서비스 이용 통계 분석 및 시스템 보안 유지</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">2. 수집하는 개인정보 항목</h4>
                <p>서비스 이용 과정에서 아래와 같은 정보들이 수집될 수 있습니다.</p>
                <ul className="list-disc pl-5 space-y-0.5 text-slate-500 mt-1">
                  <li>회원 가입 시: 구글 계정 이메일, 프로필 이름, 고유 식별자</li>
                  <li>문의 접수 시: 이메일 주소, 회사/담당자명, 문의 내용</li>
                  <li>자동 수집 항목: IP 주소, 쿠키, 방문 일시, 서비스 이용 기록</li>
                </ul>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">3. 개인정보의 보유 및 파기기간</h4>
                <p>이용자의 개인정보는 원칙적으로 개인정보의 수집 및 이용목적이 달성되면 지체 없이 파기합니다. 단, 관계법령 규정에 의하여 보존할 필요가 있는 경우 관련 법령이 정한 기간 동안 보관합니다.</p>
              </section>

              <section className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">4. 이용자의 권리</h4>
                <p>이용자는 언제든지 등록되어 있는 본인의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보 수집 동의 철회를 요청할 수 있습니다.</p>
              </section>
            </div>
          )}

          {type === 'contact' && (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <p className="text-slate-500 font-medium text-xs">
                스토어/카드사 프로모션 배너 제휴, 신규 게임 등록 요청 및 비즈니스 협업 제안을 남겨주시면 담당자 검토 후 신속히 연락드리겠습니다.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">담당자 이메일 주소 *</label>
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="official@company.com"
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-[#00D2B8] outline-none font-medium"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-bold text-slate-700">회사명 / 서비스명 (선택)</label>
                  <input
                    type="text"
                    value={contactCompany}
                    onChange={(e) => setContactCompany(e.target.value)}
                    placeholder="예: (주)호갱컴퍼니"
                    className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-[#00D2B8] outline-none font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">제휴 / 제안 내용 *</label>
                <textarea
                  required
                  rows={5}
                  value={contactContent}
                  onChange={(e) => setContactContent(e.target.value)}
                  placeholder="제휴 제안 내용, 배너 입점 문의 또는 원하는 협업 방식을 상세히 작성해 주세요."
                  className="w-full px-3.5 py-2.5 rounded border border-slate-300 text-slate-800 text-xs focus:ring-2 focus:ring-[#00D2B8] outline-none font-medium resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-gradient-to-r from-[#00D2B8] to-[#00E5FF] hover:brightness-105 text-slate-950 font-black text-xs rounded transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? '제출 처리 중...' : '제휴 및 광고 문의 제출하기'}
              </button>
            </form>
          )}
        </div>

        {/* 푸터 버튼 */}
        {type !== 'contact' && (
          <div className="pt-2 border-t border-slate-100 shrink-0 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs rounded transition-all cursor-pointer shadow-md"
            >
              확인
            </button>
          </div>
        )}
      </div>
    </div>
  );
}