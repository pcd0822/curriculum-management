const CATEGORY_STYLES = {
  '기초교과': { bg: '#e2dfff', text: '#3525cd', icon: '📐' },
  '탐구교과': { bg: '#d1fae5', text: '#005338', icon: '🔬' },
  '예술교과': { bg: '#fce7f3', text: '#9d174d', icon: '🎨' },
  '체육교과': { bg: '#fee2e2', text: '#991b1b', icon: '🏃' },
  '교양교과': { bg: '#fef3c7', text: '#92400e', icon: '📚' },
};

export default function CourseCard({
  course,
  selected = false,
  recommended = false,
  required = false,
  disabled = false,
  hint = '',
  joint = false,
  host = '',
  schedule = '',
  onToggle,
}) {
  const { subjectName, credits, category, subCategory, prerequisites } = course;
  const style = CATEGORY_STYLES[category] || CATEGORY_STYLES['교양교과'];
  const prereqList = Array.isArray(prerequisites) ? prerequisites : [];

  return (
    <div
      className={`bg-white rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-all ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${selected ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
      style={{
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}
      title={hint || ''}
      onClick={(e) => {
        if (disabled) {
          if (hint) alert(hint);
          return;
        }
        onToggle?.(e);
      }}
    >
      {/* Category icon */}
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
        style={{ backgroundColor: style.bg }}
      >
        {style.icon}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Badges */}
        <div className="flex flex-wrap gap-1 mb-1">
          {subCategory && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-white font-semibold"
              style={{
                fontSize: '0.6rem',
                backgroundColor: '#4f46e5',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              {subCategory}
            </span>
          )}
          {recommended && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-white font-semibold"
              style={{
                fontSize: '0.6rem',
                backgroundColor: '#7c3aed',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              추천
            </span>
          )}
          {required && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-white font-semibold"
              style={{
                fontSize: '0.6rem',
                backgroundColor: '#dc2626',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              필수
            </span>
          )}
          {joint && (
            <span
              className="inline-block px-1.5 py-0.5 rounded text-white font-semibold"
              style={{
                fontSize: '0.6rem',
                backgroundColor: '#7c3aed',
                fontFamily: "'Inter', sans-serif",
                lineHeight: 1.2,
              }}
            >
              공동교육
            </span>
          )}
        </div>

        {/* Name + credits */}
        <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
          {subjectName}
        </p>
        <p
          className="text-xs text-slate-400 mt-0.5"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {credits}학점
          {prereqList.length > 0 && (
            <span className="ml-2 text-[0.65rem] text-amber-600">
              · 선이수: {prereqList.join(', ')}
            </span>
          )}
        </p>
        {joint && (host || schedule) && (
          <p className="text-[0.65rem] text-violet-600 mt-0.5">
            {host && <>🏫 {host}</>}
            {host && schedule && <span className="mx-1 text-slate-300">·</span>}
            {schedule && <>🕒 {schedule}</>}
          </p>
        )}
        {disabled && hint && !required && (
          <p className="text-[0.65rem] text-rose-500 mt-1 leading-tight line-clamp-2">{hint}</p>
        )}
      </div>

      {/* Checkbox */}
      <div className="flex-shrink-0">
        <div
          className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${
            selected
              ? 'bg-indigo-600 border-indigo-600'
              : 'border-slate-300 bg-white'
          }`}
        >
          {selected && (
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
