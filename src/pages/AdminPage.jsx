import { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import GaugeChart from '../components/GaugeChart';
import * as DB from '../api/db';
import { readExcel, downloadTemplate, downloadRegistryTemplate, downloadJointCurriculumTemplate, downloadBulkEnrollmentTemplate } from '../api/excel';

const TABS = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'system', label: '시스템 설정', icon: '⚙️' },
  { key: 'courses', label: '교육과정 관리', icon: '📚' },
  { key: 'rules', label: '선택 규칙', icon: '📏' },
  { key: 'share', label: '배포 및 공유', icon: '🔗' },
  { key: 'students', label: '학생 현황', icon: '👥' },
];

const PER_PAGE = 8;

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // Data
  const [responses, setResponses] = useState([]);
  const [courses, setCourses] = useState([]);
  const [registry, setRegistry] = useState([]);
  const [settings, setSettings] = useState(null);
  const [jointCurriculum, setJointCurriculum] = useState([]);

  // System
  const [apiUrl, setApiUrl] = useState(() => {
    try { return localStorage.getItem('gas_api_url') || ''; } catch { return ''; }
  });
  const [connStatus, setConnStatus] = useState('');

  // Table
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Upload status
  const [uploadMsg, setUploadMsg] = useState({});

  /* ── Load data ── */
  const loadData = useCallback(async () => {
    if (!DB.isConfigured()) return;
    setLoading(true);
    try {
      const [res, cfg, stg, reg, jc] = await Promise.all([
        DB.fetchResponses().catch(() => []),
        DB.fetchConfig().catch(() => []),
        DB.fetchSettings().catch(() => null),
        DB.fetchRegistry().catch(() => []),
        DB.fetchJointCurriculum().catch(() => []),
      ]);
      setResponses(Array.isArray(res) ? res : res?.data || []);
      setCourses(Array.isArray(cfg) ? cfg : cfg?.data || []);
      setSettings(stg);
      setRegistry(Array.isArray(reg) ? reg : reg?.data || []);
      setJointCurriculum(Array.isArray(jc) ? jc : jc?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ── System tab ── */
  function saveApiUrl() {
    if (!apiUrl.trim()) return;
    localStorage.setItem('gas_api_url', apiUrl.trim());
    DB.init(apiUrl.trim());
    setConnStatus('✅ API URL이 저장되었습니다.');
    loadData();
  }
  async function testConnection() {
    if (!DB.isConfigured()) { setConnStatus('❌ API URL을 먼저 저장하세요.'); return; }
    setConnStatus('🔄 연결 테스트 중...');
    try {
      await DB.fetchConfig();
      setConnStatus('✅ 연결 성공! 데이터를 정상적으로 가져왔습니다.');
    } catch (e) {
      setConnStatus('❌ 연결 실패: ' + e.message);
    }
  }

  /* ── Upload handlers ── */
  async function handleUpload(fileInputId, action, label) {
    const input = document.getElementById(fileInputId);
    const file = input?.files?.[0];
    if (!file) { setUploadMsg(m => ({ ...m, [action]: '❌ 파일을 선택해주세요.' })); return; }
    if (!DB.isConfigured()) { setUploadMsg(m => ({ ...m, [action]: '❌ API URL을 먼저 설정하세요.' })); return; }
    setUploadMsg(m => ({ ...m, [action]: '⏳ 업로드 중...' }));
    try {
      const data = await readExcel(file);
      if (!data.length) throw new Error('데이터가 비어 있습니다.');
      if (action === 'saveConfig') await DB.saveConfig(data);
      else if (action === 'saveRegistry') await DB.saveRegistry(data);
      else if (action === 'saveJointCurriculum') await DB.saveJointCurriculum(data);
      setUploadMsg(m => ({ ...m, [action]: `✅ ${label} ${data.length}건 저장 완료!` }));
      loadData();
    } catch (e) {
      setUploadMsg(m => ({ ...m, [action]: '❌ 오류: ' + e.message }));
    }
  }

  /* ── Rules tab ── */
  const [ruleInputs, setRuleInputs] = useState({});
  useEffect(() => {
    if (settings?.selectionRules) setRuleInputs(settings.selectionRules);
  }, [settings]);

  function updateRule(semKey, idx, field, value) {
    setRuleInputs(prev => {
      const next = { ...prev };
      if (!next[semKey]) next[semKey] = [];
      next[semKey] = [...next[semKey]];
      next[semKey][idx] = { ...next[semKey][idx], [field]: value };
      return next;
    });
  }
  function addRule(semKey) {
    setRuleInputs(prev => {
      const next = { ...prev };
      if (!next[semKey]) next[semKey] = [];
      next[semKey] = [...next[semKey], { credits: 4, count: 3 }];
      return next;
    });
  }
  function removeRule(semKey, idx) {
    setRuleInputs(prev => {
      const next = { ...prev };
      next[semKey] = next[semKey].filter((_, i) => i !== idx);
      if (next[semKey].length === 0) delete next[semKey];
      return next;
    });
  }
  async function saveRules() {
    if (!DB.isConfigured()) return alert('API URL을 먼저 설정하세요.');
    try {
      const newSettings = { ...(settings || {}), selectionRules: ruleInputs };
      await DB.saveSettings(newSettings);
      setSettings(newSettings);
      alert('규칙이 저장되었습니다!');
    } catch (e) { alert('저장 실패: ' + e.message); }
  }

  /* ── Share tab ── */
  const shareUrl = apiUrl ? `${window.location.origin}/login?key=${btoa(apiUrl)}` : '';

  /* ── Stats (Dashboard) ── */
  const totalStudents = responses.length || 0;
  const passCount = responses.filter(r => {
    const v = (r.ValidationResult || r.validationResult || '');
    return v.includes('통과') || v.includes('충족');
  }).length;
  const failCount = totalStudents - passCount;
  const avgCredits = totalStudents > 0
    ? (responses.reduce((s, r) => s + (Number(r.TotalCredits || r.totalCredits) || 0), 0) / totalStudents).toFixed(1)
    : '0';
  const passRate = totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(0) : '0';

  /* ── Table data ── */
  const tableRows = responses.map(r => ({
    id: r.Grade ? `${r.Grade}${String(r.Class).padStart(2,'0')}${String(r.Number).padStart(2,'0')}` : '-',
    name: r.Name || r.name || '-',
    courses: r.SelectedCourses || r.selectedCourses || '-',
    credits: r.TotalCredits || r.totalCredits || '-',
    status: (r.ValidationResult || r.validationResult || '').includes('통과') || (r.ValidationResult || r.validationResult || '').includes('충족') ? '통과' : '미달',
  }));
  const filtered = tableRows
    .filter(r => filter === 'all' || r.status === (filter === 'pass' ? '통과' : '미달'))
    .filter(r => !search.trim() || r.name.includes(search) || r.id.includes(search));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [filter, search]);

  /* ── Semester course groups ── */
  const coursesBySemester = {};
  courses.forEach(c => {
    const g = c.학년 || c.grade; const s = c.학기 || c.semester;
    if (!g || !s) return;
    const key = `${g}-${s}`;
    if (!coursesBySemester[key]) coursesBySemester[key] = [];
    coursesBySemester[key].push(c);
  });
  const semesterKeys = Object.keys(coursesBySemester).sort();
  const allSemesters = ['2-1', '2-2', '3-1', '3-2'];

  const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>{children}</div>
  );
  const SectionTitle = ({ children }) => (
    <h2 className="text-base font-bold text-slate-800 mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>{children}</h2>
  );
  const StatusMsg = ({ msgKey }) => uploadMsg[msgKey] ? <p className="mt-3 text-sm">{uploadMsg[msgKey]}</p> : null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activePath="/admin" />

      <main className="flex-1 ml-0 lg:ml-[240px]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          {/* ── Tab navigation ── */}
          <div className="flex gap-1 overflow-x-auto pb-4 mb-6 border-b border-slate-100">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  tab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'
                }`}>
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* ======================== DASHBOARD TAB ======================== */}
          {tab === 'dashboard' && (
            <>
              <div className="flex items-end justify-between mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>OO고등학교 학점 이수 현황</h1>
                  <p className="text-sm text-slate-500 mt-0.5">실시간 데이터 기준</p>
                </div>
                <button onClick={loadData} className="px-5 py-2.5 border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 text-sm font-semibold rounded-xl transition-colors">새로고침</button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard icon="👥" label="전체 학생 수" value={totalStudents} unit="명" color="#4f46e5" />
                <StatCard icon="⚠️" label="미달 결과" value={failCount} unit="명" color="#dc2626" />
                <StatCard icon="📊" label="평균 이수 학점" value={avgCredits} unit="학점" color="#4f46e5" />
                <StatCard icon="✅" label="검증 통과율" value={passRate} unit="%" color="#059669" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card><SectionTitle>교과군별 학점분포</SectionTitle>
                  <div className="flex justify-center"><GaugeChart value={Number(passRate)} size={180} color="#4f46e5" label="통과율" /></div>
                </Card>
                <Card><SectionTitle>학년·학기별 개설과목 수</SectionTitle>
                  <div className="flex items-end gap-4 h-48">
                    {semesterKeys.map(k => {
                      const count = coursesBySemester[k].length;
                      return (
                        <div key={k} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-xs font-semibold text-slate-600">{count}</span>
                          <div className="w-full rounded-t-lg" style={{ height: `${Math.min(count * 8, 160)}px`, background: 'linear-gradient(180deg, #6366f1, #4f46e5)' }} />
                          <span className="text-[0.65rem] text-slate-500 mt-1">{k}</span>
                        </div>
                      );
                    })}
                    {semesterKeys.length === 0 && <p className="text-sm text-slate-400 m-auto">과목 데이터 없음</p>}
                  </div>
                </Card>
              </div>
              {/* Student table */}
              <Card>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <SectionTitle>학생별 이수 현황</SectionTitle>
                  <div className="flex items-center gap-2">
                    <input type="text" placeholder="검색..." value={search} onChange={e => setSearch(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-48" />
                    {['all','pass','fail'].map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${filter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {f === 'all' ? '전체' : f === 'pass' ? '통과' : '미달'}
                      </button>
                    ))}
                  </div>
                </div>
                {loading ? (
                  <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b border-slate-100">
                          <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">학번</th>
                          <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">이름</th>
                          <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">선택과목</th>
                          <th className="text-right py-3 px-3 text-slate-500 font-medium text-xs">학점</th>
                          <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs">상태</th>
                        </tr></thead>
                        <tbody>{paged.map((r, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="py-3 px-3 font-mono text-xs text-slate-600">{r.id}</td>
                            <td className="py-3 px-3 font-medium text-slate-800">{r.name}</td>
                            <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{r.courses}</td>
                            <td className="py-3 px-3 text-right font-semibold">{r.credits}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.status === '통과' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}{paged.length === 0 && <tr><td colSpan="5" className="py-12 text-center text-slate-400">데이터 없음</td></tr>}</tbody>
                      </table>
                    </div>
                    <div className="flex justify-center gap-2 mt-4">
                      <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">이전</button>
                      <span className="px-3 py-1.5 text-sm text-slate-600">{page} / {totalPages}</span>
                      <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-100 disabled:opacity-40">다음</button>
                    </div>
                  </>
                )}
              </Card>
            </>
          )}

          {/* ======================== SYSTEM TAB ======================== */}
          {tab === 'system' && (
            <div className="max-w-2xl space-y-6">
              <Card>
                <SectionTitle>Google Apps Script API 설정</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">배포된 Google Apps Script 웹 앱 URL을 입력하세요. 이 URL은 데이터베이스(Google Sheets)와의 통신에 사용됩니다.</p>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">API URL</label>
                  <input type="text" value={apiUrl} onChange={e => setApiUrl(e.target.value)}
                    className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="https://script.google.com/macros/s/.../exec" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveApiUrl} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold">저장</button>
                  <button onClick={testConnection} className="bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl hover:bg-slate-200 text-sm font-semibold">연결 테스트</button>
                </div>
                {connStatus && <p className="mt-4 text-sm">{connStatus}</p>}
              </Card>
              <Card>
                <SectionTitle>진로 추천 · 커리어넷 (Netlify)</SectionTitle>
                <p className="text-sm text-slate-500 mb-3">AI + 커리어넷 추천은 Netlify Functions로 동작합니다. 환경변수 <code className="text-xs bg-slate-100 px-1 rounded">OPENAI_API_KEY</code>를 설정하세요.</p>
                <ul className="text-sm text-slate-500 list-disc pl-5 space-y-1">
                  <li><code className="text-xs">CAREERNET_API_KEY</code> — 커리어넷 발급 키 (이미 설정됨)</li>
                  <li><code className="text-xs">OPENAI_API_KEY</code> — OpenAI API 키</li>
                </ul>
              </Card>
            </div>
          )}

          {/* ======================== COURSES TAB ======================== */}
          {tab === 'courses' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* 과목 업로드 */}
              <Card>
                <SectionTitle>교육과정 편제표 업로드</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">'편제표' 시트가 포함된 엑셀 파일을 업로드하세요. 기존 데이터는 덮어씌워집니다.</p>
                <div className="space-y-3">
                  <button onClick={downloadTemplate} className="text-indigo-600 hover:underline text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    과목 템플릿 양식 다운로드
                  </button>
                  <input type="file" id="course-file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  <button onClick={() => handleUpload('course-file', 'saveConfig', '과목')} className="w-full bg-emerald-600 text-white py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-semibold">과목 데이터 업로드 및 저장</button>
                </div>
                <StatusMsg msgKey="saveConfig" />
              </Card>

              {/* 학적 업로드 */}
              <Card>
                <SectionTitle>학적 정보 업로드</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">학번(5자리)과 이름이 포함된 엑셀 파일을 업로드하세요. 학생코드는 자동 발급됩니다.</p>
                <div className="space-y-3">
                  <button onClick={downloadRegistryTemplate} className="text-indigo-600 hover:underline text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    학적 템플릿 양식 다운로드
                  </button>
                  <input type="file" id="registry-file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  <button onClick={() => handleUpload('registry-file', 'saveRegistry', '학적')} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold">학적 데이터 업로드 및 저장</button>
                </div>
                <StatusMsg msgKey="saveRegistry" />
              </Card>

              {/* 공동교육과정 */}
              <Card>
                <SectionTitle>공동교육과정 개설 과목 업로드</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">공동교육과정 개설 과목을 엑셀로 업로드하세요.</p>
                <div className="space-y-3">
                  <button onClick={downloadJointCurriculumTemplate} className="text-indigo-600 hover:underline text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    공동교육과정 템플릿 다운로드
                  </button>
                  <input type="file" id="joint-file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  <button onClick={() => handleUpload('joint-file', 'saveJointCurriculum', '공동교육과정')} className="w-full bg-teal-600 text-white py-2.5 rounded-xl hover:bg-teal-700 text-sm font-semibold">공동교육과정 업로드 및 저장</button>
                </div>
                <StatusMsg msgKey="saveJointCurriculum" />
              </Card>

              {/* 현황 카드들 */}
              <Card>
                <SectionTitle>현재 등록 현황</SectionTitle>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-indigo-600" style={{ fontFamily: "'Manrope'" }}>{courses.length}</div>
                    <p className="text-xs text-slate-500 mt-1">등록 과목</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-emerald-600" style={{ fontFamily: "'Manrope'" }}>{registry.length}</div>
                    <p className="text-xs text-slate-500 mt-1">등록 학생</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-teal-600" style={{ fontFamily: "'Manrope'" }}>{jointCurriculum.length}</div>
                    <p className="text-xs text-slate-500 mt-1">공동교육과정</p>
                  </div>
                </div>
                <button onClick={loadData} className="mt-4 text-sm text-indigo-600 hover:underline w-full text-center">새로고침</button>
              </Card>

              {/* 과목 미리보기 테이블 */}
              <Card className="md:col-span-2">
                <SectionTitle>등록된 과목 미리보기</SectionTitle>
                {courses.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">등록된 과목이 없습니다. 엑셀 파일을 업로드해주세요.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">과목명</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학년</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학기</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학점</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">교과군</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">필수</th>
                      </tr></thead>
                      <tbody>{courses.slice(0, 50).map((c, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="py-2 px-2 font-medium text-slate-800">{c.과목명 || c.subjectName || '-'}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{c.학년 || c.grade || '-'}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{c.학기 || c.semester || '-'}</td>
                          <td className="py-2 px-2 text-center font-semibold">{c.학점 || c.credits || '-'}</td>
                          <td className="py-2 px-2 text-slate-600">{c.교과군 || c.category || '-'}</td>
                          <td className="py-2 px-2 text-center">{String(c.필수여부 || c.required || 'FALSE').toUpperCase() === 'TRUE' ? '✅' : '-'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                    {courses.length > 50 && <p className="text-xs text-slate-400 text-center py-2">...외 {courses.length - 50}개 과목</p>}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ======================== RULES TAB ======================== */}
          {tab === 'rules' && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <SectionTitle>학년-학기별 선택 규칙 설정</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">각 학기별로 학점 단위 선택 규칙을 추가하세요. (예: 4학점 과목 3개 선택)</p>
                <div className="space-y-6">
                  {allSemesters.map(sem => {
                    const rules = ruleInputs[sem] || [];
                    return (
                      <div key={sem} className="border border-slate-100 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-slate-800 text-sm">{sem.replace('-', '학년 ')}학기</h3>
                          <button onClick={() => addRule(sem)} className="text-xs text-indigo-600 hover:underline">+ 규칙 추가</button>
                        </div>
                        {rules.length === 0 && <p className="text-xs text-slate-400">설정된 규칙 없음</p>}
                        {rules.map((rule, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-2">
                            <select value={rule.credits || 'all'} onChange={e => updateRule(sem, idx, 'credits', e.target.value === 'all' ? 'all' : Number(e.target.value))}
                              className="px-2 py-1.5 border border-slate-200 rounded-lg text-sm">
                              <option value="all">모든 학점</option>
                              <option value="2">2학점</option>
                              <option value="3">3학점</option>
                              <option value="4">4학점</option>
                            </select>
                            <span className="text-sm text-slate-500">과목</span>
                            <input type="number" value={rule.count || ''} onChange={e => updateRule(sem, idx, 'count', Number(e.target.value))}
                              className="w-16 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center" min="0" />
                            <span className="text-sm text-slate-500">개</span>
                            <button onClick={() => removeRule(sem, idx)} className="text-red-400 hover:text-red-600 text-sm ml-auto">삭제</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <button onClick={saveRules} className="mt-6 w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold">규칙 저장</button>
              </Card>

              <Card>
                <SectionTitle>과목 편제 확인</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">등록된 과목이 학년-학기별로 올바르게 분류되었는지 확인하세요.</p>
                <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {semesterKeys.length === 0 && <p className="text-sm text-slate-400 text-center py-8">과목 데이터를 먼저 업로드하세요.</p>}
                  {semesterKeys.map(k => (
                    <div key={k} className="border border-slate-100 rounded-xl p-3">
                      <h4 className="font-semibold text-sm text-slate-700 mb-2">{k.replace('-', '학년 ')}학기 ({coursesBySemester[k].length}과목)</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {coursesBySemester[k].map((c, i) => {
                          const name = c.과목명 || c.subjectName || '-';
                          const req = String(c.필수여부 || c.required || '').toUpperCase() === 'TRUE';
                          return (
                            <span key={i} className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${req ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {name} ({c.학점 || c.credits}학점)
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ======================== SHARE TAB ======================== */}
          {tab === 'share' && (
            <div className="max-w-2xl space-y-6">
              <Card>
                <SectionTitle>학생용 접속 링크</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">아래 링크를 학생들에게 공유하세요. 학생은 관리자가 등록한 학생 코드(10자리)와 학번·이름으로 본인 확인 후 수강신청합니다.</p>
                {!apiUrl ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">시스템 설정에서 API URL을 먼저 설정해주세요.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-xl text-center">
                      <p className="text-xs text-slate-500 mb-2">학생 접속 링크</p>
                      <p className="font-mono text-sm text-indigo-600 break-all">{shareUrl}</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('링크가 복사되었습니다!'); }}
                      className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold">링크 복사하기</button>
                  </div>
                )}
              </Card>
              <Card>
                <SectionTitle>학적부 (학생코드 목록)</SectionTitle>
                {registry.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">학적 데이터를 먼저 업로드하세요.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">학번</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">이름</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">학생코드</th>
                      </tr></thead>
                      <tbody>{registry.map((r, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-2 px-2 font-mono text-xs">{r.학번 || r.studentId || '-'}</td>
                          <td className="py-2 px-2 font-medium">{r.이름 || r.name || '-'}</td>
                          <td className="py-2 px-2 font-mono text-xs tracking-wider text-indigo-600">{r.학생코드 || r.studentCode || '-'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ======================== STUDENTS TAB ======================== */}
          {tab === 'students' && (
            <div className="space-y-6">
              <Card>
                <SectionTitle>수강신청 현황</SectionTitle>
                {responses.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">아직 수강신청 데이터가 없습니다.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">학번</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">이름</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">희망 진로</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">선택 과목</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학점</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">검증</th>
                      </tr></thead>
                      <tbody>{responses.map((r, i) => {
                        const sid = r.Grade ? `${r.Grade}${String(r.Class).padStart(2,'0')}${String(r.Number).padStart(2,'0')}` : '-';
                        const vr = (r.ValidationResult || r.validationResult || '');
                        const pass = vr.includes('통과') || vr.includes('충족');
                        return (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="py-2 px-2 font-mono text-xs">{sid}</td>
                            <td className="py-2 px-2 font-medium">{r.Name || r.name || '-'}</td>
                            <td className="py-2 px-2 text-slate-600">{r.Major || r.major || '-'}</td>
                            <td className="py-2 px-2 text-slate-600 max-w-xs truncate">{r.SelectedCourses || '-'}</td>
                            <td className="py-2 px-2 text-center font-semibold">{r.TotalCredits || '-'}</td>
                            <td className="py-2 px-2 text-center">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {pass ? '통과' : '미달'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}</tbody>
                    </table>
                  </div>
                )}
              </Card>
              {/* 일괄 등록 */}
              <Card>
                <SectionTitle>일괄 수강신청 등록</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">xlsx 파일을 통해 전체 학생의 수강 신청 정보를 한 번에 등록할 수 있습니다.</p>
                <div className="flex flex-wrap gap-3 items-center">
                  <button onClick={() => downloadBulkEnrollmentTemplate(courses.filter(c => !(String(c.필수여부 || c.required || '').toUpperCase() === 'TRUE')))}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 text-sm font-semibold">📥 샘플 양식 다운로드</button>
                  <span className="text-xs text-slate-400">서버 등록 선택과목 기준</span>
                </div>
              </Card>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
