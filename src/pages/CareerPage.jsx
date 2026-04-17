import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import {
  getAiRecommendation,
  getCareernetRecommendation,
  getQuestions,
  submitReport,
  getMajorList,
  getMajorDetail,
} from '../api/careernet';
import { fetchConfig, fetchSettings, isConfigured } from '../api/db';

/* ───────────────────────── constants ───────────────────────── */

const TABS = [
  { key: 'home', label: 'AI 추천' },
  { key: 'tests', label: '심리검사' },
  { key: 'majors', label: '학과탐색' },
];

const TESTS = [
  { id: 31, name: '직업흥미검사(K)', desc: '흥미 유형을 기반으로 적합한 직업군을 탐색합니다.' },
  { id: 21, name: '직업적성검사', desc: '자신의 적성을 파악하여 진로 방향을 설정합니다.' },
  { id: 25, name: '직업가치관검사', desc: '직업 선택에서 중요하게 여기는 가치를 알아봅니다.' },
  { id: 27, name: '진로개발역량검사', desc: '진로 개발에 필요한 핵심 역량을 진단합니다.' },
  { id: 36, name: '진로성숙도검사', desc: '진로 결정 준비 정도를 종합적으로 평가합니다.' },
  { id: 38, name: '진로실행력검사', desc: '진로 목표를 실행하는 능력을 측정합니다.' },
];

const SUBJECT_TABS = [
  { code: '', label: '전체' },
  { code: '100391', label: '인문' },
  { code: '100392', label: '사회' },
  { code: '100393', label: '교육' },
  { code: '100394', label: '공학' },
  { code: '100395', label: '자연' },
  { code: '100396', label: '의약' },
  { code: '100397', label: '예체능' },
];

const CATEGORY_ICONS = {
  수학: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" /><line x1="2" y1="12" x2="22" y2="12" />
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  ),
  정보: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><line x1="9" y1="9" x2="15" y2="15" />
      <line x1="15" y1="9" x2="9" y2="15" />
    </svg>
  ),
  과학: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3v12l-3 5h12l-3-5V3" /><line x1="8" y1="3" x2="16" y2="3" />
    </svg>
  ),
  default: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4l2 2" />
    </svg>
  ),
};

function getCategoryIcon(cat) {
  if (!cat) return CATEGORY_ICONS.default;
  for (const key of Object.keys(CATEGORY_ICONS)) {
    if (cat.includes(key)) return CATEGORY_ICONS[key];
  }
  return CATEGORY_ICONS.default;
}

/* ───────────────────────── sub-components ───────────────────────── */

function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );
}

function TabBar({ view, onChange }) {
  return (
    <div className="flex bg-white rounded-xl p-1 mx-5 mt-3 shadow-sm">
      {TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
            view === t.key
              ? 'bg-indigo-600 text-white shadow'
              : 'text-slate-500 hover:text-slate-700'
          }`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ───────── View 1 : AI 추천 (Home) ───────── */

function HomeView({ major, setMajor, recommendations, setRecommendations, loading, setLoading }) {
  const [inputValue, setInputValue] = useState(major || '');
  const [aiTip, setAiTip] = useState('');
  const [aiError, setAiError] = useState('');
  const [dbCourses, setDbCourses] = useState([]);
  const [selectionRules, setSelectionRules] = useState(null);

  // DB에서 과목 목록 + 선택 규칙 로드
  useEffect(() => {
    if (!isConfigured()) return;
    fetchConfig().then(cfg => {
      const arr = Array.isArray(cfg) ? cfg : cfg?.data || [];
      setDbCourses(arr);
    }).catch(() => {});
    fetchSettings().then(stg => {
      if (stg?.selectionRules) setSelectionRules(stg.selectionRules);
    }).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!inputValue.trim()) return;
    setMajor(inputValue.trim());
    setLoading(true);
    setAiError('');
    setAiTip('');
    try {
      // DB 등록 과목명만 전달 → AI가 이 중에서만 추천
      const courseNames = dbCourses.map(c => c.과목명 || c.subjectName || '').filter(Boolean);
      const rulesText = selectionRules ? Object.entries(selectionRules).map(([k, rules]) =>
        `${k}학기: ${rules.map(r => `${r.credits === 'all' ? '모든' : r.credits + '학점'} ${r.count}개`).join(', ')}`
      ).join(' / ') : '';
      const coursesStr = courseNames.length > 0
        ? courseNames.join(', ')
        : '(과목 목록이 등록되지 않았습니다)';
      const fullPrompt = rulesText
        ? `${coursesStr}\n\n[선택 규칙] ${rulesText}`
        : coursesStr;

      const data = await getAiRecommendation(inputValue.trim(), fullPrompt);
      const content = data?.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('AI 응답이 비어 있습니다.');

      // Parse "과목명: 이유" format lines + DB 매칭으로 학년/학기/학점 추가
      const lines = content.split('\n').filter(l => l.trim());
      const recs = [];
      for (const line of lines) {
        const match = line.match(/^[\d.)\-*]*\s*(.+?)\s*[:：]\s*(.+)$/);
        if (match) {
          const name = match[1].trim();
          // DB 과목과 매칭
          const dbMatch = dbCourses.find(c => {
            const dbName = (c.과목명 || c.subjectName || '').trim();
            return dbName === name || dbName.includes(name) || name.includes(dbName);
          });
          recs.push({
            name,
            description: match[2].trim(),
            category: dbMatch ? (dbMatch.교과군 || dbMatch.category || '교과') : '교과',
            subCategory: dbMatch ? (dbMatch.세부교과 || dbMatch.subCategory || '') : '',
            grade: dbMatch ? (dbMatch.학년 || dbMatch.grade || '') : '',
            semester: dbMatch ? (dbMatch.학기 || dbMatch.semester || '') : '',
            credits: dbMatch ? (dbMatch.학점 || dbMatch.credits || '') : '',
          });
        }
      }
      if (recs.length > 0) {
        setRecommendations(recs);
        setAiTip(`"${inputValue.trim()}" 진로에 맞춰 AI가 ${recs.length}개 과목을 추천했습니다. 추천 과목을 참고하여 수강신청에 반영하세요.`);
        // AI 추천 이력 저장
        try {
          const history = JSON.parse(localStorage.getItem('aiHistory') || '[]');
          history.push({ major: inputValue.trim(), date: new Date().toLocaleDateString('ko-KR'), courses: recs.map(r => r.name) });
          localStorage.setItem('aiHistory', JSON.stringify(history.slice(-20)));
        } catch {}
      } else {
        setRecommendations([{ name: 'AI 추천 결과', description: content, category: '전체' }]);
        setAiTip(content.substring(0, 150));
      }
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'AI 추천을 받을 수 없습니다.');
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  };

  // AI 추천은 사용자가 검색 버튼을 누를 때만 호출

  return (
    <div className="px-5 pb-6">
      {/* Hero */}
      <div className="mt-5 mb-4">
        <h1
          className="text-slate-900 font-bold leading-tight"
          style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem' }}
        >
          진로 맞춤형 과목 추천
        </h1>
        <p className="text-slate-500 text-sm mt-2 leading-relaxed">
          AI가 학생의 과목을 분석하여 최적의 직업 경로를 안내합니다.
        </p>
      </div>

      {/* Input + Search button */}
      <div className="flex gap-2 mb-5">
        <div className="relative flex-1">
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7.5L12 22l-3-5.5C7 14.5 5 12 5 9a7 7 0 0 1 7-7z" />
              <circle cx="12" cy="9" r="2.5" />
            </svg>
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="희망 직업 또는 전공 입력"
            disabled={loading}
            className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading || !inputValue.trim()}
          className="px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
        >
          {loading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
          {loading ? '분석 중' : '추천'}
        </button>
      </div>

      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-slate-800 font-bold text-base" style={{ fontFamily: "'Manrope', sans-serif" }}>
          AI 추천 과목 리스트
        </h2>
        <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">
          {recommendations.length}개의 추천 과목
        </span>
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-12 gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg className="animate-spin h-7 w-7 text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center animate-pulse">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" /></svg>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-700" style={{ fontFamily: "'Manrope', sans-serif" }}>AI가 과목을 분석하고 있습니다</p>
            <p className="text-xs text-slate-400 mt-1">등록된 교과 데이터와 진로를 매칭 중...</p>
          </div>
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      ) : (
        <>
          {/* Error */}
          {aiError && (
            <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
              {aiError}
              <p className="text-xs mt-1 text-red-400">Netlify 환경변수 OPENAI_API_KEY가 설정되어 있는지 확인하세요.</p>
            </div>
          )}

          {/* Cards */}
          <div className="space-y-3 mb-4">
            {recommendations.map((rec, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    {getCategoryIcon(rec.category)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-800 font-bold text-sm">{rec.name || rec.subject}</h3>
                    <p className="text-slate-400 text-xs mt-0.5">{rec.subCategory || rec.category || '교과'}</p>
                    <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{rec.description || rec.reason}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {rec.grade && rec.semester && (
                        <span className="bg-indigo-50 text-indigo-600 text-[0.65rem] font-semibold px-2 py-0.5 rounded-full">
                          {rec.grade}학년 {rec.semester}학기
                        </span>
                      )}
                      {rec.credits && (
                        <span className="bg-slate-100 text-slate-600 text-[0.65rem] font-medium px-2 py-0.5 rounded-full">
                          {rec.credits}학점
                        </span>
                      )}
                      {rec.category && rec.category !== '교과' && rec.category !== '전체' && (
                        <span className="bg-emerald-50 text-emerald-600 text-[0.65rem] font-medium px-2 py-0.5 rounded-full">
                          {rec.category}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* AI tip */}
          {(aiTip || recommendations.length > 0) && (
            <div className="bg-violet-50 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-violet-200 flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5">
                    <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                  </svg>
                </div>
                <span className="text-violet-700 font-bold text-xs">AI 어드바이저의 팁</span>
              </div>
              <p className="text-violet-600 text-xs leading-relaxed">
                {aiTip || `"${major}" 진로에 맞는 과목을 AI가 추천했습니다. 추천 과목을 참고하여 수강신청에 반영하세요.`}
              </p>
            </div>
          )}

          {/* CTA */}
          <button
            className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
          >
            추천과목 모두 선택하기
          </button>
        </>
      )}
    </div>
  );
}

/* ───────── View 2 : 진로심리검사 (Tests) ───────── */

const TEST_ICONS = [
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"/><path d="M18 20V4"/><path d="M6 20v-4"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>,
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
];

function TestsView() {
  const [testState, setTestState] = useState({
    step: 'list', // list | gender | questions | submitting | result
    testId: null,
    testName: '',
    gender: null,
    questions: [],
    currentQ: 0,
    answers: {},
    resultUrl: null,
    startDtm: null,
    error: null,
  });

  const startTest = (test) => {
    setTestState((s) => ({ ...s, step: 'gender', testId: test.id, testName: test.name, error: null }));
  };

  const selectGender = async (gender) => {
    setTestState((s) => ({ ...s, gender, step: 'loading', error: null }));
    try {
      const data = await getQuestions(testState.testId);
      const questions = data.RESULT || [];
      setTestState((s) => ({
        ...s,
        questions,
        currentQ: 0,
        answers: {},
        step: 'questions',
        startDtm: Date.now(),
      }));
    } catch (err) {
      setTestState((s) => ({ ...s, step: 'list', error: err.message }));
    }
  };

  const answerQuestion = (qNum, answerVal) => {
    setTestState((s) => {
      const newAnswers = { ...s.answers, [qNum]: answerVal };
      const nextQ = s.currentQ + 1;
      if (nextQ >= s.questions.length) {
        // All done, submit
        return { ...s, answers: newAnswers, step: 'submitting' };
      }
      return { ...s, answers: newAnswers, currentQ: nextQ };
    });
  };

  // Submit when step becomes 'submitting'
  useEffect(() => {
    if (testState.step !== 'submitting') return;
    const doSubmit = async () => {
      try {
        // Build answer string: "1=score 2=score ..." (v1 형식, B 접두사 없음)
        const answerStr = Object.entries(testState.answers)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([k, v]) => `${k}=${v}`)
          .join(' ');

        const payload = {
          qestrnSeq: String(testState.testId),
          trgetSe: '100207', // 고등학생 코드
          name: '',
          gender: String(testState.gender),
          grade: '1',
          startDtm: testState.startDtm,
          answers: answerStr,
        };

        const data = await submitReport(payload);
        // v1 응답: { SUCC_YN: "Y", RESULT: { inspctSeq: ..., url: "..." } }
        const url = data?.RESULT?.url || null;
        const seq = data?.RESULT?.inspctSeq || null;
        setTestState((s) => ({ ...s, step: 'result', resultUrl: url, inspctSeq: seq }));
        // 이력 저장
        try {
          const history = JSON.parse(localStorage.getItem('testHistory') || '[]');
          history.push({ testName: testState.testName, date: new Date().toLocaleDateString('ko-KR'), resultUrl: url, inspctSeq: seq });
          localStorage.setItem('testHistory', JSON.stringify(history.slice(-20)));
        } catch {}
      } catch (err) {
        setTestState((s) => ({ ...s, step: 'list', error: '결과 제출 실패: ' + err.message }));
      }
    };
    doSubmit();
  }, [testState.step, testState.answers, testState.testId, testState.gender, testState.startDtm]);

  const resetTest = () => {
    setTestState({
      step: 'list',
      testId: null,
      testName: '',
      gender: null,
      questions: [],
      currentQ: 0,
      answers: {},
      resultUrl: null,
      startDtm: null,
      error: null,
    });
  };

  /* ── Gender selection ── */
  if (testState.step === 'gender') {
    return (
      <div className="px-5 pb-6">
        <button onClick={resetTest} className="flex items-center gap-1 text-slate-500 text-sm mt-4 mb-6">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          돌아가기
        </button>
        <h2 className="text-slate-800 font-bold text-lg mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
          {testState.testName}
        </h2>
        <p className="text-slate-500 text-sm mb-8">성별을 선택해주세요.</p>
        <div className="flex gap-3">
          <button
            onClick={() => selectGender(100323)}
            className="flex-1 bg-white rounded-2xl py-6 shadow-sm text-center hover:ring-2 hover:ring-indigo-400 transition"
          >
            <div className="text-3xl mb-2">👨</div>
            <span className="text-slate-700 font-semibold text-sm">남성</span>
          </button>
          <button
            onClick={() => selectGender(100324)}
            className="flex-1 bg-white rounded-2xl py-6 shadow-sm text-center hover:ring-2 hover:ring-indigo-400 transition"
          >
            <div className="text-3xl mb-2">👩</div>
            <span className="text-slate-700 font-semibold text-sm">여성</span>
          </button>
        </div>
      </div>
    );
  }

  /* ── Loading questions ── */
  if (testState.step === 'loading') {
    return <Spinner />;
  }

  /* ── Questions ── */
  if (testState.step === 'questions') {
    const q = testState.questions[testState.currentQ];
    const progress = ((testState.currentQ) / testState.questions.length) * 100;

    // Parse answer options: answer01~answer10 (label) + answerScore01~answerScore10 (value)
    const options = [];
    for (let i = 1; i <= 10; i++) {
      const padded = String(i).padStart(2, '0');
      const label = q[`answer${padded}`];
      const score = q[`answerScore${padded}`];
      if (label && score) options.push({ value: score, label });
    }
    if (options.length === 0) {
      for (let i = 1; i <= 4; i++) options.push({ value: String(i), label: `${i}` });
    }

    return (
      <div className="px-5 pb-6">
        <button onClick={resetTest} className="flex items-center gap-1 text-slate-500 text-sm mt-4 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          그만두기
        </button>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{testState.currentQ + 1} / {testState.questions.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #3525cd, #7c3aed)' }}
            />
          </div>
        </div>

        <h3 className="text-slate-800 font-bold text-base mb-6 leading-relaxed">
          {q.question || q.qText || `문항 ${testState.currentQ + 1}`}
        </h3>

        <div className="space-y-2.5">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => answerQuestion(testState.currentQ + 1, opt.value)}
              className="w-full text-left bg-white rounded-xl px-4 py-3.5 text-sm text-slate-700 shadow-sm hover:ring-2 hover:ring-indigo-400 transition"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  /* ── Submitting ── */
  if (testState.step === 'submitting') {
    return (
      <div className="px-5 pb-6 pt-8 text-center">
        <Spinner />
        <p className="text-slate-500 text-sm mt-4">검사 결과를 분석 중입니다...</p>
      </div>
    );
  }

  /* ── Result ── */
  if (testState.step === 'result') {
    return (
      <div className="px-5 pb-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm text-center mt-6">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h3 className="text-slate-800 font-bold text-lg mb-2">{testState.testName} 완료!</h3>
          <p className="text-slate-500 text-sm mb-5">검사가 성공적으로 완료되었습니다.</p>
          {testState.inspctSeq && (
            <p className="text-xs text-slate-400 mb-3" style={{ fontFamily: "'Inter', sans-serif" }}>검사번호: {testState.inspctSeq}</p>
          )}
          {testState.resultUrl ? (
            <a
              href={testState.resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full py-3 rounded-xl text-white font-bold text-sm mb-2"
              style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
            >
              📊 결과 보고서 보기
            </a>
          ) : (
            <div className="space-y-2 mb-2">
              <p className="text-amber-600 text-sm">결과 URL을 직접 확인하세요.</p>
              <a
                href={`https://www.career.go.kr/inspct/entr/inspctResult.do`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block w-full py-3 rounded-xl text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
              >
                커리어넷 검사 결과 페이지 →
              </a>
            </div>
          )}
          <button onClick={resetTest} className="mt-3 text-slate-500 text-sm underline">
            다른 검사 하기
          </button>
        </div>
      </div>
    );
  }

  /* ── Test list (default) ── */
  return (
    <div className="px-5 pb-6">
      <h2
        className="text-slate-800 font-bold text-lg mt-5 mb-1"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        진로심리검사
      </h2>
      <p className="text-slate-500 text-sm mb-5">커리어넷 진로심리검사를 통해 자신을 탐색하세요.</p>

      {testState.error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{testState.error}</div>
      )}

      <div className="space-y-2.5">
        {TESTS.map((test, idx) => (
          <button
            key={test.id}
            onClick={() => startTest(test)}
            className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3.5 text-left hover:ring-2 hover:ring-indigo-200 transition"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
              {TEST_ICONS[idx % TEST_ICONS.length]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-slate-800 font-bold text-sm">{test.name}</h3>
              <p className="text-slate-400 text-xs mt-0.5 truncate">{test.desc}</p>
            </div>
            <span className="text-slate-300 text-lg flex-shrink-0">&rsaquo;</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ───────── View 3 : 학과탐색 (Majors) ───────── */

function MajorsView() {
  const [activeSubject, setActiveSubject] = useState('100394');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [majorList, setMajorList] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [majorDetail, setMajorDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const perPage = 10;

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMajorList(activeSubject, currentPage, perPage, searchQuery);
      const content = data?.dataSearch?.content || [];
      const items = Array.isArray(content) ? content : [content];
      setMajorList(items);
      // totalCount는 각 항목 안에 있음
      const tc = items.length > 0 ? Number(items[0]?.totalCount || 0) : 0;
      setTotalCount(tc);
    } catch (err) {
      console.error(err);
      setMajorList([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [activeSubject, currentPage, searchQuery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const totalPages = Math.max(1, Math.ceil(totalCount / perPage));

  const handleSearch = () => {
    setSearchQuery(searchInput);
    setCurrentPage(1);
  };

  const openDetail = async (majorSeq) => {
    setDetailLoading(true);
    try {
      const data = await getMajorDetail(majorSeq);
      const detail = data?.dataSearch?.content || data;
      setMajorDetail(Array.isArray(detail) ? detail[0] : detail);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  /* ── Detail View ── */
  if (majorDetail) {
    const d = majorDetail;
    const Tag = ({ children, bg = 'bg-indigo-50', color = 'text-indigo-700' }) => (
      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mr-1 mb-1 ${bg} ${color}`}>{children}</span>
    );
    const DetailCard = ({ title, children }) => (
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <h4 className="text-indigo-600 font-bold text-xs mb-2.5">{title}</h4>
        {children}
      </div>
    );

    return (
      <div className="px-5 pb-6">
        <button onClick={() => setMajorDetail(null)} className="flex items-center gap-1 text-slate-500 text-sm mt-4 mb-4">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          목록으로
        </button>
        <h2 className="text-slate-800 font-bold text-lg mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>{d.major || d.mClass || '학과 상세'}</h2>
        {d.department && <p className="text-slate-400 text-xs mb-4 leading-relaxed">{typeof d.department === 'string' ? d.department.substring(0, 120) + (d.department.length > 120 ? '...' : '') : ''}</p>}

        {detailLoading ? <Spinner /> : (
          <div className="space-y-3">
            {/* 학과 개요 */}
            {d.summary && (
              <DetailCard title="학과 개요">
                <p className="text-slate-600 text-sm leading-relaxed">{d.summary.replace(/<br\s*\/?>/gi, '\n')}</p>
              </DetailCard>
            )}

            {/* 관련 고교 교과목 */}
            {Array.isArray(d.relate_subject) && d.relate_subject.length > 0 && (
              <DetailCard title="관련 고교 교과목">
                {d.relate_subject.filter(s => s.subject_name && s.subject_description).map((s, i) => (
                  <div key={i} className="mb-3 last:mb-0">
                    <p className="text-indigo-600 font-semibold text-xs mb-1">{s.subject_name}</p>
                    <div className="flex flex-wrap">
                      {(s.subject_description || '').replace(/<br\s*\/?>/gi, ', ').split(/[,，]/).map(v => v.trim()).filter(Boolean).map((v, j) => (
                        <Tag key={j}>{v}</Tag>
                      ))}
                    </div>
                  </div>
                ))}
              </DetailCard>
            )}

            {/* 진로 탐색 활동 */}
            {Array.isArray(d.career_act) && d.career_act.length > 0 && (
              <DetailCard title="진로 탐색 활동">
                {d.career_act.map((a, i) => (
                  <div key={i} className="mb-2 last:mb-0 bg-slate-50 rounded-xl p-3">
                    <p className="text-slate-800 font-semibold text-xs mb-1">{(a.act_name || '').replace(/<br\s*\/?>/gi, '')}</p>
                    <p className="text-slate-500 text-xs leading-relaxed">{(a.act_description || '').replace(/<br\s*\/?>/gi, ' ')}</p>
                  </div>
                ))}
              </DetailCard>
            )}

            {/* 흥미와 적성 */}
            {d.interest && (
              <DetailCard title="흥미와 적성">
                <p className="text-slate-600 text-sm leading-relaxed">{d.interest.replace(/<br\s*\/?>/gi, '\n')}</p>
              </DetailCard>
            )}

            {/* 학과 특성 */}
            {d.property && (
              <DetailCard title="학과 특성">
                <p className="text-slate-600 text-sm leading-relaxed">{d.property.replace(/<br\s*\/?>/gi, '\n')}</p>
              </DetailCard>
            )}

            {/* 관련 직업 & 자격 */}
            {(d.job || d.qualifications) && (
              <DetailCard title="관련 직업 & 자격">
                {d.job && (
                  <div className="mb-2">
                    <p className="text-slate-500 font-semibold text-xs mb-1">관련 직업</p>
                    <div className="flex flex-wrap">{d.job.split(',').map((j, i) => <Tag key={i} bg="bg-emerald-50" color="text-emerald-700">{j.trim()}</Tag>)}</div>
                  </div>
                )}
                {d.qualifications && (
                  <div>
                    <p className="text-slate-500 font-semibold text-xs mb-1">관련 자격</p>
                    <div className="flex flex-wrap">{d.qualifications.split(',').map((q, i) => <Tag key={i} bg="bg-amber-50" color="text-amber-700">{q.trim()}</Tag>)}</div>
                  </div>
                )}
              </DetailCard>
            )}

            {/* 졸업 후 진출 분야 */}
            {Array.isArray(d.enter_field) && d.enter_field.length > 0 && (
              <DetailCard title="졸업 후 진출 분야">
                {d.enter_field.map((f, i) => (
                  <div key={i} className="mb-2 last:mb-0 bg-slate-50 rounded-xl p-3">
                    <p className="text-emerald-700 font-semibold text-xs mb-1">{f.gradeuate || ''}</p>
                    <p className="text-slate-500 text-xs">{(f.description || '').replace(/<br\s*\/?>/gi, ' ')}</p>
                  </div>
                ))}
              </DetailCard>
            )}

            {/* 대학 주요 교과목 */}
            {Array.isArray(d.main_subject) && d.main_subject.length > 0 && (
              <DetailCard title="대학 주요 교과목">
                {d.main_subject.slice(0, 6).map((s, i) => (
                  <div key={i} className="mb-2 last:mb-0">
                    <p className="text-slate-800 font-semibold text-xs">{s.SBJECT_NM || ''}</p>
                    <p className="text-slate-500 text-xs mt-0.5 leading-relaxed">{(s.SBJECT_SUMRY || '').substring(0, 80)}{(s.SBJECT_SUMRY || '').length > 80 ? '...' : ''}</p>
                  </div>
                ))}
              </DetailCard>
            )}

            {/* 개설 대학 */}
            {Array.isArray(d.university) && d.university.length > 0 && (
              <DetailCard title="개설 대학">
                <div className="flex flex-wrap">
                  {d.university.slice(0, 20).map((u, i) => (
                    u.schoolURL
                      ? <a key={i} href={u.schoolURL} target="_blank" rel="noopener noreferrer"><Tag bg="bg-violet-50" color="text-violet-700">{u.schoolName || ''}</Tag></a>
                      : <Tag key={i} bg="bg-violet-50" color="text-violet-700">{u.schoolName || ''}</Tag>
                  ))}
                  {d.university.length > 20 && <Tag bg="bg-slate-100" color="text-slate-500">외 {d.university.length - 20}개</Tag>}
                </div>
              </DetailCard>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── List View ── */
  return (
    <div className="px-5 pb-6">
      <h2
        className="text-slate-800 font-bold text-lg mt-5 mb-1"
        style={{ fontFamily: "'Manrope', sans-serif" }}
      >
        학과 추천 과목
      </h2>
      <p className="text-slate-500 text-sm mb-4">계열별 학과를 탐색하고 관련 교과목을 확인하세요.</p>

      {/* Category tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-3 -mx-5 px-5 scrollbar-hide">
        {SUBJECT_TABS.map((tab) => (
          <button
            key={tab.code}
            onClick={() => {
              setActiveSubject(tab.code);
              setCurrentPage(1);
            }}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
              activeSubject === tab.code
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-white text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="학과명 검색"
          className="flex-1 bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={handleSearch}
          className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 transition"
        >
          검색
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : majorList.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-400 text-sm">검색 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="space-y-2.5">
            {majorList.map((m, idx) => (
              <button
                key={m.majorSeq || idx}
                onClick={() => openDetail(m.majorSeq)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:ring-2 hover:ring-indigo-200 transition"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                    <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-slate-800 font-bold text-sm truncate">{m.mClass || m.major}</h3>
                  {m.facilName && (
                    <p className="text-slate-400 text-xs mt-0.5 truncate">{m.facilName}</p>
                  )}
                </div>
                <span className="text-slate-300 text-lg flex-shrink-0">&rsaquo;</span>
              </button>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-1 mt-5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-white transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                    currentPage === page
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-500 hover:bg-white'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 disabled:opacity-30 hover:bg-white transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
          <p className="text-center text-xs text-slate-400 mt-2">
            총 {totalCount}개 중 {(currentPage - 1) * perPage + 1}-
            {Math.min(currentPage * perPage, totalCount)}
          </p>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function CareerPage() {
  const [view, setView] = useState('home');
  const [major, setMajor] = useState('데이터사이언티스트');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f9fb]">
      {/* Header */}
      <Header title={localStorage.getItem('school_name') || '진로탐색'} />

      {/* Tab bar */}
      <TabBar view={view} onChange={setView} />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {view === 'home' && (
          <HomeView
            major={major}
            setMajor={setMajor}
            recommendations={recommendations}
            setRecommendations={setRecommendations}
            loading={loading}
            setLoading={setLoading}
          />
        )}
        {view === 'tests' && <TestsView />}
        {view === 'majors' && <MajorsView />}
      </div>

      {/* Bottom nav */}
      <MobileNav />
    </div>
  );
}
