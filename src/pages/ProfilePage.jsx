import { useState, useEffect, useMemo } from 'react';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import { isConfigured, fetchSettings } from '../api/db';
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
  const [settings, setSettings] = useState(null);
  const [openDetailIdx, setOpenDetailIdx] = useState(null);

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

  /* 학교명 표시용 settings만 가볍게 가져옴 */
  useEffect(() => {
    if (!isConfigured()) return;
    fetchSettings().then((stg) => setSettings(stg)).catch(() => {});
  }, []);

  /* 희망 진로 — 우선순위: verifiedStudent > 마지막 신청 이력의 major > 서버 응답 major */
  const major = (
    student.major
    || student.희망진로
    || (submissionHistory[0] && submissionHistory[0].major)
    || ''
  );

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

        {/* ── 수강신청 이력 (디바이스 기준) ── */}
        <h3 className="text-sm font-bold text-slate-700 mb-2 mt-5" style={{ fontFamily: "'Manrope', sans-serif" }}>
          수강신청 이력 (이 기기 기준)
        </h3>
        {submissionHistory.length > 0 ? (
          <div className="space-y-2 mb-4">
            {submissionHistory.map((h, i) => (
              <Card key={i} className="!p-4 cursor-pointer hover:ring-2 hover:ring-indigo-200 transition" >
                <div onClick={() => setOpenDetailIdx(i)}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {h.studentName ? `${h.studentName} (${h.studentId})` : '내 신청'}
                        {h.serverSaved && <span className="ml-1.5 text-[0.6rem] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full align-middle">✓ 서버 제출</span>}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">{h.dateLabel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                        {h.totalCredits || 0}학점
                      </span>
                      <span className="text-slate-300 text-base">›</span>
                    </div>
                  </div>
                  <div className="text-[0.7rem] text-slate-500 mb-1.5">
                    학교지정 {h.requiredCredits ?? '-'}학점 · 학생선택 {h.optionalCredits ?? '-'}학점 · 기초교과 {h.foundationCredits ?? '-'}학점
                    {(h.jointCredits ?? 0) > 0 && (
                      <span className="text-violet-600 font-semibold"> · 공동 {h.jointCredits}학점</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(h.courses || []).slice(0, 12).map((c, j) => (
                      <span
                        key={j}
                        className={`text-[0.65rem] font-medium px-2 py-0.5 rounded-full ${
                          c.joint
                            ? 'bg-violet-50 text-violet-700'
                            : c.required
                              ? 'bg-red-50 text-red-600'
                              : 'bg-emerald-50 text-emerald-700'
                        }`}
                        title={c.joint ? `공동교육과정${c.host ? ' · ' + c.host : ''}` : ''}
                      >
                        {c.joint ? '🏫 ' : ''}{c.subjectName}
                      </span>
                    ))}
                    {(h.courses || []).length > 12 && (
                      <span className="text-[0.65rem] text-slate-400">외 {h.courses.length - 12}개</span>
                    )}
                  </div>
                  <p className="mt-2 text-[0.65rem] text-indigo-500">탭하여 학년·학기별 상세 보기</p>
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

      {openDetailIdx !== null && submissionHistory[openDetailIdx] && (
        <SubmissionDetailModal
          submission={submissionHistory[openDetailIdx]}
          onClose={() => setOpenDetailIdx(null)}
        />
      )}

      <MobileNav />
    </div>
  );
}

/* ─── 신청 이력 상세 모달: 학년·학기 단위 그룹 + 학교지정/학생선택/공동교육과정 표시 ─── */
function SubmissionDetailModal({ submission, onClose }) {
  const grouped = {};
  (submission.courses || []).forEach((c) => {
    const g = c.grade || 0;
    const s = c.semester || 0;
    const key = g && s ? `${g}-${s}` : '미지정';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(c);
  });
  const sortedKeys = Object.keys(grouped).sort();

  function semSummary(items) {
    const total = items.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
    const reqCount = items.filter((c) => c.required).length;
    const optCount = items.filter((c) => !c.required && !c.joint).length;
    const jointCount = items.filter((c) => c.joint).length;
    return { total, reqCount, optCount, jointCount };
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="pt-3 pb-2 flex items-center justify-center">
          <div className="w-12 h-1.5 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="px-5 pb-3 border-b border-slate-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-extrabold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
                수강신청 상세
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">{submission.dateLabel}</p>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">×</button>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="bg-indigo-50 rounded-xl p-2 text-center">
              <div className="text-[0.6rem] text-indigo-500 font-medium">총 학점</div>
              <div className="text-base font-extrabold text-indigo-700" style={{ fontFamily: "'Manrope', sans-serif" }}>{submission.totalCredits || 0}</div>
            </div>
            <div className="bg-red-50 rounded-xl p-2 text-center">
              <div className="text-[0.6rem] text-red-500 font-medium">학교지정</div>
              <div className="text-base font-extrabold text-red-600" style={{ fontFamily: "'Manrope', sans-serif" }}>{submission.requiredCredits ?? '-'}</div>
            </div>
            <div className="bg-emerald-50 rounded-xl p-2 text-center">
              <div className="text-[0.6rem] text-emerald-600 font-medium">학생선택</div>
              <div className="text-base font-extrabold text-emerald-700" style={{ fontFamily: "'Manrope', sans-serif" }}>{submission.optionalCredits ?? '-'}</div>
            </div>
            <div className="bg-violet-50 rounded-xl p-2 text-center">
              <div className="text-[0.6rem] text-violet-600 font-medium">공동교육</div>
              <div className="text-base font-extrabold text-violet-700" style={{ fontFamily: "'Manrope', sans-serif" }}>{submission.jointCredits ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Semesters */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {sortedKeys.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">신청 과목이 없습니다.</p>
          ) : (
            sortedKeys.map((key) => {
              const items = grouped[key];
              const { total, reqCount, optCount, jointCount } = semSummary(items);
              return (
                <div key={key} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <h4 className="text-sm font-bold text-indigo-700" style={{ fontFamily: "'Manrope', sans-serif" }}>
                      {key === '미지정' ? '미지정' : `${key.split('-')[0]}학년 ${key.split('-')[1]}학기`}
                    </h4>
                    <div className="text-[0.65rem] text-slate-500">
                      <span className="font-mono font-semibold text-slate-700">{total}학점</span>
                      <span className="text-slate-300 mx-1">·</span>
                      {reqCount > 0 && <span className="text-red-600">필수 {reqCount}</span>}
                      {reqCount > 0 && (optCount > 0 || jointCount > 0) && <span className="text-slate-300 mx-1">·</span>}
                      {optCount > 0 && <span className="text-emerald-600">선택 {optCount}</span>}
                      {optCount > 0 && jointCount > 0 && <span className="text-slate-300 mx-1">·</span>}
                      {jointCount > 0 && <span className="text-violet-600">공동 {jointCount}</span>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {items.map((c, i) => (
                      <div
                        key={i}
                        className={`rounded-xl px-3 py-2 flex items-center justify-between border ${
                          c.joint
                            ? 'bg-violet-50/70 border-violet-200'
                            : c.required
                              ? 'bg-red-50/70 border-red-200'
                              : 'bg-emerald-50/70 border-emerald-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className={`px-1.5 py-0.5 rounded text-[0.6rem] font-bold flex-shrink-0 ${
                            c.joint
                              ? 'bg-violet-200 text-violet-800'
                              : c.required
                                ? 'bg-red-200 text-red-800'
                                : 'bg-emerald-200 text-emerald-800'
                          }`}>
                            {c.joint ? '공동교육' : c.required ? '학교지정' : '학생선택'}
                          </span>
                          <span className="text-sm text-slate-800 font-medium truncate">{c.subjectName}</span>
                          {c.joint && c.host && (
                            <span className="text-[0.65rem] text-violet-600 flex-shrink-0">🏫 {c.host}</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end flex-shrink-0">
                          <span className="text-xs font-mono font-semibold text-slate-700">{c.credits}학점</span>
                          {c.subCategory && (
                            <span className="text-[0.6rem] text-slate-400">{c.subCategory}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
