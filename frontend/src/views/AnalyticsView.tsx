import React from 'react';
import { 
  BarChart3, 
  PieChart, 
  Activity, 
  Clock, 
  ShieldAlert, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  ExternalLink 
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { AnalyticsSummary, FleetSummary, ScanReport } from '../types';

interface AnalyticsViewProps {
  report: ScanReport | null;
  fleet: FleetSummary | null;
  analytics: AnalyticsSummary | null;
  onNavigateTab?: (tab: string) => void;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  report,
  fleet,
  analytics,
  onNavigateTab,
}) => {
  const fleetScore = fleet?.fleet_score ?? (report?.summary?.score ?? 0);
  const totalAssets = fleet?.total_assets ?? (report ? 1 : 0);
  const timeline = analytics?.timeline || [];
  const topFailing = analytics?.top_failing_controls || [];

  // Format timeline data for Recharts
  const chartData = timeline.map((t, idx) => {
    let dateLabel = `Scan #${idx + 1}`;
    if (t.date) {
      try {
        const d = new Date(t.date);
        dateLabel = d.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch {
        dateLabel = t.date;
      }
    }
    return {
      index: idx + 1,
      dateLabel,
      score: t.score,
      asset: t.asset_name,
      category: t.category,
      passed: t.passed,
      failed: t.failed,
      total: t.total,
    };
  });

  // Cross-Asset Severity comparison data
  const crossSeverity = analytics?.cross_asset_severity || {
    windows: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    linux: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    firewall: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
    network: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
  };

  const severityBarData = [
    {
      category: 'Windows',
      Critical: crossSeverity.windows?.CRITICAL ?? 0,
      High: crossSeverity.windows?.HIGH ?? 0,
      Medium: crossSeverity.windows?.MEDIUM ?? 0,
    },
    {
      category: 'Linux',
      Critical: crossSeverity.linux?.CRITICAL ?? 0,
      High: crossSeverity.linux?.HIGH ?? 0,
      Medium: crossSeverity.linux?.MEDIUM ?? 0,
    },
    {
      category: 'Firewall',
      Critical: crossSeverity.firewall?.CRITICAL ?? 0,
      High: crossSeverity.firewall?.HIGH ?? 0,
      Medium: crossSeverity.firewall?.MEDIUM ?? 0,
    },
    {
      category: 'Network',
      Critical: crossSeverity.network?.CRITICAL ?? 0,
      High: crossSeverity.network?.HIGH ?? 0,
      Medium: crossSeverity.network?.MEDIUM ?? 0,
    },
  ];

  const getSeverityBadge = (sev: string) => {
    const s = sev?.toUpperCase();
    switch (s) {
      case 'CRITICAL':
        return <span className="text-[10px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">CRITICAL</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/30">HIGH</span>;
      case 'MEDIUM':
        return <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">MEDIUM</span>;
      default:
        return <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">LOW</span>;
    }
  };

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* Top Metric Strip */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
          <span className="text-xs text-zinc-400 font-medium">Fleet Compliance Index</span>
          <div className="text-3xl font-extrabold text-white mt-1">{fleetScore}%</div>
          <div className="w-full bg-zinc-800 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full ${fleetScore >= 70 ? 'bg-emerald-500' : fleetScore >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
              style={{ width: `${fleetScore}%` }}
            />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Historical Audits</span>
            <div className="text-2xl font-bold text-white mt-1">{timeline.length}</div>
            <span className="text-[11px] text-zinc-400">Total recorded scan events</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-400 font-medium">Active Fleet Assets</span>
            <div className="text-2xl font-bold text-white mt-1">{totalAssets}</div>
            <span className="text-[11px] text-zinc-400">Heterogeneous appliances</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-rose-400">Total Deviations</span>
            <div className="text-2xl font-bold text-rose-400 mt-1">
              {fleet?.total_failed ?? (report?.summary?.failed ?? 0)}
            </div>
            <span className="text-[11px] text-zinc-400">Requiring hardening fixes</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Compliance Drift & Hardening Timeline */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <span>Compliance Drift & Hardening Timeline</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Historical compliance scores over time. Measures security improvement across successive audits.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
            <span>Score (%)</span>
          </div>
        </div>

        <div className="h-64 w-full pt-4">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333ea" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#9333ea" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="dateLabel" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis domain={[0, 100]} stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 shadow-xl text-xs space-y-1">
                          <p className="font-bold text-white">{data.asset}</p>
                          <p className="text-purple-400 font-mono font-bold">Compliance Score: {data.score}%</p>
                          <p className="text-zinc-400 text-[11px]">{data.passed} passed / {data.total} total checks</p>
                          <p className="text-zinc-500 text-[10px]">{data.dateLabel}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#a855f7"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#scoreGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
              No historical data available. Run audits to plot compliance drift over time.
            </div>
          )}
        </div>
      </div>

      {/* Top Systemic Security Deviations (Pareto Principle) */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <span>Top Systemic Security Deviations</span>
              <span className="text-[11px] font-normal text-zinc-400">(Pareto Analysis)</span>
            </h3>
            <p className="text-xs text-zinc-400">
              Most frequent CIS control failures occurring across multiple machines in your organization
            </p>
          </div>
          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('findings')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
            >
              Remediation Playbook &rarr;
            </button>
          )}
        </div>

        {topFailing.length === 0 ? (
          <div className="p-8 text-center rounded-xl bg-zinc-950/40 border border-zinc-800/60 text-zinc-400 text-xs">
            No systemic multi-asset failures detected. All evaluated systems are currently adhering to tested baseline controls.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {topFailing.map((ctl) => (
              <div
                key={ctl.id}
                className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800 hover:border-purple-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-purple-300 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      CIS {ctl.id}
                    </span>
                    {getSeverityBadge(ctl.severity)}
                    <span className="text-xs text-zinc-400">{ctl.category}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-zinc-100">{ctl.title}</h4>
                  <div className="text-[11px] text-zinc-400 flex items-center gap-2">
                    <span>Affected Systems:</span>
                    <span className="text-zinc-300 font-mono font-medium">
                      {ctl.affected_assets.join(', ') || 'All tested devices'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block uppercase">Non-Compliant</span>
                    <strong className="text-lg font-black text-rose-400 font-mono">
                      {ctl.fail_count} Device{ctl.fail_count !== 1 ? 's' : ''}
                    </strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cross-Asset Severity Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-purple-400" />
            Cross-Asset Severity Exposure Matrix
          </h3>
          <p className="text-xs text-zinc-400">
            Comparison of Critical, High, and Medium misconfigurations across target environments
          </p>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="category" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="Critical" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="High" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Medium" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Defense Domain Category Breakdown */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-purple-400" />
            Category Risk Exposure
          </h3>
          <p className="text-xs text-zinc-400">Weighted risk score penalty across active security domains</p>

          <div className="space-y-2.5 pt-2">
            {report?.summary?.category_risk && Object.entries(report.summary.category_risk).length > 0 ? (
              Object.entries(report.summary.category_risk).map(([cat, risk]) => (
                <div key={cat} className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800 flex items-center justify-between">
                  <span className="font-semibold text-xs text-zinc-200">{cat || 'General'}</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-purple-500/10 text-purple-300 font-bold border border-purple-500/20">
                    Risk Penalty: {risk}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs">
                Inspect individual findings to see detailed category risk breakdowns.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
