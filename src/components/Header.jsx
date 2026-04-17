export default function Header({
  title = 'Scholaris Core',
  avatarLabel = '?',
  onAvatarClick,
}) {
  return (
    <header className="bg-white flex items-center justify-between px-5 py-4">
      {/* Left: logo + title */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
        </div>
        <span
          className="text-slate-800 font-bold text-base tracking-tight"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {title}
        </span>
      </div>

      {/* Right: avatar */}
      <button
        onClick={onAvatarClick}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {avatarLabel}
      </button>
    </header>
  );
}
