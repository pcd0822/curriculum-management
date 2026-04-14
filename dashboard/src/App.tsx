import { useState } from 'react';
import { useDashboardData } from './hooks/useDashboardData';
import { SummaryCards } from './components/SummaryCards';
import { CategoryDonutChart } from './components/CategoryDonutChart';
import { SemesterBarChart } from './components/SemesterBarChart';
import { StudentTable } from './components/StudentTable';
import { ComplianceGauges } from './components/ComplianceGauges';
import { StudentCreditDetail } from './components/StudentCreditDetail';

type TabId = 'overview' | 'detail';

function App() {
  const { config, responses, registry, settings, loading, error, refresh } = useDashboardData();
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {settings.schoolName || '고교학점제'} 학점 이수 현황
            </h1>
            <p className="text-sm text-gray-500 mt-1">교육과정 이수 현황 대시보드</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            {/* Tab buttons */}
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'overview'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                종합 현황
              </button>
              <button
                onClick={() => setActiveTab('detail')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeTab === 'detail'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                학생별 상세
              </button>
            </div>
            <button
              onClick={refresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                  <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              새로고침
            </button>
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center space-y-3">
              <svg className="animate-spin h-10 w-10 text-primary-500 mx-auto" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
              </svg>
              <p className="text-gray-500">데이터를 불러오는 중...</p>
            </div>
          </div>
        ) : activeTab === 'overview' ? (
          <>
            {/* Summary Cards */}
            <SummaryCards registry={registry} responses={responses} />

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CategoryDonutChart config={config} />
              <SemesterBarChart config={config} />
            </div>

            {/* Compliance Gauges */}
            <ComplianceGauges responses={responses} config={config} />

            {/* Student Table */}
            <StudentTable responses={responses} />
          </>
        ) : (
          <>
            {/* Summary Cards */}
            <SummaryCards registry={registry} responses={responses} />

            {/* Student Credit Detail */}
            <StudentCreditDetail responses={responses} config={config} />
          </>
        )}
      </div>
    </div>
  );
}

export default App;
