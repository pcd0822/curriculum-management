import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isConfigured, fetchConfig, fetchSettings, fetchJointCurriculum, submitResponse } from '../api/db.js';
import { getVerifiedStudent, setVerifiedStudent, getStudentAvatarLabel } from '../api/student.js';
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
    const trimmed = String(k).trim();
    const mapped = FIELD_MAP[trimmed] || trimmed;
    // 매핑된 영문 키 + 원본 한국어 키 둘 다 보존 (폴백 매칭용)
    out[mapped] = v;
    if (mapped !== trimmed) out[trimmed] = v;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [majorModalOpen, setMajorModalOpen] = useState(false);
  const [majorInput, setMajorInput] = useState('');

  /* Read verified student info — 앱 종료 전까지 유지.
     관리자 미리보기 모드에서는 가짜 학생을 사용해 실제 학생 데이터에 영향을 주지 않음. */
  const [student, setStudent] = useState(() => {
    if (isAdminPreview) {
      return { name: '관리자(테스트)', studentId: 'PREVIEW', studentCode: 'TEST-MODE' };
    }
    return getVerifiedStudent();
  });
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

        /* 과목 ID는 항상 행 인덱스를 포함해 고유하게 생성.
           DB의 과목코드/영문ID가 학기별로 같더라도 React 객체 충돌이 일어나지 않도록 강제. */
        const processed = rawCourses.map((c, i) => {
          const norm = normaliseCourse(c);
          return {
            joint: false,
            ...norm,
            id: `course-${i}`, // ← spread 뒤에 두어 절대 덮어쓰이지 않음
          };
        });

        /* 공동교육과정 — 정규 교과 외 추가 이수 가능 과목 */
        const rawJoint = Array.isArray(jointRes) ? jointRes : jointRes?.data || [];
        const processedJoint = rawJoint.map((c, i) => {
          const norm = normaliseCourse(c);
          return {
            joint: true,
            host: c.거점학교 || c.host || '',
            schedule: c.운영일시 || c.schedule || '',
            ...norm,
            required: false,
            id: `joint-${i}`, // ← spread 뒤에서 무조건 고유 ID
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

        /* 복수편제 위반 자동 정리: 같은 식별자(과목명/슬러그)를 가진 다학기 과목이 동시에 선택돼 있으면
           가장 빠른 학기 한 개만 남기고 제거 — 이전 버그로 인해 sessionStorage에 양쪽이 모두 저장된 경우 대비 */
        const collectIds = (c) => {
          const cands = [c.subjectName, c['과목명'], c.slug, c['영문ID'], c.code, c['과목코드']];
          const out = [];
          for (const v of cands) {
            const n = String(v || '').replace(/\s+/g, '').normalize('NFC').toLowerCase();
            if (n) out.push(n);
          }
          return out;
        };
        const seenSig = new Map(); // sig → courseId
        const sortedIds = [...reqIds].sort((a, b) => {
          const ca = merged.find((x) => x.id === a);
          const cb = merged.find((x) => x.id === b);
          if (!ca || !cb) return 0;
          const ka = (ca.grade || 0) * 10 + (ca.semester || 0);
          const kb = (cb.grade || 0) * 10 + (cb.semester || 0);
          return ka - kb;
        });
        const dedupReqIds = new Set();
        for (const id of sortedIds) {
          const c = merged.find((x) => x.id === id);
          if (!c) { dedupReqIds.add(id); continue; }
          const sigs = collectIds(c);
          const dup = sigs.find((s) => seenSig.has(s));
          if (dup && !c.required) {
            console.warn('[중복편제] 정리: 같은 과목 중복 선택 제거', c.subjectName, c.id, '←', seenSig.get(dup));
            continue; // 동일 식별자가 이미 있는 경우 이 ID는 제외
          }
          dedupReqIds.add(id);
          sigs.forEach((s) => seenSig.set(s, id));
        }
        setSelectedIds(dedupReqIds);

        /* 데이터 진단: 동일 과목명을 가진 행이 여러 학기에 분포하는지 콘솔에 노출 */
        try {
          const byName = {};
          merged.forEach((c) => {
            const sig = String(c.subjectName || '').replace(/\s+/g, '').normalize('NFC').toLowerCase();
            if (!sig) return;
            if (!byName[sig]) byName[sig] = [];
            byName[sig].push({ name: c.subjectName, id: c.id, sem: `${c.grade}-${c.semester}`, slug: c.slug, code: c.code });
          });
          const dupGroups = Object.entries(byName).filter(([, arr]) => arr.length > 1);
          if (dupGroups.length > 0) {
            console.info('[중복편제] 다학기 편성 과목 그룹:', dupGroups.map(([sig, arr]) => ({ sig, items: arr })));
            console.info('[중복편제] 진단 로그 활성화: localStorage.setItem("dupDebug","1") 후 새로고침');
          } else {
            console.info('[중복편제] 다학기 편성 과목이 발견되지 않음. 데이터에 동일 과목명이 다른 학기에 있는지 확인 필요.');
          }
        } catch {}
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
    () => selectedCourses.filter((c) => !c.required && !c.joint),
    [selectedCourses],
  );

  const requiredCredits = useMemo(
    () => selectedCourses.filter((c) => c.required).reduce((s, c) => s + c.credits, 0),
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

  /* 학기 이동 */
  const semIdx = SEMESTERS.findIndex((s) => s.key === activeSemester);
  const prevSemester = semIdx > 0 ? SEMESTERS[semIdx - 1] : null;
  const nextSemester = semIdx >= 0 && semIdx < SEMESTERS.length - 1 ? SEMESTERS[semIdx + 1] : null;
  function gotoSemester(key) {
    setActiveSemester(key);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  }

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
  /* 학기간 동명 과목 중복 신청은 항상 차단 (정책 고정).
     예외는 settings.duplicateCourseSlugs 에 등록된 과목명/슬러그에 한해서만 허용. */
  const allowMultiSemesterDuplicate = false;
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

  /* 후수→선이수 매핑 (관리자 화면에서 등록).
     {[과목명|slug]: [선이수1, 선이수2, ...]} 형태. */
  const prerequisitesMap = (settings && typeof settings.prerequisitesMap === 'object' && !Array.isArray(settings.prerequisitesMap))
    ? settings.prerequisitesMap : {};

  /* 한 과목의 선이수 목록을 모두 수집 — 엑셀 컬럼(course.prerequisites) + 관리자 매핑(prerequisitesMap) */
  function getCoursePrerequisites(course) {
    const fromCourse = Array.isArray(course.prerequisites) ? course.prerequisites : [];
    const lookupKeys = [course.subjectName, course.slug, course.id].map((k) => String(k || '').trim()).filter(Boolean);
    let fromSettings = [];
    for (const k of lookupKeys) {
      if (Array.isArray(prerequisitesMap[k])) {
        fromSettings = fromSettings.concat(prerequisitesMap[k]);
      }
    }
    const merged = [...fromCourse, ...fromSettings].map((p) => String(p || '').trim()).filter(Boolean);
    return [...new Set(merged)];
  }

  /* 선이수 검사: 선이수 과목이 같은 학기 또는 이전 학기에 선택되어 있어야 함.
     - 슬러그/과목명 양쪽으로 매칭(공백·유니코드 정규화)
     - 카리큘럼에 존재하지 않는 선이수 항목(예: 1학년 과목)은 이미 이수한 것으로 간주(통과)
     - 등록된 과목인데 선택 안 됨 → 미충족 */
  function missingPrerequisites(course) {
    const prereqs = getCoursePrerequisites(course);
    if (prereqs.length === 0) return [];
    const here = semOrder(semKeyOf(course));

    const satisfied = new Set();
    const allKnown = new Set();
    courses.forEach((c) => {
      const slug = String(c.slug || '').trim();
      const name = String(c.subjectName || '').trim();
      const slugN = normName(slug);
      const nameN = normName(name);
      if (slug) allKnown.add(slug);
      if (name) allKnown.add(name);
      if (slugN) allKnown.add(slugN);
      if (nameN) allKnown.add(nameN);
      if (!selectedIds.has(c.id)) return;
      if (semOrder(semKeyOf(c)) > here) return;
      if (slug) satisfied.add(slug);
      if (name) satisfied.add(name);
      if (slugN) satisfied.add(slugN);
      if (nameN) satisfied.add(nameN);
    });

    return prereqs.filter((p) => {
      const pN = normName(p);
      if (!p) return false;
      if (satisfied.has(p) || satisfied.has(pN)) return false;       // 이미 이수
      if (!allKnown.has(p) && !allKnown.has(pN)) return false;       // 카리큘럼에 없는 항목 → 통과
      return true;                                                    // 등록되어 있는데 미선택 → 차단
    });
  }

  /* 복수편제 차단 (이름 단일 기준).
     같은 과목명을 가진 과목이 다른 학기에 편성되어 있을 때, 어느 한 쪽이 선택되면
     나머지 학기의 동일 이름 과목은 차단. 학기 비교는 grade 또는 semester 중 하나라도 다르면 다른 학기로 인정.
     예외: settings.allowMultiSemesterDuplicate, settings.duplicateCourseSlugs */
  function normName(s) {
    return String(s || '').replace(/[\s\u200B-\u200D\uFEFF]+/g, '').normalize('NFC').toLowerCase();
  }
  function getCourseNameKey(c) {
    if (!c) return '';
    return normName(c.subjectName || c['과목명'] || c.slug || c['영문ID'] || c.code || c['과목코드']);
  }
  function isDifferentSemester(a, b) {
    return Number(a.grade) !== Number(b.grade) || Number(a.semester) !== Number(b.semester);
  }
  function findDuplicateByName(course, prevSelected, verbose = false) {
    const log = verbose ? console.warn.bind(console) : () => {};
    if (allowMultiSemesterDuplicate) {
      log('[중복편제] allowMultiSemesterDuplicate=true → 통과');
      return null;
    }
    const sel = prevSelected || selectedIds;
    const myName = getCourseNameKey(course);
    log('[중복편제] 검사 시작', {
      course: course?.subjectName,
      myName,
      sem: `${course.grade}-${course.semester}`,
      selSize: sel?.size,
      selectedIds: sel ? [...sel] : null,
      coursesCount: courses?.length,
    });
    if (!myName) { log('[중복편제] myName 비어있음 → 통과'); return null; }
    const exempt = duplicateCourseSlugs.some((x) => normName(x) === myName);
    if (exempt) { log('[중복편제] 예외 목록 → 통과'); return null; }
    let foundSameName = 0;
    for (const c of courses) {
      if (c.id === course.id) continue;
      const otherName = getCourseNameKey(c);
      if (otherName === myName) {
        foundSameName++;
        log('[중복편제] 동일 이름 후보', {
          other: c.subjectName,
          otherId: c.id,
          otherSem: `${c.grade}-${c.semester}`,
          isSelected: sel.has(c.id),
          isDifferentSemester: isDifferentSemester(c, course),
        });
      }
      if (!sel.has(c.id)) continue;
      if (!isDifferentSemester(c, course)) continue;
      if (otherName === myName) {
        log('[중복편제] ✅ 차단', c.subjectName);
        return c;
      }
    }
    log('[중복편제] 매칭 없음 → 통과', { foundSameName });
    return null;
  }
  // 기존 호출 지점 호환을 위한 별칭 (렌더링용 — verbose 끔)
  const isDuplicateAcrossSemester = (course) => findDuplicateByName(course, null, false);
  // 외부에서 사용할 수 있도록 정규화 식별자 도우미는 그대로 유지(다른 함수에서 참조)
  function collectCourseIds(c) {
    return c ? [getCourseNameKey(c)].filter(Boolean) : [];
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
        message: `"${course.subjectName}"이(가) ${dup.grade}학년 ${dup.semester}학기에 이미 신청되었습니다. 같은 과목명(또는 영문ID)이 다른 학기에 복수편제된 과목은 한 학기에서만 신청할 수 있습니다. 다른 학기에서 신청하려면 먼저 ${dup.grade}-${dup.semester}학기의 선택을 해제하세요.`,
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
    /* 선이수 미충족 사후 검증 — 필수·학생선택·공동교육과정 모두 대상 */
    const reportedPrereq = new Set(); // 같은 위배 메시지 중복 방지
    selectedCourses.forEach((c) => {
      const missing = missingPrerequisites(c);
      if (missing.length > 0) {
        const names = missing.map((p) => {
          const f = courses.find(
            (x) => String(x.slug || '').trim() === String(p).trim() ||
                   String(x.subjectName || '').trim() === String(p).trim()
          );
          return f?.subjectName || p;
        });
        const key = `${c.subjectName}|${names.join(',')}`;
        if (reportedPrereq.has(key)) return;
        reportedPrereq.add(key);
        const tag = c.required ? '[필수]' : c.joint ? '[공동]' : '[선택]';
        issues.push(`${tag} "${c.subjectName}" 선이수 과목 미이수: ${names.join(', ')}`);
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
      console.warn('[중복편제] 클릭', { name: course.subjectName, id, sem: `${course.grade}-${course.semester}` });

      setSelectedIds((prev) => {
        console.warn('[중복편제] prev 상태', { prevSize: prev.size, prevIds: [...prev] });
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
          setBlockedReason(null);
          return next;
        }

        /* 1) 이름 기반 복수편제 차단 — prev(최신 상태)를 직접 사용. verbose=true */
        if (!course.joint) {
          const dup = findDuplicateByName(course, prev, true);
          if (dup) {
            setBlockedReason({
              courseName: course.subjectName,
              reason: `"${course.subjectName}"이(가) ${dup.grade}학년 ${dup.semester}학기에 이미 신청되었습니다. 같은 과목명이 다른 학기에 복수편제된 경우 한 학기에서만 신청할 수 있습니다. 다른 학기에서 신청하려면 먼저 ${dup.grade}-${dup.semester}학기의 선택을 해제하세요.`,
            });
            return prev;
          }
        } else {
          console.warn('[중복편제] joint 과목 → 검사 건너뜀');
        }

        /* 2) 그 외 차단 사유 (선이수, 선택규칙 등) */
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

  function handleSubmit() {
    if (!canSubmit) {
      const reasons = submitIssues.map((s, i) => `${i + 1}. ${s}`).join('\n');
      alert(`제출 불가\n\n다음 규칙을 위배하여 제출할 수 없습니다:\n\n${reasons}`);
      setSheetOpen(true);
      return;
    }
    /* 제출 전 진로/학과 입력 받기 */
    setMajorInput(student?.major || student?.희망진로 || '');
    setMajorModalOpen(true);
  }

  async function performSubmit(enteredMajor) {
    if (!canSubmit) return;
    const major = String(enteredMajor || '').trim() || '탐색중';
    /* 학생 정보에 진로 저장 (관리자 미리보기에서는 저장 안 함) */
    if (!isAdminPreview) {
      const updated = { ...student, major, 희망진로: major };
      setVerifiedStudent(updated);
      setStudent(updated);
    }
    const snapshot = selectedCourses.map((c) => ({
      id: c.id,
      subjectName: c.subjectName,
      credits: c.credits,
      grade: c.grade,
      semester: c.semester,
      category: c.category || '',
      subCategory: c.subCategory || '',
      required: !!c.required,
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

    /* 학번을 학년·반·번호로 분해 (예: "20513" → grade 2, class 5, number 13) */
    const sidStr = String(student?.studentId || student?.학번 || '').trim();
    const sidGrade = Number(sidStr.charAt(0)) || 0;
    const sidClass = Number(sidStr.substring(1, 3)) || 0;
    const sidNumber = Number(sidStr.substring(3)) || 0;
    const studentName = student?.name || student?.이름 || '';
    /* major는 모달에서 받은 값을 우선 사용 */

    const optionalNames = snapshot.filter((c) => !c.required && !c.joint).map((c) => c.subjectName);
    const requiredNames = snapshot.filter((c) => c.required).map((c) => c.subjectName);
    const jointEntries = snapshot.filter((c) => c.joint).map((c) => ({
      subjectName: c.subjectName,
      host: c.host,
    }));

    const validationLines = [
      `총 이수학점: ${totalCredits}/${requiredTotalCredits}`,
      `학교지정: ${requiredCredits || (totalCredits - optionalCredits - jointCredits)}학점, 학생선택: ${optionalCredits}학점${jointCredits > 0 ? `, 공동교육: ${jointCredits}학점` : ''}`,
      `기초교과: ${foundationCredits}학점 (${totalCredits > 0 ? Math.round((foundationCredits / totalCredits) * 100) : 0}%)`,
      submitIssues.length === 0 ? '✅ 모든 학점 이수 규칙 충족' : `⚠️ ${submitIssues.length}건 위배`,
    ];

    const payload = {
      grade: sidGrade,
      classNum: sidClass,
      studentNum: sidNumber,
      name: studentName,
      major,
      selectedCourses: optionalNames.join(', '),
      jointCourses: jointEntries,
      totalCredits,
      validationResult: validationLines.join(' / '),
      aiRecommendation: '',
      // 추가 메타 — GAS가 헤더 매핑된 것만 저장하지만 향후 확장 대비
      coursesDetail: JSON.stringify(snapshot),
      foundationCredits,
      optionalCredits,
      requiredCredits,
      jointCredits,
    };

    setIsSubmitting(true);
    try {
      await submitResponse(payload);

      sessionStorage.setItem('pendingSelectedCourses', JSON.stringify(snapshot));

      /* 로컬 신청 이력 저장 (날짜·시간대별로 누적) */
      try {
        const history = JSON.parse(localStorage.getItem('submissionHistory') || '[]');
        history.push({
          timestamp: Date.now(),
          dateLabel: new Date().toLocaleString('ko-KR'),
          studentId: sidStr,
          studentName,
          major,
          totalCredits,
          optionalCredits,
          foundationCredits,
          regularCredits,
          requiredCredits,
          jointCredits,
          courses: snapshot,
          submitOk: true,
          serverSaved: true,
        });
        localStorage.setItem('submissionHistory', JSON.stringify(history.slice(-50)));
      } catch {}

      alert(`✅ 제출 완료!\n\n· 총 ${totalCredits}학점 (${snapshot.length}과목)\n· 학교지정 ${requiredCredits}학점 + 학생선택 ${optionalCredits}학점${jointCredits > 0 ? ` + 공동교육 ${jointCredits}학점` : ''}\n· 희망 진로: ${major}\n\n관리자 대시보드와 이수현황에 즉시 집계됩니다.`);
      setMajorModalOpen(false);
      navigate('/credits');
    } catch (err) {
      console.error('submit error', err);
      alert(`❌ 제출 실패: ${err.message || '서버 오류'}\n\n잠시 후 다시 시도하거나 관리자에게 문의하세요.`);
    } finally {
      setIsSubmitting(false);
    }
  }
  // 기존 호출부 호환을 위한 별칭
  const handleNextStep = handleSubmit;

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
        onNext={handleSubmit}
        submitIssues={submitIssues}
        canSubmit={canSubmit}
        isSubmitting={isSubmitting}
      />

      {/* ── Mini status bar (시트가 닫혀 있을 때) ── */}
      {!sheetOpen && (() => {
        /* 현재 학기 선택 규칙이 모두 충족되었는지 */
        const rules = selectionRules[activeSemester];
        const isSemesterComplete = Array.isArray(rules) && rules.length > 0 &&
          rules.every((rule) => {
            const cur = countSelected(activeSemester, rule.credits, null);
            return cur >= Number(rule.count);
          });
        return (
          <div
            className="fixed left-0 right-0 z-40 px-5 pb-2"
            style={{ bottom: '64px' }}
          >
            <div className="w-full max-w-lg mx-auto flex items-stretch gap-2">
              {/* 이전 학기 */}
              {prevSemester && (
                <button
                  onClick={() => gotoSemester(prevSemester.key)}
                  className="flex-shrink-0 bg-white border border-slate-200 rounded-2xl px-3 py-3 shadow-md hover:shadow-lg flex flex-col items-center justify-center"
                  title={`${prevSemester.label}로 이동`}
                >
                  <span className="text-base text-slate-500 leading-none">←</span>
                  <span className="text-[0.6rem] text-slate-500 font-semibold mt-0.5 leading-none">
                    {prevSemester.label}
                  </span>
                </button>
              )}

              {/* 신청 보기 (메인) */}
              <button
                onClick={() => setSheetOpen(true)}
                className="flex-1 min-w-0 bg-white border border-slate-200 rounded-2xl px-4 py-3 flex items-center justify-between shadow-md hover:shadow-lg transition-shadow"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-slate-400 text-xs">↑</span>
                  <div className="flex flex-col items-start min-w-0">
                    <span className="text-xs font-semibold text-slate-700 truncate" style={{ fontFamily: "'Inter', sans-serif" }}>
                      선택: {selectedIds.size}과목 / 총 {totalCredits}학점
                    </span>
                    <span className="text-[0.65rem] text-slate-400 truncate">
                      학생선택 {optionalCredits}학점
                      {jointCredits > 0 && ` · 공동 ${jointCredits}`}
                      {' · '}{progress}%
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
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

              {/* 다음 학기 */}
              {nextSemester && (
                <button
                  onClick={() => gotoSemester(nextSemester.key)}
                  className={`flex-shrink-0 rounded-2xl px-3 py-3 shadow-md hover:shadow-lg flex flex-col items-center justify-center transition-all relative ${
                    isSemesterComplete
                      ? 'text-white border-0'
                      : 'bg-white border border-slate-200 text-slate-500'
                  }`}
                  style={isSemesterComplete ? { background: 'linear-gradient(135deg, #3525cd, #4f46e5)' } : {}}
                  title={`${nextSemester.label}로 이동`}
                >
                  {isSemesterComplete && (
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white" />
                  )}
                  <span className={`text-base leading-none ${isSemesterComplete ? 'text-white' : 'text-slate-500'}`}>→</span>
                  <span className={`text-[0.6rem] font-semibold mt-0.5 leading-none ${isSemesterComplete ? 'text-white' : 'text-slate-500'}`}>
                    {nextSemester.label}
                  </span>
                </button>
              )}
            </div>
            {/* 안내 문구 (선택 규칙 충족 시) */}
            {nextSemester && isSemesterComplete && (
              <p className="mt-1 text-[0.65rem] text-emerald-600 font-semibold text-center">
                ✓ 이 학기 선택 규칙을 모두 충족했어요. 다음 학기로 이동해 보세요.
              </p>
            )}
          </div>
        );
      })()}

      {/* ── 진로/학과 입력 모달 ── */}
      {majorModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/40"
          onClick={() => !isSubmitting && setMajorModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-extrabold text-slate-800 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
              진로/학과 입력
            </h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              학생이 희망하는 <strong className="text-indigo-600">진로 또는 학과(전공)</strong>은 무엇인가요?<br />
              <span className="text-xs text-slate-400">아직 정하지 못했다면 <strong>"탐색중"</strong>이라고 입력하세요.</span>
            </p>
            <input
              type="text"
              value={majorInput}
              onChange={(e) => setMajorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSubmitting) {
                  performSubmit(majorInput);
                }
                if (e.key === 'Escape' && !isSubmitting) setMajorModalOpen(false);
              }}
              placeholder="예: 컴퓨터공학, 간호사, 탐색중"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 mb-4"
              autoFocus
              disabled={isSubmitting}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setMajorModalOpen(false)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={() => performSubmit(majorInput)}
                disabled={isSubmitting}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    제출중
                  </>
                ) : '제출하기 →'}
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}

/* ─── Bottom sheet component ─── */
function BottomSheet({ open, onClose, selectedCount, totalCredits, optionalCredits, foundationCredits, regularCredits, jointCredits, progress, selectedCourses, onUnselect, onNext, submitIssues, canSubmit, isSubmitting }) {
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
            disabled={!canSubmit || isSubmitting}
            className="w-full py-3 rounded-2xl text-white text-sm font-bold transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              background: canSubmit
                ? 'linear-gradient(135deg, #3525cd, #4f46e5)'
                : 'linear-gradient(135deg, #94a3b8, #64748b)',
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                제출중...
              </>
            ) : canSubmit ? (
              '✓ 제출하기'
            ) : (
              '제출 불가 (규칙 위배)'
            )}
          </button>
        </div>
      </div>
    </>
  );
}
