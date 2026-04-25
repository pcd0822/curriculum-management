import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isConfigured, fetchConfig, fetchSettings, fetchJointCurriculum } from '../api/db.js';
import { getVerifiedStudent, getStudentAvatarLabel } from '../api/student.js';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import CourseCard from '../components/CourseCard';

/* ─── Korean field-name mapping (mirrors legacy index.html normalisation) ─── */
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
  for (const [k, v] of Object.entries(raw)) {
    const mapped = FIELD_MAP[k] || k;
    out[mapped] = v;
  }
  out.credits = Number(out.credits) || 0;
  out.grade = Number(out.grade) || 0;
  out.semester = Number(out.semester) || 0;
  const req = String(out.required || '').toUpperCase().trim();
  out.required = req === 'TRUE' || req === 'Y' || req === '1' || req === '필수' || out.required === true;
  out.recommended = out.recommended === true || out.recommended === '추천' || out.recommended === 'Y';
  if (Array.isArray(out.prerequisites)) {
    out.prerequisites = out.prerequisites.map((s) => String(s).trim()).filter(Boolean);
  } else if (typeof out.prerequisites === 'string') {
    out.prerequisites = out.prerequisites.split(',').map((s) => s.trim()).filter(Boolean);
  } else {
    out.prerequisites = [];
  }
  return out;
}

/* ─── semester helpers ─── */
const SEMESTERS = [
  { key: '2-1', label: '2-1학기', grade: 2, semester: 1 },
  { key: '2-2', label: '2-2학기', grade: 2, semester: 2 },
  { key: '3-1', label: '3-1학기', grade: 3, semester: 1 },
  { key: '3-2', label: '3-2학기', grade: 3, semester: 2 },
];

const semKeyOf = (c) => `${c.grade}-${c.semester}`;
const semOrder = (k) => {
  const [g, s] = k.split('-').map(Number);
  return g * 10 + s;
};

/* 기초교과 정의: 세부교과(국어·영어·수학) ∪ 과목명(한국사1·한국사2) */
const FOUNDATION_SUBCATS = ['국어', '영어', '수학'];
const FOUNDATION_NAMES = ['한국사1', '한국사2'];
function isFoundationCourse(course) {
  const sub = String(course.subCategory || '').trim();
  if (FOUNDATION_SUBCATS.includes(sub)) return true;
  const name = String(course.subjectName || '').trim();
  if (FOUNDATION_NAMES.includes(name)) return true;
  return false;
}

export default function CoursesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isAdminPreview = searchParams.get('preview') === 'admin';

  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeSemester, setActiveSemester] = useState('2-1');
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [blockedReason, setBlockedReason] = useState(null); // {courseName, reason}

  /* Read verified student info — 앱 종료 전까지 유지.
     관리자 미리보기 모드에서는 가짜 학생을 사용해 실제 학생 데이터에 영향을 주지 않음. */
  const student = useMemo(() => {
    if (isAdminPreview) {
      return { name: '관리자(테스트)', studentId: 'PREVIEW', studentCode: 'TEST-MODE' };
    }
    return getVerifiedStudent();
  }, [isAdminPreview]);
  const avatarLabel = isAdminPreview ? '관' : getStudentAvatarLabel();
  const schoolName = settings?.schoolName || localStorage.getItem('school_name') || 'OO고등학교';

  useEffect(() => {
    if (!isConfigured()) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [configRes, settingsRes, jointRes] = await Promise.all([
          fetchConfig(),
          fetchSettings(),
          fetchJointCurriculum().catch(() => []),
        ]);

        if (cancelled) return;

        const rawCourses = Array.isArray(configRes)
          ? configRes
          : configRes?.courses ?? configRes?.data ?? [];

        const processed = rawCourses.map((c, i) => ({
          id: c.id ?? c.code ?? `course-${i}`,
          joint: false,
          ...normaliseCourse(c),
        }));

        /* 공동교육과정 — 정규 교과 외 추가 이수 가능 과목 */
        const rawJoint = Array.isArray(jointRes) ? jointRes : jointRes?.data || [];
        const processedJoint = rawJoint.map((c, i) => {
          const norm = normaliseCourse(c);
          return {
            id: `joint-${c.slug || norm.slug || i}-${i}`,
            joint: true,
            host: c.거점학교 || c.host || '',
            schedule: c.운영일시 || c.schedule || '',
            ...norm,
            required: false, // 공동교육과정은 항상 선택
          };
        });

        const merged = [...processed, ...processedJoint];
        setCourses(merged);

        const s = settingsRes?.settings ?? settingsRes?.data ?? settingsRes ?? {};
        setSettings(s);

        const reqIds = new Set(processed.filter((c) => c.required).map((c) => c.id));

        /* AI 추천 적용 플래그가 있으면, 추천 과목명을 매칭하여 선택 set에 추가 */
        let aiNames = null;
        try {
          const raw = sessionStorage.getItem('applyAiRecommendations');
          if (raw) {
            aiNames = JSON.parse(raw);
            sessionStorage.removeItem('applyAiRecommendations');
          }
        } catch {}
        if (Array.isArray(aiNames) && aiNames.length > 0) {
          merged.forEach((c) => {
            const name = String(c.subjectName || '').trim();
            if (aiNames.some((n) => n === name || name.includes(n) || n.includes(name))) {
              reqIds.add(c.id);
            }
          });
        } else {
          /* 이전 세션에서 진행 중이던 선택을 복원. 미리보기 모드는 별도 키 사용 */
          try {
            const restoreKey = isAdminPreview ? 'previewSelection' : 'currentSelection';
            const saved = JSON.parse(sessionStorage.getItem(restoreKey) || '[]');
            if (Array.isArray(saved)) saved.forEach((id) => reqIds.add(id));
          } catch {}
        }
        setSelectedIds(reqIds);
      } catch (err) {
        console.error('Failed to load courses:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [navigate]);

  /* ── Derived data ── */
  const semesterObj = SEMESTERS.find((s) => s.key === activeSemester) || SEMESTERS[0];

  const filteredCourses = useMemo(
    () => courses.filter((c) => c.grade === semesterObj.grade && c.semester === semesterObj.semester),
    [courses, semesterObj],
  );

  const selectedCourses = useMemo(
    () => courses.filter((c) => selectedIds.has(c.id)),
    [courses, selectedIds],
  );

  const optionalSelected = useMemo(
    () => selectedCourses.filter((c) => !c.required),
    [selectedCourses],
  );

  const totalCredits = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + c.credits, 0),
    [selectedCourses],
  );

  const optionalCredits = useMemo(
    () => optionalSelected.reduce((sum, c) => sum + c.credits, 0),
    [optionalSelected],
  );

  const foundationCredits = useMemo(
    () => selectedCourses.filter(isFoundationCourse).reduce((s, c) => s + c.credits, 0),
    [selectedCourses],
  );

  const jointSelected = useMemo(
    () => selectedCourses.filter((c) => c.joint),
    [selectedCourses],
  );
  const jointCredits = useMemo(
    () => jointSelected.reduce((s, c) => s + c.credits, 0),
    [jointSelected],
  );
  const regularCredits = totalCredits - jointCredits;

  const maxCourses = courses.length || 1;
  const progress = Math.round((selectedIds.size / maxCourses) * 100);

  /* 선택 상태가 바뀔 때마다 sessionStorage에 저장 (탭 이동 시 유지).
     관리자 미리보기는 별도 키로 보관하여 실제 학생 선택을 침해하지 않음. */
  useEffect(() => {
    if (loading) return;
    const key = isAdminPreview ? 'previewSelection' : 'currentSelection';
    try {
      sessionStorage.setItem(key, JSON.stringify([...selectedIds]));
    } catch {}
  }, [selectedIds, loading, isAdminPreview]);

  /* ── Settings ── */
  const selectionRules = settings?.selectionRules || {};
  const allowMultiSemesterDuplicate = !!settings?.allowMultiSemesterDuplicate;
  const duplicateCourseSlugs = Array.isArray(settings?.duplicateCourseSlugs)
    ? settings.duplicateCourseSlugs
    : [];
  const requiredTotalCredits = Number(settings?.requiredTotalCredits) || 180;
  const foundationCap = Math.floor(requiredTotalCredits * 0.5);
  const minCreditRules = Array.isArray(settings?.minCreditRules) ? settings.minCreditRules : [];

  /* 학기별 학점·과목수 규칙 검사 (정규 교과 한정 — 공동교육과정은 추가 이수이므로 미포함) */
  function countSelected(semKey, creditFilter, excludeId) {
    return courses.filter((c) => {
      if (c.required) return false;
      if (c.joint) return false;
      if (!selectedIds.has(c.id)) return false;
      if (c.id === excludeId) return false;
      if (semKeyOf(c) !== semKey) return false;
      if (creditFilter !== 'all' && c.credits !== Number(creditFilter)) return false;
      return true;
    }).length;
  }

  function violatedSelectionRule(course) {
    const semKey = semKeyOf(course);
    const rules = selectionRules[semKey];
    if (!rules || !Array.isArray(rules)) return null;
    for (const rule of rules) {
      const creditMatch = rule.credits === 'all' || course.credits === Number(rule.credits);
      if (creditMatch) {
        const cur = countSelected(semKey, rule.credits, null);
        if (cur >= Number(rule.count)) {
          return `${semKey.replace('-', '학년 ')}학기 ${rule.credits === 'all' ? '모든' : rule.credits + '학점'} 과목은 최대 ${rule.count}개까지 선택할 수 있습니다.`;
        }
      }
    }
    return null;
  }

  /* 선이수 검사: 선이수 과목이 같은 학기 또는 이전 학기에 선택되어 있어야 함 */
  function missingPrerequisites(course) {
    if (!course.prerequisites || course.prerequisites.length === 0) return [];
    const here = semOrder(semKeyOf(course));
    const satisfied = new Set();
    courses.forEach((c) => {
      if (!selectedIds.has(c.id)) return;
      if (semOrder(semKeyOf(c)) > here) return; // 같은 학기 또는 이전만 인정
      if (c.slug) satisfied.add(c.slug);
      if (c.subjectName) satisfied.add(c.subjectName);
    });
    return course.prerequisites.filter((p) => !satisfied.has(p));
  }

  /* 복수편제 차단: 같은 과목명 + 같은 학점 과목이 다른 학기에 동일 편성된 경우,
     어느 한 쪽이 선택되면 나머지 학기의 동일 과목은 신청 차단.
     예외: settings.duplicateCourseSlugs 또는 allowMultiSemesterDuplicate=true */
  function isDuplicateAcrossSemester(course) {
    if (allowMultiSemesterDuplicate) return false;
    const allowedDup = duplicateCourseSlugs.some(
      (x) => x === course.slug || x === course.subjectName || x === course.id,
    );
    if (allowedDup) return false;
    const myName = String(course.subjectName || '').trim();
    const myCredits = Number(course.credits) || 0;
    if (!myName) return null;
    for (const c of courses) {
      if (c.id === course.id) continue;
      if (!selectedIds.has(c.id)) continue;
      const otherName = String(c.subjectName || '').trim();
      const otherCredits = Number(c.credits) || 0;
      const sameName = otherName === myName;
      const sameCredits = otherCredits === myCredits;
      const differentSemester = semKeyOf(c) !== semKeyOf(course);
      if (sameName && sameCredits && differentSemester) {
        return c;
      }
    }
    return null;
  }

  /* 비활성 사유 종합 — 기초교과 50% 룰은 최종 제출 단계(submitIssues)에서만 검증 */
  function getDisableInfo(course) {
    if (course.required) return null;
    if (selectedIds.has(course.id)) return null;
    /* 정규 교과에만 학기별 선택 규칙·동명 중복 적용. 공동교육과정은 추가 이수라 제외 */
    if (!course.joint) {
      const ruleMsg = violatedSelectionRule(course);
      if (ruleMsg) return { type: 'rule', message: ruleMsg };
      const dup = isDuplicateAcrossSemester(course);
      if (dup) return {
        type: 'duplicate',
        message: `"${course.subjectName}"(${course.credits}학점)이 ${dup.grade}-${dup.semester}학기에 복수편제되어 이미 신청되었습니다. 같은 과목명·같은 학점이라 다른 학기에서는 추가 신청할 수 없습니다.`,
      };
    }
    const missing = missingPrerequisites(course);
    if (missing.length > 0) {
      const names = missing.map((p) => {
        const found = courses.find((c) => c.slug === p || c.subjectName === p);
        return found?.subjectName || p;
      });
      return {
        type: 'prereq',
        message: `이 과목을 선택하려면 선이수 과목을 먼저 선택해야 합니다: ${names.join(', ')}`,
      };
    }
    return null;
  }

  /* 교과별 최소 이수학점 집계 (관리자 설정 기반) */
  const minCreditStatus = useMemo(() => {
    return minCreditRules.map((rule) => {
      const sum = selectedCourses.reduce((acc, c) => {
        if (rule.type === 'category') {
          if (String(c.category || '').trim() === rule.name) return acc + c.credits;
        } else if (rule.type === 'subCategory') {
          if (String(c.subCategory || '').trim() === rule.name) return acc + c.credits;
        }
        return acc;
      }, 0);
      return { ...rule, current: sum, ok: sum >= Number(rule.min || 0) };
    });
  }, [minCreditRules, selectedCourses]);

  /* 최종 제출 검증: 위배되면 제출 불가 */
  const submitIssues = useMemo(() => {
    const issues = [];
    if (totalCredits < requiredTotalCredits) {
      issues.push(`총 이수학점이 부족합니다. 현재 ${totalCredits}학점, ${requiredTotalCredits - totalCredits}학점 더 필요 (목표 ${requiredTotalCredits}학점).`);
    }
    if (totalCredits > 0 && foundationCredits > totalCredits * 0.5) {
      issues.push(`기초교과(국·영·수·한국사1·2)가 전체의 50%를 초과했습니다 (${foundationCredits}/${totalCredits}학점). 기초교과 외 과목을 더 선택하거나 선택한 기초교과 일부를 해제하세요.`);
    }
    /* 교과별 최소 이수학점 검증 */
    minCreditStatus.forEach((s) => {
      if (!s.ok) {
        const label = s.type === 'category' ? '교과군' : '세부교과';
        issues.push(`${label} "${s.name}" 최소 이수학점(${s.min}) 부족: 현재 ${s.current}학점, ${s.min - s.current}학점 더 필요.`);
      }
    });
    /* 학기별 선택 규칙 사후 검증 */
    Object.keys(selectionRules).forEach((semKey) => {
      const rules = selectionRules[semKey];
      if (!Array.isArray(rules)) return;
      rules.forEach((rule) => {
        const cur = countSelected(semKey, rule.credits, null);
        if (cur > Number(rule.count)) {
          issues.push(`${semKey} 학기 ${rule.credits === 'all' ? '모든' : rule.credits + '학점'} 과목 선택 규칙(최대 ${rule.count}개)을 초과했습니다.`);
        }
      });
    });
    /* 선이수 미충족 사후 검증 */
    selectedCourses.forEach((c) => {
      if (c.required) return;
      const missing = missingPrerequisites(c);
      if (missing.length > 0) {
        const names = missing.map((p) => {
          const f = courses.find((x) => x.slug === p || x.subjectName === p);
          return f?.subjectName || p;
        });
        issues.push(`"${c.subjectName}" 선이수 과목 미이수: ${names.join(', ')}`);
      }
    });
    return issues;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourses, totalCredits, foundationCredits, requiredTotalCredits, selectionRules, minCreditStatus, courses]);

  const canSubmit = submitIssues.length === 0 && selectedIds.size > 0;

  /* ── Handlers ── */
  const toggleCourse = useCallback(
    (id) => {
      const course = courses.find((c) => c.id === id);
      if (!course) return;

      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          setBlockedReason(null);
          return next;
        }

        const info = getDisableInfo(course);
        if (info) {
          setBlockedReason({ courseName: course.subjectName, reason: info.message });
          return prev;
        }
        next.add(id);
        setBlockedReason(null);
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [courses, selectedIds, settings],
  );

  function handleNextStep() {
    if (!canSubmit) {
      const reasons = submitIssues.map((s, i) => `${i + 1}. ${s}`).join('\n');
      alert(`최종 제출 불가\n\n다음 규칙을 위배하여 제출할 수 없습니다:\n\n${reasons}`);
      setSheetOpen(true);
      return;
    }
    const snapshot = selectedCourses.map((c) => ({
      id: c.id,
      subjectName: c.subjectName,
      credits: c.credits,
      grade: c.grade,
      semester: c.semester,
      required: c.required,
      joint: !!c.joint,
      host: c.host || '',
    }));

    /* 관리자 미리보기 모드 — 실제 신청 이력에는 저장하지 않음 */
    if (isAdminPreview) {
      alert(
        '🛠 관리자 테스트 모드\n\n검증을 통과했습니다. 실제 신청 이력에는 저장되지 않습니다.\n\n' +
        `· 총 ${totalCredits}학점 / 목표 ${requiredTotalCredits}학점\n` +
        `· 학생선택 ${optionalCredits}학점, 기초교과 ${foundationCredits}학점\n` +
        (jointCredits > 0 ? `· 공동교육과정 ${jointCredits}학점\n` : '') +
        `· 신청 ${snapshot.length}과목`
      );
      navigate('/admin');
      return;
    }

    sessionStorage.setItem('pendingSelectedCourses', JSON.stringify(snapshot));

    /* 수강신청 이력 저장 (날짜·시간대별로 누적) */
    try {
      const studentId = student?.studentId || student?.학번 || '';
      const studentName = student?.name || student?.이름 || '';
      const history = JSON.parse(localStorage.getItem('submissionHistory') || '[]');
      history.push({
        timestamp: Date.now(),
        dateLabel: new Date().toLocaleString('ko-KR'),
        studentId,
        studentName,
        totalCredits,
        optionalCredits,
        foundationCredits,
        regularCredits,
        jointCredits,
        courses: snapshot,
        submitOk: true,
      });
      localStorage.setItem('submissionHistory', JSON.stringify(history.slice(-50)));
    } catch {}

    navigate('/credits');
  }

  /* ── Render ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#f7f9fb' }}>
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-indigo-500" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-slate-400 font-medium">불러오는 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f7f9fb' }}>
      <Header title={schoolName} avatarLabel={avatarLabel} />

      {/* ── 관리자 테스트 모드 배너 ── */}
      {isAdminPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-base flex-shrink-0">🛠</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-800 leading-tight">관리자 테스트 모드</div>
              <div className="text-[0.65rem] text-amber-700 leading-tight">실제 학생 신청 이력에는 저장되지 않습니다.</div>
            </div>
          </div>
          <button
            onClick={() => {
              try { sessionStorage.removeItem('previewSelection'); } catch {}
              navigate('/admin');
            }}
            className="flex-shrink-0 text-[0.7rem] font-semibold text-amber-800 bg-white border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100"
          >
            관리자로 돌아가기
          </button>
        </div>
      )}

      {/* ── Stepper ── */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <span className="text-xs font-semibold text-emerald-700" style={{ fontFamily: "'Inter', sans-serif" }}>
              학생정보
            </span>
          </div>

          <div className="w-6 h-px bg-slate-200" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold"
              style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
            >
              2
            </div>
            <span className="text-xs font-semibold text-indigo-700" style={{ fontFamily: "'Inter', sans-serif" }}>
              과목선택
            </span>
          </div>

          <div className="w-6 h-px bg-slate-200" />

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200">
            <div className="w-5 h-5 rounded-full bg-slate-300 flex items-center justify-center text-white text-[0.6rem] font-bold">3</div>
            <span className="text-xs font-semibold text-slate-500" style={{ fontFamily: "'Inter', sans-serif" }}>
              제출완료
            </span>
          </div>
        </div>
      </div>

      {/* ── Semester tabs ── */}
      <div className="px-5 pb-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {SEMESTERS.map((s) => {
            const active = s.key === activeSemester;
            return (
              <button
                key={s.key}
                onClick={() => setActiveSemester(s.key)}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                  active ? 'text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
                }`}
                style={
                  active
                    ? { background: 'linear-gradient(135deg, #3525cd, #4f46e5)', fontFamily: "'Inter', sans-serif" }
                    : { fontFamily: "'Inter', sans-serif" }
                }
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <h2 className="text-base font-bold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
          개설 교과 목록
        </h2>
        <span className="text-xs font-medium text-slate-400" style={{ fontFamily: "'Inter', sans-serif" }}>
          총 {filteredCourses.length}과목
        </span>
      </div>

      {/* ── 안내 카드: 선택 가이드 ── */}
      <div className="px-5 pb-2 space-y-2">
        {selectionRules[activeSemester] && (
          <div className="bg-indigo-50 rounded-xl px-3 py-2 flex items-start gap-2">
            <span className="text-indigo-500 text-xs mt-0.5">📏</span>
            <div className="text-xs text-indigo-700">
              <span className="font-semibold">선택 규칙: </span>
              {selectionRules[activeSemester].map((r, i) => (
                <span key={i}>
                  {r.credits === 'all' ? '모든' : `${r.credits}학점`} 과목 {r.count}개
                  {i < selectionRules[activeSemester].length - 1 ? ', ' : ''}
                </span>
              ))}
              <span className="text-indigo-400"> (초과 선택 불가)</span>
            </div>
          </div>
        )}
        <div className="bg-amber-50 rounded-xl px-3 py-2 flex items-start gap-2">
          <span className="text-amber-500 text-xs mt-0.5">ℹ️</span>
          <div className="text-xs text-amber-700 leading-relaxed">
            <span className="font-semibold">선택 지침</span><br />
            • 선이수 과목이 있는 과목은 해당 선이수 과목을 먼저 선택해야 합니다.<br />
            • 같은 이름의 과목은 한 학기에서만 신청할 수 있습니다 (학기간 중복 차단).<br />
            • 학기별 선택 규칙을 초과하면 자동으로 비활성화됩니다.<br />
            • 기초교과(국·영·수·한국사1·2)는 전체 이수학점의 50%를 넘을 수 없습니다.
          </div>
        </div>
        {/* 기초교과 진행도 미터 */}
        <div className="bg-white rounded-xl px-3 py-2 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-semibold text-slate-700">기초교과 한도 (50%)</span>
            <span className={`font-mono ${foundationCredits > totalCredits * 0.5 && totalCredits > 0 ? 'text-rose-600 font-bold' : 'text-slate-500'}`}>
              {foundationCredits} / {totalCredits > 0 ? Math.floor(totalCredits * 0.5) : 0}학점
              {totalCredits > 0 && (
                <span className="text-slate-400"> · 총 {totalCredits}학점 중 {Math.round((foundationCredits / totalCredits) * 100)}%</span>
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
          <p className="text-[0.65rem] text-slate-400 mt-1">
            목표 총 {requiredTotalCredits}학점 기준 기초교과 최대 {foundationCap}학점 (한국사 6학점 포함)
            {jointCredits > 0 && ` · 공동교육과정 ${jointCredits}학점 포함`}
          </p>
        </div>
        {/* 교과별 최소 이수학점 — 수치 표시 */}
        {minCreditStatus.length > 0 && (
          <div className="bg-white rounded-xl px-3 py-2 border border-slate-100 shadow-sm">
            <div className="text-xs font-semibold text-slate-700 mb-1.5">교과별 최소 이수학점</div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.7rem]">
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
        {blockedReason && (
          <div className="bg-rose-50 rounded-xl px-3 py-2 flex items-start gap-2 border border-rose-200">
            <span className="text-rose-500 text-xs mt-0.5">⚠️</span>
            <div className="text-xs text-rose-700 leading-relaxed flex-1">
              <span className="font-semibold">{blockedReason.courseName}</span> 선택 차단<br />
              {blockedReason.reason}
            </div>
            <button onClick={() => setBlockedReason(null)} className="text-rose-400 hover:text-rose-600 text-xs">✕</button>
          </div>
        )}
      </div>

      {/* ── Course list ── */}
      <div className="flex-1 overflow-y-auto px-5 pb-48" style={{ WebkitOverflowScrolling: 'touch' }}>
        {filteredCourses.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-slate-400">이 학기에 개설된 교과가 없습니다.</p>
          </div>
        ) : (
          (() => {
            const regularList = filteredCourses.filter((c) => !c.joint);
            const jointList = filteredCourses.filter((c) => c.joint);
            return (
              <>
                {/* 정규 교과 */}
                {regularList.length > 0 && (
                  <>
                    <div className="text-[0.7rem] font-bold text-slate-500 uppercase tracking-wider mb-1.5 mt-1">
                      정규 교과 ({regularList.length})
                    </div>
                    <div className="flex flex-col gap-2.5 mb-4">
                      {regularList.map((course) => {
                        const info = getDisableInfo(course);
                        return (
                          <CourseCard
                            key={course.id}
                            course={course}
                            selected={selectedIds.has(course.id)}
                            recommended={course.recommended}
                            required={course.required}
                            disabled={course.required || !!info}
                            hint={info?.message}
                            onToggle={() => toggleCourse(course.id)}
                          />
                        );
                      })}
                    </div>
                  </>
                )}

                {/* 공동교육과정 */}
                {jointList.length > 0 && (
                  <>
                    <div className="flex items-center gap-2 mb-1.5 mt-2">
                      <span className="text-[0.7rem] font-bold text-violet-700 uppercase tracking-wider">
                        공동교육과정 (추가 이수)
                      </span>
                      <span className="text-[0.6rem] font-medium text-violet-500 bg-violet-50 px-1.5 py-0.5 rounded-full">
                        {jointList.length}과목 · 졸업 학점 위에 추가됨
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {jointList.map((course) => {
                        const info = getDisableInfo(course);
                        return (
                          <CourseCard
                            key={course.id}
                            course={course}
                            selected={selectedIds.has(course.id)}
                            recommended={course.recommended}
                            required={false}
                            disabled={!!info}
                            hint={info?.message}
                            joint
                            host={course.host}
                            schedule={course.schedule}
                            onToggle={() => toggleCourse(course.id)}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            );
          })()
        )}
      </div>

      {/* ── Bottom sheet: 신청 과목 미리보기 (드래그 / 토글) ── */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        selectedCount={selectedIds.size}
        totalCredits={totalCredits}
        optionalCredits={optionalCredits}
        foundationCredits={foundationCredits}
        regularCredits={regularCredits}
        jointCredits={jointCredits}
        progress={progress}
        selectedCourses={selectedCourses}
        onUnselect={(id) => toggleCourse(id)}
        onNext={handleNextStep}
        submitIssues={submitIssues}
        canSubmit={canSubmit}
      />

      {/* ── Mini status bar (시트가 닫혀 있을 때) ── */}
      {!sheetOpen && (
        <div
          className="fixed left-0 right-0 z-40 px-5 pb-2"
          style={{ bottom: '64px' }}
        >
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-md hover:shadow-lg transition-shadow"
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs">↑</span>
              <div className="flex flex-col items-start">
                <span className="text-xs font-semibold text-slate-700" style={{ fontFamily: "'Inter', sans-serif" }}>
                  선택: {selectedIds.size}과목 / 총 {totalCredits}학점
                </span>
                <span className="text-[0.65rem] text-slate-400">
                  학생선택 {optionalCredits}학점
                  {jointCredits > 0 && ` · 공동교육 ${jointCredits}학점`}
                  {' · '}{progress}% 달성
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(progress, 100)}%`,
                    background: 'linear-gradient(135deg, #3525cd, #4f46e5)',
                  }}
                />
              </div>
              <span className="text-[0.65rem] text-indigo-600 font-semibold">신청 보기</span>
            </div>
          </button>
        </div>
      )}

      <MobileNav />
    </div>
  );
}

/* ─── Bottom sheet component ─── */
function BottomSheet({ open, onClose, selectedCount, totalCredits, optionalCredits, foundationCredits, regularCredits, jointCredits, progress, selectedCourses, onUnselect, onNext, submitIssues, canSubmit }) {
  const grouped = useMemo(() => {
    const map = {};
    selectedCourses.forEach((c) => {
      const k = `${c.grade}-${c.semester}`;
      if (!map[k]) map[k] = [];
      map[k].push(c);
    });
    return Object.keys(map)
      .sort()
      .map((k) => ({ key: k, label: `${k.replace('-', '학년 ')}학기`, items: map[k] }));
  }, [selectedCourses]);

  // 드래그로 닫기
  const [dragY, setDragY] = useState(0);
  const [dragStart, setDragStart] = useState(null);
  const onTouchStart = (e) => setDragStart(e.touches[0].clientY);
  const onTouchMove = (e) => {
    if (dragStart == null) return;
    const dy = e.touches[0].clientY - dragStart;
    if (dy > 0) setDragY(dy);
  };
  const onTouchEnd = () => {
    if (dragY > 80) onClose();
    setDragY(0);
    setDragStart(null);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black transition-opacity ${open ? 'opacity-30 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl flex flex-col"
        style={{
          bottom: '64px',
          maxHeight: '70vh',
          transform: open ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragStart == null ? 'transform 0.28s ease' : 'none',
        }}
      >
        {/* Drag handle */}
        <div
          className="pt-3 pb-2 flex items-center justify-center cursor-pointer"
          onClick={onClose}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <div className="w-12 h-1.5 rounded-full bg-slate-200" />
        </div>

        {/* Summary */}
        <div className="px-5 pb-2 flex items-end justify-between">
          <div>
            <div className="text-xs text-slate-400">현재 신청 과목</div>
            <div className="text-lg font-extrabold text-slate-800" style={{ fontFamily: "'Manrope', sans-serif" }}>
              {selectedCount}과목 · {totalCredits}학점
            </div>
            <div className="text-[0.7rem] text-slate-400">
              학생선택 {optionalCredits}학점 · {progress}% 달성
            </div>
            {jointCredits > 0 && (
              <div className="text-[0.7rem] mt-0.5 text-violet-600">
                정규 {regularCredits}학점 + 공동교육과정 {jointCredits}학점
              </div>
            )}
            <div className={`text-[0.7rem] mt-0.5 ${
              foundationCredits > totalCredits * 0.5 && totalCredits > 0
                ? 'text-rose-600 font-semibold'
                : 'text-slate-500'
            }`}>
              기초교과 {foundationCredits}학점
              {totalCredits > 0 && ` (${Math.round((foundationCredits / totalCredits) * 100)}%)`}
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:bg-slate-100"
          >
            ↓ 내리고 계속 선택
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {grouped.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              아직 선택한 과목이 없습니다.
            </div>
          ) : (
            grouped.map((g) => (
              <div key={g.key} className="mb-4">
                <div className="text-xs font-semibold text-indigo-600 mb-1.5">
                  {g.label} ({g.items.length}과목 · {g.items.reduce((s, c) => s + c.credits, 0)}학점)
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.items.map((c) => (
                    <div
                      key={c.id}
                      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                        c.joint ? 'bg-violet-50' : 'bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {c.required && (
                          <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-red-100 text-red-700 flex-shrink-0">필수</span>
                        )}
                        {c.joint && (
                          <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-violet-200 text-violet-800 flex-shrink-0">공동</span>
                        )}
                        <span className="text-sm text-slate-700 truncate">{c.subjectName}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-slate-500">{c.credits}학점</span>
                        {!c.required && (
                          <button
                            onClick={() => onUnselect(c.id)}
                            className="text-rose-500 hover:text-rose-700 text-xs"
                          >
                            제거
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* CTA + 검증 결과 */}
        <div className="px-5 pt-2 pb-4 border-t border-slate-100">
          {submitIssues && submitIssues.length > 0 ? (
            <div className="mb-2 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-rose-500 text-xs">⚠️</span>
                <span className="text-xs font-bold text-rose-700">최종 제출 불가 — 위배 규칙 {submitIssues.length}건</span>
              </div>
              <ul className="text-[0.68rem] text-rose-700 leading-snug list-disc list-inside space-y-0.5">
                {submitIssues.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          ) : selectedCount > 0 ? (
            <div className="mb-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex items-center gap-2">
              <span className="text-emerald-500 text-xs">✅</span>
              <span className="text-xs font-semibold text-emerald-700">모든 학점 이수 규칙을 충족했습니다.</span>
            </div>
          ) : null}
          <button
            onClick={onNext}
            disabled={!canSubmit}
            className="w-full py-3 rounded-2xl text-white text-sm font-bold transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, #3525cd, #4f46e5)'
                : 'linear-gradient(135deg, #94a3b8, #64748b)',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            {canSubmit ? '다음 단계 →' : '제출 불가 (규칙 위배)'}
          </button>
        </div>
      </div>
    </>
  );
}
