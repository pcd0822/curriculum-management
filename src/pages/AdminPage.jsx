import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import StatCard from '../components/StatCard';
import GaugeChart from '../components/GaugeChart';
import * as DB from '../api/db';
import { saveConfigByCohort, fetchRegisteredCohorts } from '../api/db';
import { readExcel, downloadExcel, downloadTemplate, downloadRegistryTemplate, downloadJointCurriculumTemplate, downloadBulkEnrollmentTemplate } from '../api/excel';
import AdminLogin, { getAdminSession, clearAdminSession, getValidIdToken } from '../components/AdminLogin';
import { fetchMyMapping, registerMyMapping, isRouterConfigured } from '../api/router';

/* ── 6자리 학생코드 생성 ── */
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동 문자 제외
function generateCode6() {
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
}
function ensureCode6(list) {
  const used = new Set(list.map(r => r.학생코드 || r.studentCode).filter(Boolean));
  return list.map(r => {
    const existing = r.학생코드 || r.studentCode;
    if (existing && existing.length >= 6) return r;
    let code;
    do { code = generateCode6(); } while (used.has(code));
    used.add(code);
    return { ...r, 학생코드: code, studentCode: code };
  });
}

/* ── CSV 생성 ── */
function toCSV(rows, columns) {
  const header = columns.join(',');
  const body = rows.map(r => columns.map(c => `"${String(r[c] || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return '\uFEFF' + header + '\n' + body;
}
function downloadCSV(csvStr, filename) {
  const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
}

/* ── Canvas 기반 PNG/PDF 생성 ── */
function buildCodeCanvas(students, title) {
  const rowH = 32, headerH = 50, padX = 24, padY = 16;
  const w = 420, h = headerH + padY * 2 + students.length * rowH + 10;
  const canvas = document.createElement('canvas'); canvas.width = w * 2; canvas.height = h * 2;
  const ctx = canvas.getContext('2d'); ctx.scale(2, 2);
  // bg
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  // title
  ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 16px Manrope, sans-serif';
  ctx.fillText(title, padX, padY + 20);
  ctx.fillStyle = '#94a3b8'; ctx.font = '11px Inter, sans-serif';
  ctx.fillText(`생성일: ${new Date().toLocaleDateString('ko-KR')}`, padX, padY + 38);
  // header
  const tableY = headerH + padY;
  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(padX, tableY, w - padX * 2, rowH);
  ctx.fillStyle = '#64748b'; ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillText('학번', padX + 12, tableY + 20);
  ctx.fillText('학생코드', padX + 180, tableY + 20);
  // rows
  students.forEach((s, i) => {
    const y = tableY + rowH * (i + 1);
    if (i % 2 === 1) { ctx.fillStyle = '#f8fafc'; ctx.fillRect(padX, y, w - padX * 2, rowH); }
    ctx.fillStyle = '#334155'; ctx.font = '12px "Noto Sans KR", sans-serif';
    ctx.fillText(s.학번 || s.studentId || '', padX + 12, y + 20);
    ctx.fillStyle = '#4f46e5'; ctx.font = 'bold 13px monospace';
    ctx.fillText(s.학생코드 || s.studentCode || '', padX + 180, y + 20);
  });
  return canvas;
}
function downloadPNG(canvas, filename) {
  const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = filename; a.click();
}
async function downloadPDF(canvas, filename) {
  const { jsPDF } = await import('jspdf');
  const imgData = canvas.toDataURL('image/png');
  const w = canvas.width / 2, h = canvas.height / 2;
  const orientation = w > h ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation, unit: 'px', format: [w + 40, h + 40] });
  pdf.addImage(imgData, 'PNG', 20, 20, w, h);
  pdf.save(filename);
}

const TABS = [
  { key: 'dashboard', label: '대시보드', icon: '📊' },
  { key: 'system', label: '시스템 설정', icon: '⚙️' },
  { key: 'courses', label: '교육과정 관리', icon: '📚' },
  { key: 'rules', label: '선택 규칙', icon: '📏' },
  { key: 'share', label: '배포 및 공유', icon: '🔗' },
  { key: 'students', label: '학생 현황', icon: '👥' },
];

const PER_PAGE = 8;

/* ── Stable sub-components (정의를 함수 외부에 두어 re-render 시 재생성 방지) ── */
function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl shadow-sm p-6 ${className}`}>{children}</div>;
}
function SectionTitle({ children }) {
  return <h2 className="text-base font-bold text-slate-800 mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>{children}</h2>;
}

/* 입력값과 부분일치하는 과목명 추천 (입력창 바로 아래).
   매칭/가시성은 부모에서 계산해 props로 전달 — 키보드 활성 인덱스도 부모가 관리. */
function PrereqSuggestions({ query, matches, visible, activeIdx, onPick }) {
  if (!query) return null;
  if (!visible) {
    if (matches.length === 0) {
      return (
        <p className="mt-1 text-[0.65rem] text-slate-400">
          일치하는 과목명이 없습니다. (등록되지 않은 이름도 자유롭게 입력 가능)
        </p>
      );
    }
    return null;
  }
  return (
    <div className="mt-1 max-h-40 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-sm">
      <div className="px-3 py-1 text-[0.6rem] text-slate-400 bg-slate-50 border-b border-slate-100 sticky top-0">
        ↑↓ 이동 · Enter 선택 — 일치 {matches.length}건
      </div>
      {matches.map((item, idx) => {
        const active = idx === activeIdx;
        return (
          <button
            key={item.name}
            type="button"
            onMouseEnter={() => { /* 마우스 이동 시 활성 동기화는 부모가 관리해도 됨 — 여기선 단순화 위해 생략 */ }}
            onMouseDown={(e) => { e.preventDefault(); onPick(item.name); }}
            className={`w-full text-left px-3 py-1.5 text-sm flex items-center justify-between gap-2 border-b border-slate-50 last:border-b-0 ${
              active ? 'bg-indigo-100 text-indigo-700 font-semibold' : 'hover:bg-indigo-50 text-slate-700'
            }`}
          >
            <span className="truncate">{item.name}</span>
            {item.semesters && item.semesters.length > 0 && (
              <span className={`text-[0.65rem] flex-shrink-0 ${active ? 'text-indigo-500' : 'text-slate-400'}`}>
                {item.semesters.join(', ')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════ Export Modal ═══════════════════════ */
function ExportModal({ open, onClose, registry }) {
  const [dlMode, setDlMode] = useState('individual');
  const [dlFormat, setDlFormat] = useState('csv');
  const [dlInput, setDlInput] = useState('');
  if (!open) return null;

  function getTargetStudents() {
    if (dlMode === 'individual') {
      if (dlInput.trim()) return registry.filter(r => (r.학번 || r.studentId || '') === dlInput.trim());
      return registry;
    }
    if (dlMode === 'class') {
      if (!dlInput.trim() || dlInput.trim().length < 2) { alert('학년반을 입력해주세요 (예: 101)'); return []; }
      const g = dlInput.trim()[0], c = dlInput.trim().substring(1).padStart(2, '0');
      return registry.filter(r => { const s = r.학번 || r.studentId || ''; return s.length >= 3 && s[0] === g && s.substring(1, 3) === c; });
    }
    return registry;
  }

  function handleDownload() {
    const students = getTargetStudents();
    if (!students.length) { alert('해당 학생이 없습니다.'); return; }
    const cols = ['학번', '학생코드'];
    const mapped = students.map(r => ({ 학번: r.학번 || r.studentId || '', 학생코드: r.학생코드 || r.studentCode || '' }));
    const label = dlMode === 'individual' ? (dlInput.trim() || '전체개별') : dlMode === 'class' ? `학급_${dlInput}` : '전체';
    const fname = `학생코드_${label}_${new Date().toISOString().slice(0, 10)}`;
    if (dlFormat === 'csv') { downloadCSV(toCSV(mapped, cols), fname + '.csv'); }
    else {
      const title = dlMode === 'class' ? `${dlInput}반 학생 코드` : dlMode === 'individual' && dlInput.trim() ? `학생 코드 (${dlInput})` : '전체 학생 코드';
      const canvas = buildCodeCanvas(mapped, title);
      if (dlFormat === 'png') downloadPNG(canvas, fname + '.png');
      else downloadPDF(canvas, fname + '.pdf');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg text-slate-800" style={{ fontFamily: "'Manrope'" }}>코드 내보내기</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">✕</button>
        </div>

        {/* 드롭다운 + 입력 통합 */}
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">저장 대상</label>
        <div className="flex border border-slate-200 rounded-xl overflow-hidden mb-1">
          <select value={dlMode} onChange={e => { setDlMode(e.target.value); setDlInput(''); }}
            className="bg-slate-50 text-sm font-semibold text-indigo-600 px-3 py-2.5 border-r border-slate-200 focus:outline-none cursor-pointer" style={{ minWidth: '90px' }}>
            <option value="individual">개인</option>
            <option value="class">학급</option>
            <option value="all">전체</option>
          </select>
          {dlMode !== 'all' ? (
            <input type="text" value={dlInput} onChange={e => setDlInput(e.target.value)}
              placeholder={dlMode === 'individual' ? '학번 입력 (예: 20513)' : '학년반 입력 (예: 101)'}
              className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none" />
          ) : (
            <div className="flex-1 px-3 py-2.5 text-sm text-slate-400">전체 {registry.length}명</div>
          )}
        </div>
        {dlMode === 'individual' && !dlInput.trim() && (
          <p className="text-xs text-amber-600 mb-3 pl-1">학번을 입력하지 않으면 전체 학생이 개별 문서로 출력됩니다.</p>
        )}
        {dlMode !== 'individual' && <div className="mb-3" />}

        {/* 파일 형식 드롭다운 */}
        <label className="block text-xs font-semibold text-slate-500 mb-1.5">파일 형식</label>
        <select value={dlFormat} onChange={e => setDlFormat(e.target.value)}
          className="w-full p-2.5 border border-slate-200 rounded-xl text-sm mb-5 focus:outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="csv">📄 CSV (.csv)</option>
          <option value="png">🖼️ PNG 이미지 (.png)</option>
          <option value="pdf">📑 PDF 문서 (.pdf)</option>
        </select>

        <button onClick={handleDownload} disabled={registry.length === 0}
          className="w-full py-3 rounded-xl text-white font-bold text-sm disabled:bg-slate-300"
          style={{ background: registry.length > 0 ? 'linear-gradient(135deg, #3525cd, #4f46e5)' : undefined }}>
          ⬇️ 다운로드
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════ ShareTab Component ═══════════════════════ */
function ShareTab({ apiUrl, shareUrl, registry, setRegistry, loadData }) {
  const [codeGenMsg, setCodeGenMsg] = useState('');
  const [exportOpen, setExportOpen] = useState(false);

  async function generateCodes() {
    if (registry.length === 0) return alert('학적 데이터를 먼저 업로드하세요.');
    const updated = ensureCode6(registry);
    setRegistry(updated);
    setCodeGenMsg(`✅ ${updated.length}명의 학생 코드가 확인/생성되었습니다.`);
    if (DB.isConfigured()) {
      try { await DB.saveRegistry(updated); setCodeGenMsg(m => m + ' (서버 저장 완료)'); }
      catch (e) { setCodeGenMsg(m => m + ' ⚠️ 서버 저장 실패: ' + e.message); }
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <SectionTitle>학생용 접속 링크</SectionTitle>
        <p className="text-sm text-slate-500 mb-4">아래 링크를 학생들에게 공유하세요. 학생은 학번과 6자리 학생코드로 본인 확인 후 수강신청합니다.</p>
        {!apiUrl ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm">시스템 설정에서 API URL을 먼저 설정해주세요.</div>
        ) : (
          <div className="space-y-3">
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
        <SectionTitle>학생 코드 자동 생성</SectionTitle>
        <p className="text-sm text-slate-500 mb-4">등록된 학생에게 영문+숫자 6자리 인증코드를 자동 생성합니다.</p>
        <div className="flex items-center gap-3">
          <button onClick={generateCodes} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl hover:bg-emerald-700 text-sm font-semibold">
            🔑 코드 자동 생성 ({registry.length}명)
          </button>
          <span className="text-sm text-slate-500">{registry.filter(r => (r.학생코드 || r.studentCode || '').length >= 6).length}명 발급 완료</span>
        </div>
        {codeGenMsg && <p className="mt-3 text-sm">{codeGenMsg}</p>}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <SectionTitle>학적부 (학생코드 목록)</SectionTitle>
          <button onClick={() => setExportOpen(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            코드 내보내기
          </button>
        </div>
        {registry.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">학적 데이터를 먼저 업로드하세요.</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100">
                <th className="text-left py-2 px-3 text-slate-500 text-xs">학번</th>
                <th className="text-left py-2 px-3 text-slate-500 text-xs">학생코드</th>
              </tr></thead>
              <tbody>{registry.map((r, i) => (
                <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="py-2 px-3 font-mono text-xs">{r.학번 || r.studentId || '-'}</td>
                  <td className="py-2 px-3 font-mono text-sm tracking-widest text-indigo-600 font-bold">{r.학생코드 || r.studentCode || <span className="text-slate-300 font-normal">미발급</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Card>

      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} registry={registry} />
    </div>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  /* ── Admin auth gate ── */
  const [adminSession, setAdminSessionState] = useState(() => getAdminSession());
  const [routerStatus, setRouterStatus] = useState(''); // '⏳ 시트 자동 로드 중...' 등
  function handleAdminAuth(email /*, idToken */) {
    setAdminSessionState({ email, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });
  }
  function handleAdminLogout() {
    clearAdminSession();
    setAdminSessionState(null);
  }

  // Data
  const [responses, setResponses] = useState([]);
  /* 코호트별 편제표 — 1, 2, 3학년 각각 별도 배열. AdminPage 전반에서 'courses' 대신 사용 */
  const [coursesByCohort, setCoursesByCohort] = useState({ 1: [], 2: [], 3: [] });
  const [registry, setRegistry] = useState([]);
  const [settings, setSettings] = useState(null);
  const [jointCurriculum, setJointCurriculum] = useState([]);

  /* 모든 코호트 합친 배열 — 기존 로직(통계, 카테고리 추출 등) 호환용 */
  const courses = useMemo(() => {
    return [
      ...(coursesByCohort[1] || []).map(c => ({ ...c, _cohort: 1 })),
      ...(coursesByCohort[2] || []).map(c => ({ ...c, _cohort: 2 })),
      ...(coursesByCohort[3] || []).map(c => ({ ...c, _cohort: 3 })),
    ];
  }, [coursesByCohort]);

  /* 어떤 코호트 시트를 보고 있는지 — 미리보기/규칙 편집 시 활용 */
  const [activeCohort, setActiveCohort] = useState(1);

  // System — 활성 관리자 이메일에 매핑된 키만 읽음 (다른 계정 시트로 누출 차단)
  const [apiUrl, setApiUrl] = useState(() => {
    try {
      const sess = JSON.parse(localStorage.getItem('adminSession') || 'null');
      const email = sess?.email && (!sess.expiresAt || Date.now() < Number(sess.expiresAt))
        ? String(sess.email).toLowerCase() : null;
      if (email) return localStorage.getItem(`gas_api_url:${email}`) || '';
      return ''; // 인증 전엔 학생 키도 읽지 않음
    } catch { return ''; }
  });
  const [schoolName, setSchoolName] = useState(() => {
    try {
      const sess = JSON.parse(localStorage.getItem('adminSession') || 'null');
      const email = sess?.email && (!sess.expiresAt || Date.now() < Number(sess.expiresAt))
        ? String(sess.email).toLowerCase() : null;
      if (email) return localStorage.getItem(`school_name:${email}`) || '';
      return '';
    } catch { return ''; }
  });
  const [connStatus, setConnStatus] = useState('');

  /* 인증 상태에 따라 API URL을 격리 관리.
     - 미인증: db 글로벌 상태 reset (이전 계정 시트 누출 차단)
     - 인증됨: 그 이메일 키의 캐시 → 라우터 조회 → init */
  useEffect(() => {
    if (!adminSession?.email) {
      DB.reset();
      setApiUrl('');
      setSchoolName('');
      setResponses([]);
      setCoursesByCohort({ 1: [], 2: [], 3: [] });
      setRegistry([]);
      setSettings(null);
      setJointCurriculum([]);
      setRouterStatus('');
      return;
    }

    const email = String(adminSession.email).toLowerCase();
    let cancelled = false;

    // 1) 로컬 캐시(이메일 키)
    let cachedUrl = '';
    let cachedSchool = '';
    try {
      cachedUrl = localStorage.getItem(`gas_api_url:${email}`) || '';
      cachedSchool = localStorage.getItem(`school_name:${email}`) || '';
    } catch {}

    if (cachedUrl) {
      DB.init(cachedUrl, { ownerEmail: email });
      setApiUrl(cachedUrl);
      if (cachedSchool) setSchoolName(cachedSchool);
      loadData();
    } else {
      // 캐시 없음 — 글로벌 상태 정리, 라우터 조회 결과를 기다림
      DB.reset();
      setApiUrl('');
      setSchoolName('');
    }

    // 2) 라우터 조회 (있으면 캐시보다 우선)
    if (!isRouterConfigured()) {
      if (!cachedUrl) setRouterStatus('💡 라우터 미설정 — 시스템 설정에서 시트 URL을 직접 입력하세요.');
      return () => { cancelled = true; };
    }

    setRouterStatus('⏳ 계정에 매핑된 학교 시트 조회 중...');
    (async () => {
      try {
        const m = await fetchMyMapping(email);
        if (cancelled) return;
        if (m && m.apiUrl) {
          if (m.apiUrl !== cachedUrl) {
            DB.init(m.apiUrl, { ownerEmail: email });
            setApiUrl(m.apiUrl);
            if (m.schoolName) {
              setSchoolName(m.schoolName);
              try { localStorage.setItem(`school_name:${email}`, m.schoolName); } catch {}
            }
            setRouterStatus(`✅ 자동 로드: ${m.schoolName || m.apiUrl.slice(0, 60) + '…'}`);
            setTimeout(() => loadData(), 0);
          } else {
            setRouterStatus('✅ 매핑 동기화됨');
          }
        } else {
          setRouterStatus(cachedUrl
            ? '💡 라우터에 등록된 매핑 없음 — 현재는 로컬 캐시 사용 중입니다.'
            : '💡 등록된 매핑 없음 — 시스템 설정에서 시트 URL을 입력하세요.');
        }
      } catch (e) {
        if (!cancelled) setRouterStatus('⚠️ 라우터 조회 실패: ' + e.message);
      }
    })();
    return () => { cancelled = true; };
  }, [adminSession?.email]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const [res, cfg1, cfg2, cfg3, stg, reg, jc] = await Promise.all([
        DB.fetchResponses().catch(() => []),
        DB.fetchConfig(1).catch(() => []),
        DB.fetchConfig(2).catch(() => []),
        DB.fetchConfig(3).catch(() => []),
        DB.fetchSettings().catch(() => null),
        DB.fetchRegistry().catch(() => []),
        DB.fetchJointCurriculum().catch(() => []),
      ]);
      setResponses(Array.isArray(res) ? res : res?.data || []);
      setCoursesByCohort({
        1: Array.isArray(cfg1) ? cfg1 : (cfg1?.data || []),
        2: Array.isArray(cfg2) ? cfg2 : (cfg2?.data || []),
        3: Array.isArray(cfg3) ? cfg3 : (cfg3?.data || []),
      });
      setSettings(stg);
      setRegistry(Array.isArray(reg) ? reg : reg?.data || []);
      setJointCurriculum(Array.isArray(jc) ? jc : jc?.data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  /* loadData는 인증 변경 useEffect에서 명시적으로 호출하므로 자동 호출 안 함 */

  /* ── System tab ── */
  async function saveApiUrl() {
    const url = apiUrl.trim();
    if (!url) return;
    if (!adminSession?.email) {
      setConnStatus('❌ 로그인 후에 시트 URL을 저장할 수 있습니다.');
      return;
    }
    const email = String(adminSession.email).toLowerCase();
    DB.init(url, { ownerEmail: email });
    setConnStatus('✅ API URL이 저장되었습니다.');

    /* 라우터에 본인 매핑 등록 — 다른 컴퓨터에서도 자동 로드되게 */
    if (isRouterConfigured()) {
      const idToken = getValidIdToken();
      if (!idToken) {
        setConnStatus('✅ 로컬 저장 완료. (라우터 자동 등록 실패: 토큰 만료 — 다시 로그인 후 재저장 필요)');
      } else {
        try {
          await registerMyMapping({ idToken, apiUrl: url, schoolName: (schoolName || '').trim() });
          setConnStatus('✅ 저장 완료. 다른 기기에서도 동일 계정으로 로그인하면 자동 로드됩니다.');
        } catch (e) {
          setConnStatus('⚠️ 로컬 저장됨, 라우터 등록 실패: ' + e.message);
        }
      }
    }

    loadData();
  }
  async function saveSchoolName() {
    const name = schoolName.trim();
    if (!name) return;
    if (!adminSession?.email) {
      alert('로그인 후 학교 이름을 저장할 수 있습니다.');
      return;
    }
    const email = String(adminSession.email).toLowerCase();
    try { localStorage.setItem(`school_name:${email}`, name); } catch {}
    if (DB.isConfigured()) {
      try {
        // 기존 settings를 먼저 최신으로 가져온 뒤 병합
        let current = settings || {};
        try { const fresh = await DB.fetchSettings(); if (fresh && typeof fresh === 'object') current = fresh; } catch {}
        const newSettings = { ...current, schoolName: name };
        await DB.saveSettings(newSettings);
        setSettings(newSettings);

        /* 라우터의 schoolName도 갱신 (이미 매핑이 있을 때만 의미 있음) */
        if (isRouterConfigured() && adminSession?.email && apiUrl.trim()) {
          const idToken = getValidIdToken();
          if (idToken) {
            try { await registerMyMapping({ idToken, apiUrl: apiUrl.trim(), schoolName: name }); } catch {}
          }
        }

        alert('학교 이름이 저장되었습니다!');
      } catch (e) { alert('서버 저장 실패: ' + e.message); }
    } else {
      alert('학교 이름이 로컬에 저장되었습니다. (API 연결 시 서버에도 저장됩니다)');
    }
  }
  // Settings에서 학교 이름 복원 (최초 1회만) — 활성 이메일 키에 캐시
  const schoolNameLoaded = useRef(false);
  useEffect(() => {
    if (settings?.schoolName && !schoolNameLoaded.current) {
      schoolNameLoaded.current = true;
      setSchoolName(settings.schoolName);
      const email = adminSession?.email ? String(adminSession.email).toLowerCase() : null;
      if (email) {
        try { localStorage.setItem(`school_name:${email}`, settings.schoolName); } catch {}
      }
    }
  }, [settings, adminSession?.email]);
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

  /* 코호트(현 학년) 단위 편제표 업로드: 해당 코호트 시트 전체 교체.
     1학년 편제표는 현 1학년 학생용, 2학년 편제표는 현 2학년 학생용, 3학년은 현 3학년 학생용.
     업로드 파일에는 6학기(1-1 ~ 3-2) 모든 과목이 들어 있을 수 있다 — 학년 컬럼은 과목의 편성 학기 정보. */
  async function handleUploadCohortConfig(fileInputId, cohort) {
    const key = `saveConfig_g${cohort}`;
    const input = document.getElementById(fileInputId);
    const file = input?.files?.[0];
    if (!file) { setUploadMsg(m => ({ ...m, [key]: '❌ 파일을 선택해주세요.' })); return; }
    if (!DB.isConfigured()) { setUploadMsg(m => ({ ...m, [key]: '❌ API URL을 먼저 설정하세요.' })); return; }
    setUploadMsg(m => ({ ...m, [key]: '⏳ 업로드 중...' }));
    try {
      const rows = await readExcel(file);
      if (!rows.length) throw new Error('데이터가 비어 있습니다.');
      await saveConfigByCohort(cohort, rows);
      setUploadMsg(m => ({ ...m, [key]: `✅ ${cohort}학년 편제표 ${rows.length}건 저장 완료! (다른 학년 편제표는 보존)` }));
      loadData();
    } catch (e) {
      setUploadMsg(m => ({ ...m, [key]: '❌ 오류: ' + e.message }));
    }
  }

  /* ── Rules tab ──
     ruleInputsByCohort: { 1: { "1-1":[...], ..., "3-2":[...] }, 2: {...}, 3: {...} }
     코호트마다 6학기 학기별 규칙을 따로 관리. */
  const [ruleInputsByCohort, setRuleInputsByCohort] = useState({ 1: {}, 2: {}, 3: {} });
  const [minCreditRulesByCohort, setMinCreditRulesByCohort] = useState({ 1: [], 2: [], 3: [] });
  const [requiredTotalByCohort, setRequiredTotalByCohort] = useState({ 1: 180, 2: 180, 3: 180 });
  const [prereqMap, setPrereqMap] = useState({}); // { '수학II': ['수학I'], ... } — 전 코호트 공통
  const [prereqInputTarget, setPrereqInputTarget] = useState('');
  const [prereqInputPrereq, setPrereqInputPrereq] = useState('');
  useEffect(() => {
    if (!settings) return;
    /* 코호트별 새 모델 우선, 없으면 기존 단일 모델을 cohort 1로 폴백 */
    const rbc = settings.selectionRulesByCohort;
    if (rbc && typeof rbc === 'object') {
      setRuleInputsByCohort({
        1: rbc[1] || rbc['1'] || {},
        2: rbc[2] || rbc['2'] || {},
        3: rbc[3] || rbc['3'] || {},
      });
    } else if (settings.selectionRules) {
      // 호환: 기존 단일 selectionRules는 활성 cohort에만 적용
      setRuleInputsByCohort(prev => ({ ...prev, 1: settings.selectionRules }));
    }

    const mcbc = settings.minCreditRulesByCohort;
    if (mcbc && typeof mcbc === 'object') {
      setMinCreditRulesByCohort({
        1: Array.isArray(mcbc[1] || mcbc['1']) ? (mcbc[1] || mcbc['1']) : [],
        2: Array.isArray(mcbc[2] || mcbc['2']) ? (mcbc[2] || mcbc['2']) : [],
        3: Array.isArray(mcbc[3] || mcbc['3']) ? (mcbc[3] || mcbc['3']) : [],
      });
    } else if (Array.isArray(settings.minCreditRules)) {
      setMinCreditRulesByCohort(prev => ({ ...prev, 1: settings.minCreditRules }));
    }

    const rtbc = settings.requiredTotalCreditsByCohort;
    if (rtbc && typeof rtbc === 'object') {
      setRequiredTotalByCohort({
        1: Number(rtbc[1] || rtbc['1']) || 180,
        2: Number(rtbc[2] || rtbc['2']) || 180,
        3: Number(rtbc[3] || rtbc['3']) || 180,
      });
    } else if (settings.requiredTotalCredits) {
      const n = Number(settings.requiredTotalCredits) || 180;
      setRequiredTotalByCohort({ 1: n, 2: n, 3: n });
    }

    if (settings.prerequisitesMap && typeof settings.prerequisitesMap === 'object' && !Array.isArray(settings.prerequisitesMap)) {
      setPrereqMap(settings.prerequisitesMap);
    }
  }, [settings]);

  /* 활성 코호트의 규칙 — 위에 정의된 activeCohort 사용 */
  const ruleInputs = ruleInputsByCohort[activeCohort] || {};
  const minCreditRules = minCreditRulesByCohort[activeCohort] || [];
  const requiredTotalInput = requiredTotalByCohort[activeCohort] || 180;
  function setRequiredTotalInput(v) {
    setRequiredTotalByCohort(prev => ({ ...prev, [activeCohort]: v }));
  }

  /* 선이수 매핑 입력 — 키보드 내비게이션 상태 */
  const [targetActiveIdx, setTargetActiveIdx] = useState(0);
  const [prereqActiveIdx, setPrereqActiveIdx] = useState(0);
  const [targetClosed, setTargetClosed] = useState(false);
  const [prereqClosed, setPrereqClosed] = useState(false);

  /* 선이수 매핑 편집 헬퍼 */
  function addPrereqMapping() {
    const target = String(prereqInputTarget || '').trim();
    const prereq = String(prereqInputPrereq || '').trim();
    if (!target || !prereq) return;
    if (target === prereq) { alert('후수 과목과 선이수 과목이 같을 수 없습니다.'); return; }
    setPrereqMap((prev) => {
      const list = Array.isArray(prev[target]) ? prev[target] : [];
      if (list.includes(prereq)) return prev;
      return { ...prev, [target]: [...list, prereq] };
    });
    setPrereqInputPrereq('');
  }
  function removePrereqMapping(target, prereq) {
    setPrereqMap((prev) => {
      const list = (prev[target] || []).filter((p) => p !== prereq);
      const next = { ...prev };
      if (list.length === 0) delete next[target];
      else next[target] = list;
      return next;
    });
  }
  function clearAllPrereqsFor(target) {
    setPrereqMap((prev) => {
      const next = { ...prev };
      delete next[target];
      return next;
    });
  }

  /* 활성 코호트의 규칙 갱신 헬퍼 */
  function setRuleInputs(updater) {
    setRuleInputsByCohort(prev => {
      const cohortRules = prev[activeCohort] || {};
      const next = typeof updater === 'function' ? updater(cohortRules) : updater;
      return { ...prev, [activeCohort]: next };
    });
  }
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

  /* ── 교과별 최소 이수학점 ── */
  function setMinCreditRules(updater) {
    setMinCreditRulesByCohort(prev => {
      const list = prev[activeCohort] || [];
      const next = typeof updater === 'function' ? updater(list) : updater;
      return { ...prev, [activeCohort]: next };
    });
  }
  function addMinRule(type, name) {
    if (!name) return;
    setMinCreditRules(prev => {
      if (prev.some(r => r.type === type && r.name === name)) return prev;
      return [...prev, { type, name, min: 8 }];
    });
  }
  function updateMinRule(idx, field, value) {
    setMinCreditRules(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }
  function removeMinRule(idx) {
    setMinCreditRules(prev => prev.filter((_, i) => i !== idx));
  }

  const [savingRules, setSavingRules] = useState(false);
  const [saveRulesMsg, setSaveRulesMsg] = useState('');

  async function saveRules() {
    if (!DB.isConfigured()) return alert('API URL을 먼저 설정하세요.');
    setSavingRules(true);
    setSaveRulesMsg('');
    try {
      /* 코호트별 정리 */
      const cleanedMinByCohort = {};
      [1, 2, 3].forEach(c => {
        const list = minCreditRulesByCohort[c] || [];
        cleanedMinByCohort[c] = list
          .filter(r => r.name && Number(r.min) >= 0)
          .map(r => ({ type: r.type, name: String(r.name).trim(), min: Number(r.min) || 0 }));
      });
      const totalByCohort = {
        1: Number(requiredTotalByCohort[1]) || 180,
        2: Number(requiredTotalByCohort[2]) || 180,
        3: Number(requiredTotalByCohort[3]) || 180,
      };
      const rulesByCohort = {
        1: ruleInputsByCohort[1] || {},
        2: ruleInputsByCohort[2] || {},
        3: ruleInputsByCohort[3] || {},
      };

      /* settings는 가장 최신 서버값을 한 번 더 받아 병합 — 다른 탭에서 수정 시 충돌 방지 */
      let baseSettings = settings || {};
      try {
        const fresh = await DB.fetchSettings();
        if (fresh && typeof fresh === 'object' && !Array.isArray(fresh)) baseSettings = fresh;
      } catch {}
      /* prereqMap 정리: 빈 항목 제거 (전 코호트 공통) */
      const cleanedPrereqMap = {};
      Object.entries(prereqMap).forEach(([target, list]) => {
        const t = String(target || '').trim();
        const arr = Array.isArray(list) ? list.map((x) => String(x || '').trim()).filter(Boolean) : [];
        if (t && arr.length > 0) cleanedPrereqMap[t] = [...new Set(arr)];
      });
      const newSettings = {
        ...baseSettings,
        /* 신규 모델 */
        selectionRulesByCohort: rulesByCohort,
        minCreditRulesByCohort: cleanedMinByCohort,
        requiredTotalCreditsByCohort: totalByCohort,
        prerequisitesMap: cleanedPrereqMap,
      };
      /* 구버전 단일 필드는 제거 (혼선 방지) */
      delete newSettings.selectionRules;
      delete newSettings.minCreditRules;
      delete newSettings.requiredTotalCredits;
      await DB.saveSettings(newSettings);
      setSettings(newSettings);
      const totalPrereqEntries = Object.values(cleanedPrereqMap).reduce((s, a) => s + a.length, 0);
      const summary = [1, 2, 3].map(c => {
        const semCount = Object.keys(rulesByCohort[c]).length;
        const minCount = cleanedMinByCohort[c].length;
        return `${c}학년: 학기규칙 ${semCount}건/최소학점 ${minCount}건/총 ${totalByCohort[c]}학점`;
      }).join(' · ');
      setSaveRulesMsg(`✅ 저장 완료 — ${summary} · 선이수 매핑 ${totalPrereqEntries}건`);
    } catch (e) {
      setSaveRulesMsg('❌ 저장 실패: ' + e.message);
    } finally {
      setSavingRules(false);
    }
  }

  /* ── 활성 코호트 편제표에서 교과군/세부교과 자동 추출 ── */
  const activeCohortCourses = coursesByCohort[activeCohort] || [];
  const availableCategories = useMemo(() => {
    const set = new Set();
    activeCohortCourses.forEach(c => {
      const v = c.교과군 || c.category;
      if (v) set.add(String(v).trim());
    });
    return [...set].sort();
  }, [activeCohortCourses]);
  const availableSubCategories = useMemo(() => {
    const set = new Set();
    activeCohortCourses.forEach(c => {
      const v = c.세부교과 || c.subCategory || c['교과(군)'];
      if (v) set.add(String(v).trim());
    });
    return [...set].sort();
  }, [activeCohortCourses]);

  /* 과목명 단위로 중복 제거된 목록 (선이수 매핑 입력 추천용). */
  const uniqueCourseNames = useMemo(() => {
    const map = new Map();
    courses.forEach((c) => {
      const name = String(c.과목명 || c.subjectName || '').trim();
      if (!name) return;
      const g = c.학년 || c.grade;
      const s = c.학기 || c.semester;
      const semKey = (g && s) ? `${g}-${s}` : '';
      if (!map.has(name)) map.set(name, new Set());
      if (semKey) map.get(name).add(semKey);
    });
    return Array.from(map.entries())
      .map(([name, semSet]) => ({ name, semesters: [...semSet].sort() }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  }, [courses]);

  /* 입력 → 부분일치 매칭 (공백 무시, 대소문자 무시) */
  function getMatches(query, exclude) {
    const q = String(query || '').replace(/\s+/g, '').toLowerCase();
    if (!q) return [];
    return uniqueCourseNames
      .filter((item) => {
        if (!item || !item.name) return false;
        if (exclude && item.name === exclude) return false;
        const n = String(item.name).replace(/\s+/g, '').toLowerCase();
        return n.includes(q);
      })
      .slice(0, 8);
  }
  function isExactSingleMatch(query, matches) {
    if (!Array.isArray(matches) || matches.length !== 1) return false;
    const q = String(query || '').replace(/\s+/g, '').toLowerCase();
    const m = String(matches[0].name).replace(/\s+/g, '').toLowerCase();
    return q === m;
  }
  const targetMatches = useMemo(
    () => getMatches(prereqInputTarget),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prereqInputTarget, uniqueCourseNames]
  );
  const prereqMatches = useMemo(
    () => getMatches(prereqInputPrereq, prereqInputTarget),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prereqInputPrereq, prereqInputTarget, uniqueCourseNames]
  );
  const targetSuggestionsVisible = !targetClosed && targetMatches.length > 0 && !isExactSingleMatch(prereqInputTarget, targetMatches);
  const prereqSuggestionsVisible = !prereqClosed && prereqMatches.length > 0 && !isExactSingleMatch(prereqInputPrereq, prereqMatches);

  /* 추천 리스트 키보드 처리 헬퍼 */
  function handleSuggestionKey(e, opts) {
    const { matches, visible, activeIdx, setActiveIdx, setValue, setClosed, onSubmit, currentValue } = opts;
    if (visible && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, matches.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setClosed(true);
        return;
      }
      if (e.key === 'Enter' && activeIdx >= 0 && activeIdx < matches.length) {
        const picked = matches[activeIdx].name;
        const norm = (s) => String(s || '').replace(/\s+/g, '').toLowerCase();
        if (norm(currentValue) === norm(picked)) {
          // 입력값과 활성 항목이 이미 동일 → 목록을 닫고 제출
          e.preventDefault();
          setClosed(true);
          if (onSubmit) onSubmit();
          return;
        }
        // 활성 항목을 입력값으로 채움 + 목록 닫기
        e.preventDefault();
        setValue(picked);
        setClosed(true);
        return;
      }
    }
    if (e.key === 'Enter' && onSubmit) onSubmit();
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
    courses: r.SelectedCourses || r.selectedCourses || '-',
    credits: r.TotalCredits || r.totalCredits || '-',
    status: (r.ValidationResult || r.validationResult || '').includes('통과') || (r.ValidationResult || r.validationResult || '').includes('충족') ? '통과' : '미달',
  }));
  const filtered = tableRows
    .filter(r => filter === 'all' || r.status === (filter === 'pass' ? '통과' : '미달'))
    .filter(r => !search.trim() || r.id.includes(search));
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  useEffect(() => { setPage(1); }, [filter, search]);

  /* ── 활성 코호트 편제표의 학년-학기별 과목 그룹 ── */
  const coursesBySemester = {};
  activeCohortCourses.forEach(c => {
    const g = c.학년 || c.grade; const s = c.학기 || c.semester;
    if (!g || !s) return;
    const key = `${g}-${s}`;
    if (!coursesBySemester[key]) coursesBySemester[key] = [];
    coursesBySemester[key].push(c);
  });
  const semesterKeys = Object.keys(coursesBySemester).sort();
  const allSemesters = ['1-1', '1-2', '2-1', '2-2', '3-1', '3-2'];

  /* 등록된 코호트 (편제표가 비어있지 않은) */
  const registeredCohorts = useMemo(() => {
    return [1, 2, 3].filter(c => (coursesByCohort[c] || []).length > 0);
  }, [coursesByCohort]);

  /* 코호트별 등록 행 수 */
  const courseCountByCohort = useMemo(() => ({
    1: (coursesByCohort[1] || []).length,
    2: (coursesByCohort[2] || []).length,
    3: (coursesByCohort[3] || []).length,
  }), [coursesByCohort]);

  const statusMsg = (key) => uploadMsg[key] ? <p className="mt-3 text-sm">{uploadMsg[key]}</p> : null;

  /* ── 관리자 보안 설정 ──
     Client ID는 빌드 시 Netlify 환경변수(VITE_GOOGLE_CLIENT_ID)로 주입.
     이메일 화이트리스트는 학교별로 다르므로 GAS Settings에 보관. */
  const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const adminEmails = Array.isArray(settings?.adminEmails) ? settings.adminEmails : [];

  /* 화이트리스트가 비어있을 때 첫 로그인을 자동 등록하는 부트스트랩 */
  async function handleAdminBootstrap(email) {
    if (!DB.isConfigured()) return; // API 미설정 — 세션만 로컬에서 유지
    try {
      let baseSettings = settings || {};
      try {
        const fresh = await DB.fetchSettings();
        if (fresh && typeof fresh === 'object' && !Array.isArray(fresh)) baseSettings = fresh;
      } catch {}
      const list = Array.isArray(baseSettings.adminEmails) ? baseSettings.adminEmails : [];
      if (list.length === 0) {
        const next = { ...baseSettings, adminEmails: [email] };
        await DB.saveSettings(next);
        setSettings(next);
      }
    } catch (e) {
      console.warn('admin bootstrap failed', e);
    }
  }

  /* 관리자 보안 설정 저장 */
  const [adminSecurityMsg, setAdminSecurityMsg] = useState('');
  const [emailInput, setEmailInput] = useState('');

  async function saveSecuritySettings(next) {
    if (!DB.isConfigured()) {
      setAdminSecurityMsg('❌ API URL을 먼저 설정하세요.');
      return;
    }
    try {
      let baseSettings = settings || {};
      try {
        const fresh = await DB.fetchSettings();
        if (fresh && typeof fresh === 'object' && !Array.isArray(fresh)) baseSettings = fresh;
      } catch {}
      const merged = { ...baseSettings, ...next };
      await DB.saveSettings(merged);
      setSettings(merged);
      setAdminSecurityMsg('✅ 저장 완료');
    } catch (e) {
      setAdminSecurityMsg('❌ 저장 실패: ' + e.message);
    }
  }

  function addAdminEmail() {
    const v = String(emailInput || '').trim().toLowerCase();
    if (!v || !v.includes('@')) return;
    if (adminEmails.includes(v)) { setEmailInput(''); return; }
    saveSecuritySettings({ adminEmails: [...adminEmails, v] });
    setEmailInput('');
  }
  function removeAdminEmail(email) {
    if (adminEmails.length <= 1) {
      if (!window.confirm('마지막 관리자 이메일을 제거하면 다음 로그인 시 누구나 첫 관리자로 등록될 수 있습니다. 계속하시겠습니까?')) return;
    }
    saveSecuritySettings({ adminEmails: adminEmails.filter(e => e !== email) });
  }

  /* ── 인증 게이트 ── */
  if (!adminSession) {
    return (
      <AdminLogin
        clientId={googleClientId}
        adminEmails={adminEmails}
        onAuth={handleAdminAuth}
        onBootstrap={handleAdminBootstrap}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar activePath="/admin" />

      <main className="flex-1 ml-0 lg:ml-[240px]">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
          {/* ── 관리자 세션 표시 + 로그아웃 ── */}
          <div className="flex items-center justify-end mb-2 gap-2 text-xs">
            <span className="text-slate-500">로그인:</span>
            <span className="font-mono text-slate-700">{adminSession.email}</span>
            <button
              onClick={() => {
                if (window.confirm('로그아웃하시겠습니까?')) handleAdminLogout();
              }}
              className="ml-2 px-3 py-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              로그아웃
            </button>
          </div>

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
                  <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: "'Manrope', sans-serif" }}>{schoolName || 'OO고등학교'} 학점 이수 현황</h1>
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

              {/* 과목별 누적 신청자 수 (선택 과목 인기도) */}
              <Card className="mb-6">
                <SectionTitle>과목별 누적 신청자 수 (학생선택)</SectionTitle>
                <p className="text-xs text-slate-500 mb-4">학생들이 제출한 신청서에서 과목명별로 집계한 인원수입니다.</p>
                {(() => {
                  const counter = {};
                  responses.forEach(r => {
                    const raw = r.SelectedCourses || r.selectedCourses || '';
                    String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
                      counter[name] = (counter[name] || 0) + 1;
                    });
                  });
                  const ranked = Object.entries(counter).sort((a, b) => b[1] - a[1]);
                  if (ranked.length === 0) {
                    return <p className="text-sm text-slate-400 py-8 text-center">아직 제출된 신청서가 없습니다.</p>;
                  }
                  const max = ranked[0][1];
                  return (
                    <div className="space-y-1.5 max-h-[360px] overflow-y-auto pr-2">
                      {ranked.map(([name, count]) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="text-sm text-slate-700 w-44 truncate flex-shrink-0" title={name}>{name}</span>
                          <div className="flex-1 h-5 rounded-full bg-slate-100 overflow-hidden relative">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${(count / max) * 100}%`, background: 'linear-gradient(90deg, #6366f1, #4f46e5)' }}
                            />
                          </div>
                          <span className="text-xs font-mono font-semibold text-slate-700 w-12 text-right">{count}명</span>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </Card>

              {/* 공동교육과정 누적 신청 */}
              <Card className="mb-6">
                <SectionTitle>공동교육과정 누적 신청자 수</SectionTitle>
                {(() => {
                  const counter = {};
                  responses.forEach(r => {
                    const raw = r.JointCourses || r.jointCourses || '';
                    if (Array.isArray(raw)) {
                      raw.forEach(j => {
                        const name = j?.subjectName || String(j);
                        if (name) counter[name] = (counter[name] || 0) + 1;
                      });
                    } else {
                      String(raw).split(',').map(s => s.trim()).filter(Boolean).forEach(name => {
                        counter[name] = (counter[name] || 0) + 1;
                      });
                    }
                  });
                  const ranked = Object.entries(counter).sort((a, b) => b[1] - a[1]);
                  if (ranked.length === 0) {
                    return <p className="text-sm text-slate-400 py-6 text-center">제출된 공동교육과정 신청이 없습니다.</p>;
                  }
                  return (
                    <div className="flex flex-wrap gap-1.5">
                      {ranked.map(([name, count]) => (
                        <span key={name} className="inline-flex items-center gap-1 bg-violet-50 text-violet-700 px-2 py-0.5 rounded-full text-xs">
                          🏫 {name} <span className="font-mono font-semibold text-violet-600">{count}</span>
                        </span>
                      ))}
                    </div>
                  );
                })()}
              </Card>
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
                          <th className="text-left py-3 px-3 text-slate-500 font-medium text-xs">선택과목</th>
                          <th className="text-right py-3 px-3 text-slate-500 font-medium text-xs">학점</th>
                          <th className="text-center py-3 px-3 text-slate-500 font-medium text-xs">상태</th>
                        </tr></thead>
                        <tbody>{paged.map((r, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                            <td className="py-3 px-3 font-mono text-xs text-slate-600">{r.id}</td>
                            <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{r.courses}</td>
                            <td className="py-3 px-3 text-right font-semibold">{r.credits}</td>
                            <td className="py-3 px-3 text-center">
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${r.status === '통과' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{r.status}</span>
                            </td>
                          </tr>
                        ))}{paged.length === 0 && <tr><td colSpan="4" className="py-12 text-center text-slate-400">데이터 없음</td></tr>}</tbody>
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
              {/* 학교 이름 */}
              <Card>
                <SectionTitle>학교 정보</SectionTitle>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">학교 이름</label>
                  <div className="flex gap-2">
                    <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                      className="flex-1 p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="예: OO고등학교" />
                    <button onClick={saveSchoolName} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold whitespace-nowrap">저장</button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1.5">저장하면 구글 스프레드시트 Settings에도 반영됩니다.</p>
                </div>
              </Card>
              {/* API URL */}
              <Card>
                <SectionTitle>Google Apps Script API 설정</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  배포된 Google Apps Script 웹 앱 URL을 입력하세요. 한 번 저장하면 다른 기기에서 동일 Google 계정으로 로그인 시 자동 로드됩니다.
                </p>
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
                {DB.isConfigured() && !connStatus && <p className="mt-3 text-xs text-emerald-600">✅ API URL이 이미 설정되어 있습니다.</p>}
                {connStatus && <p className="mt-4 text-sm">{connStatus}</p>}

                {/* 라우터 자동 로드 상태 */}
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-600 mb-1.5">계정 동기화 상태</p>
                  {isRouterConfigured() ? (
                    <p className="text-xs text-slate-500 leading-relaxed">{routerStatus || '대기 중'}</p>
                  ) : (
                    <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
                      ⚠️ 라우터가 설정되어 있지 않습니다 — 사이트 운영자에게 <code className="bg-white px-1 rounded">VITE_GAS_ROUTER_URL</code> 환경변수 등록을 요청하세요.
                      현재 시트 URL은 이 브라우저에만 저장되어 다른 기기에서는 다시 입력해야 합니다.
                    </p>
                  )}
                </div>
              </Card>
              {/* 관리자 보안 (Google 로그인) */}
              <Card>
                <SectionTitle>관리자 보안 — Google 계정 로그인</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  관리자 대시보드 접근을 Google 계정으로 제한합니다. Client ID는 사이트 운영자가 Netlify 환경변수
                  <code className="bg-slate-100 px-1 rounded mx-1">VITE_GOOGLE_CLIENT_ID</code>로 주입한 값을 사용합니다.
                </p>

                {/* Client ID 상태 표시 (읽기 전용) */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Google OAuth 2.0 Client ID (환경변수)</label>
                  {googleClientId ? (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-emerald-700 font-semibold">✓ 환경변수에서 로드됨</span>
                      </div>
                      <code className="block font-mono text-slate-600 break-all">
                        {googleClientId.length > 60 ? googleClientId.slice(0, 30) + '…' + googleClientId.slice(-20) : googleClientId}
                      </code>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 leading-relaxed">
                      <p className="font-semibold mb-1">⚠️ 환경변수 미설정</p>
                      <p>Netlify 사이트 설정 → Environment variables 에서
                      <code className="bg-white px-1 rounded mx-1">VITE_GOOGLE_CLIENT_ID</code>를 추가하고 재배포하세요.
                      Google Cloud Console의 OAuth 2.0 클라이언트 ID(승인된 자바스크립트 원본에
                      <code className="bg-white px-1 rounded mx-1">{typeof window !== 'undefined' ? window.location.origin : ''}</code> 포함)를 사용합니다.</p>
                    </div>
                  )}
                </div>

                {/* 허용 이메일 화이트리스트 */}
                <div className="mb-3">
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">관리자 허용 이메일 ({adminEmails.length}명)</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAdminEmail(); } }}
                      placeholder="admin@school.kr"
                      className="flex-1 p-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                    <button
                      onClick={addAdminEmail}
                      className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-emerald-700 whitespace-nowrap"
                    >
                      + 추가
                    </button>
                  </div>
                  {adminEmails.length === 0 ? (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      ⚠️ 화이트리스트가 비어있습니다. 다음에 로그인하는 Google 계정이 첫 관리자로 자동 등록됩니다.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {adminEmails.map(em => (
                        <span key={em} className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-xs font-medium border border-indigo-200">
                          {em}
                          <button
                            onClick={() => removeAdminEmail(em)}
                            className="text-indigo-400 hover:text-rose-600 font-bold"
                            title="제거"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {adminSecurityMsg && <p className="mt-2 text-xs">{adminSecurityMsg}</p>}
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
              {/* 코호트(현 학년) 단위 편제표 업로드 */}
              <Card className="md:col-span-2">
                <SectionTitle>현 학년별 편제표 업로드</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  편제표는 <strong>현재 학생 학년 단위</strong>로 따로 등록합니다. 한 편제표 안에 1~3학년 모든 학기 과목을 함께 넣을 수 있습니다.
                  <br />
                  · <strong>1학년 편제표</strong>: 현 1학년 학생용 — 앞으로 2~3학년에서 선택할 과목까지 포함
                  <br />
                  · <strong>2학년 편제표</strong>: 현 2학년 학생용 — 1학년 때 선택한 과목 + 3학년 선택 과목
                  <br />
                  · <strong>3학년 편제표</strong>: 현 3학년 학생용 — 모든 학기 회고 + 3학년 잔여 선택 과목
                  <br />
                  파일을 업로드하면 <strong>해당 학년 편제표 전체가 교체</strong>됩니다 (다른 학년 편제표는 그대로).
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map(g => {
                    const key = `saveConfig_g${g}`;
                    const fileId = `course-file-g${g}`;
                    const count = courseCountByCohort[g] || 0;
                    return (
                      <div key={g} className="border border-slate-200 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-sm text-slate-700">현 {g}학년 편제표</h4>
                          <span className={`text-xs font-mono ${count > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {count > 0 ? `${count}건 등록됨` : '미등록'}
                          </span>
                        </div>
                        <button onClick={() => downloadTemplate(g)} className="text-indigo-600 hover:underline text-xs mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          편제표 템플릿
                        </button>
                        <input type="file" id={fileId} accept=".xlsx,.xls" className="block w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2" />
                        <button onClick={() => handleUploadCohortConfig(fileId, g)} className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 text-xs font-semibold">
                          현 {g}학년 편제표 업로드
                        </button>
                        {uploadMsg[key] && <p className="mt-2 text-xs">{uploadMsg[key]}</p>}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700">
                  💡 학생은 자기 현 학년 편제표를 자동으로 조회합니다. 학년 코호트별로 과목·선택 규칙이 다를 수 있으며, 매년 학년이 올라갈 때 새 학년 편제표를 다시 업로드합니다.
                </div>
              </Card>

              {/* 학적 업로드 */}
              <Card>
                <SectionTitle>학적 정보 업로드</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">학번(5자리)이 포함된 엑셀 파일을 업로드하세요. 학생코드는 자동 발급됩니다. (개인정보 보호를 위해 이름은 수집하지 않습니다.)</p>
                <div className="space-y-3">
                  <button onClick={downloadRegistryTemplate} className="text-indigo-600 hover:underline text-sm flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    학적 템플릿 양식 다운로드
                  </button>
                  <input type="file" id="registry-file" accept=".xlsx,.xls" className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
                  <button onClick={() => handleUpload('registry-file', 'saveRegistry', '학적')} className="w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold">학적 데이터 업로드 및 저장</button>
                </div>
                {statusMsg('saveRegistry')}
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
                {statusMsg('saveJointCurriculum')}
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

              {/* 과목 미리보기 테이블 — 모든 코호트 통합 */}
              <Card className="md:col-span-2">
                <SectionTitle>등록된 과목 미리보기 (모든 코호트 통합)</SectionTitle>
                {courses.length === 0 ? (
                  <p className="text-sm text-slate-400 py-8 text-center">등록된 과목이 없습니다. 위에서 학년별 편제표를 업로드하세요.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white"><tr className="border-b border-slate-100">
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">편제표</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">과목명</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학년</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학기</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">학점</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">교과군</th>
                        <th className="text-center py-2 px-2 text-slate-500 text-xs">필수</th>
                        <th className="text-left py-2 px-2 text-slate-500 text-xs">선이수과목</th>
                      </tr></thead>
                      <tbody>{courses.slice(0, 80).map((c, i) => {
                        const prereq = c.선이수과목 || c.선수과목 || c.prerequisites || '';
                        const prereqStr = Array.isArray(prereq) ? prereq.join(', ') : String(prereq);
                        return (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/60">
                          <td className="py-2 px-2 text-center">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 text-[0.65rem] font-bold">현{c._cohort}학년</span>
                          </td>
                          <td className="py-2 px-2 font-medium text-slate-800">{c.과목명 || c.subjectName || '-'}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{c.학년 || c.grade || '-'}</td>
                          <td className="py-2 px-2 text-center text-slate-600">{c.학기 || c.semester || '-'}</td>
                          <td className="py-2 px-2 text-center font-semibold">{c.학점 || c.credits || '-'}</td>
                          <td className="py-2 px-2 text-slate-600">{c.교과군 || c.category || '-'}</td>
                          <td className="py-2 px-2 text-center">{String(c.필수여부 || c.required || 'FALSE').toUpperCase() === 'TRUE' ? '✅' : '-'}</td>
                          <td className="py-2 px-2 text-amber-700 text-xs">{prereqStr || '-'}</td>
                        </tr>
                        );
                      })}</tbody>
                    </table>
                    {courses.length > 80 && <p className="text-xs text-slate-400 text-center py-2">...외 {courses.length - 80}개 과목</p>}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* ======================== RULES TAB ======================== */}
          {tab === 'rules' && (
            <div className="grid md:grid-cols-2 gap-6">
              {/* 코호트(현 학년) 탭 — 어떤 학년 편제표의 규칙을 편집하는지 */}
              <Card className="md:col-span-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <SectionTitle>편집 대상 — 현 학년 코호트</SectionTitle>
                    <p className="text-xs text-slate-500">아래의 모든 규칙은 선택한 코호트(현 학년 편제표)에만 적용됩니다.</p>
                  </div>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(c => {
                      const active = c === activeCohort;
                      const count = courseCountByCohort[c];
                      return (
                        <button
                          key={c}
                          onClick={() => setActiveCohort(c)}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            active ? 'text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                          style={active ? { background: 'linear-gradient(135deg, #3525cd, #4f46e5)' } : undefined}
                        >
                          현 {c}학년
                          <span className={`ml-1.5 text-[0.65rem] ${active ? 'text-white/80' : 'text-slate-400'}`}>({count}건)</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </Card>

              {/* 졸업 요건: 총 이수학점 */}
              <Card className="md:col-span-2">
                <SectionTitle>졸업 요건 — 총 이수학점 (현 {activeCohort}학년)</SectionTitle>
                <p className="text-sm text-slate-500 mb-3">
                  학생이 충족해야 할 총 이수학점입니다. 이 값의 50%가 기초교과(국·영·수·한국사1·2) 한도로 자동 적용됩니다.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    value={requiredTotalInput}
                    onChange={(e) => setRequiredTotalInput(e.target.value)}
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg text-sm text-center"
                    min="0"
                  />
                  <span className="text-sm text-slate-500">학점</span>
                  <span className="text-xs text-slate-400 ml-3">
                    → 기초교과 최대 <span className="font-bold text-indigo-600">{Math.floor((Number(requiredTotalInput) || 0) * 0.5)}학점</span>
                  </span>
                </div>
              </Card>

              {/* 교과별 최소 이수학점 */}
              <Card className="md:col-span-2">
                <SectionTitle>교과별 최소 이수학점 설정 — 현 {activeCohort}학년</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  교과군(예: 체육교과) 또는 세부교과(예: 국어, 수학) 단위로 최소 이수학점을 설정하세요.
                  학생의 신청 학점이 이 값을 충족하지 못하면 최종 제출이 차단됩니다.
                </p>

                {/* 추가 영역 */}
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">교과군 추가</label>
                      <select
                        onChange={(e) => { if (e.target.value) { addMinRule('category', e.target.value); e.target.value = ''; } }}
                        defaultValue=""
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                      >
                        <option value="">교과군을 선택하세요…</option>
                        {availableCategories.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">세부교과 추가</label>
                      <select
                        onChange={(e) => { if (e.target.value) { addMinRule('subCategory', e.target.value); e.target.value = ''; } }}
                        defaultValue=""
                        className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm bg-white"
                      >
                        <option value="">세부교과를 선택하세요…</option>
                        {availableSubCategories.map(c => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                  </div>
                  {(availableCategories.length === 0 && availableSubCategories.length === 0) && (
                    <p className="text-xs text-amber-600 mt-2">
                      ⚠️ 과목 데이터를 먼저 업로드해야 교과군·세부교과를 자동으로 인식할 수 있습니다.
                    </p>
                  )}
                </div>

                {/* 등록된 규칙 리스트 */}
                {minCreditRules.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    설정된 최소 이수학점 규칙이 없습니다. 위에서 추가하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-500 px-2 pb-1 border-b border-slate-100">
                      <div className="col-span-2">분류</div>
                      <div className="col-span-5">교과명</div>
                      <div className="col-span-3 text-center">최소 학점</div>
                      <div className="col-span-2"></div>
                    </div>
                    {minCreditRules.map((rule, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-center px-2 py-1.5 hover:bg-slate-50 rounded-lg">
                        <div className="col-span-2">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[0.65rem] font-semibold ${
                            rule.type === 'category' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {rule.type === 'category' ? '교과군' : '세부교과'}
                          </span>
                        </div>
                        <div className="col-span-5 text-sm font-medium text-slate-800 truncate">{rule.name}</div>
                        <div className="col-span-3 flex items-center justify-center gap-1">
                          <input
                            type="number"
                            value={rule.min}
                            onChange={(e) => updateMinRule(idx, 'min', e.target.value)}
                            min="0"
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                          />
                          <span className="text-xs text-slate-500">학점</span>
                        </div>
                        <div className="col-span-2 text-right">
                          <button
                            onClick={() => removeMinRule(idx)}
                            className="text-rose-500 hover:text-rose-700 text-xs"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700 leading-relaxed">
                  <span className="font-semibold">참고:</span> "교과군"은 과목 데이터의 <code className="bg-white px-1 rounded">교과군</code>(예: 기초교과, 체육교과) 컬럼,
                  "세부교과"는 <code className="bg-white px-1 rounded">세부교과</code>(예: 국어, 수학, 한국사) 컬럼을 기준으로 합산합니다.
                </div>
              </Card>

              {/* 과목 위계 규칙 (선이수 관계 설정) */}
              <Card className="md:col-span-2">
                <SectionTitle>과목 위계 규칙 (선이수 관계 설정)</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  후수 과목과 그 선이수 과목을 등록하세요. 학생이 선이수 과목을 선택하지 않으면 후수 과목 카드는 자동 비활성화됩니다.
                  과목 엑셀에 <code className="bg-slate-100 px-1 rounded">선이수과목</code> 컬럼이 비어 있어도 여기서 등록한 매핑이 적용됩니다.
                </p>

                {/* 추가 폼 — 직접 입력 + 실시간 매칭 추천 (↑↓ Enter 키 지원) */}
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-start gap-2">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">후수 과목 (과목명 직접 입력)</label>
                      <input
                        type="text"
                        value={prereqInputTarget}
                        onChange={(e) => {
                          setPrereqInputTarget(e.target.value);
                          setTargetClosed(false);
                          setTargetActiveIdx(0);
                        }}
                        onKeyDown={(e) => handleSuggestionKey(e, {
                          matches: targetMatches,
                          visible: targetSuggestionsVisible,
                          activeIdx: targetActiveIdx,
                          setActiveIdx: setTargetActiveIdx,
                          setValue: setPrereqInputTarget,
                          setClosed: setTargetClosed,
                          currentValue: prereqInputTarget,
                          onSubmit: () => {
                            if (prereqInputTarget.trim() && prereqInputPrereq.trim()) addPrereqMapping();
                          },
                        })}
                        placeholder="예: 물질과 에너지"
                        autoComplete="off"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <PrereqSuggestions
                        query={prereqInputTarget}
                        matches={targetMatches}
                        visible={targetSuggestionsVisible}
                        activeIdx={targetActiveIdx}
                        onPick={(name) => { setPrereqInputTarget(name); setTargetClosed(true); }}
                      />
                    </div>
                    <div className="text-center text-slate-400 text-sm pt-7 hidden md:block">←</div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">선이수 과목 (과목명 직접 입력)</label>
                      <input
                        type="text"
                        value={prereqInputPrereq}
                        onChange={(e) => {
                          setPrereqInputPrereq(e.target.value);
                          setPrereqClosed(false);
                          setPrereqActiveIdx(0);
                        }}
                        onKeyDown={(e) => handleSuggestionKey(e, {
                          matches: prereqMatches,
                          visible: prereqSuggestionsVisible,
                          activeIdx: prereqActiveIdx,
                          setActiveIdx: setPrereqActiveIdx,
                          setValue: setPrereqInputPrereq,
                          setClosed: setPrereqClosed,
                          currentValue: prereqInputPrereq,
                          onSubmit: () => {
                            if (prereqInputTarget.trim() && prereqInputPrereq.trim()) addPrereqMapping();
                          },
                        })}
                        placeholder="예: 화학"
                        autoComplete="off"
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      />
                      <PrereqSuggestions
                        query={prereqInputPrereq}
                        matches={prereqMatches}
                        visible={prereqSuggestionsVisible}
                        activeIdx={prereqActiveIdx}
                        onPick={(name) => { setPrereqInputPrereq(name); setPrereqClosed(true); }}
                      />
                    </div>
                    <button
                      onClick={addPrereqMapping}
                      disabled={!prereqInputTarget.trim() || !prereqInputPrereq.trim()}
                      className="px-3 py-2 rounded-lg text-white text-sm font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed mt-5"
                    >
                      + 추가
                    </button>
                  </div>
                  <p className="text-[0.7rem] text-slate-500 mt-2 leading-relaxed">
                    📌 매핑은 <strong>과목명 단위</strong>로만 저장됩니다. 같은 이름이 여러 학기에 복수편제된 경우(예: 화학 2-1·2-2),
                    어느 학기에서 선택해도 선이수 조건이 충족됩니다 — 학기별로 따로 등록할 필요 없습니다.
                  </p>
                  <p className="text-[0.7rem] text-amber-600 mt-1 leading-relaxed">
                    ⚠️ 입력한 과목명이 등록된 과목과 정확히 일치해야 학생 화면에서 매칭됩니다.
                    아래 추천 목록을 활용하면 띄어쓰기·표기 차이를 줄일 수 있습니다.
                  </p>
                </div>

                {/* 등록된 매핑 리스트 */}
                {Object.keys(prereqMap).length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-6">
                    등록된 선이수 관계가 없습니다. 위에서 추가하세요.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {Object.entries(prereqMap).map(([target, list]) => (
                      <div key={target} className="flex flex-wrap items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl">
                        <span className="text-sm font-bold text-slate-800">{target}</span>
                        <span className="text-xs text-slate-400">←</span>
                        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                          {Array.isArray(list) && list.map((p) => (
                            <span
                              key={`${target}-${p}`}
                              className="inline-flex items-center gap-1 bg-white text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full text-xs font-medium"
                            >
                              {p}
                              <button
                                onClick={() => removePrereqMapping(target, p)}
                                className="text-amber-400 hover:text-rose-600 ml-0.5"
                                title="매핑 삭제"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={() => clearAllPrereqsFor(target)}
                          className="text-rose-500 hover:text-rose-700 text-xs ml-auto"
                          title="이 후수 과목의 모든 선이수 삭제"
                        >
                          전체 삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg text-xs text-amber-700 leading-relaxed">
                  <span className="font-semibold">예시:</span> "물질과 에너지 ← 화학" 로 등록하면 학생이 어떤 학기의 화학(2-1 또는 2-2)이라도
                  하나만 선택하면 물질과 에너지를 신청할 수 있습니다. 화학을 전혀 선택하지 않으면 물질과 에너지 카드가 자동 비활성화됩니다.
                </div>
              </Card>

              <Card>
                <SectionTitle>학기별 선택 규칙 — 현 {activeCohort}학년</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">
                  각 학기별로 학점 단위 선택 규칙을 추가하세요. (예: 4학점 과목 3개 선택) 한 코호트(현 학년) 학생이 졸업까지 거치는 6학기 모두 설정 가능합니다.
                </p>
                <div className="space-y-3">
                  {allSemesters.map(sem => {
                    const rules = ruleInputs[sem] || [];
                    return (
                      <div key={sem} className="border border-slate-100 bg-white rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold text-slate-700 text-xs">{sem.replace('-', '학년 ')}학기</h4>
                          <button onClick={() => addRule(sem)} className="text-[0.7rem] text-indigo-600 hover:underline">+ 규칙 추가</button>
                        </div>
                        {rules.length === 0 && <p className="text-[0.7rem] text-slate-400">설정된 규칙 없음</p>}
                        {rules.map((rule, idx) => (
                          <div key={idx} className="flex items-center gap-2 mb-1.5">
                            <select value={rule.credits || 'all'} onChange={e => updateRule(sem, idx, 'credits', e.target.value === 'all' ? 'all' : Number(e.target.value))}
                              className="px-2 py-1 border border-slate-200 rounded text-xs">
                              <option value="all">모든 학점</option>
                              <option value="2">2학점</option>
                              <option value="3">3학점</option>
                              <option value="4">4학점</option>
                            </select>
                            <span className="text-xs text-slate-500">과목</span>
                            <input type="number" value={rule.count || ''} onChange={e => updateRule(sem, idx, 'count', Number(e.target.value))}
                              className="w-14 px-2 py-1 border border-slate-200 rounded text-xs text-center" min="0" />
                            <span className="text-xs text-slate-500">개</span>
                            <button onClick={() => removeRule(sem, idx)} className="text-red-400 hover:text-red-600 text-xs ml-auto">삭제</button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={saveRules}
                  disabled={savingRules}
                  className="mt-6 w-full bg-indigo-600 text-white py-2.5 rounded-xl hover:bg-indigo-700 text-sm font-semibold disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {savingRules ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      저장중...
                    </>
                  ) : '규칙 저장'}
                </button>
                {saveRulesMsg && (
                  <p className={`mt-2 text-xs leading-relaxed ${
                    saveRulesMsg.startsWith('✅') ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {saveRulesMsg}
                  </p>
                )}
              </Card>

              <Card>
                <SectionTitle>과목 편제 확인 — 현 {activeCohort}학년</SectionTitle>
                <p className="text-sm text-slate-500 mb-4">선택된 코호트(편제표)의 과목이 학년-학기별로 올바르게 분류되었는지 확인하세요.</p>
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
          {tab === 'share' && <ShareTab apiUrl={apiUrl} shareUrl={shareUrl} registry={registry} setRegistry={setRegistry} loadData={loadData} />}

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
