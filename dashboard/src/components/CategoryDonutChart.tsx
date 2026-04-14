import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ConfigRow } from '../data/mockData';
import { CATEGORY_COLORS } from '../data/mockData';

interface CategoryDonutChartProps {
  readonly config: ConfigRow[];
}

function aggregateByCategory(config: ConfigRow[]) {
  const map = new Map<string, number>();
  for (const c of config) {
    const cat = c.교과군 || '기타';
    map.set(cat, (map.get(cat) ?? 0) + Number(c.학점));
  }
  return Array.from(map, ([name, value]) => ({ name, value }));
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number }> }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 text-sm">
      <p className="font-semibold text-gray-800">{payload[0].name}</p>
      <p className="text-gray-500">{payload[0].value}학점</p>
    </div>
  );
};

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ config }) => {
  const data = aggregateByCategory(config);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-base font-semibold text-gray-800 mb-4">교과군별 학점 분포</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={65}
            outerRadius={100}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            formatter={(value: string) => <span className="text-sm text-gray-600">{value}</span>}
            iconType="circle"
            iconSize={8}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CategoryDonutChart;
