import { BrowserRouter, Routes, Route, Outlet, Link } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CoursesPage from './pages/CoursesPage';
import CreditsPage from './pages/CreditsPage';
import AdminPage from './pages/AdminPage';
import CareerPage from './pages/CareerPage';
import AiRecommendPage from './pages/AiRecommendPage';
import ProfilePage from './pages/ProfilePage';

function Layout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Outlet />
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ backgroundColor: '#f7f9fb' }}>
      {/* Hero icon */}
      <div
        className="w-18 h-18 rounded-2xl flex items-center justify-center mb-6"
        style={{
          width: '72px',
          height: '72px',
          background: 'linear-gradient(135deg, #3525cd, #4f46e5)',
          boxShadow: '0 8px 32px rgba(79,70,229,0.25)',
        }}
      >
        <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>

      <h1 className="text-2xl font-extrabold text-[#191c1e] mb-1" style={{ fontFamily: "'Manrope', sans-serif" }}>고교학점제</h1>
      <h2 className="text-lg font-bold text-[#4f46e5] mb-2" style={{ fontFamily: "'Manrope', sans-serif" }}>진로학업설계</h2>
      <p className="text-[#777587] text-sm mb-10 max-w-xs" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>수강신청 · 진로탐색 · 학점관리 통합 플랫폼</p>

      {/* Menu grid */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        {[
          { to: '/login', icon: '🎓', label: '학생 로그인' },
          { to: '/courses', icon: '📚', label: '수강신청' },
          { to: '/career', icon: '🧭', label: '진로탐색' },
          { to: '/credits', icon: '📊', label: '이수현황' },
        ].map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className="flex flex-col items-center gap-2.5 bg-white rounded-2xl p-5 transition-all hover:scale-[1.02]"
            style={{ boxShadow: '0 1px 3px rgba(25,28,30,0.04), 0 4px 12px rgba(25,28,30,0.03)' }}
          >
            <span className="text-2xl">{item.icon}</span>
            <span className="text-sm font-semibold text-[#191c1e]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{item.label}</span>
          </Link>
        ))}
      </div>

      <Link
        to="/admin"
        className="mt-8 text-xs text-[#777587] hover:text-[#4f46e5] transition-colors font-medium"
        style={{ fontFamily: "'Inter', sans-serif" }}
      >
        관리자 대시보드 →
      </Link>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/ai" element={<AiRecommendPage />} />
          <Route path="/career" element={<CareerPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
