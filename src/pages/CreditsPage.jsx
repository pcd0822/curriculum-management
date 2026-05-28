import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import GaugeChart from '../components/GaugeChart';
import {
  isConfigured,
  fetchConfig,
  fetchSettings,
  fetchJointCurriculum,
  fetchResponses,
} from '../api/db';
import { getVerifiedStudent } from '../api/student';

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

/* ─── 과목명 정규화 (공백·NFC·대소문자 무시) ─── */
function normName(s) {
  return String(s || '').replace(/\s+/g, '').normalize('NFC').toLowerCase();
}

/* ─── 학번 첫 자리 → 코호트(1|2|3) ─── */
function cohortFromId(id) {
  const g = Number(String(id || '').trim().charAt(0));
  return g >= 1 && g <= 3 ? g : null;
}

/* ─── 코호트별 설정 해석 (CoursesPage.jsx 패턴 이식) ─── */
function resolveRequiredTotal(settings, cohort) {
  const byCohort = settings?.requiredTotalCreditsByCohort;
  if (byCohort && typeof byCohort === 'object') {
    const v = Number(byCohort[cohort] ?? byCohort[String(cohort)]);
    if (v > 0) return v;
  }
  return Number(settings?.requiredTotalCredits) || 174;
}
function resolveMinCreditRules(settings, cohort) {
  const byCohort = settings?.minCreditRulesByCohort;
  if (byCohort && typeof byCohort === 'object') {
    const list = byCohort[cohort] || byCohort[String(cohort)];
    if (Array.isArray(list)) return list;
  }
  return Array.isArray(settings?.minCreditRules) ? settings.minCreditRules : [];
}

/* ─── 편제표/공동교육과정 정규화 헬퍼 ─── */
function normalizeConfig(cfg) {
  const raw = Array.isArray(cfg) ? cfg : cfg?.data || [];
  return raw.map((c, i) => ({ joint: false, ...normaliseCourse(c), id: `course-${i}` }));
}
function normalizeJoint(jc) {
  const raw = Array.isArray(jc) ? jc : jc?.data || [];
  return raw.map((c, i) => ({ joint: true, host: c.거점학교 || c.host || '', ...normaliseCourse(c), required: false, id: `joint-${i}` }));
}

/* ─── 서버 응답(Responses 한 행) → 과목 리스트 복원 ─── */
function buildCoursesFromResponse(resp, cohortCourses, jointCourses) {
  /* 1) CoursesDetail(JSON)이 있으면 그대로 사용 (정확) */
  const detailRaw = resp.CoursesDetail || resp.coursesDetail;
  if (detailRaw) {
    try {
      const arr = JSON.parse(detailRaw);
      if (Array.isArray(arr) && arr.length > 0) {
        return arr.map((c, i) => ({
          joint: !!c.joint,
          required: !!c.required,
          subjectName: c.subjectName,
          credits: Number(c.credits) || 0,
          grade: Number(c.grade) || 0,
          semester: Number(c.semester) || 0,
          category: c.category || '',
          subCategory: c.subCategory || '',
          id: c.id || `detail-${i}`,
        }));
      }
    } catch { /* 파싱 실패 시 이름 대조로 폴백 */ }
  }
  /* 2) 폴백: 편제표 필수과목 전체 + 학생선택 이름 매칭 + 공동교육 이름 매칭 */
  const result = [];
  cohortCourses.filter((c) => c.required).forEach((c) => result.push(c));
  String(resp.SelectedCourses || resp.selectedCourses || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .forEach((nm) => {
      const key = normName(nm);
      const match = cohortCourses.find((c) => !c.required && normName(c.subjectName) === key);
      result.push(match || { subjectName: nm, credits: 0, grade: 0, semester: 0, category: '', subCategory: '', required: false, joint: false, id: `opt-${key}` });
    });
  String(resp.JointCourses || resp.jointCourses || '')
    .split(',').map((s) => s.trim()).filter(Boolean)
    .forEach((nm) => {
      const key = normName(nm);
      const match = jointCourses.find((c) => normName(c.subjectName) === key);
      result.push(match ? { ...match, joint: true } : { subjectName: nm, credits: 0, grade: 0, semester: 0, category: '공동교육과정', subCategory: '', required: false, joint: true, id: `joint-${key}` });
    });
  return result;
}

/* ─── 학번 재구성 (Grade/Class/Number → 5자리) ─── */
function idFromResponse(resp) {
  const g = String(resp.Grade ?? resp.grade ?? '').trim();
  const c = String(resp.Class ?? resp.classNum ?? '').trim();
  const n = String(resp.Number ?? resp.studentNum ?? '').trim();
  if (!g) return '';
  return `${g}${c.padStart(2, '0')}${n.padStart(2, '0')}`;
}

/* ─── 대시보드 지표 계산 (순수 함수) ─── */
function computeDashboard(selectedCourses, { requiredTotalCredits, minCreditRules }) {
  const totalCredits = selectedCourses.reduce((s, c) => s + (Number(c.credits) || 0), 0);
  const requiredCredits = selectedCourses.filter((c) => c.required).reduce((s, c) => s + c.credits, 0);
  const optionalCredits = selectedCourses.filter((c) => !c.required && !c.joint).reduce((s, c) => s + c.credits, 0);
  const jointCredits = selectedCourses.filter((c) => c.joint).reduce((s, c) => s + c.credits, 0);
  const foundationCredits = selectedCourses.filter(isFoundationCourse).reduce((s, c) => s + c.credits, 0);

  const catMap = {};
  selectedCourses.forEach((c) => {
    const key = c.joint ? '공동교육과정' : (c.category || '기타');
    catMap[key] = (catMap[key] || 0) + c.credits;
  });
  const catSum = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
  const categoryBreakdown = Object.entries(catMap)
    .map(([name, credits], i) => ({ name, credits, ratio: Math.round((credits / catSum) * 100), color: pickColor(name, i) }))
    .sort((a, b) => b.credits - a.credits);

  const semMap = {};
  selectedCourses.forEach((c) => {
    if (!c.grade || !c.semester) return;
    const k = `${c.grade}-${c.semester}`;
    if (!semMap[k]) semMap[k] = { key: k, label: `${c.grade}-${c.semester}학기`, credits: 0, count: 0, jointCount: 0 };
    semMap[k].credits += c.credits;
    semMap[k].count += 1;
    if (c.joint) semMap[k].jointCount += 1;
  });
  const semesterBreakdown = Object.values(semMap).sort((a, b) => a.key.localeCompare(b.key));

  const minCreditStatus = (minCreditRules || []).map((rule) => {
    const sum = selectedCourses.reduce((acc, c) => {
      if (rule.type === 'category' && String(c.category || '').trim() === rule.name) return acc + c.credits;
      if (rule.type === 'subCategory' && String(c.subCategory || '').trim() === rule.name) return acc + c.credits;
      return acc;
    }, 0);
    return { ...rule, current: sum, ok: sum >= Number(rule.min || 0) };
  });

  const issues = [];
  if (totalCredits < requiredTotalCredits) issues.push(`총 이수학점 부족 (${totalCredits}/${requiredTotalCredits})`);
  if (totalCredits > 0 && foundationCredits > totalCredits * 0.5) issues.push(`기초교과 50% 초과 (${foundationCredits}/${totalCredits})`);
  minCreditStatus.forEach((s) => { if (!s.ok) issues.push(`${s.name} ${s.current}/${s.min}학점`); });
  const allOk = issues.length === 0 && selectedCourses.length > 0;

  return { totalCredits, requiredCredits, optionalCredits, jointCredits, foundationCredits, categoryBreakdown, semesterBreakdown, minCreditStatus, issues, allOk };
}

export default function CreditsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdminPreview = new URLSearchParams(location.search).get('preview') === 'admin';

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState([]); // 학생 모드: 편제표(코호트)+공동교육

  /* 관리자 모드 상태 */
  const [jointAll, setJointAll] = useState([]);
  const [adminQuery, setAdminQuery] = useState('');
  const [adminStudentId, setAdminStudentId] = useState('');
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');
  const cohortConfigCache = useRef({});

  const [activeSubId, setActiveSubId] = useState('current');

  const student = useMemo(() => getVerifiedStudent(), []);
  const studentId = student.studentId || student.학번 || '';
  const schoolName = settings?.schoolName || localStorage.getItem('school_name') || '이수현황';

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

  /* 신청 이력 (localStorage) — 최신 먼저 */
  const submissionHistory = useMemo(() => {
    try {
      const arr = JSON.parse(localStorage.getItem('submissionHistory') || '[]');
      return Array.isArray(arr) ? arr.slice().reverse() : [];
    } catch { return []; }
  }, []);

  /* ── 초기 로드 ── */
  useEffect(() => {
    if (!isConfigured()) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const stg = await fetchSettings().catch(() => null);
        if (cancelled) return;
        setSettings(stg);

        if (isAdminPreview) {
          const jc = await fetchJointCurriculum().catch(() => []);
          if (cancelled) return;
          setJointAll(normalizeJoint(jc));
        } else {
          const cohort = cohortFromId(studentId) || 1;
          const [cfg, jc] = await Promise.all([
            fetchConfig(cohort).catch(() => []),
            fetchJointCurriculum().catch(() => []),
          ]);
          if (cancelled) return;
          setCourses([...normalizeConfig(cfg), ...normalizeJoint(jc)]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAdminPreview, studentId]);

  /* ── 관리자: 학번 검색 ── */
  async function runAdminSearch() {
    const id = String(adminQuery || '').trim();
    if (!/^\d{5}$/.test(id)) { setAdminError('학번 5자리를 입력하세요.'); return; }
    if (!isConfigured()) { setAdminError('시트가 연결되지 않았습니다. 관리자 로그인 후 다시 시도하세요.'); return; }
    setAdminLoading(true); setAdminError('');
    try {
      const cohort = cohortFromId(id) || 1;
      let cohortCourses = cohortConfigCache.current[cohort];
      if (!cohortCourses) {
        const cfg = await fetchConfig(cohort).catch(() => []);
        cohortCourses = normalizeConfig(cfg);
        cohortConfigCache.current[cohort] = cohortCourses;
      }
      const respRaw = await fetchResponses().catch(() => []);
      const responses = Array.isArray(respRaw) ? respRaw : respRaw?.data || [];
      const mine = responses.filter((r) => idFromResponse(r) === id);
      setAdminStudentId(id);
      if (mine.length === 0) {
        setAdminSubmissions([]);
        setAdminError(`학번 ${id}의 제출 내역이 없습니다.`);
        return;
      }
      const subs = mine.map((r, i) => {
        const ts = r.Timestamp ? new Date(r.Timestamp) : null;
        const dateLabel = ts && !isNaN(ts.getTime()) ? ts.toLocaleString('ko-KR') : `제출 ${i + 1}`;
        return {
          id: `sub-${i}`,
          label: `${dateLabel}${r.Major ? ` · ${r.Major}` : ''}`,
          courses: buildCoursesFromResponse(r, cohortCourses, jointAll),
          totalStored: r.TotalCredits,
          validationResult: r.ValidationResult || '',
        };
      }).reverse(); // 최신 먼저
      setAdminSubmissions(subs);
      setActiveSubId(subs[0].id);
    } catch (e) {
      setAdminError('조회 실패: ' + (e?.message || e));
    } finally {
      setAdminLoading(false);
    }
  }

  /* ── 학생 모드: 제출 목록 ── */
  const liveSelectedCourses = useMemo(() => {
    if (courses.length === 0) return [];
    return courses.filter((c) => c.required || selectedIdSet.has(c.id));
  }, [courses, selectedIdSet]);

  const studentSubmissions = useMemo(() => {
    const list = [{ id: 'current', label: '현재 선택 (미제출)', courses: liveSelectedCourses, totalStored: null }];
    submissionHistory.forEach((h, i) => {
      const snap = Array.isArray(h.courses) ? h.courses.map((c, j) => ({
        joint: !!c.joint,
        required: !!c.required,
        subjectName: c.subjectName,
        credits: Number(c.credits) || 0,
        grade: Number(c.grade) || 0,
        semester: Number(c.semester) || 0,
        category: c.category || '',
        subCategory: c.subCategory || '',
        id: c.id || `snap-${i}-${j}`,
      })) : [];
      list.push({ id: `h-${h.timestamp || i}`, label: h.dateLabel || `제출 ${i + 1}`, courses: snap, totalStored: h.totalCredits });
    });
    return list;
  }, [liveSelectedCourses, submissionHistory]);

  /* ── 활성 제출 + 대시보드 ── */
  const submissions = isAdminPreview ? adminSubmissions : studentSubmissions;
  const activeSub = submissions.find((s) => s.id === activeSubId) || submissions[0] || null;
  const activeCourses = activeSub?.courses || [];
  const displayId = isAdminPreview ? adminStudentId : studentId;
  const avatarLabel = displayId ? String(displayId).slice(-2) : (isAdminPreview ? '관' : '?');

  const viewCohort = cohortFromId(displayId) || 1;
  const requiredTotalCredits = resolveRequiredTotal(settings, viewCohort);
  const minCreditRules = resolveMinCreditRules(settings, viewCohort);
  const dash = useMemo(
    () => computeDashboard(activeCourses, { requiredTotalCredits, minCreditRules }),
    [activeCourses, requiredTotalCredits, minCreditRules],
  );

  const headlineTotal = (activeSub && activeSub.totalStored != null && activeSub.totalStored !== '')
    ? Number(activeSub.totalStored) : dash.totalCredits;
  const headlineProgress = requiredTotalCredits > 0
    ? Math.min(Math.round((headlineTotal / requiredTotalCredits) * 100), 100) : 0;

  const showDashboard = !isAdminPreview || adminSubmissions.length > 0;

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

        {/* 관리자: 학번 검색 */}
        {isAdminPreview && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
            <div className="text-sm font-bold text-slate-800 mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>
              학번으로 학생 이수현황 조회
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                value={adminQuery}
                onChange={(e) => setAdminQuery(e.target.value.replace(/\D/g, '').slice(0, 5))}
                onKeyDown={(e) => { if (e.key === 'Enter') runAdminSearch(); }}
                placeholder="학번 5자리 (예: 20513)"
                className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={runAdminSearch}
                disabled={adminLoading}
                className="px-5 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
              >
                {adminLoading ? '조회 중…' : '조회'}
              </button>
            </div>
            {adminError && <p className="text-xs text-rose-600 mt-2">{adminError}</p>}
            {!isConfigured() && (
              <p className="text-xs text-amber-600 mt-2">시트가 연결되지 않았습니다. 관리자 대시보드에서 로그인 후 이용하세요.</p>
            )}
          </div>
        )}

        {showDashboard && (
          <>
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
                  학번 <span className="font-mono">{displayId || '-'}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {isAdminPreview ? '관리자 조회' : '나의 수강신청 현황'} · {activeCourses.length}과목
                </div>
              </div>
            </div>

            {/* 제출(수강신청 데이터) 선택기 */}
            {submissions.length > 1 && (
              <div className="bg-white rounded-2xl p-3 mb-3 shadow-sm">
                <label className="block text-[0.7rem] font-semibold text-slate-500 mb-1.5 px-0.5">
                  수강신청 데이터 선택 ({submissions.length}건)
                </label>
                <select
                  value={activeSub?.id || ''}
                  onChange={(e) => setActiveSubId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {submissions.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 메인 게이지 */}
            <div className="bg-white rounded-2xl p-5 mb-3 shadow-sm">
              <div className="flex items-center gap-5">
                <GaugeChart
                  value={headlineProgress}
                  size={110}
                  color={headlineTotal >= requiredTotalCredits ? '#10b981' : '#4f46e5'}
                  label=""
                />
                <div className="flex-1 min-w-0">
                  <div className="text-3xl font-extrabold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
                    {headlineTotal}
                    <span className="text-sm text-slate-400 font-medium ml-1">/ {requiredTotalCredits}학점</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`inline-block w-2 h-2 rounded-full ${headlineTotal >= requiredTotalCredits ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    <span className={`text-xs font-semibold ${headlineTotal >= requiredTotalCredits ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {headlineTotal >= requiredTotalCredits ? '졸업 학점 충족' : `${requiredTotalCredits - headlineTotal}학점 더 필요`}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1.5 leading-snug">
                    필수 {dash.requiredCredits} · 학생선택 {dash.optionalCredits}
                    {dash.jointCredits > 0 && <span className="text-violet-600"> · 공동 {dash.jointCredits}</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* 검증 상태 */}
            <div className={`rounded-2xl p-4 mb-3 shadow-sm border ${
              dash.allOk ? 'bg-emerald-50 border-emerald-200' : dash.issues.length > 0 ? 'bg-rose-50 border-rose-200' : 'bg-slate-50 border-slate-200'
            }`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{dash.allOk ? '✅' : dash.issues.length > 0 ? '⚠️' : 'ℹ️'}</span>
                <span className={`text-sm font-bold ${dash.allOk ? 'text-emerald-700' : dash.issues.length > 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                  {dash.allOk
                    ? '모든 학점 이수 규칙을 충족했습니다'
                    : activeCourses.length === 0
                      ? (isAdminPreview ? '선택 과목 데이터가 없습니다' : '아직 과목을 선택하지 않았습니다')
                      : `검증 실패 ${dash.issues.length}건`}
                </span>
              </div>
              {activeCourses.length === 0 ? (
                !isAdminPreview && (
                  <button
                    onClick={() => navigate('/courses')}
                    className="mt-2 w-full py-2 rounded-xl text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
                  >
                    수강신청 하러 가기 →
                  </button>
                )
              ) : dash.issues.length > 0 ? (
                <ul className="text-[0.72rem] text-rose-700 leading-snug list-disc list-inside space-y-0.5 mt-1">
                  {dash.issues.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              ) : null}
            </div>

            {/* 기초교과 50% */}
            <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-bold text-slate-700">기초교과 한도 (50%)</span>
                <span className={`text-xs font-mono ${
                  dash.foundationCredits > dash.totalCredits * 0.5 && dash.totalCredits > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'
                }`}>
                  {dash.foundationCredits} / {dash.totalCredits > 0 ? Math.floor(dash.totalCredits * 0.5) : 0}학점
                  {dash.totalCredits > 0 && (
                    <span className="text-slate-400"> · {Math.round((dash.foundationCredits / dash.totalCredits) * 100)}%</span>
                  )}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${dash.totalCredits > 0 ? Math.min((dash.foundationCredits / (dash.totalCredits * 0.5)) * 100, 100) : 0}%`,
                    background: dash.foundationCredits > dash.totalCredits * 0.5 && dash.totalCredits > 0
                      ? 'linear-gradient(135deg, #f43f5e, #e11d48)'
                      : 'linear-gradient(135deg, #3525cd, #4f46e5)',
                  }}
                />
              </div>
              <p className="text-[0.65rem] text-slate-400 mt-1">국·영·수 + 한국사1·2 합계</p>
            </div>

            {/* 교과별 최소 이수학점 — 수치 */}
            {dash.minCreditStatus.length > 0 && (
              <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <div className="text-xs font-bold text-slate-700 mb-2">교과별 최소 이수학점</div>
                <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[0.72rem]">
                  {dash.minCreditStatus.map((s, i) => (
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
            {dash.categoryBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <div className="text-sm font-bold text-slate-800 mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  교과군별 학점 분포
                </div>
                <div className="space-y-2">
                  {dash.categoryBreakdown.map((cat) => (
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
            {dash.semesterBreakdown.length > 0 && (
              <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <div className="text-sm font-bold text-slate-800 mb-3" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  학기별 신청 현황
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {dash.semesterBreakdown.map((s) => (
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
            {activeCourses.length > 0 && (
              <div className="bg-white rounded-2xl p-4 mb-3 shadow-sm">
                <div className="text-sm font-bold text-slate-800 mb-2.5" style={{ fontFamily: "'Manrope', sans-serif" }}>
                  선택 과목 ({activeCourses.length})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {activeCourses.map((c, i) => (
                    <span
                      key={c.id || i}
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

            {/* 신청 이력 (학생 본인 화면만) */}
            {!isAdminPreview && submissionHistory.length > 0 && (
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
          </>
        )}

        {/* 관리자: 검색 전 안내 */}
        {isAdminPreview && !showDashboard && !adminError && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-slate-400">학번을 검색하면 해당 학생의 이수현황 대시보드가 표시됩니다.</p>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  );
}
