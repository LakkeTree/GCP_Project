import { useEffect, useState, useCallback } from 'react';

const API_BASE = 'http://127.0.0.1:8000';
const PAGE_SIZE = 20;

interface TopGame {
  game_name: string;
  play_count: number;
}

interface AdminUserRow {
  user_id: string;
  email: string;
  nickname: string;
  provider: string;
  role: string;
  created_at: string | null;
  last_login_at: string | null;
  is_active_7d: boolean;
  top_games: TopGame[];
}

interface StatsSummary {
  total_users: number;
  active_users_daily: number;
  active_users_weekly: number;
  active_users_monthly: number;
  generated_at: string;
}

type GuardState = 'CHECKING' | 'NO_TOKEN' | 'FORBIDDEN' | 'OK';

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboardPage() {
  const [guard, setGuard] = useState<GuardState>('CHECKING');
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const authHeader = () => {
    const token = localStorage.getItem('google_token');
    return token ? { Authorization: `Bearer ${token}` } : null;
  };

  const loadStats = useCallback(async () => {
    const headers = authHeader();
    if (!headers) return;
    const res = await fetch(`${API_BASE}/admin/stats/summary`, { headers });
    if (res.status === 403) {
      setGuard('FORBIDDEN');
      return;
    }
    if (!res.ok) throw new Error(`통계 조회 실패 (${res.status})`);
    const result = await res.json();
    setStats(result.data);
  }, []);

  const loadUsers = useCallback(async (nextOffset: number) => {
    const headers = authHeader();
    if (!headers) return;
    setLoadingTable(true);
    try {
      const res = await fetch(`${API_BASE}/admin/users?limit=${PAGE_SIZE}&offset=${nextOffset}`, { headers });
      if (res.status === 403) {
        setGuard('FORBIDDEN');
        return;
      }
      if (!res.ok) throw new Error(`유저 목록 조회 실패 (${res.status})`);
      const result = await res.json();
      setUsers(result.data.users);
      setTotalCount(result.data.total_count);
      setOffset(nextOffset);
    } finally {
      setLoadingTable(false);
    }
  }, []);

  useEffect(() => {
    const headers = authHeader();
    if (!headers) {
      setGuard('NO_TOKEN');
      return;
    }

    (async () => {
      try {
        await Promise.all([loadStats(), loadUsers(0)]);
        setGuard((prev) => (prev === 'FORBIDDEN' ? prev : 'OK'));
      } catch (err) {
        console.error('관리자 대시보드 로드 실패:', err);
        setErrorMsg('데이터를 불러오는 중 오류가 발생했습니다. 서버 연결을 확인해 주세요.');
      }
    })();
  }, [loadStats, loadUsers]);

  if (guard === 'CHECKING') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 text-sm font-bold">
        불러오는 중...
      </div>
    );
  }

  if (guard === 'NO_TOKEN' || guard === 'FORBIDDEN') {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl">
          🔒
        </div>
        <h1 className="text-lg font-black text-slate-900">
          {guard === 'NO_TOKEN' ? '로그인이 필요합니다' : '관리자 권한이 필요합니다'}
        </h1>
        <p className="text-sm text-slate-500 font-medium max-w-md">
          {guard === 'NO_TOKEN'
            ? '관리자 대시보드는 로그인 후 이용할 수 있습니다.'
            : '이 페이지는 ROLE_ADMIN 권한을 가진 계정만 접근할 수 있습니다.'}
        </p>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="bg-[#F8FAFC] min-h-screen py-8">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 space-y-8">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-black text-slate-900">관리자 대시보드</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">
            총 이용자 수, 활성 사용자 수, 유저별 선호 게임 로그를 모니터링합니다.
          </p>
        </div>

        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm font-bold text-rose-700">
            {errorMsg}
          </div>
        )}

        {/* 요약 통계 카드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="총 가입자 수" value={stats?.total_users} accent />
          <StatCard label="일간 활성 사용자 (DAU)" value={stats?.active_users_daily} />
          <StatCard label="주간 활성 사용자 (WAU)" value={stats?.active_users_weekly} />
          <StatCard label="월간 활성 사용자 (MAU)" value={stats?.active_users_monthly} />
        </div>
        {stats && (
          <p className="text-[11px] text-slate-400 font-medium -mt-4">
            기준 시각: {formatDateTime(stats.generated_at)} · 활성 사용자는 최근 로그인(인증 토큰 검증) 시각 기준입니다.
          </p>
        )}

        {/* 유저 로그 모니터링 테이블 */}
        <section className="bg-white rounded-lg border border-slate-200/90 shadow-xs">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900">유저 로그 모니터링</h2>
            <span className="text-xs font-bold text-slate-400">
              전체 {totalCount.toLocaleString()}명 · {currentPage} / {totalPages} 페이지
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-100">
                  <th className="text-left px-4 py-3">유저</th>
                  <th className="text-left px-4 py-3">권한</th>
                  <th className="text-left px-4 py-3">가입일</th>
                  <th className="text-left px-4 py-3">최근 로그인</th>
                  <th className="text-left px-4 py-3">활성 여부(7일)</th>
                  <th className="text-left px-4 py-3">선호 게임 랭킹</th>
                </tr>
              </thead>
              <tbody>
                {loadingTable && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 text-xs font-bold">
                      불러오는 중...
                    </td>
                  </tr>
                )}
                {!loadingTable && users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 text-xs font-bold">
                      표시할 유저가 없습니다.
                    </td>
                  </tr>
                )}
                {!loadingTable &&
                  users.map((u) => (
                    <tr key={u.user_id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="flex flex-col leading-tight">
                          <span className="font-bold text-slate-800">{u.nickname}</span>
                          <span className="text-[11px] text-slate-400">{u.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                            u.role === 'ROLE_ADMIN'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}
                        >
                          {u.role === 'ROLE_ADMIN' ? '관리자' : '일반회원'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(u.created_at)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(u.last_login_at)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                            u.is_active_7d
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}
                        >
                          {u.is_active_7d ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.top_games.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {u.top_games.map((g, idx) => (
                              <span
                                key={g.game_name}
                                className="text-[11px] font-bold px-2 py-0.5 rounded bg-gradient-to-r from-[#00D2B8]/15 to-[#00F5FF]/15 border border-[#00D2B8]/30 text-[#00A896]"
                              >
                                {idx + 1}위 {g.game_name}
                                {g.play_count > 0 ? ` (${g.play_count}회)` : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-300 font-medium">기록 없음</span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="p-4 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              disabled={offset === 0 || loadingTable}
              onClick={() => loadUsers(Math.max(0, offset - PAGE_SIZE))}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer"
            >
              이전
            </button>
            <button
              type="button"
              disabled={offset + PAGE_SIZE >= totalCount || loadingTable}
              onClick={() => loadUsers(offset + PAGE_SIZE)}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-bold text-xs rounded transition-colors cursor-pointer"
            >
              다음
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value?: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-lg border p-5 shadow-xs ${
        accent
          ? 'bg-gradient-to-br from-[#00D2B8] to-[#00F5FF] border-transparent text-slate-950'
          : 'bg-white border-slate-200/90 text-slate-900'
      }`}
    >
      <p className={`text-xs font-bold ${accent ? 'text-slate-900/70' : 'text-slate-400'}`}>{label}</p>
      <p className="text-2xl font-black mt-1.5">
        {value === undefined ? '-' : value.toLocaleString()}
      </p>
    </div>
  );
}
