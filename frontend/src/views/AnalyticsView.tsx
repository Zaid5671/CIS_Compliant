import React from 'react';
import { BarChart3, PieChart, Activity, Clock, ShieldAlert } from 'lucide-react';
import { ScanReport } from '../types';

interface AnalyticsViewProps {
  report: ScanReport | null;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ report }) => {
  if (!report) {
    return (
      <div className="p-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 max-w-xl mx-auto my-12 text-zinc-400 text-xs">
        No active scan data available. Execute an audit to inspect analytics charts.
      </div>
    );
  }

  const { summary } = report;
  const categoryRisk = summary.category_risk || {};
  const sortedCategories = Object.entries(categoryRisk);

  const totalEvaluated = (summary.passed || 0) + (summary.failed || 0) + (summary.manual || 0) + (summary.warn || 0);

  return (
    <div className="space-y-6">
      {/* Top Metric Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
          <span className="text-xs text-zinc-400 font-medium">Compliance Index</span>
          <div className="text-3xl font-extrabold text-white mt-1">{summary.score}%</div>
          <div className="w-full bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full ${summary.score >= 70 ? 'bg-emerald-500' : 'bg-amber-500'}`}
              style={{ width: `${summary.score}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Scan Duration</span>
            <div className="text-2xl font-bold text-white mt-1">{(report.duration_ms / 1000).toFixed(2)}s</div>
            <span className="text-[11px] text-zinc-400">Total audit execution time</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Critical / High Exposure</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {(summary.severity_counts?.critical || 0) + (summary.severity_counts?.high || 0)}
            </div>
            <span className="text-[11px] text-zinc-400">High-priority remediation targets</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Visual Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown Bar */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-400" />
            Evaluation Status Mix
          </h3>

          <div className="space-y-3 pt-2">
            {[
              { label: 'Passed Controls', count: summary.passed || 0, color: 'bg-emerald-500', text: 'text-emerald-400' },
              { label: 'Failed Deviations', count: summary.failed || 0, color: 'bg-rose-500', text: 'text-rose-400' },
              { label: 'Warnings', count: summary.warn || 0, color: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Manual Checks', count: summary.manual || 0, color: 'bg-blue-500', text: 'text-blue-400' },
            ].map((item) => {
              const pct = totalEvaluated > 0 ? Math.round((item.count / totalEvaluated) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{item.label}</span>
                    <span className={`font-mono font-bold ${item.text}`}>{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Severity Exposure Breakdown */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Severity Exposure
          </h3>

          <div className="space-y-3 pt-2">
            {[
              { level: 'Critical', count: summary.severity_counts?.critical || 0, color: 'bg-rose-500', text: 'text-rose-400' },
              { level: 'High', count: summary.severity_counts?.high || 0, color: 'bg-orange-500', text: 'text-orange-400' },
              { level: 'Medium', count: summary.severity_counts?.medium || 0, color: 'bg-amber-500', text: 'text-amber-400' },
              { level: 'Low / Informational', count: (summary.severity_counts?.low || 0) + (summary.severity_counts?.info || 0), color: 'bg-blue-500', text: 'text-blue-400' },
            ].map((item) => {
              const pct = summary.total > 0 ? Math.round((item.count / summary.total) * 100) : 0;
              return (
                <div key={item.level} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{item.level}</span>
                    <span className={`font-mono font-bold ${item.text}`}>{item.count} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Category Risk Ranking */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <h3 className="text-sm font-bold text-white">Risk Exposure by Benchmark Category</h3>
        <p className="text-xs text-zinc-400">Weighted risk penalty calculated from failing controls</p>

        <div className="space-y-2 pt-2">
          {sortedCategories.length === 0 ? (
            <p className="text-xs text-zinc-400">No category risk recorded.</p>
          ) : (
            sortedCategories.map(([cat, risk]) => (
              <div key={cat} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-between">
                <span className="font-semibold text-xs text-zinc-200">{cat || 'General'}</span>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                  Risk Score: {risk}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

