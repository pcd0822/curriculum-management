export default function GaugeChart({
  value = 0,
  label = '',
  size = 120,
  color = '#4f46e5',
  trackColor = '#e6e8ea',
}) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const strokeWidth = size * 0.1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        {/* Center text */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <span
            className="font-bold"
            style={{
              fontSize: size * 0.22,
              color,
            }}
          >
            {clampedValue}%
          </span>
        </div>
      </div>
      {label && (
        <span
          className="text-slate-500 text-xs font-medium"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
