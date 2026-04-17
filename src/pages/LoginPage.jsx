import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { init, verifyStudent } from '../api/db.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [studentId, setStudentId] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /* If ?key= is present, decode it and initialise the API URL */
  useEffect(() => {
    const key = searchParams.get('key');
    if (key) {
      try {
        const url = atob(key);
        init(url);
      } catch {
        /* ignore malformed base-64 */
      }
    }
  }, [searchParams]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!studentId.trim() || !studentCode.trim() || !name.trim()) {
      setError('모든 항목을 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      const res = await verifyStudent({
        studentCode: studentCode.trim(),
        studentId: studentId.trim(),
        name: name.trim(),
      });

      /* Store verified student info for downstream pages */
      sessionStorage.setItem(
        'verifiedStudent',
        JSON.stringify({
          studentCode: studentCode.trim(),
          studentId: studentId.trim(),
          name: name.trim(),
          ...res,
        }),
      );

      navigate('/courses');
    } catch (err) {
      setError(err.message || '인증에 실패했습니다. 정보를 다시 확인해 주세요.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#f7f9fb', fontFamily: "'Manrope', sans-serif" }}
    >
      {/* ── Top bar ── */}
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-600 hover:bg-white/70 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="text-sm font-bold text-slate-700 tracking-tight">학생 인증</span>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 pb-24">
        {/* Icon + badge */}
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
            </svg>
          </div>
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-semibold text-indigo-700"
            style={{ backgroundColor: '#e0e7ff' }}
          >
            학생 본인 인증
          </span>
        </div>

        {/* Title / subtitle */}
        <h1
          className="text-slate-800 font-bold text-center mb-2"
          style={{ fontSize: '1.5rem', fontFamily: "'Manrope', sans-serif" }}
        >
          학업 증명 및 인증
        </h1>
        <p className="text-sm text-slate-500 text-center max-w-xs mb-6 leading-relaxed">
          본인 확인을 위해 학교에서 발급받은 학번과 인증 코드를 입력해 주세요.
        </p>

        {/* ── Card ── */}
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm bg-white rounded-2xl p-5"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
        >
          {/* Card header */}
          <div className="flex items-center gap-2 mb-5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span className="text-sm font-bold text-slate-700">인증 정보 입력</span>
          </div>

          {/* Name input */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">이름</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          {/* Student ID input */}
          <div className="mb-3">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">학번</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </svg>
              </span>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="학번을 입력하세요"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          {/* Student code input */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">관리자 발급 코드</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
              </span>
              <input
                type="text"
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value.toUpperCase())}
                placeholder="6자리 코드를 입력하세요"
                maxLength={10}
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm text-slate-700 placeholder:text-slate-300 tracking-wider uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-colors"
              />
            </div>
          </div>

          {/* Info checkbox / note */}
          <div className="flex items-start gap-2 mb-5">
            <div className="mt-0.5 w-4 h-4 rounded border border-slate-300 flex items-center justify-center flex-shrink-0">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              인증 코드 분실시 담임선생님에게 문의 바랍니다
            </p>
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
              <p className="text-xs text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl text-white text-sm font-bold tracking-tight transition-opacity disabled:opacity-60"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                인증 중...
              </span>
            ) : (
              '인증 및 다음 단계로 →'
            )}
          </button>

          {/* Footer help icons */}
          <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-slate-100">
            <button type="button" className="text-slate-300 hover:text-slate-400 transition-colors" title="도움말">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            <button type="button" className="text-slate-300 hover:text-slate-400 transition-colors" title="이메일">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </button>
            <button type="button" className="text-slate-300 hover:text-slate-400 transition-colors" title="전화">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          </div>
        </form>
      </div>

      {/* ── Bottom decorative nav ── */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100"
        style={{ height: '56px', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-[56px] max-w-lg mx-auto px-4">
          {[
            { label: '진행현황', icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z' },
            { label: '교육봇', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
            { label: '고객 지원', icon: 'M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0z' },
            { label: '학생 인증', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
          ].map((tab) => (
            <button
              key={tab.label}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-slate-400"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d={tab.icon} />
              </svg>
              <span className="text-[0.6rem] font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
