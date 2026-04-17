import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import GaugeChart from '../components/GaugeChart';
import MobileNav from '../components/MobileNav';
import {
  isConfigured,
  fetchResponses,
  fetchConfig,
  fetchSettings,
} from '../api/db';

const ITEMS_PER_PAGE = 8;

const semesterData = [
  { label: '1-1', value: 72 },
  { label: '1-2', value: 58 },
  { label: '2-1', value: 85 },
  { label: '2-2', value: 64 },
  { label: '3-1', value: 90 },
  { label: '3-2', value: 46 },
];

const typeBadgeColor = {
  필수: 'bg-indigo-100 text-indigo-700',
  선택: 'bg-violet-100 text-violet-700',
  교양: 'bg-emerald-100 text-emerald-700',
  예술: 'bg-amber-100 text-amber-700',
};

export default function CreditsPage() {
  const [responses, setResponses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
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
      const [resData, cfgData, setData] = await Promise.all([
        fetchResponses(),
        fetchConfig(),
        fetchSettings(),
      ]);
      setResponses(Array.isArray(resData) ? resData : resData?.data || []);
      setCourses(Array.isArray(cfgData) ? cfgData : cfgData?.data || []);
    } catch (err) {
      console.error('CreditsPage loadData error:', err);
    } finally {
      setLoading(false);
    }
  }

  /* ── Computed stats ── */
  const totalStudents = responses.length || 1248;
  const completedCount = responses.filter((r) => r.status === '이수').length || 1102;
  const avgCredits =
    responses.length > 0
      ? (
          responses.reduce((sum, r) => sum + (Number(r.credits) || 0), 0) /
          responses.length
        ).toFixed(1)
      : '168.4';
  const passRate =
    responses.length > 0
      ? (
          (responses.filter((r) => r.status === '통과' || r.status === '이수').length /
            responses.length) *
          100
        ).toFixed(1)
      : '84.2';

  /* ── Pagination ── */
  const tableData = responses.length > 0 ? responses : placeholderRows();
  const totalPages = Math.max(1, Math.ceil(tableData.length / ITEMS_PER_PAGE));
  const paged = tableData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  if (!isConfigured() && !loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <div className="bg-white rounded-2xl shadow p-10 text-center max-w-md">
          <p className="text-2xl font-bold text-slate-700 mb-2">API 연결 필요</p>
          <p className="text-slate-500 text-sm">
            학점 이수 현황 데이터를 불러오려면 먼저 API URL을 설정해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar – desktop only */}
      <div className="hidden lg:block">
        <Sidebar activePath="/credits" />
      </div>

      {/* Main content */}
      <main className="flex-1 lg:ml-[240px] pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* ── Top Bar ── */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-6">
            <div>
              <h1
                className="text-2xl font-bold text-slate-900"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                {localStorage.getItem('school_name') || 'OO고등학교'} 학점 이수 현황
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                실시간 학점 상태 및 졸업 요건 진단 시스템
              </p>
            </div>
            <button className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors self-start sm:self-auto">
              분석리포트생성
            </button>
          </div>

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard icon="👥" label="전체 학생 수" value={totalStudents.toLocaleString()} unit="명" color="#4f46e5" />
            <StatCard icon="📋" label="이수 현황 건" value={completedCount.toLocaleString()} unit="건" color="#7c3aed" />
            <StatCard icon="📊" label="평균 이수 학점" value={avgCredits} unit="pt" color="#059669" />
            <StatCard icon="✅" label="검증 통과율" value={passRate} unit="%" color="#d97706" />
          </div>

          {/* ── Bar Chart ── */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2
              className="text-base font-bold text-slate-800 mb-5"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              학년·학기별 개설과목 수
            </h2>
            <div className="flex items-end gap-4 h-48">
              {semesterData.map((s) => (
                <div key={s.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold text-slate-600">{s.value}</span>
                  <div
                    className="w-full rounded-t-lg"
                    style={{
                      height: `${(s.value / 100) * 160}px`,
                      background: 'linear-gradient(180deg, #4f46e5 0%, #3525cd 100%)',
                    }}
                  />
                  <span className="text-[0.65rem] text-slate-500 font-medium mt-1">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Path to Graduation ── */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <h2
              className="text-base font-bold text-slate-800 mb-5"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              Path to Graduation
            </h2>
            <div className="flex items-center gap-0">
              {/* Step 1 */}
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-sm font-bold mb-2">
                  ✓
                </div>
                <p className="text-sm font-semibold text-slate-800">1학년</p>
                <p className="text-xs text-emerald-600 font-medium">수료 완료</p>
              </div>
              <div className="h-0.5 flex-1 bg-emerald-400 -mt-6" />
              {/* Step 2 */}
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center text-sm font-bold mb-2 ring-4 ring-indigo-100">
                  2
                </div>
                <p className="text-sm font-semibold text-slate-800">2학년</p>
                <p className="text-xs text-indigo-600 font-medium">지금 검증 중</p>
              </div>
              <div className="h-0.5 flex-1 bg-slate-200 -mt-6" />
              {/* Step 3 */}
              <div className="flex-1 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-400 flex items-center justify-center text-sm font-bold mb-2">
                  3
                </div>
                <p className="text-sm font-semibold text-slate-400">3학년</p>
                <p className="text-xs text-slate-400 font-medium">남은 과정 도래</p>
              </div>
            </div>
          </div>

          {/* ── Gauge Charts ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Donut – 교과군별 학점분포 */}
            <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col items-center">
              <h2
                className="text-base font-bold text-slate-800 mb-4 self-start"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                교과군별 학점분포
              </h2>
              <GaugeChart value={100} label="전체 이수" size={160} color="#4f46e5" />
            </div>

            {/* 졸업 요건 이수 현황 */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2
                className="text-base font-bold text-slate-800 mb-4"
                style={{ fontFamily: "'Manrope', sans-serif" }}
              >
                졸업 요건 이수 현황
              </h2>
              <div className="flex items-center justify-around mt-4">
                <GaugeChart value={56} label="필수교과" size={100} color="#4f46e5" />
                <GaugeChart value={65} label="예술교과" size={100} color="#d97706" />
                <GaugeChart value={45} label="교양교과" size={100} color="#059669" />
              </div>
            </div>
          </div>

          {/* ── Student Table ── */}
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h2
              className="text-base font-bold text-slate-800 mb-4"
              style={{ fontFamily: "'Manrope', sans-serif" }}
            >
              학생별 이수 현황
            </h2>

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
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">날짜</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">이름</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">과목/교과</th>
                        <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">유형</th>
                        <th className="text-right py-3 px-3 text-slate-500 font-medium text-xs">학점</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paged.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors"
                        >
                          <td className="py-3 px-3 text-slate-600">{row.date || '-'}</td>
                          <td className="py-3 px-3 font-medium text-slate-800">{row.name || '-'}</td>
                          <td className="py-3 px-3 text-slate-600">{row.course || row.subject || '-'}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                typeBadgeColor[row.type] || 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {row.type || '일반'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-800">
                            {row.credits ?? '-'}
                          </td>
                        </tr>
                      ))}
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

      {/* Mobile Nav – mobile only */}
      <div className="lg:hidden">
        <MobileNav />
      </div>
    </div>
  );
}

/* Placeholder rows when no API data */
function placeholderRows() {
  return [
    { date: '2026-03-15', name: '김민수', course: '국어', type: '필수', credits: 3 },
    { date: '2026-03-15', name: '이서연', course: '수학 I', type: '필수', credits: 3 },
    { date: '2026-03-14', name: '박지훈', course: '영어회화', type: '선택', credits: 2 },
    { date: '2026-03-14', name: '최유진', course: '미술', type: '예술', credits: 2 },
    { date: '2026-03-13', name: '정해린', course: '윤리와사상', type: '교양', credits: 2 },
    { date: '2026-03-13', name: '한도윤', course: '물리학 I', type: '선택', credits: 3 },
    { date: '2026-03-12', name: '오수빈', course: '한국사', type: '필수', credits: 3 },
    { date: '2026-03-12', name: '윤재원', course: '음악', type: '예술', credits: 2 },
  ];
}
