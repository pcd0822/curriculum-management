import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { isConfigured, fetchConfig, fetchSettings } from '../api/db.js';
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
};

function normaliseCourse(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    const mapped = FIELD_MAP[k] || k;
    out[mapped] = v;
  }
  /* Ensure numeric types */
  out.credits = Number(out.credits) || 0;
  out.grade = Number(out.grade) || 0;
  out.semester = Number(out.semester) || 0;
  const req = String(out.required || '').toUpperCase().trim();
  out.required = req === 'TRUE' || req === 'Y' || req === '1' || req === '필수' || out.required === true;
  out.recommended = out.recommended === true || out.recommended === '추천' || out.recommended === 'Y';
  return out;
}

/* ─── semester helpers ─── */
const SEMESTERS = [
  { key: '2-1', label: '2-1학기', grade: 2, semester: 1 },
  { key: '2-2', label: '2-2학기', grade: 2, semester: 2 },
  { key: '3-1', label: '3-1학기', grade: 3, semester: 1 },
  { key: '3-2', label: '3-2학기', grade: 3, semester: 2 },
];

export default function CoursesPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [activeSemester, setActiveSemester] = useState('2-1');
  const [loading, setLoading] = useState(true);

  /* Read verified student info */
  const student = useMemo(() => {
    try {
      return JSON.parse(sessionStorage.getItem('verifiedStudent') || '{}');
    } catch {
      return {};
    }
  }, []);

  const avatarLabel = student.name ? student.name.charAt(0) : '?';
  const schoolName = settings?.schoolName || localStorage.getItem('school_name') || 'OO고등학교';

  /* ── Data fetch ── */
  useEffect(() => {
    if (!isConfigured()) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [configRes, settingsRes] = await Promise.all([
          fetchConfig(),
          fetchSettings(),
        ]);

        if (cancelled) return;

        /* Normalise course rows */
        const rawCourses = Array.isArray(configRes)
          ? configRes
          : configRes?.courses ?? configRes?.data ?? [];

        const processed = rawCourses.map((c, i) => ({
          id: c.id ?? c.code ?? `course-${i}`,
          ...normaliseCourse(c),
        }));

        setCourses(processed);

        /* Settings */
        const s = settingsRes?.settings ?? settingsRes?.data ?? settingsRes ?? {};
        setSettings(s);

        /* Auto-select required courses */
        const reqIds = new Set(processed.filter((c) => c.required).map((c) => c.id));
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

  const totalCredits = useMemo(
    () => selectedCourses.reduce((sum, c) => sum + c.credits, 0),
    [selectedCourses],
  );

  const maxCourses = courses.length || 1;
  const progress = Math.round((selectedIds.size / maxCourses) * 100);

  /* ── Selection rule check ── */
  const selectionRules = settings?.selectionRules || {};

  // 특정 학기에서 특정 학점의 선택(비필수) 과목 수 계산
  function countSelected(semKey, creditFilter, excludeId) {
    return courses.filter(c => {
      if (c.required) return false;
      if (!selectedIds.has(c.id)) return false;
      if (c.id === excludeId) return false;
      if (`${c.grade}-${c.semester}` !== semKey) return false;
      if (creditFilter !== 'all' && c.credits !== Number(creditFilter)) return false;
      return true;
    }).length;
  }

  // 과목이 선택 규칙에 의해 비활성화되어야 하는지 확인
  function isDisabledByRule(course) {
    if (course.required) return false; // 필수 과목은 항상 활성
    if (selectedIds.has(course.id)) return false; // 이미 선택된 건 체크 해제 가능
    const semKey = `${course.grade}-${course.semester}`;
    const rules = selectionRules[semKey];
    if (!rules || !Array.isArray(rules)) return false;
    for (const rule of rules) {
      const creditMatch = rule.credits === 'all' || course.credits === Number(rule.credits);
      if (creditMatch) {
        const currentCount = countSelected(semKey, rule.credits, null);
        if (currentCount >= Number(rule.count)) return true;
      }
    }
    return false;
  }

  /* ── Handlers ── */
  const toggleCourse = useCallback(
    (id) => {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          // 선택 시 규칙 체크
          const course = courses.find(c => c.id === id);
          if (course) {
            const semKey = `${course.grade}-${course.semester}`;
            const rules = selectionRules[semKey];
            if (rules && Array.isArray(rules)) {
              for (const rule of rules) {
                const creditMatch = rule.credits === 'all' || course.credits === Number(rule.credits);
                if (creditMatch) {
                  // 현재 선택된 수 계산 (next 기준)
                  const currentCount = courses.filter(c => {
                    if (c.required) return false;
                    if (!next.has(c.id)) return false;
                    if (`${c.grade}-${c.semester}` !== semKey) return false;
                    if (rule.credits !== 'all' && c.credits !== Number(rule.credits)) return false;
                    return true;
                  }).length;
                  if (currentCount >= Number(rule.count)) return prev; // 초과 → 선택 불가
                }
              }
            }
          }
          next.add(id);
        }
        return next;
      });
    },
    [courses, selectionRules],
  );

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
      {/* ── Header ── */}
      <Header title={schoolName} avatarLabel={avatarLabel} />

      {/* ── Stepper ── */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center gap-2">
          {/* Step 1: done */}
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

          {/* Connector */}
          <div className="w-6 h-px bg-slate-200" />

          {/* Step 2: active */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[0.6rem] font-bold"
              style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
            >
              2
            </div>
            <span className="text-xs font-semibold text-indigo-700" style={{ fontFamily: "'Inter', sans-serif" }}>
              교육선택
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
                  active
                    ? 'text-white'
                    : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
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

      {/* ── Section header ── */}
      <div className="flex items-center justify-between px-5 pb-2">
        <h2
          className="text-base font-bold text-slate-800"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          개설 교과 목록
        </h2>
        <span
          className="text-xs font-medium text-slate-400"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          총 {filteredCourses.length}과목
        </span>
      </div>

      {/* ── Selection rule hint ── */}
      {selectionRules[activeSemester] && (
        <div className="px-5 pb-2">
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
        </div>
      )}

      {/* ── Course list ── */}
      <div
        className="flex-1 overflow-y-auto px-5 pb-40"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="flex flex-col gap-2.5">
          {filteredCourses.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-slate-400">
                이 학기에 개설된 교과가 없습니다.
              </p>
            </div>
          ) : (
            filteredCourses.map((course) => (
              <CourseCard
                key={course.id}
                course={course}
                selected={selectedIds.has(course.id)}
                recommended={course.recommended}
                required={course.required}
                disabled={course.required || isDisabledByRule(course)}
                onToggle={() => toggleCourse(course.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Bottom status bar (above MobileNav) ── */}
      <div
        className="fixed left-0 right-0 bg-white border-t border-slate-100 px-5 py-3 z-40"
        style={{ bottom: '60px', boxShadow: '0 -2px 10px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center justify-between max-w-lg mx-auto">
          {/* Left: selection info */}
          <div className="flex flex-col">
            <span
              className="text-xs font-semibold text-slate-700"
              style={{ fontFamily: "'Inter', sans-serif" }}
            >
              선택: {selectedIds.size}과목 / 총 {totalCredits}학점
            </span>
            <span className="text-[0.65rem] text-slate-400">{progress}% 달성</span>
          </div>

          {/* Right: progress + next button */}
          <div className="flex items-center gap-3">
            {/* Mini progress bar */}
            <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(progress, 100)}%`,
                  background: 'linear-gradient(135deg, #3525cd, #4f46e5)',
                }}
              />
            </div>

            <button
              className="px-4 py-2 rounded-xl text-white text-xs font-bold tracking-tight transition-opacity"
              style={{
                background: 'linear-gradient(135deg, #3525cd, #4f46e5)',
                fontFamily: "'Manrope', sans-serif",
              }}
            >
              다음 단계 →
            </button>
          </div>
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <MobileNav />
    </div>
  );
}
