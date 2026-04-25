import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import MobileNav from '../components/MobileNav';
import { getAiRecommendation } from '../api/careernet';
import { fetchConfig, fetchSettings, isConfigured } from '../api/db';
import { getStudentAvatarLabel } from '../api/student';

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

function hasExistingSelection() {
  try {
    const cur = JSON.parse(sessionStorage.getItem('currentSelection') || '[]');
    if (Array.isArray(cur) && cur.length > 0) return true;
  } catch {}
  try {
    const pending = JSON.parse(sessionStorage.getItem('pendingSelectedCourses') || '[]');
    if (Array.isArray(pending) && pending.length > 0) return true;
  } catch {}
  return false;
}

export default function AiRecommendPage() {
  const navigate = useNavigate();
  const [major, setMajor] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');
  const [aiError, setAiError] = useState('');
  const [dbCourses, setDbCourses] = useState([]);
  const [selectionRules, setSelectionRules] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schoolName = localStorage.getItem('school_name') || 'AI 과목추천';
  const avatarLabel = getStudentAvatarLabel();

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
    if (!major.trim()) return;
    setLoading(true);
    setAiError('');
    setAiTip('');
    try {
      const courseNames = dbCourses.map(c => c.과목명 || c.subjectName || '').filter(Boolean);
      const rulesText = selectionRules ? Object.entries(selectionRules).map(([k, rules]) =>
        `${k}학기: ${rules.map(r => `${r.credits === 'all' ? '모든' : r.credits + '학점'} ${r.count}개`).join(', ')}`
      ).join(' / ') : '';
      const coursesStr = courseNames.length > 0 ? courseNames.join(', ') : '(과목 목록이 등록되지 않았습니다)';
      const fullPrompt = rulesText ? `${coursesStr}\n\n[선택 규칙] ${rulesText}` : coursesStr;

      const data = await getAiRecommendation(major.trim(), fullPrompt);
      const content = data?.choices?.[0]?.message?.content || '';
      if (!content) throw new Error('AI 응답이 비어 있습니다.');

      const lines = content.split('\n').filter(l => l.trim());
      const recs = [];
      for (const line of lines) {
        const match = line.match(/^[\d.)\-*]*\s*(.+?)\s*[:：]\s*(.+)$/);
        if (match) {
          const name = match[1].trim();
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
        setAiTip(`"${major.trim()}" 진로에 맞춰 AI가 ${recs.length}개 과목을 추천했습니다.`);
        try {
          const history = JSON.parse(localStorage.getItem('aiHistory') || '[]');
          history.push({ major: major.trim(), date: new Date().toLocaleString('ko-KR'), courses: recs.map(r => r.name) });
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

  function applyRecommendations() {
    const validRecs = recommendations
      .filter(r => r.name && r.name !== 'AI 추천 결과')
      .map(r => r.name);
    if (validRecs.length === 0) {
      alert('적용할 추천 과목이 없습니다. 먼저 진로를 검색하여 추천을 받으세요.');
      return;
    }
    sessionStorage.setItem('applyAiRecommendations', JSON.stringify(validRecs));
    sessionStorage.removeItem('currentSelection');
    sessionStorage.removeItem('pendingSelectedCourses');
    navigate('/courses');
  }

  function handleApplyClick() {
    if (recommendations.length === 0) {
      alert('먼저 진로를 입력하여 AI 추천을 받으세요.');
      return;
    }
    if (hasExistingSelection()) {
      setConfirmOpen(true);
      return;
    }
    applyRecommendations();
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f7f9fb]">
      <Header title={schoolName} avatarLabel={avatarLabel} />

      <div className="flex-1 overflow-y-auto pb-24 px-5">
        {/* Hero */}
        <div className="mt-5 mb-4">
          <h1 className="text-slate-900 font-bold leading-tight" style={{ fontFamily: "'Manrope', sans-serif", fontSize: '1.75rem' }}>
            진로 맞춤형 과목 추천
          </h1>
          <p className="text-slate-500 text-sm mt-2 leading-relaxed">
            AI가 입력한 진로/전공에 맞춰 등록된 교과 중에서 과목을 추천합니다.
          </p>
        </div>

        {/* Input + Search */}
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
              value={major}
              onChange={(e) => setMajor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="희망 직업 또는 전공 입력"
              disabled={loading}
              className="w-full bg-white rounded-xl pl-10 pr-4 py-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={loading || !major.trim()}
            className="px-5 py-3 rounded-xl text-white text-sm font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
          >
            {loading ? '분석 중' : '추천'}
          </button>
        </div>

        {/* Section header */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-slate-800 font-bold text-base" style={{ fontFamily: "'Manrope', sans-serif" }}>
            AI 추천 과목 리스트
          </h2>
          <span className="bg-indigo-50 text-indigo-600 text-xs font-semibold px-2.5 py-1 rounded-full">
            {recommendations.length}개 추천
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-12 gap-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-indigo-600" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <p className="text-sm text-slate-500">AI가 과목을 분석하고 있습니다...</p>
          </div>
        ) : (
          <>
            {aiError && (
              <div className="bg-red-50 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
                {aiError}
              </div>
            )}

            {recommendations.length === 0 && !aiError && (
              <div className="bg-white rounded-2xl px-5 py-10 text-center text-sm text-slate-400 mb-4">
                위에 진로/전공을 입력하고 추천 버튼을 누르세요.
              </div>
            )}

            <div className="space-y-3 mb-4">
              {recommendations.map((rec, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {getCategoryIcon(rec.category)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-800 font-bold text-sm">{rec.name}</h3>
                      {rec.subCategory && <p className="text-slate-400 text-xs mt-0.5">{rec.subCategory}</p>}
                      <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">{rec.description}</p>
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
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {aiTip && (
              <div className="bg-violet-50 rounded-2xl p-4 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-violet-700 font-bold text-xs">💡 AI 어드바이저의 팁</span>
                </div>
                <p className="text-violet-600 text-xs leading-relaxed">{aiTip}</p>
              </div>
            )}

            {recommendations.length > 0 && (
              <button
                onClick={handleApplyClick}
                className="w-full py-3.5 rounded-xl text-white font-bold text-sm shadow-lg transition-transform active:scale-95"
                style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
              >
                추천과목 모두 선택하기 →
              </button>
            )}
          </>
        )}
      </div>

      {/* 기존 선택 덮어쓰기 확인 모달 */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-5 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 shadow-xl">
            <h3 className="text-base font-bold text-slate-800 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>
              기존 신청 과목이 있습니다
            </h3>
            <p className="text-sm text-slate-500 mb-4 leading-relaxed">
              현재 수강신청 화면에 선택된 과목이 있습니다.<br />
              AI 추천 과목으로 <strong className="text-rose-600">초기화하고 다시 신청</strong>하시겠습니까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200"
              >
                취소
              </button>
              <button
                onClick={() => { setConfirmOpen(false); applyRecommendations(); }}
                className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold"
                style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)' }}
              >
                초기화 후 적용
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileNav />
    </div>
  );
}
