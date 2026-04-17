import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import GaugeChart from '../components/GaugeChart';
import {
  isConfigured,
  fetchResponses,
  fetchConfig,
  fetchSettings,
  fetchRegistry,
} from '../api/db';

const ITEMS_PER_PAGE = 8;

const semesterBars = [
  { label: '1-1', value: 68 },
  { label: '1-2', value: 55 },
  { label: '2-1', value: 80 },
  { label: '2-2', value: 62 },
  { label: '3-1', value: 88 },
  { label: '3-2', value: 42 },
];

const statusBadge = {
  통과: 'bg-emerald-100 text-emerald-700',
  미달: 'bg-red-100 text-red-700',
  진행중: 'bg-amber-100 text-amber-700',
};

export default function AdminPage() {
  const [responses, setResponses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all' | 'pass' | 'fail'
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (!isConfigured()) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const [resData, cfgData, setData, regData] = await Promise.all([
        fetchResponses(),
        fetchConfig(),
        fetchSettings(),
        fetchRegistry(),
      ]);
      setResponses(Array.isArray(resData) ? resData : resData?.data || []);
      setCourses(Array.isArray(cfgData) ? cfgData : cfgData?.data || []);
      setSettings(setData);
      setRegistry(Array.isArray(regData) ? regData : regData?.data || []);
    } catch (err) {
      console.error('AdminPage loadData error:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    setCurrentPage(1);
    loadData();
  }

  /* ── Computed stats ── */
  const totalStudents = responses.length || 7;
  const failCount =
    responses.length > 0
      ? responses.filter((r) => r.status === '미달').length
      : 5;
  const avgCredits =
    responses.length > 0
      ? (
          responses.reduce((sum, r) => sum + (Number(r.credits) || 0), 0) /
          responses.length
        ).toFixed(1)
      : '171.6';
  const passRate =
    responses.length > 0
      ? (
          (responses.filter((r) => r.status === '통과' || r.status === '이수').length /
            responses.length) *
          100
        ).toFixed(0)
      : '60';

  /* ── Filter + Search ── */
  const tableData = (responses.length > 0 ? responses : placeholderRows())
    .filter((row) => {
      if (filter === 'pass') return row.status === '통과' || row.status === '이수';
      if (filter === 'fail') return row.status === '미달';
      return true;
    })
    .filter((row) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (row.name || '').toLowerCase().includes(q) ||
        (row.studentId || '').toLowerCase().includes(q) ||
        (row.course || row.subject || '').toLowerCase().includes(q)
      );
    });

  const totalPages = Math.max(1, Math.ceil(tableData.length / ITEMS_PER_PAGE));
  const paged = tableData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  // Reset page when filter / search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, search]);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar activePath="/admin" />

      {/* Main content */}
      <main className="flex-1 ml-[240px]">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          {/* ── Top Bar ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
            <div>
              <h1
                className="text-2xl font-bold text-slate-900"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                OO고등학교 학점 이수 현황
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                XXXX학년도 1학기 기준
              </p>
            </div>
            <button
              onClick={handleRefresh}
              className="px-5 py-2.5 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold rounded-xl transition-colors self-start sm:self-auto"
            >
              새로고침
            </button>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="👥" label="전체 학생 수" value={totalStudents} unit="명" color="#4f46e5" />
            <StatCard icon="⚠️" label="미달 결과" value={failCount} unit="명" color="#dc2626" />
            <StatCard icon="📊" label="평균 이수 학점" value={avgCredits} unit="학점" color="#4f46e5" />
            <StatCard icon="✅" label="검증 통과율" value={`${passRate}`} unit="%" color="#059669" />
          </div>

          {/* ── Gauge Charts Row ── */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2
              className="text-base font-bold text-slate-800 mb-5"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              교육과정 이수 기준 충족 현황
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              <GaugeChart value={58} label="총 이수 학점" size={120} color="#4f46e5" />
              <GaugeChart value={90} label="기초교과비율" size={120} color="#059669" />
              <GaugeChart value={80} label="예술교과 학점" size={120} color="#d97706" />
              <GaugeChart value={100} label="교양교과 학점" size={120} color="#059669" />
            </div>
          </div>

          {/* ── Two Charts Side by Side ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Donut – 교과군별 학점분포 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center">
              <h2
                className="text-base font-bold text-slate-800 mb-4 self-start"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                교과군별 학점분포
              </h2>
              <div className="relative">
                <GaugeChart value={100} size={180} color="#4f46e5" />
                {/* Overlay center label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span
                    className="text-2xl font-bold text-indigo-600"
                    style={{ fontFamily: "'Manrope', sans-serif" }}
                  >
                    {avgCredits}
                  </span>
                  <span className="text-xs text-slate-500 font-medium">이수학점</span>
                </div>
              </div>
            </div>

            {/* Bar Chart – 학년·학기별 개설과목 수 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2
                className="text-base font-bold text-slate-800 mb-5"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                학년·학기별 개설과목 수
              </h2>
              <div className="flex items-end gap-4 h-48">
                {semesterBars.map((s) => (
                  <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-600">{s.value}</span>
                    <div
                      className="w-full rounded-t-lg"
                      style={{
                        height: `${(s.value / 100) * 160}px`,
                        background: 'linear-gradient(180deg, #6366f1 0%, #4f46e5 100%)',
                      }}
                    />
                    <span className="text-[0.65rem] text-slate-500 font-medium mt-1">
                      {s.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Student Table ── */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2
                className="text-base font-bold text-slate-800"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                학생별 이수 현황
              </h2>
              <div className="flex items-center gap-2">
                {/* Search */}
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="검색..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
                  />
                </div>
                {/* Filter buttons */}
                {[
                  { key: 'all', label: '전체' },
                  { key: 'pass', label: '통과' },
                  { key: 'fail', label: '미달' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      filter === f.key
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">학번</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">이름</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">선택과목</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">이수현황</th>
                        <th className="text-right py-3 px-3 text-slate-500 font-medium text-xs">학점</th>
                        <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-3 px-3 text-slate-600 font-mono text-xs">
                            {row.studentId || '-'}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-800">
                            {row.name || '-'}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {row.course || row.subject || '-'}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                row.completion === '이수'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : row.completion === '미이수'
                                  ? 'bg-red-100 text-red-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.completion || '진행중'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-800">
                            {row.credits ?? '-'}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                statusBadge[row.status] || 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.status || '확인중'}
                            </span>
                          </td>
                        </tr>
                      ))}
                      {paged.length === 0 && (
                        <tr>
                          <td colSpan="6" className="py-12 text-center text-slate-400">
                            검색 결과가 없습니다.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-center gap-2 mt-5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    이전
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1 ||
                        p === totalPages ||
                        Math.abs(p - currentPage) <= 1,
                    )
                    .map((p, i, arr) => (
                      <span key={p} className="flex items-center gap-2">
                        {i > 0 && arr[i - 1] !== p - 1 && (
                          <span className="text-slate-300">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(p)}
                          className={`w-8 h-8 rounded-lg text-sm font-medium ${
                            p === currentPage
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p}
                        </button>
                      </span>
                    ))}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40"
                  >
                    다음
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/* Placeholder rows when no API data */
function placeholderRows() {
  return [
    { studentId: '20241001', name: '김민수', course: '화학 I', completion: '이수', credits: 3, status: '통과' },
    { studentId: '20241002', name: '이서연', course: '물리학 II', completion: '이수', credits: 3, status: '통과' },
    { studentId: '20241003', name: '박지훈', course: '미술창작', completion: '미이수', credits: 2, status: '미달' },
    { studentId: '20241004', name: '최유진', course: '영어회화', completion: '미이수', credits: 2, status: '미달' },
    { studentId: '20241005', name: '정해린', course: '국어', completion: '이수', credits: 3, status: '미달' },
    { studentId: '20241006', name: '한도윤', course: '수학 II', completion: '미이수', credits: 3, status: '미달' },
    { studentId: '20241007', name: '오수빈', course: '윤리와사상', completion: '이수', credits: 2, status: '미달' },
  ];
}
