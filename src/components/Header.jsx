export default function Header({
  title = '고교학점제',
  avatarLabel = '?',
  onAvatarClick,
}) {
  return (
    <header
      className="bg-white/90 backdrop-blur-xl flex items-center justify-between px-5 py-4 sticky top-0 z-30"
      style={{ boxShadow: '0 1px 3px rgba(25, 28, 30, 0.04)' }}
    >
      {/* Left: logo + title */}
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #3525cd, #4f46e5)',
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <span
          className="text-[#191c1e] font-extrabold text-base tracking-tight"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          {title}
        </span>
      </div>

      {/* Right: avatar */}
      <button
        onClick={onAvatarClick}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 transition-transform hover:scale-105"
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
