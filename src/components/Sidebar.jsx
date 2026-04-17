import { Link } from 'react-router-dom';

const navItems = [
  {
    label: 'Dashboard',
    path: '/admin',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    label: 'Credit Status',
    path: '/credits',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: 'Course Registration',
    path: '/courses',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    label: 'Graduation Diagnosis',
    path: '/admin/graduation',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 2 4 3 6 3s6-1 6-3v-5" />
      </svg>
    ),
  },
];

export default function Sidebar({ activePath = '' }) {
  return (
    <aside
      className="fixed left-0 top-0 bottom-0 flex flex-col justify-between"
      style={{
        width: '240px',
        backgroundColor: '#0f172a',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
    >
      {/* Logo */}
      <div>
        <div className="flex items-center gap-3 px-5 py-6">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
          <span
            className="text-white font-bold text-base tracking-tight"
            style={{ fontFamily: "'Manrope', sans-serif" }}
          >
            Academic Curator
          </span>
        </div>

        {/* Nav Items */}
        <nav className="mt-2 px-3 flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive =
              activePath === item.path ||
              (item.path !== '/admin' && activePath.startsWith(item.path));
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-full text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Bottom User */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          AD
        </div>
        <div className="flex flex-col">
          <span className="text-white text-sm font-medium leading-tight">AD</span>
          <span className="text-slate-400 text-xs leading-tight">관리자 계정</span>
        </div>
      </div>
    </aside>
  );
}
