import React, { useState, useMemo } from 'react';
import type { ResponseRow } from '../data/mockData';

interface StudentTableProps {
  readonly responses: ResponseRow[];
}

export const StudentTable: React.FC<StudentTableProps> = ({ responses }) => {
  const [search, setSearch] = useState('');
  const [filterPass, setFilterPass] = useState<'all' | 'pass' | 'fail'>('all');

  const filtered = useMemo(() => {
    return responses.filter((r) => {
      const matchSearch =
        !search ||
        r.Name.includes(search) ||
        r.Major.includes(search) ||
        `${r.Grade}${r.Class}${r.Number}`.includes(search);

      const isPassed = r.ValidationResult?.includes('통과');
      const matchFilter =
        filterPass === 'all' ||
        (filterPass === 'pass' && isPassed) ||
        (filterPass === 'fail' && !isPassed);

      return matchSearch && matchFilter;
    });
  }, [responses, search, filterPass]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h3 className="text-base font-semibold text-gray-800">학생별 이수 현황</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="이름, 학번, 진로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300 w-48"
          />
          <select
            value={filterPass}
            onChange={(e) => setFilterPass(e.target.value as 'all' | 'pass' | 'fail')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="all">전체</option>
            <option value="pass">통과</option>
            <option value="fail">미통과</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-3 px-3 text-gray-500 font-medium">학번</th>
              <th className="text-left py-3 px-3 text-gray-500 font-medium">이름</th>
              <th className="text-left py-3 px-3 text-gray-500 font-medium">희망 진로</th>
              <th className="text-right py-3 px-3 text-gray-500 font-medium">총 학점</th>
              <th className="text-center py-3 px-3 text-gray-500 font-medium">검증 결과</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  해당하는 학생이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((r, i) => {
                const studentId = `${r.Grade}${r.Class}${r.Number}`;
                const isPassed = r.ValidationResult?.includes('통과');
                return (
                  <tr
                    key={`${studentId}-${i}`}
                    className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="py-3 px-3 font-mono text-gray-700">{studentId}</td>
                    <td className="py-3 px-3 font-medium text-gray-800">{r.Name}</td>
                    <td className="py-3 px-3 text-gray-600">{r.Major}</td>
                    <td className="py-3 px-3 text-right">
                      <span
                        className={`font-semibold ${
                          Number(r.TotalCredits) >= 174 ? 'text-primary-600' : 'text-rose-500'
                        }`}
                      >
                        {r.TotalCredits}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          isPassed
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {isPassed ? '통과' : '미통과'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentTable;
