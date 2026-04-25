import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import GaugeChart from '../components/GaugeChart';
import {
  isConfigured,
  fetchConfig,
  fetchSettings,
  fetchJointCurriculum,
} from '../api/db';
import { getVerifiedStudent, getStudentAvatarLabel } from '../api/student';

/* ─── Field mapping (CoursesPage 와 동일 규칙) ─── */
const FIELD_MAP = {
  '과목명': 'subjectName',
  '학점': 'credits',
  '교과군': 'category',
  '교과영역': 'category',
  '교과(군)': 'subCategory',
  '세부교과': 'subCategory',
  '학년': 'grade',
  '학기': 'semester',
  '필수여부': 'required',
  '영문ID': 'slug',
  '과목코드': 'code',
  '추천': 'recommended',
  '선이수과목': 'prerequisites',
  '선수과목': 'prerequisites',
};
function normaliseCourse(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) out[FIELD_MAP[k] || k] = v;
  out.credits = Number(out.credits) || 0;
  out.grade = Number(out.grade) || 0;
  out.semester = Number(out.semester) || 0;
  const req = String(out.required || '').toUpperCase().trim();
  out.required = req === 'TRUE' || req === 'Y' || req === '1' || req === '필수' || out.required === true;
  return out;
}

/* ─── 기초교과 정의 (CoursesPage 와 동일) ─── */
const FOUNDATION_SUBCATS = ['국어', '영어', '수학'];
const FOUNDATION_NAMES = ['한국사1', '한국사2'];
function isFoundationCourse(c) {
  const sub = String(c.subCategory || '').trim();
  if (FOUNDATION_SUBCATS.includes(sub)) return true;
  const name = String(c.subjectName || '').trim();
  return FOUNDATION_NAMES.includes(name);
}

const CATEGORY_COLORS = {
  '기초교과': '#4f46e5',
  '탐구교과': '#10b981',
  '예술교과': '#ec4899',
  '체육교과': '#f43f5e',
  '교양교과': '#f59e0b',
  '공동교육과정': '#7c3aed',
};
function pickColor(name, idx = 0) {
  return CATEGORY_COLORS[name] || ['#4f46e5', '#10b981', '#ec4899', '#f43f5e', '#f59e0b', '#7c3aed', '#06b6d4'][idx % 7];
}

export default function CreditsPage() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const student = useMemo(() => getVerifiedStudent(), []);
  const avatarLabel = getStudentAvatarLabel();
  const schoolName = settings?.schoolName || localStorage.getItem('school_name') || '이수현황';
  const studentName = student.name || student.이름 || '';
  const studentId = student.studentId || student.학번 || '';

  /* 학생이 현재 선택한 과목 ID 목록 (sessionStorage) */
  const selectedIdSet = useMemo(() => {
    try {
      const cur = JSON.parse(sessionStorage.getItem('currentSelection') || '[]');
      if (Array.isArray(cur) && cur.length > 0) return new Set(cur);
    } catch {}
    try {
      const pending = JSON.parse(sessionStorage.getItem('pendingSelectedCourses') || '[]');
      if (Array.isArray(pending)) return new Set(pending.map((p) => p.id));
    } catch {}
    return new Set();
  }, []);

  /* 신청 이력 (localStorage) */
  const submissionHistory = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('submissionHistory') || '[]');
      return Array.isArray(arr) ? arr.slice().reverse() : [];
    } catch { return []; }
  }, []);

  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const [cfg, stg, jc] = await Promise.all([
          fetchConfig().catch(() => []),
          fetchSettings().catch(() => null),
          fetchJointCurriculum().catch(() => []),
        ]);
        if (cancelled) return;

        const rawCourses = Array.isArray(cfg) ? cfg : cfg?.data || [];
        const proc = rawCourses.map((c, i) => ({
          id: c.id ?? c.code ?? `course-${i}`,
          joint: false,
          ...normaliseCourse(c),
        }));
        const rawJoint = Array.isArray(jc) ? jc : jc?.data || [];
        const procJoint = rawJoint.map((c, i) => {
          const norm = normaliseCourse(c);
          return {
            id: `joint-${c.slug || norm.slug || i}-${i}`,
            joint: true,
            host: c.거점학교 || c.host || '',
            ...norm,
            required: false,
          };
        });
        setCourses([...proc, ...procJoint]);
        setSettings(stg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  /* 선택된 과목 모음 (필수 자동 포함) */
  const selectedCourses = useMemo(() => {
    if (courses.length === 0) return [];
    return courses.filter((c) => c.required || selectedIdSet.has(c.id));
  }, [courses, selectedIdSet]);

  /* 학점 합계 */
  const totalCredits = selectedCourses.reduce((s, c) => s + c.credits, 0);
  const requiredCredits = selectedCourses.filter((c) => c.required).reduce((s, c) => s + c.credits, 0);
  const optionalCredits = selectedCourses.filter((c) => !c.required && !c.joint).reduce((s, c) => s + c.credits, 0);
  const jointCredits = selectedCourses.filter((c) => c.joint).reduce((s, c) => s + c.credits, 0);
  const foundationCredits = selectedCourses.filter(isFoundationCourse).reduce((s, c) => s + c.credits, 0);
  const requiredTotalCredits = Number(settings?.requiredTotalCredits) || 180;
  const totalProgress = Math.min(Math.round((totalCredits / requiredTotalCredits) * 100), 100);

  /* 교과군별 학점 분포 */
  const categoryBreakdown = useMemo(() => {
    const map = {};
    selectedCourses.forEach((c) => {
      const key = c.joint ? '공동교육과정' : (c.category || '기타');
      map[key] = (map[key] || 0) + c.credits;
    });
    const sum = Object.values(map).reduce((a, b) => a + b, 0) || 1;
    return Object.entries(map)
      .map(([name, credits], i) => ({ name, credits, ratio: Math.round((credits / sum) * 100), color: pickColor(name, i) }))
      .sort((a, b) => b.credits - a.credits);
  }, [selectedCourses]);

  /* 학기별 학점 */
  const semesterBreakdown = useMemo(() => {
    const map = {};
    selectedCourses.forEach((c) => {
      if (!c.grade || !c.semester) return;
      const k = `${c.grade}-${c.semester}`;
      if (!map[k]) map[k] = { key: k, label: `${c.grade}-${c.semester}학기`, credits: 0, count: 0, jointCount: 0 };
      map[k].credits += c.credits;
      map[k].count += 1;
      if (c.joint) map[k].jointCount += 1;
    });
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [selectedCourses]);

  /* 교과별 최소 이수학점 (관리자 설정) */
  const minCreditRules = Array.isArray(settings?.minCreditRules) ? settings.minCreditRules : [];
  const minCreditStatus = useMemo(() => minCreditRules.map((rule) => {
    const sum = selectedCourses.reduce((acc, c) => {
      if (rule.type === 'category' && String(c.category || '').trim() === rule.name) return acc + c.credits;
      if (rule.type === 'subCategory' && String(c.subCategory || '').trim() === rule.name) return acc + c.credits;
      return acc;
    }, 0);
    return { ...rule, current: sum, ok: sum >= Number(rule.min || 0) };
  }), [minCreditRules, selectedCourses]);

  /* 검증 결과 요약 */
  const issues = [];
  if (totalCredits < requiredTotalCredits) issues.push(`총 이수학점 부족 (${totalCredits}/${requiredTotalCredits})`);
  if (totalCredits > 0 && foundationCredits > totalCredits * 0.5) {
    issues.push(`기초교과 50% 초과 (${foundationCredits}/${totalCredits})`);
  }
  minCreditStatus.forEach((s) => {
    if (!s.ok) issues.push(`${s.name} ${s.current}/${s.min}학점`);
  });
  const allOk = issues.length === 0 && selectedCourses.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f9fb' }}>
        <Header title={schoolName} avatarLabel={avatarLabel} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
        <MobileNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f9fb' }}>
      <Header title={schoolName} avatarLabel={avatarLabel} />

      <div className="flex-1 overflow-y-auto px-5 pt-4 pb-24 max-w-2xl mx-auto w-full">

        {/* 학생 헤더 */}
        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
          >
            {avatarLabel}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {studentName || '학생'} <span className="text-xs text-slate-400 font-normal">{studentId}</span>
            </div>
            <div className="text-xs text-slate-500">나의 수강신청 현황 · {selectedCourses.length}과목 선택</div>
          </div>
        </div>

        {/* 메인 게이지 */}
        <div className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
          <div className="flex items-center gap-5">
            <GaugeChart
              value={totalProgress}
              size={110}
              color={totalCredits >= requiredTotalCredits ? '#10b981' : '#4f46e5'}
              label=""
            />
            <div className="flex-1 min-w-0">
              <div className="text-3xl font-extrabold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
                {totalCredits}
                <span className="text-sm text-slate-400 font-medium ml-1">/ {requiredTotalCredits}학점</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className={`inline-block w-2 h-2 rounded-full ${totalCredits >= requiredTotalCredits ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className={`text-xs font-semibold ${totalCredits >= requiredTotalCredits ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {totalCredits >= requiredTotalCredits ? '졸업 학점 충족' : `${requiredTotalCredits - totalCredits}학점 더 필요`}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1.5 leading-snug">
                필수 {requiredCredits} · 학생선택 {optionalCredits}
                {jointCredits > 0 && <span className="text-violet-600"> · 공동 {jointCredits}</span>}
              </div>
            </div>
          </div>
        </div>

        {/* 검증 상태 */}
        <div className={`rounded-2xl p-4 mb-3 shadow-sm border ${
          allOk ? 'bg-emerald-50 border-emerald-200' : issues.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
        }`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{allOk ? '✅' : issues.length > 0 ? '⚠️' : 'ℹ️'}</span>
            <span className={`text-sm font-bold ${allOk ? 'text-emerald-700' : issues.length > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
              {allOk
                ? '모든 학점 이수 규칙을 충족했습니다'
                : selectedCourses.length === 0
                  ? '아직 과목을 선택하지 않았습니다'
                  : `검증 실패 ${issues.length}건`}
            </span>
          </div>
          {selectedCourses.length === 0 ? (
            <button
              onClick={() => navigate('/courses')}
              className="mt-2 w-full py-2 rounded-xl text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
            >
              수강신청 하러 가기 →
            </button>
          ) : issues.length > 0 ? (
            <ul className="text-[0.72rem] text-rose-700 leading-snug list-disc list-inside space-y-0.5 mt-1">
              {issues.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          ) : null}
        </div>

        {/* 기초교과 50% */}
        <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-700">기초교과 한도 (50%)</span>
            <span className={`text-xs font-mono ${
              foundationCredits > totalCredits * 0.5 && totalCredits > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'
            }`}>
              {foundationCredits} / {totalCredits > 0 ? Math.floor(totalCredits * 0.5) : 0}학점
              {totalCredits > 0 && (
                <span className="text-slate-400"> · {Math.round((foundationCredits / totalCredits) * 100)}%</span>
              )}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${totalCredits > 0 ? Math.min((foundationCredits / (totalCredits * 0.5)) * 100, 100) : 0}%`,
                background: foundationCredits > totalCredits * 0.5 && totalCredits > 0
                  ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
                  : 'linear-gradient(135deg, #3525cd, #4f46e5)',
              }}
            />
          </div>
          <p className="text-[0.65rem] text-slate-400 mt-1">국·영·수 + 한국사1·2 합계</p>
        </div>

        {/* 교과별 최소 이수학점 — 수치 */}
        {minCreditStatus.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="text-xs font-bold text-slate-700 mb-2">교과별 최소 이수학점</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.72rem]">
              {minCreditStatus.map((s, i) => (
                <span key={i} className="inline-flex items-center gap-1">
                  <span className="text-slate-600">{s.name}</span>
                  <span className={`font-mono ${s.ok ? 'text-emerald-600' : 'text-rose-600 font-bold'}`}>
                    {s.current}/{s.min}
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 교과군별 분포 */}
        {categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
              교과군별 학점 분포
            </div>
            <div className="space-y-2">
              {categoryBreakdown.map((cat) => (
                <div key={cat.name}>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="text-slate-700 font-medium">{cat.name}</span>
                    <span className="text-slate-500 font-mono">
                      {cat.credits}학점 <span className="text-slate-400">({cat.ratio}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${cat.ratio}%`, backgroundColor: cat.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 학기별 학점 */}
        {semesterBreakdown.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
              학기별 신청 현황
            </div>
            <div className="grid grid-cols-2 gap-2">
              {semesterBreakdown.map((s) => (
                <div key={s.key} className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-500 font-semibold">{s.label}</div>
                  <div className="text-lg font-extrabold text-indigo-600 mt-0.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {s.credits}<span className="text-xs text-slate-400 font-normal ml-1">학점</span>
                  </div>
                  <div className="text-[0.65rem] text-slate-500">
                    {s.count}과목
                    {s.jointCount > 0 && <span className="text-violet-600"> · 공동 {s.jointCount}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 선택 과목 목록 */}
        {selectedCourses.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-2.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
              내 선택 과목 ({selectedCourses.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {selectedCourses.map((c) => (
                <span
                  key={c.id}
                  className={`text-[0.7rem] font-medium px-2 py-1 rounded-full ${
                    c.joint
                      ? 'bg-violet-50 text-violet-700'
                      : c.required
                        ? 'bg-red-50 text-red-600'
                        : 'bg-indigo-50 text-indigo-700'
                  }`}
                  title={`${c.grade}-${c.semester}학기 · ${c.credits}학점`}
                >
                  {c.joint ? '🏫 ' : ''}{c.subjectName}
                  <span className="ml-1 text-slate-400">{c.credits}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 신청 이력 */}
        {submissionHistory.length > 0 && (
          <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-2.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
              최근 신청 이력
            </div>
            <div className="space-y-2">
              {submissionHistory.slice(0, 5).map((h, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-slate-700 font-medium truncate">{h.dateLabel}</div>
                    <div className="text-[0.65rem] text-slate-400">
                      {h.totalCredits}학점 · {(h.courses || []).length}과목
                      {(h.jointCredits ?? 0) > 0 && <span className="text-violet-600"> · 공동 {h.jointCredits}</span>}
                    </div>
                  </div>
                  <span className="text-[0.65rem] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    저장됨
                  </span>
                </div>
              ))}
            </div>
            {submissionHistory.length > 5 && (
              <button
                onClick={() => navigate('/profile')}
                className="mt-2 text-xs text-indigo-600 hover:underline"
              >
                전체 이력 보기 →
              </button>
            )}
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  );
}
