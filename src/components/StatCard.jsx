export default function StatCard({
  icon,
  label,
  value,
  unit = '',
  color = '#4f46e5',
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <span
            className="text-slate-500 text-xs font-medium tracking-wide"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {label}
          </span>
          <div className="flex items-baseline gap-1">
            <span
              className="text-2xl font-bold"
              style={{
                fontFamily: "'Manrope', sans-serif",
                color,
              }}
            >
              {value}
            </span>
            {unit && (
              <span
                className="text-sm text-slate-400 font-medium"
                style={{ fontFamily: "'Inter', sans-serif" }}
              >
                {unit}
              </span>
            )}
          </div>
        </div>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
          style={{ backgroundColor: `${color}12` }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
