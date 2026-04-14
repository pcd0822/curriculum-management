import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { ConfigRow } from '../data/mockData';

interface SemesterBarChartProps {
  readonly config: ConfigRow[];
}

function aggregateBySemester(config: ConfigRow[]) {
  const map = new Map<string, number>();
  for (const c of config) {
    const key = `${c.학년}학년 ${c.학기}학기`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return Array.from(map, ([name, count]) => ({ name, count })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{label}</p>
      <p className="text-gray-500">{payload[0].value}개 과목</p>
    </div>
  );
};

export const SemesterBarChart: React.FC<SemesterBarChartProps> = ({ config }) => {
  const data = aggregateBySemester(config);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">학년-학기별 개설 과목 수</h3>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis tick={{ fontSize: 12, fill: '#64748b' }} allowDecimals={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="#6366f1" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SemesterBarChart;
