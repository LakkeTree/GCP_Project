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

interface DomainStatus {
  domain: string;
  last_status: string;
  last_scraper_name: string;
  last_provider_or_retailer: string | null;
  last_rows_extracted: number;
  last_error_type: string | null;
  last_error_message: string | null;
  last_finished_at: string | null;
  hours_since_last_run: number | null;
  is_stale: boolean;
}

interface CrawlLogRow {
  run_id: string;
  domain: string;
  scraper_name: string;
  provider_or_retailer: string | null;
  status: string;
  rows_extracted: number;
  error_type: string | null;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number;
  trigger_source: string;
}

interface DataStatus {
  stale_threshold_hours: number;
  domains: DomainStatus[];
  recent_logs: CrawlLogRow[];
  generated_at: string;
}

type GuardState = 'CHECKING' | 'NO_TOKEN' | 'FORBIDDEN' | 'OK';
type TabKey = 'users' | 'data';

const DOMAIN_LABELS: Record<string, string> = {
  card_data: '카드사',
  epay_data: '간편결제',
  store_data: '스토어',
  telecom_data: '통신사',
  voucher_data: '상품권',
  mobile_game_data: '게임 정보',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : `${iso}Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboardPage() {
  const [guard, setGuard] = useState<GuardState>('CHECKING');
  const [activeTab, setActiveTab] = useState<TabKey>('users');
  const [stats, setStats] = useState<StatsSummary | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loadingTable, setLoadingTable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const [loadingDataStatus, setLoadingDataStatus] = useState(false);
  const [dataStatusError, setDataStatusError] = useState<string | null>(null);
  const [dataStatusLoaded, setDataStatusLoaded] = useState(false);

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

  const loadDataStatus = useCallback(async () => {
    const headers = authHeader();
    if (!headers) return;
    setLoadingDataStatus(true);
    setDataStatusError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/data-status`, { headers });
      if (res.status === 403) {
        setGuard('FORBIDDEN');
        return;
      }
      if (!res.ok) throw new Error(`데이터 현황 조회 실패 (${res.status})`);
      const result = await res.json();
      setDataStatus(result.data);
      setDataStatusLoaded(true);
    } catch (err) {
      console.error('크롤링 데이터 현황 로드 실패:', err);
      setDataStatusError('크롤링 데이터 현황을 불러오지 못했습니다. 서버 연결을 확인해 주세요.');
    } finally {
      setLoadingDataStatus(false);
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
        setGuard((prev) => (prev === 'FORBIDDEN' ? prev : 'OK'));
      }
    })();
  }, [loadStats, loadUsers]);

  useEffect(() => {
    if (activeTab === 'data' && !dataStatusLoaded && guard === 'OK') {
      loadDataStatus();
    }
  }, [activeTab, dataStatusLoaded, guard, loadDataStatus]);

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

        {/* 탭 전환 */}
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 text-sm font-black rounded-t-lg transition-colors cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white border border-slate-200 border-b-white text-slate-900 -mb-px'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            유저 모니터링
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('data')}
            className={`px-4 py-2.5 text-sm font-black rounded-t-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'data'
                ? 'bg-white border border-slate-200 border-b-white text-slate-900 -mb-px'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            데이터 모니터링
            {dataStatus && dataStatus.domains.some((d) => d.is_stale) && (
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" title="갱신이 필요한 도메인이 있습니다" />
            )}
          </button>
        </div>

        {activeTab === 'users' && (
          <>
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
                          className={`text-[11px] font-bold px-2 py-0.5 rounded border whitespace-nowrap ${
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
          </>
        )}

        {activeTab === 'data' && (
          <DataMonitoringPanel
            dataStatus={dataStatus}
            loading={loadingDataStatus}
            error={dataStatusError}
            onRetry={loadDataStatus}
          />
        )}
      </div>
    </div>
  );
}

function formatHoursSince(hours: number | null): string {
  if (hours === null) return '기록 없음';
  if (hours < 1) return `${Math.round(hours * 60)}분 전`;
  if (hours < 48) return `${hours.toFixed(1)}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function DataMonitoringPanel({
  dataStatus,
  loading,
  error,
  onRetry,
}: {
  dataStatus: DataStatus | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && !dataStatus) {
    return (
      <div className="py-16 text-center text-slate-400 text-sm font-bold">불러오는 중...</div>
    );
  }

  if (error && !dataStatus) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm font-bold text-rose-700 flex items-center justify-between">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded transition-colors cursor-pointer"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!dataStatus) return null;

  const staleCount = dataStatus.domains.filter((d) => d.is_stale).length;

  return (
    <div className="space-y-6">
      {staleCount > 0 && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-sm font-bold text-rose-700">
          ⚠️ {staleCount}개 도메인의 데이터가 {dataStatus.stale_threshold_hours}시간 이상 갱신되지 않았습니다.
        </div>
      )}

      {/* 도메인별 최신성 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {dataStatus.domains.map((d) => (
          <div
            key={d.domain}
            className={`rounded-lg border p-4 shadow-xs ${
              d.is_stale ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-slate-200/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">
                {DOMAIN_LABELS[d.domain] || d.domain}
              </span>
              <div className="flex items-center gap-1.5">
                {d.is_stale && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded border bg-rose-100 text-rose-700 border-rose-300">
                    갱신 필요
                  </span>
                )}
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                    d.last_status === 'SUCCESS'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {d.last_status === 'SUCCESS' ? '성공' : '실패'}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{d.domain}</p>

            <div className="mt-3 space-y-1 text-xs text-slate-500">
              <p>마지막 실행: <span className="font-bold text-slate-700">{formatHoursSince(d.hours_since_last_run)}</span></p>
              <p>수집 건수: <span className="font-bold text-slate-700">{d.last_rows_extracted.toLocaleString()}건</span></p>
              {d.last_status !== 'SUCCESS' && d.last_error_message && (
                <p className="text-rose-600 font-bold truncate" title={d.last_error_message}>
                  {d.last_error_type ? `[${d.last_error_type}] ` : ''}{d.last_error_message}
                </p>
              )}
            </div>
          </div>
        ))}
        {dataStatus.domains.length === 0 && (
          <div className="col-span-full text-center py-8 text-slate-400 text-xs font-bold">
            크롤링 로그가 아직 없습니다.
          </div>
        )}
      </div>

      {/* 최근 크롤링 실행 이력 */}
      <section className="bg-white rounded-lg border border-slate-200/90 shadow-xs">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-black text-slate-900">최근 크롤링 실행 이력</h2>
          <span className="text-xs font-bold text-slate-400">최근 {dataStatus.recent_logs.length}건</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-bold border-b border-slate-100">
                <th className="text-left px-4 py-3">도메인</th>
                <th className="text-left px-4 py-3">스크래퍼</th>
                <th className="text-left px-4 py-3">상태</th>
                <th className="text-left px-4 py-3">수집 건수</th>
                <th className="text-left px-4 py-3">실행 시각</th>
                <th className="text-left px-4 py-3">소요 시간</th>
              </tr>
            </thead>
            <tbody>
              {dataStatus.recent_logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400 text-xs font-bold">
                    표시할 로그가 없습니다.
                  </td>
                </tr>
              )}
              {dataStatus.recent_logs.map((log, idx) => (
                <tr key={`${log.run_id}-${log.scraper_name}-${idx}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <span className="font-bold text-slate-800">{DOMAIN_LABELS[log.domain] || log.domain}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    <div className="flex flex-col leading-tight">
                      <span>{log.scraper_name}</span>
                      {log.provider_or_retailer && (
                        <span className="text-[10px] text-slate-400">{log.provider_or_retailer}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        log.status === 'SUCCESS'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                      title={log.error_message || undefined}
                    >
                      {log.status === 'SUCCESS' ? '성공' : '실패'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{log.rows_extracted.toLocaleString()}건</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDateTime(log.finished_at)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{log.duration_seconds.toFixed(1)}초</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-[11px] text-slate-400 font-medium">
        기준 시각: {formatDateTime(dataStatus.generated_at)}
      </p>
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
