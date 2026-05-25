import { useState, useEffect, useCallback } from 'react';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import {
  getQuestions,
  submitReport,
  getMajorList,
  getMajorDetail,
  getProfessorInterview,
  getMajorCurriculum,
  getCurriculumCourseDetail,
} from '../api/careernet';
import { getStudentAvatarLabel } from '../api/student';

/* ───────────────────────── constants ───────────────────────── */

const TABS = [
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

/* HomeView (AI 추천) 본체는 src/pages/AiRecommendPage.jsx 로 이전됨 */


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

/* ───────── View 3 : 학과탐색 (Majors) ─────────
 * 상위 탭 '학과탐색' 안에 3개 하위 탭:
 *   - info: 학과정보탐색 (기존 MajorsView 그대로)
 *   - professor: 학과 교수님 인터뷰
 *   - curriculum: 학과 커리큘럼(강의계획서)
 */

const MAJOR_SUB_TABS = [
  { key: 'info', label: '학과정보탐색' },
  { key: 'professor', label: '교수님 인터뷰' },
  { key: 'curriculum', label: '학과 커리큘럼' },
];

function MajorsSubTabBar({ value, onChange }) {
  return (
    <div className="flex gap-1.5 overflow-x-auto px-5 pt-3 pb-1 scrollbar-hide">
      {MAJOR_SUB_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all ${
            value === t.key
              ? 'bg-indigo-600 text-white shadow'
              : 'bg-white text-slate-500 hover:text-slate-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function MajorsView() {
  const [subView, setSubView] = useState('info');
  return (
    <div>
      <MajorsSubTabBar value={subView} onChange={setSubView} />
      {subView === 'info' && <MajorInfoView />}
      {subView === 'professor' && <ProfessorInterviewView />}
      {subView === 'curriculum' && <CurriculumView />}
    </div>
  );
}

function MajorInfoView() {
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

/* ───────── View 3-B : 학과 교수님 인터뷰 ───────── */

function ProfessorInterviewView() {
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null); // { major, interviews: [{ professor, qas: [] }] }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profIdx, setProfIdx] = useState(0); // 인터뷰한 교수가 여러 명일 때 선택
  const [qIdx, setQIdx] = useState(0);

  const loadInterview = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setError('학과명을 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    setProfIdx(0);
    setQIdx(0);
    try {
      const result = await getProfessorInterview(trimmed);
      setData(result);
    } catch (e) {
      setError(e.message || '불러오기 실패');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const interview = data?.interviews?.[profIdx];
  const qas = interview?.qas || [];
  const total = qas.length;
  const current = qas[qIdx];

  const prev = useCallback(() => setQIdx((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setQIdx((i) => Math.min(total - 1, i + 1)), [total]);

  // 키보드 좌우 화살표로 카드 넘기기
  useEffect(() => {
    if (!total) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next, total]);

  return (
    <div className="px-5 pb-6">
      <h2 className="text-slate-800 font-bold text-lg mt-5 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
        학과 교수님 인터뷰
      </h2>
      <p className="text-slate-500 text-sm mb-4">학과를 입력하면 교수님과의 Q&A 카드를 한 장씩 넘겨볼 수 있어요.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadInterview(searchInput)}
          placeholder="예) 컴퓨터공학과"
          className="flex-1 bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => loadInterview(searchInput)}
          className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 transition"
        >
          조회
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}

      {loading ? <Spinner /> : !data ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          관심 학과를 입력해 교수님 인터뷰를 찾아보세요.
        </div>
      ) : !interview ? (
        <div className="text-center py-12 text-slate-400 text-sm">등록된 인터뷰가 없습니다.</div>
      ) : (
        <>
          {/* 학과/교수 헤더 + 인터뷰 선택 (여러 건일 때) */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
            <p className="text-indigo-600 font-bold text-xs">{interview.major || data.major}</p>
            <p className="text-slate-800 font-bold text-base mt-0.5">
              {interview.professor}
              {data.interviews.length > 1 && <span className="text-slate-400 font-normal text-sm ml-1">#{profIdx + 1}</span>}
            </p>
            {data.interviews.length > 1 && (
              <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-hide">
                {data.interviews.map((iv, i) => (
                  <button
                    key={i}
                    onClick={() => { setProfIdx(i); setQIdx(0); }}
                    className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition ${
                      i === profIdx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
                    }`}
                    title={iv.major}
                  >
                    {iv.major || iv.professor} #{i + 1}
                  </button>
                ))}
              </div>
            )}
            {data.matchCount > 0 && (
              <p className="text-slate-400 text-[0.7rem] mt-2">총 {data.matchCount}건 매칭</p>
            )}
          </div>

          {total === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">등록된 질의응답이 없습니다.</div>
          ) : (
            <>
              {/* Q&A 카드 */}
              <div className="bg-white rounded-2xl p-5 shadow-sm min-h-[260px]">
                <div className="flex items-start gap-2 mb-3">
                  <span className="bg-indigo-100 text-indigo-700 font-bold text-xs rounded-md px-2 py-0.5 flex-shrink-0 mt-0.5">Q</span>
                  <p className="text-slate-800 font-bold text-sm leading-relaxed">{current.question}</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-emerald-100 text-emerald-700 font-bold text-xs rounded-md px-2 py-0.5 flex-shrink-0 mt-0.5">A</span>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{current.answer}</p>
                </div>
              </div>

              {/* 컨트롤 + 인디케이터 */}
              <div className="flex items-center justify-between mt-4">
                <button
                  onClick={prev}
                  disabled={qIdx === 0}
                  className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 hover:text-indigo-600 transition"
                  aria-label="이전 질문"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <div className="flex items-center gap-1.5">
                  {qas.map((_, i) => (
                    <span
                      key={i}
                      className={`h-1.5 rounded-full transition-all ${i === qIdx ? 'w-5 bg-indigo-600' : 'w-1.5 bg-slate-300'}`}
                    />
                  ))}
                </div>
                <button
                  onClick={next}
                  disabled={qIdx === total - 1}
                  className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-slate-500 disabled:opacity-30 hover:text-indigo-600 transition"
                  aria-label="다음 질문"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
                </button>
              </div>
              <p className="text-center text-xs text-slate-400 mt-2">{qIdx + 1} / {total}</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ───────── View 3-C : 학과 커리큘럼(강의계획서) ───────── */

function CurriculumView() {
  const [searchInput, setSearchInput] = useState('');
  const [majorName, setMajorName] = useState(''); // 확정된 학과명
  const [stage, setStage] = useState('idle'); // idle | universities | courses
  const [universities, setUniversities] = useState([]); // [{ university, college, major, courseCount }]
  const [pickedUniversity, setPickedUniversity] = useState('');
  const [curriculum, setCurriculum] = useState(null); // { courses, college, matchedMajor, truncated, ... }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(''); // 보조 안내(잘린 결과 등)

  const [selected, setSelected] = useState(null); // 모달용 — 행 데이터 그대로 사용

  /* 1단계: 학과명으로 매칭 대학 목록 조회 */
  const loadUniversities = async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) {
      setError('학과명을 입력하세요.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');
    setPickedUniversity('');
    setCurriculum(null);
    try {
      const res = await getMajorCurriculum(trimmed);
      setMajorName(trimmed);
      setUniversities(Array.isArray(res.universities) ? res.universities : []);
      setStage('universities');
      if (res.truncated) {
        setInfo(`총 ${res.matchCount}건 중 첫 ${res.universities?.reduce((s, u) => s + (u.courseCount || 0), 0) || 0}건으로 추린 결과입니다. 학과명을 더 구체적으로 입력하면 정확해져요.`);
      }
    } catch (e) {
      setError(e.message || '불러오기 실패');
      setStage('idle');
      setUniversities([]);
    } finally {
      setLoading(false);
    }
  };

  /* 2단계: 학과 + 대학으로 커리큘럼 상세 조회 */
  const loadCurriculum = async (univ) => {
    if (!majorName || !univ) return;
    setLoading(true);
    setError('');
    setInfo('');
    setPickedUniversity(univ);
    try {
      const res = await getMajorCurriculum(majorName, univ);
      setCurriculum(res);
      setStage('courses');
      if (res.truncated) {
        setInfo('데이터가 많아 일부만 표시됩니다. 학과명·대학명을 더 구체적으로 입력해보세요.');
      }
    } catch (e) {
      setError(e.message || '불러오기 실패');
    } finally {
      setLoading(false);
    }
  };

  const goBackToUniversities = () => {
    setStage('universities');
    setPickedUniversity('');
    setCurriculum(null);
    setInfo('');
  };

  const closeModal = () => setSelected(null);

  // ESC로 모달 닫기
  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  /* 학년별로 묶기 (정렬은 서버에서 처리됨) */
  const coursesByYear = curriculum?.courses
    ? curriculum.courses.reduce((acc, c) => {
        const y = c.year || 0;
        if (!acc[y]) acc[y] = [];
        acc[y].push(c);
        return acc;
      }, {})
    : {};

  return (
    <div className="px-5 pb-6">
      <h2 className="text-slate-800 font-bold text-lg mt-5 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
        학과 커리큘럼
      </h2>
      <p className="text-slate-500 text-sm mb-4">학과를 입력해 매칭된 대학을 선택하면 4년 강의계획서를 확인할 수 있어요.</p>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUniversities(searchInput)}
          placeholder="예) 컴퓨터공학과"
          className="flex-1 bg-white rounded-xl px-4 py-2.5 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button
          onClick={() => loadUniversities(searchInput)}
          className="bg-indigo-600 text-white px-4 rounded-xl text-sm font-semibold shadow-sm hover:bg-indigo-700 transition"
        >
          조회
        </button>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">{error}</div>
      )}
      {info && (
        <div className="bg-amber-50 text-amber-700 text-xs rounded-xl px-4 py-2.5 mb-4">{info}</div>
      )}

      {loading ? <Spinner /> : stage === 'idle' ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          관심 학과를 입력해 커리큘럼을 확인해보세요.
        </div>
      ) : stage === 'universities' ? (
        /* ── 1단계: 매칭된 대학 목록 ── */
        universities.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm">매칭된 학과가 없습니다.</div>
        ) : (
          <>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
              <p className="text-indigo-600 font-bold text-xs">"{majorName}"</p>
              <p className="text-slate-500 text-xs mt-1">매칭된 대학을 선택하세요. ({universities.length}개)</p>
            </div>
            <div className="space-y-2">
              {universities.map((u, i) => (
                <button
                  key={`${u.university}-${i}`}
                  onClick={() => loadCurriculum(u.university)}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:ring-2 hover:ring-indigo-200 transition"
                >
                  <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-800 font-bold text-sm truncate">{u.university}</h3>
                    <p className="text-slate-400 text-xs mt-0.5 truncate">
                      {u.college ? `${u.college} · ` : ''}{u.major} · 강좌 {u.courseCount}건
                    </p>
                  </div>
                  <span className="text-slate-300 text-lg flex-shrink-0">&rsaquo;</span>
                </button>
              ))}
            </div>
          </>
        )
      ) : (
        /* ── 2단계: 선택된 대학의 커리큘럼 ── */
        !curriculum || !curriculum.courses || curriculum.courses.length === 0 ? (
          <>
            <button onClick={goBackToUniversities} className="flex items-center gap-1 text-slate-500 text-sm mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              대학 다시 선택
            </button>
            <div className="text-center py-12 text-slate-400 text-sm">등록된 커리큘럼이 없습니다.</div>
          </>
        ) : (
          <>
            <button onClick={goBackToUniversities} className="flex items-center gap-1 text-slate-500 text-sm mb-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
              대학 다시 선택
            </button>
            <div className="bg-white rounded-2xl p-4 shadow-sm mb-3">
              <p className="text-indigo-600 font-bold text-xs">{curriculum.university}</p>
              <p className="text-slate-800 font-bold text-sm mt-0.5">
                {curriculum.college ? `${curriculum.college} · ` : ''}{curriculum.matchedMajor || majorName}
              </p>
              <p className="text-slate-400 text-xs mt-1">{curriculum.courseCount}과목 (중복·분반 제외) · 과목명을 누르면 강의계획서를 볼 수 있어요.</p>
            </div>

            {/* 학년별 그룹화된 테이블 */}
            <div className="space-y-3">
              {Object.keys(coursesByYear).sort((a, b) => Number(a) - Number(b)).map((y) => (
                <div key={y} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="bg-indigo-50 px-3 py-2">
                    <span className="text-indigo-700 font-bold text-xs">{y === '0' ? '학년 미상' : `${y}학년`}</span>
                    <span className="text-indigo-400 text-xs ml-2">{coursesByYear[y].length}과목</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 text-xs">
                        <th className="text-left font-semibold py-2 px-3 w-16">학기</th>
                        <th className="text-left font-semibold py-2 px-3">과목명</th>
                        <th className="text-left font-semibold py-2 px-3 w-14">학점</th>
                        <th className="text-left font-semibold py-2 px-3 w-20">구분</th>
                      </tr>
                    </thead>
                    <tbody>
                      {coursesByYear[y].map((c) => (
                        <tr key={c.id} className="border-t border-slate-100">
                          <td className="py-2 px-3 text-slate-500 text-xs whitespace-nowrap">{c.semester}</td>
                          <td className="py-2 px-3">
                            <button
                              onClick={() => setSelected(c)}
                              className="text-left text-indigo-700 font-semibold hover:underline"
                            >
                              {c.name}
                            </button>
                          </td>
                          <td className="py-2 px-3 text-slate-600">{c.credits}</td>
                          <td className="py-2 px-3">
                            <span className={`inline-block text-[0.65rem] font-semibold rounded-full px-2 py-0.5 ${
                              c.type?.includes('필수') ? 'bg-rose-50 text-rose-600' :
                              c.type?.includes('기초') ? 'bg-amber-50 text-amber-700' :
                              c.type?.includes('교양') ? 'bg-slate-100 text-slate-500' :
                              'bg-indigo-50 text-indigo-700'
                            }`}>{c.type || '-'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {/* 과목 상세 모달 — 행 데이터를 그대로 사용 (별도 호출 없음) */}
      {selected && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-50 flex items-end sm:items-center justify-center"
          onClick={closeModal}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-indigo-600 font-bold text-xs">
                  {selected.year ? `${selected.year}학년 ` : ''}{selected.semester} · {selected.type || '-'} · {selected.credits}학점
                </p>
                <p className="text-slate-800 font-bold text-base mt-0.5 truncate">{selected.name}</p>
                <p className="text-slate-400 text-xs mt-0.5">{selected.university} {selected.college}</p>
              </div>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500 flex-shrink-0"
                aria-label="닫기"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* 시수 */}
              {(selected.theoryHours > 0 || selected.practiceHours > 0) && (
                <section>
                  <h4 className="text-indigo-600 font-bold text-xs mb-2">시수</h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-slate-500 text-xs">이론</p>
                      <p className="text-slate-800 font-bold text-sm">{selected.theoryHours}시간</p>
                    </div>
                    <div className="bg-slate-50 rounded-xl px-3 py-2">
                      <p className="text-slate-500 text-xs">실습</p>
                      <p className="text-slate-800 font-bold text-sm">{selected.practiceHours}시간</p>
                    </div>
                  </div>
                </section>
              )}

              {/* 학습 목표 */}
              {selected.description && (
                <section>
                  <h4 className="text-indigo-600 font-bold text-xs mb-2">학습 목표</h4>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selected.description}</p>
                </section>
              )}

              {/* 선행학습자료 */}
              {selected.prerequisites && (
                <section>
                  <h4 className="text-indigo-600 font-bold text-xs mb-2">선행학습자료</h4>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selected.prerequisites}</p>
                </section>
              )}

              {/* 교재 */}
              {(selected.mainTextbook || selected.subTextbook) && (
                <section>
                  <h4 className="text-indigo-600 font-bold text-xs mb-2">교재</h4>
                  {selected.mainTextbook && (
                    <div className="mb-2">
                      <p className="text-slate-500 text-xs mb-0.5">주교재</p>
                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selected.mainTextbook}</p>
                    </div>
                  )}
                  {selected.subTextbook && (
                    <div>
                      <p className="text-slate-500 text-xs mb-0.5">부교재</p>
                      <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selected.subTextbook}</p>
                    </div>
                  )}
                </section>
              )}

              {/* 참고자료 */}
              {selected.references && (
                <section>
                  <h4 className="text-indigo-600 font-bold text-xs mb-2">참고자료</h4>
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">{selected.references}</p>
                </section>
              )}

              {/* 연도 */}
              {selected.year_data && (
                <p className="text-slate-300 text-xs text-right">{selected.year_data}년 강의계획서 기준</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────────────────────── Main Page ───────────────────────── */

export default function CareerPage() {
  const [view, setView] = useState('tests');
  const avatarLabel = getStudentAvatarLabel();

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f9fb]">
      <Header title={localStorage.getItem('school_name') || '진로탐색'} avatarLabel={avatarLabel} />

      <TabBar view={view} onChange={setView} />

      <div className="flex-1 overflow-y-auto pb-20">
        {view === 'tests' && <TestsView />}
        {view === 'majors' && <MajorsView />}
      </div>

      <MobileNav />
    </div>
  );
}
