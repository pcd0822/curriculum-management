import React from 'react';
import type { ResponseRow, ConfigRow } from '../data/mockData';

interface ComplianceGaugesProps {
  readonly responses: ResponseRow[];
  readonly config: ConfigRow[];
}

interface GaugeData {
  label: string;
  current: number;
  target: number;
  unit: string;
  inverted?: boolean;
}

function computeGauges(responses: ResponseRow[], config: ConfigRow[]): GaugeData[] {
  if (responses.length === 0) {
    return [
      { label: '총 이수 학점', current: 0, target: 174, unit: '학점' },
      { label: '기초교과 비율', current: 0, target: 50, unit: '%', inverted: true },
      { label: '예술교과 학점', current: 0, target: 10, unit: '학점' },
      { label: '교양교과 학점', current: 0, target: 16, unit: '학점' },
    ];
  }

  const avgCredits = Math.round(
    responses.reduce((s, r) => s + Number(r.TotalCredits), 0) / responses.length,
  );

  const categoryCreditsMap: Record<string, number> = {};
  for (const c of config) {
    const cat = c.교과군 || '기타';
    categoryCreditsMap[cat] = (categoryCreditsMap[cat] ?? 0) + Number(c.학점);
  }
  const totalConfigCredits = Object.values(categoryCreditsMap).reduce((a, b) => a + b, 0);
  const basicRatio =
    totalConfigCredits > 0
      ? Math.round(((categoryCreditsMap['기초교과'] ?? 0) / totalConfigCredits) * 100)
      : 0;
  const artCredits = categoryCreditsMap['예술교과'] ?? 0;
  const liberalCredits = categoryCreditsMap['교양교과'] ?? 0;

  return [
    { label: '평균 이수 학점', current: avgCredits, target: 174, unit: '학점' },
    { label: '기초교과 비율', current: basicRatio, target: 50, unit: '%', inverted: true },
    { label: '예술교과 학점', current: artCredits, target: 10, unit: '학점' },
    { label: '교양교과 학점', current: liberalCredits, target: 16, unit: '학점' },
  ];
}

const GaugeRing: React.FC<{ readonly pct: number; readonly color: string; readonly passed: boolean }> = ({
  pct,
  color,
  passed,
}) => {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(pct, 100) / 100) * circ;

  return (
    <svg width={100} height={100} className="shrink-0">
      <circle cx={50} cy={50} r={r} fill="none" stroke="#f1f5f9" strokeWidth={8} />
      <circle
        cx={50}
        cy={50}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 50 50)"
        className="transition-all duration-700"
      />
      <text x={50} y={46} textAnchor="middle" className="text-sm font-bold" fill="#1e293b">
        {Math.round(pct)}%
      </text>
      <text x={50} y={62} textAnchor="middle" className="text-[10px]" fill={passed ? '#10b981' : '#f43f5e'}>
        {passed ? '충족' : '미충족'}
      </text>
    </svg>
  );
};

export const ComplianceGauges: React.FC<ComplianceGaugesProps> = ({ responses, config }) => {
  const gauges = computeGauges(responses, config);

  const colors = ['#6366f1', '#8b5cf6', '#f59e0b', '#10b981'];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-5">이수 기준 충족 현황</h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {gauges.map((g, i) => {
          const pct = g.inverted
            ? g.current <= g.target ? 100 : Math.round(((g.target * 2 - g.current) / g.target) * 100)
            : Math.min(Math.round((g.current / g.target) * 100), 100);
          const passed = g.inverted ? g.current <= g.target : g.current >= g.target;

          return (
            <div key={g.label} className="flex flex-col items-center gap-2">
              <GaugeRing pct={Math.max(pct, 0)} color={colors[i]} passed={passed} />
              <div className="text-center">
                <p className="text-xs font-medium text-gray-600">{g.label}</p>
                <p className="text-sm font-semibold text-gray-800">
                  {g.current}{g.unit}
                  <span className="text-gray-400 font-normal">
                    {g.inverted ? ` / ${g.target}${g.unit} 이하` : ` / ${g.target}${g.unit}`}
                  </span>
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComplianceGauges;
