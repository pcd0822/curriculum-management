import React, { useState, useMemo } from 'react';
import type { ResponseRow, ConfigRow } from '../data/mockData';
import { CATEGORY_COLORS } from '../data/mockData';

interface StudentCreditDetailProps {
  readonly responses: ResponseRow[];
  readonly config: ConfigRow[];
}

interface StudentCreditBreakdown {
  studentId: string;
  name: string;
  major: string;
  totalCredits: number;
  passed: boolean;
  categories: Record<string, number>;
  selectedCount: number;
}

function buildBreakdowns(
  responses: ResponseRow[],
  config: ConfigRow[],
): StudentCreditBreakdown[] {
  const courseMap = new Map<string, ConfigRow>();
  for (const c of config) {
    courseMap.set(c.과목명, c);
  }

  return responses.map((r) => {
    const studentId = `${r.Grade}${r.Class}${r.Number}`;
    const selected = r.SelectedCourses
      ? r.SelectedCourses.split(',').map((s) => s.trim())
      : [];
    const categories: Record<string, number> = {};

    for (const courseName of selected) {
      const course = courseMap.get(courseName);
      if (course) {
        const cat = course.교과군 || '기타';
        categories[cat] = (categories[cat] ?? 0) + Number(course.학점);
      }
    }

    return {
      studentId,
      name: r.Name,
      major: r.Major,
      totalCredits: Number(r.TotalCredits),
      passed: r.ValidationResult?.includes('통과') ?? false,
      categories,
      selectedCount: selected.length,
    };
  });
}

const CreditBar: React.FC<{
  readonly category: string;
  readonly credits: number;
  readonly maxCredits: number;
}> = ({ category, credits, maxCredits }) => {
  const pct = maxCredits > 0 ? Math.min((credits / maxCredits) * 100, 100) : 0;
  const color = CATEGORY_COLORS[category] ?? '#94a3b8';

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-16 shrink-0 text-right">{category}</span>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-700 w-12 shrink-0">{credits}학점</span>
    </div>
  );
};

export const StudentCreditDetail: React.FC<StudentCreditDetailProps> = ({
  responses,
  config,
}) => {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'credits' | 'status'>('name');

  const breakdowns = useMemo(() => buildBreakdowns(responses, config), [responses, config]);

  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const c of config) cats.add(c.교과군 || '기타');
    return Array.from(cats);
  }, [config]);

  const maxCategoryCredits = useMemo(() => {
    let max = 0;
    for (const b of breakdowns) {
      for (const v of Object.values(b.categories)) {
        if (v > max) max = v;
      }
    }
    return Math.max(max, 1);
  }, [breakdowns]);

  const filtered = useMemo(() => {
    let list = breakdowns;
    if (search) {
      list = list.filter(
        (b) =>
          b.name.includes(search) ||
          b.major.includes(search) ||
          b.studentId.includes(search),
      );
    }
    return list.sort((a, b) => {
      if (sortBy === 'credits') return b.totalCredits - a.totalCredits;
      if (sortBy === 'status') return (a.passed ? 0 : 1) - (b.passed ? 0 : 1);
      return a.name.localeCompare(b.name);
    });
  }, [breakdowns, search, sortBy]);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-semibold text-gray-800">
            학생별 교과군 이수 현황
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            학생별 교과군 학점 분포를 시각적으로 확인합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300 w-40"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'credits' | 'status')}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <option value="name">이름순</option>
            <option value="credits">학점순</option>
            <option value="status">통과순</option>
          </select>
        </div>
      </div>

      {/* Category Legend */}
      <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-gray-100">
        {allCategories.map((cat) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#94a3b8' }}
            />
            <span className="text-xs text-gray-500">{cat}</span>
          </div>
        ))}
      </div>

      {/* Student Cards */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-400">해당하는 학생이 없습니다.</p>
        ) : (
          filtered.map((student) => (
            <div
              key={student.studentId}
              className="border border-gray-100 rounded-xl p-4 hover:border-primary-200 transition-colors"
            >
              {/* Student Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-sm font-bold text-primary-600">
                    {student.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {student.name}
                      <span className="font-mono text-gray-400 font-normal ml-2">
                        {student.studentId}
                      </span>
                    </p>
                    <p className="text-xs text-gray-400">{student.major}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${
                        student.totalCredits >= 174
                          ? 'text-primary-600'
                          : 'text-rose-500'
                      }`}
                    >
                      {student.totalCredits}
                      <span className="text-xs font-normal text-gray-400 ml-0.5">
                        / 174학점
                      </span>
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      student.passed
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-rose-50 text-rose-600'
                    }`}
                  >
                    {student.passed ? '통과' : '미통과'}
                  </span>
                </div>
              </div>

              {/* Category Bars */}
              <div className="space-y-1.5">
                {allCategories.map((cat) => (
                  <CreditBar
                    key={cat}
                    category={cat}
                    credits={student.categories[cat] ?? 0}
                    maxCredits={maxCategoryCredits}
                  />
                ))}
              </div>

              {/* Footer */}
              <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-4 text-xs text-gray-400">
                <span>선택 과목: {student.selectedCount}개</span>
                <span>
                  교과군: {Object.keys(student.categories).length}/{allCategories.length}개
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default StudentCreditDetail;
