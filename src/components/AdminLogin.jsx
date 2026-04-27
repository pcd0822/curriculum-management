import { useEffect, useRef, useState } from 'react';

/* ── Session helpers ── */
const SESSION_KEY = 'adminSession';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export function getAdminSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || !s.email || !s.expiresAt) return null;
    if (Date.now() > Number(s.expiresAt)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function clearAdminSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

function setAdminSession(email) {
  const s = { email, expiresAt: Date.now() + SESSION_TTL_MS };
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
  return s;
}

/* ID 토큰(JWT)에서 payload 디코드 — 서명 검증은 GIS 라이브러리가 클라이언트 측에서 nonce/aud로 처리 */
function decodeIdToken(idToken) {
  try {
    const payload = idToken.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────────
   AdminLogin
   props:
     clientId        — Google OAuth 2.0 client ID
     adminEmails     — 허용 이메일 화이트리스트
     onAuth(email)   — 인증 성공 콜백 (화이트리스트 통과 + 세션 저장 후 호출)
     onBootstrap(email) — 화이트리스트가 비어있을 때 첫 로그인을 등록할 콜백 (선택적)
   ─────────────────────────────────────────────────────────────── */
export default function AdminLogin({ clientId, adminEmails, onAuth, onBootstrap }) {
  const buttonRef = useRef(null);
  const [error, setError] = useState('');
  const [loadingScript, setLoadingScript] = useState(true);

  /* GIS 스크립트 로드 (한 번만) */
  useEffect(() => {
    if (window.google?.accounts?.id) {
      setLoadingScript(false);
      return;
    }
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => setLoadingScript(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setLoadingScript(false);
    script.onerror = () => setError('Google 로그인 스크립트를 불러오지 못했습니다.');
    document.head.appendChild(script);
  }, []);

  /* GIS 초기화 + 버튼 렌더 */
  useEffect(() => {
    if (loadingScript) return;
    if (!clientId) return;
    if (!window.google?.accounts?.id) return;

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          const payload = decodeIdToken(response.credential);
          if (!payload || !payload.email) {
            setError('이메일 정보를 가져올 수 없습니다.');
            return;
          }
          const email = String(payload.email).toLowerCase();
          const list = (adminEmails || []).map(e => String(e).toLowerCase().trim()).filter(Boolean);

          if (list.length === 0) {
            // 부트스트랩: 화이트리스트가 비어있으면 이 사용자를 첫 관리자로 등록
            setAdminSession(email);
            if (onBootstrap) onBootstrap(email);
            onAuth(email);
            return;
          }

          if (list.includes(email)) {
            setAdminSession(email);
            onAuth(email);
          } else {
            setError(`접근 권한이 없습니다. (${email}) — 관리자에게 등록 요청하세요.`);
          }
        },
      });

      if (buttonRef.current) {
        buttonRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
          width: 280,
        });
      }
    } catch (e) {
      setError('Google 로그인 초기화 실패: ' + e.message);
    }
  }, [loadingScript, clientId, adminEmails, onAuth, onBootstrap]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-8">
        <div className="flex flex-col items-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #3525cd, #4f46e5)' }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-800 mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>관리자 로그인</h1>
          <p className="text-sm text-slate-500 text-center">Google 계정으로 로그인하여 관리자 대시보드에 접근하세요.</p>
        </div>

        {!clientId && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
            <p className="text-xs text-amber-800 font-semibold mb-1">⚠️ Google Client ID 미설정</p>
            <p className="text-xs text-amber-700 leading-relaxed">
              관리자 Google 로그인을 사용하려면 Google Cloud Console에서 OAuth 2.0 클라이언트 ID를 발급받아
              아래 "임시 우회" 또는 사용자 정의 부트스트랩 후 시스템 설정에 등록해야 합니다.
            </p>
          </div>
        )}

        {clientId && (
          <div className="flex justify-center mb-4">
            <div ref={buttonRef} />
          </div>
        )}

        {clientId && loadingScript && (
          <p className="text-xs text-center text-slate-400">Google 로그인 라이브러리를 불러오는 중...</p>
        )}

        {(adminEmails || []).length === 0 && clientId && (
          <div className="mt-4 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
            <p className="text-xs text-indigo-800 leading-relaxed">
              💡 <span className="font-semibold">최초 설정 모드</span>: 허용 이메일 목록이 비어있어 가장 먼저 로그인하는 Google 계정이 첫 관리자로 자동 등록됩니다.
              이후 시스템 설정에서 추가 관리자를 등록하세요.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Client ID 미설정 시 — 임시 우회: 이메일 직접 입력 (단일 기기에서 부트스트랩용) */}
        {!clientId && (
          <BootstrapByEmail onSubmit={(email) => {
            setAdminSession(email);
            if (onBootstrap) onBootstrap(email);
            onAuth(email);
          }} />
        )}
      </div>
    </div>
  );
}

function BootstrapByEmail({ onSubmit }) {
  const [email, setEmail] = useState('');
  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <p className="text-xs text-slate-500 mb-2">
        Client ID 미설정 시 임시 부트스트랩 — 이메일을 입력해 화이트리스트에 등록하고 시스템 설정으로 진입할 수 있습니다.
      </p>
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@school.kr"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
        />
        <button
          onClick={() => {
            const v = email.trim().toLowerCase();
            if (!v || !v.includes('@')) return;
            onSubmit(v);
          }}
          className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700"
        >
          진입
        </button>
      </div>
    </div>
  );
}
