import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import GaugeChart from '../components/GaugeChart';
import { isConfigured, fetchResponses, fetchConfig, fetchSettings } from '../api/db';
import { getVerifiedStudent } from '../api/student';

function Card({ children, className = '' }) {
  return (
    <div
      className={`bg-white rounded-2xl p-5 ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(25,28,30,0.04), 0 4px 12px rgba(25,28,30,0.03)' }}
    >
      {children}
    </div>
  );
}

export default function ProfilePage() {
  const [responses, setResponses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // 저장된 학생 정보 (앱 종료 전까지 유지)
  const student = useMemo(() => getVerifiedStudent(), []);

  // 로컬 수강신청 이력
  const submissionHistory = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('submissionHistory') || '[]');
      return Array.isArray(arr) ? arr.slice().reverse() : [];
    } catch { return []; }
  }, []);

  // 진로심리검사 기록
  const testHistory = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('testHistory') || '[]'); } catch { return []; }
  }, []);

  // AI 추천 기록
  const aiHistory = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('aiHistory') || '[]'); } catch { return []; }
  }, []);

  const schoolName = settings?.schoolName || localStorage.getItem('school_name') || '';
  const avatarLabel = student.name || student.이름 ? (student.name || student.이름).charAt(0) : '?';
  const studentId = student.studentId || student.학번 || '-';
  const studentName = student.name || student.이름 || '-';
  const studentCode = student.studentCode || student.학생코드 || '-';

  // 내 수강신청 이력 (학번 기반 매칭)
  const myResponses = useMemo(() => {
    if (!studentId || studentId === '-') return [];
    return responses.filter(r => {
      const rid = r.Grade ? `${r.Grade}${String(r.Class).padStart(2,'0')}${String(r.Number).padStart(2,'0')}` : '';
      return rid === studentId;
    });
  }, [responses, studentId]);

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return; }
    Promise.all([
      fetchResponses().catch(() => []),
      fetchConfig().catch(() => []),
      fetchSettings().catch(() => null),
    ]).then(([res, cfg, stg]) => {
      setResponses(Array.isArray(res) ? res : res?.data || []);
      setCourses(Array.isArray(cfg) ? cfg : cfg?.data || []);
      setSettings(stg);
    }).finally(() => setLoading(false));
  }, []);

  // 이수 통계
  const latestResponse = myResponses.length > 0 ? myResponses[myResponses.length - 1] : null;
  const totalCredits = latestResponse ? Number(latestResponse.TotalCredits || latestResponse.totalCredits || 0) : 0;
  const selectedCourses = latestResponse ? (latestResponse.SelectedCourses || latestResponse.selectedCourses || '') : '';
  const selectedList = selectedCourses ? selectedCourses.split(',').map(s => s.trim()).filter(Boolean) : [];
  const validationResult = latestResponse ? (latestResponse.ValidationResult || latestResponse.validationResult || '') : '';
  const isPass = validationResult.includes('통과') || validationResult.includes('충족');
  const major = latestResponse ? (latestResponse.Major || latestResponse.major || '') : '';
  const creditProgress = Math.min(Math.round((totalCredits / 174) * 100), 100);

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f9fb' }}>
      <Header title={schoolName || '내 정보'} avatarLabel={avatarLabel} />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24">
        {/* ── 프로필 카드 ── */}
        <Card className="mb-4">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}>
              {avatarLabel}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>{studentName}</h2>
              <p className="text-sm text-slate-500">학번: {studentId}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>학생코드</p>
              <p className="text-sm font-bold text-indigo-600 tracking-widest font-mono">{studentCode}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-400 mb-1" style={{ fontFamily: "'Inter', sans-serif" }}>희망 진로</p>
              <p className="text-sm font-semibold text-slate-700">{major || '-'}</p>
            </div>
          </div>
        </Card>

        {/* ── 이수 현황 대시보드 ── */}
        <h3 className="text-sm font-bold text-slate-700 mb-2 mt-5" style={{ fontFamily: "'Manrope', sans-serif" }}>수강신청 현황</h3>
        {loading ? (
          <Card className="mb-4"><div className="flex justify-center py-6"><div className="w-6 h-6 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div></Card>
        ) : latestResponse ? (
          <>
            {/* 학점 게이지 */}
            <Card className="mb-3">
              <div className="flex items-center gap-5">
                <GaugeChart value={creditProgress} size={90} color="#4f46e5" label="" />
                <div>
                  <p className="text-2xl font-bold text-indigo-600" style={{ fontFamily: "'Manrope', sans-serif" }}>{totalCredits}<span className="text-sm text-slate-400 font-normal ml-1">/ 174학점</span></p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${isPass ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className={`text-xs font-semibold ${isPass ? 'text-emerald-600' : 'text-red-600'}`}>{isPass ? '요건 충족' : '요건 미달'}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">선택 {selectedList.length}과목</p>
                </div>
              </div>
            </Card>

            {/* 선택 과목 목록 */}
            <Card className="mb-3">
              <p className="text-xs font-semibold text-slate-500 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>선택 과목</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedList.length > 0 ? selectedList.map((name, i) => (
                  <span key={i} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">{name}</span>
                )) : <span className="text-xs text-slate-400">등록된 과목 없음</span>}
              </div>
            </Card>

            {/* 검증 결과 */}
            {validationResult && (
              <Card className="mb-3">
                <p className="text-xs font-semibold text-slate-500 mb-2" style={{ fontFamily: "'Inter', sans-serif" }}>검증 결과</p>
                <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap bg-slate-50 rounded-xl p-3">
                  {validationResult.substring(0, 500)}
                </div>
              </Card>
            )}
          </>
        ) : (
          <Card className="mb-4 text-center">
            <p className="text-sm text-slate-400 py-4">아직 수강신청 이력이 없습니다.</p>
            <p className="text-xs text-slate-300">수강신청 탭에서 과목을 선택하고 제출하세요.</p>
          </Card>
        )}

        {/* ── 로컬 수강신청 이력 (날짜/시간대별) ── */}
        <h3 className="text-sm font-bold text-slate-700 mb-2 mt-5" style={{ fontFamily: "'Manrope', sans-serif" }}>
          수강신청 이력 (이 기기 기준)
        </h3>
        {submissionHistory.length > 0 ? (
          <div className="space-y-2 mb-4">
            {submissionHistory.map((h, i) => (
              <Card key={i} className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {h.studentName ? `${h.studentName} (${h.studentId})` : '내 신청'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{h.dateLabel}</p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                    {h.totalCredits || 0}학점
                  </span>
                </div>
                <div className="text-[0.7rem] text-slate-500 mb-1.5">
                  학생선택 {h.optionalCredits ?? '-'}학점 · 기초교과 {h.foundationCredits ?? '-'}학점
                </div>
                <div className="flex flex-wrap gap-1">
                  {(h.courses || []).slice(0, 12).map((c, j) => (
                    <span
                      key={j}
                      className={`text-[0.65rem] font-medium px-2 py-0.5 rounded-full ${
                        c.required
                          ? 'bg-red-50 text-red-600'
                          : 'bg-emerald-50 text-emerald-700'
                      }`}
                    >
                      {c.subjectName}
                    </span>
                  ))}
                  {(h.courses || []).length > 12 && (
                    <span className="text-[0.65rem] text-slate-400">외 {h.courses.length - 12}개</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mb-4 text-center">
            <p className="text-sm text-slate-400 py-3">기기에 저장된 신청 이력이 없습니다.</p>
            <p className="text-xs text-slate-300">수강신청 → 다음 단계 클릭 시 자동 저장됩니다.</p>
          </Card>
        )}

        {/* ── 진로심리검사 이력 ── */}
        <h3 className="text-sm font-bold text-slate-700 mb-2 mt-5" style={{ fontFamily: "'Manrope', sans-serif" }}>진로심리검사 이력</h3>
        {testHistory.length > 0 ? (
          <div className="space-y-2 mb-4">
            {testHistory.map((t, i) => (
              <Card key={i} className="!p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{t.testName}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{t.date}</p>
                  </div>
                  {t.resultUrl ? (
                    <a href={t.resultUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors">
                      결과 보기
                    </a>
                  ) : (
                    <span className="text-xs text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">완료</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mb-4 text-center">
            <p className="text-sm text-slate-400 py-3">진로심리검사 이력이 없습니다.</p>
            <p className="text-xs text-slate-300">진로 탭 → 심리검사에서 검사를 진행해보세요.</p>
          </Card>
        )}

        {/* ── AI 추천 이력 ── */}
        <h3 className="text-sm font-bold text-slate-700 mb-2 mt-5" style={{ fontFamily: "'Manrope', sans-serif" }}>AI 과목 추천 이력</h3>
        {aiHistory.length > 0 ? (
          <div className="space-y-2 mb-4">
            {aiHistory.map((a, i) => (
              <Card key={i} className="!p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-slate-800">"{a.major}" 진로 추천</p>
                  <p className="text-xs text-slate-400">{a.date}</p>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(a.courses || []).slice(0, 6).map((c, j) => (
                    <span key={j} className="bg-violet-50 text-violet-700 text-xs font-medium px-2 py-0.5 rounded-full">{c}</span>
                  ))}
                  {(a.courses || []).length > 6 && <span className="text-xs text-slate-400">외 {a.courses.length - 6}개</span>}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="mb-4 text-center">
            <p className="text-sm text-slate-400 py-3">AI 추천 이력이 없습니다.</p>
            <p className="text-xs text-slate-300">진로 탭 → AI 추천에서 진로를 입력해보세요.</p>
          </Card>
        )}
      </div>

      <MobileNav />
    </div>
  );
}
