import { BrowserRouter, Routes, Route, Outlet, Link } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import CoursesPage from './pages/CoursesPage';
import CreditsPage from './pages/CreditsPage';
import AdminPage from './pages/AdminPage';
import CareerPage from './pages/CareerPage';

function Layout() {
  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <Outlet />
    </div>
  );
}

function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#3525cd] to-[#4f46e5] flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
      </div>
      <h1 className="font-display text-3xl font-extrabold text-[#191c1e] mb-2">Scholaris Core</h1>
      <p className="text-[#777587] text-sm mb-10 max-w-xs">고교학점제 수강신청 · 진로탐색 · 학점관리 통합 플랫폼</p>
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <Link to="/login" className="flex flex-col items-center gap-2 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-2xl">🎓</span>
          <span className="text-sm font-semibold text-[#191c1e]">학생 로그인</span>
        </Link>
        <Link to="/courses" className="flex flex-col items-center gap-2 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-2xl">📚</span>
          <span className="text-sm font-semibold text-[#191c1e]">수강신청</span>
        </Link>
        <Link to="/career" className="flex flex-col items-center gap-2 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-2xl">🧭</span>
          <span className="text-sm font-semibold text-[#191c1e]">진로탐색</span>
        </Link>
        <Link to="/credits" className="flex flex-col items-center gap-2 bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <span className="text-2xl">📊</span>
          <span className="text-sm font-semibold text-[#191c1e]">이수현황</span>
        </Link>
      </div>
      <Link to="/admin" className="mt-6 text-xs text-[#777587] hover:text-[#4f46e5] transition-colors">관리자 대시보드 →</Link>
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
          <Route path="/career" element={<CareerPage />} />
          <Route path="/credits" element={<CreditsPage />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
