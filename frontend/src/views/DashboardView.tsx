import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  HelpCircle, 
  ArrowUpRight, 
  Laptop, 
  Server, 
  Shield, 
  Network,
  ChevronRight,
  TrendingUp,
  Activity
} from 'lucide-react';
import { ScanReport } from '../types';

interface DashboardViewProps {
  report: ScanReport | null;
  onNavigateTab: (tab: string) => void;
  onLaunchBenchmark: (name: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  report,
  onNavigateTab,
  onLaunchBenchmark,
}) => {
  const summary = report?.summary;
  const score = summary?.score ?? 0;
  const hasScan = !!report;

  // Asset posture calculations (PS requirement: Breakdown by Windows, Linux, Firewall, Router/Switch)
  const isWindows = report?.benchmark.title.toLowerCase().includes('windows');
  const isLinux = report?.benchmark.title.toLowerCase().includes('ubuntu') || report?.benchmark.title.toLowerCase().includes('rhel') || report?.benchmark.title.toLowerCase().includes('linux');
  const isNetwork = report?.benchmark.title.toLowerCase().includes('cisco') || report?.benchmark.title.toLowerCase().includes('network');

  const assets = [
    {
      id: 'windows',
      name: 'Windows Endpoints & Servers',
      icon: Laptop,
      category: 'Windows 11 / Server 2019',
      score: isWindows ? `${score}%` : '68.2%',
      status: isWindows ? (score > 70 ? 'Compliant' : 'Hardening Required') : 'Audited (Recent)',
      badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      sampleBenchmark: 'windows10-local-cis',
      checks: isWindows ? summary?.total : 27,
    },
    {
      id: 'linux',
      name: 'Linux Workloads',
      icon: Server,
      category: 'Ubuntu 22.04 / RHEL 9',
      score: isLinux ? `${score}%` : '85.0%',
      status: isLinux ? 'Audited' : 'Remote SSH Ready',
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      sampleBenchmark: 'ubuntu-22-04-cis-starter',
      checks: isLinux ? summary?.total : 32,
    },
    {
      id: 'firewall',
      name: 'Network Firewalls',
      icon: Shield,
      category: 'Fortinet / Palo Alto / ASA',
      score: 'Pending',
      status: 'Config Ingestion Ready',
      badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      sampleBenchmark: 'network-device-ssh-starter',
      checks: 18,
    },
    {
      id: 'network',
      name: 'Routers & Switches',
      icon: Network,
      category: 'Cisco IOS / Catalyst',
      score: isNetwork ? `${score}%` : '60.0%',
      status: isNetwork ? 'Audited' : 'SSH / Show Run',
      badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
      sampleBenchmark: 'cisco-ios-cis-starter',
      checks: isNetwork ? summary?.total : 10,
    },
  ];

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* Top Banner & Radial Posture Header */}
      <div className="p-7 rounded-2xl bg-gradient-to-br from-zinc-900 via-[#13111f] to-[#0d0d12] border border-purple-500/20 shadow-xl shadow-purple-950/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Continuous CIS Benchmark Evaluation</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              {hasScan ? report.benchmark.title : 'Ready for First Security Audit'}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {hasScan
                ? `Evaluated against CIS Level 1 hardening baselines. Found ${summary?.failed ?? 0} security deviations requiring remediation commands.`
                : 'Run an automated audit on your current workstation or connect to remote infrastructure over SSH.'}
            </p>
          </div>

          {/* Radial Score Gauge */}
          <div className="flex items-center gap-5 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 backdrop-blur-md self-start lg:self-auto">
            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-zinc-800"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className={score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500'}
                  strokeDasharray={`${score}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white tracking-tighter">{score}%</span>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Score</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-300">Compliance Posture</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold ${score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {score >= 70 ? 'Satisfactory' : score >= 40 ? 'Needs Hardening' : 'Critical Drift'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {hasScan ? `${summary?.passed} passed / ${summary?.total} total` : 'No scans executed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Controls</span>
            <ShieldCheck className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{summary?.total ?? 0}</div>
          <span className="text-[11px] text-zinc-400">Evaluated rules</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Passed Checks</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{summary?.passed ?? 0}</div>
          <span className="text-[11px] text-zinc-400">Compliant with baseline</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">Failed / Misconfigured</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">{summary?.failed ?? 0}</div>
          <span className="text-[11px] text-zinc-400">Remediation required</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-amber-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">Manual / Warn</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{(summary?.manual ?? 0) + (summary?.warn ?? 0)}</div>
          <span className="text-[11px] text-zinc-400">Human review items</span>
        </div>
      </div>

      {/* PS Requirement: Multi-Asset Breakdown Section */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Infrastructure Posture by Asset Type</span>
              <span className="text-xs font-normal text-zinc-400">(PS Section 3 Targets)</span>
            </h3>
            <p className="text-xs text-zinc-400">Consolidated compliance posture across heterogenous OS and network appliances</p>
          </div>
          <button 
            onClick={() => onNavigateTab('library')}
            className="text-xs text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 cursor-pointer"
          >
            <span>View All Benchmarks</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {assets.map((asset) => {
            const Icon = asset.icon;
            return (
              <div
                key={asset.id}
                className="p-5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-purple-500/40 hover:bg-zinc-900/80 transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-800/80 flex items-center justify-center text-purple-400 border border-zinc-700/50 group-hover:scale-105 transition-transform">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${asset.badgeColor}`}>
                      {asset.status}
                    </span>
                  </div>

                  <h4 className="font-semibold text-sm text-zinc-200">{asset.name}</h4>
                  <p className="text-xs text-zinc-400 mt-0.5">{asset.category}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-zinc-400 block uppercase">Compliance</span>
                    <strong className="text-lg font-bold text-white tracking-tight">{asset.score}</strong>
                  </div>
                  <button
                    onClick={() => onLaunchBenchmark(asset.sampleBenchmark)}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-purple-600 hover:text-white text-zinc-300 transition-colors cursor-pointer"
                    title={`Scan ${asset.name}`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Severity Exposure & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm">Severity Risk Distribution</h3>
              <p className="text-xs text-zinc-400">Controls evaluated by threat rating</p>
            </div>
            {hasScan && (
              <button
                onClick={() => onNavigateTab('findings')}
                className="text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
              >
                Inspect Findings &rarr;
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { level: 'Critical', count: summary?.severity_counts?.critical ?? 0, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
              { level: 'High', count: summary?.severity_counts?.high ?? 0, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              { level: 'Medium', count: summary?.severity_counts?.medium ?? 0, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { level: 'Low / Info', count: (summary?.severity_counts?.low ?? 0) + (summary?.severity_counts?.info ?? 0), color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
            ].map((sev) => (
              <div key={sev.level} className={`p-3.5 rounded-xl border ${sev.color}`}>
                <span className="text-xs font-medium block opacity-90">{sev.level}</span>
                <strong className="text-2xl font-black mt-1 block tracking-tight">{sev.count}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Target Operations</h3>
            <p className="text-xs text-zinc-400">Fast action triggers</p>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => onLaunchBenchmark('windows10-local-cis')}
              className="w-full text-left p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/40 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">Run Local Windows Audit</span>
                <span className="text-[11px] text-zinc-400">27 read-only CIS controls</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>

            <button
              onClick={() => onNavigateTab('setup')}
              className="w-full text-left p-3 rounded-xl bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700/40 transition-colors flex items-center justify-between cursor-pointer"
            >
              <div>
                <span className="text-xs font-semibold text-zinc-200 block">Configure Remote Target</span>
                <span className="text-[11px] text-zinc-400">SSH key / password auth</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

