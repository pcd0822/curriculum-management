import React from 'react';
import type { ResponseRow, RegistryRow } from '../data/mockData';

interface SummaryCardsProps {
  readonly registry: RegistryRow[];
  readonly responses: ResponseRow[];
}

interface CardDef {
  title: string;
  value: string;
  sub: string;
  icon: string;
  color: string;
  bg: string;
}

function computeCards(registry: RegistryRow[], responses: ResponseRow[]): CardDef[] {
  const totalStudents = registry.length;
  const submitted = responses.length;
  const avgCredits =
    responses.length > 0
      ? Math.round(responses.reduce((s, r) => s + Number(r.TotalCredits), 0) / responses.length)
      : 0;
  const passed = responses.filter((r) => r.ValidationResult?.includes('통과')).length;
  const passRate = responses.length > 0 ? Math.round((passed / responses.length) * 100) : 0;

  return [
    {
      title: '전체 학생 수',
      value: `${totalStudents}명`,
      sub: '학적부 기준',
      icon: '👥',
      color: 'text-primary-600',
      bg: 'bg-primary-50',
    },
    {
      title: '수강신청 완료',
      value: `${submitted}명`,
      sub: totalStudents > 0 ? `전체 대비 ${Math.round((submitted / totalStudents) * 100)}%` : '',
      icon: '📋',
      color: 'text-violet-600',
      bg: 'bg-violet-50',
    },
    {
      title: '평균 이수 학점',
      value: `${avgCredits}`,
      sub: '기준: 174학점',
      icon: '📊',
      color: 'text-amber-500',
      bg: 'bg-amber-50',
    },
    {
      title: '검증 통과율',
      value: `${passRate}%`,
      sub: `${passed}/${responses.length}명 통과`,
      icon: '✅',
      color: 'text-emerald-500',
      bg: 'bg-emerald-50',
    },
  ];
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ registry, responses }) => {
  const cards = computeCards(registry, responses);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 hover:shadow-md transition-shadow"
        >
          <div className={`${card.bg} w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0`}>
            {card.icon}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-gray-500 font-medium">{card.title}</p>
            <p className={`text-2xl font-bold ${card.color} mt-0.5`}>{card.value}</p>
            <p className="text-xs text-gray-400 mt-1">{card.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SummaryCards;
