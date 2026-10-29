import React, { useState } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  ArrowUpRight, 
  Laptop, 
  Server, 
  Shield, 
  Network,
  ChevronRight,
  Activity,
  Layers,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
  RefreshCw,
  HardDrive
} from 'lucide-react';
import { FleetSummary, ScanReport } from '../types';

interface DashboardViewProps {
  report: ScanReport | null;
  fleet: FleetSummary | null;
  onNavigateTab: (tab: string) => void;
  onLaunchBenchmark: (name: string) => void;
  onSelectAsset: (assetId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  report,
  fleet,
  onNavigateTab,
  onLaunchBenchmark,
  onSelectAsset,
}) => {
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [deviceSearch, setDeviceSearch] = useState<string>('');

  const fleetScore = fleet?.fleet_score ?? (report?.summary?.score ?? 0);
  const totalAssets = fleet?.total_assets ?? (report ? 1 : 0);
  const totalEvaluated = fleet?.total_evaluated_checks ?? (report?.summary?.total ?? 0);
  const totalPassed = fleet?.total_passed ?? (report?.summary?.passed ?? 0);
  const totalFailed = fleet?.total_failed ?? (report?.summary?.failed ?? 0);

  const formatTimestamp = (isoStr?: string | null) => {
    if (!isoStr) return 'Never';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoStr;
    }
  };

  const categoryScores = fleet?.category_scores || {
    windows: { score: 0, count: 0, passed: 0, failed: 0, total_checks: 0 },
    linux: { score: 0, count: 0, passed: 0, failed: 0, total_checks: 0 },
    firewall: { score: 0, count: 0, passed: 0, failed: 0, total_checks: 0 },
    network: { score: 0, count: 0, passed: 0, failed: 0, total_checks: 0 },
  };

  const assetPillars = [
    {
      id: 'windows',
      name: 'Windows Systems',
      icon: Laptop,
      category: 'Workstations & Server Baselines',
      score: `${categoryScores.windows?.score ?? 0}%`,
      count: categoryScores.windows?.count ?? 0,
      passed: categoryScores.windows?.passed ?? 0,
      failed: categoryScores.windows?.failed ?? 0,
      status: categoryScores.windows?.count ? `${categoryScores.windows.count} System${categoryScores.windows.count > 1 ? 's' : ''}` : 'Ready to Audit',
      badgeColor: 'border-blue-500/30 text-blue-400 bg-blue-500/10',
      sampleBenchmark: 'windows10-local-cis',
    },
    {
      id: 'linux',
      name: 'Linux Workloads',
      icon: Server,
      category: 'Ubuntu 22.04 / RHEL 9',
      score: `${categoryScores.linux?.score ?? 0}%`,
      count: categoryScores.linux?.count ?? 0,
      passed: categoryScores.linux?.passed ?? 0,
      failed: categoryScores.linux?.failed ?? 0,
      status: categoryScores.linux?.count ? `${categoryScores.linux.count} Server${categoryScores.linux.count > 1 ? 's' : ''}` : 'SSH Remote',
      badgeColor: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
      sampleBenchmark: 'linux-basic',
    },
    {
      id: 'firewall',
      name: 'Network Firewalls',
      icon: Shield,
      category: 'Fortinet / Palo Alto / ASA',
      score: `${categoryScores.firewall?.score ?? 0}%`,
      count: categoryScores.firewall?.count ?? 0,
      passed: categoryScores.firewall?.passed ?? 0,
      failed: categoryScores.firewall?.failed ?? 0,
      status: categoryScores.firewall?.count ? `${categoryScores.firewall.count} Appliance${categoryScores.firewall.count > 1 ? 's' : ''}` : 'Config Ingest',
      badgeColor: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
      sampleBenchmark: 'network-device-ssh-starter',
    },
    {
      id: 'network',
      name: 'Routers & Switches',
      icon: Network,
      category: 'Cisco IOS / Catalyst',
      score: `${categoryScores.network?.score ?? 0}%`,
      count: categoryScores.network?.count ?? 0,
      passed: categoryScores.network?.passed ?? 0,
      failed: categoryScores.network?.failed ?? 0,
      status: categoryScores.network?.count ? `${categoryScores.network.count} Switch${categoryScores.network.count > 1 ? 'es' : ''}` : 'Show Run / SSH',
      badgeColor: 'border-purple-500/30 text-purple-400 bg-purple-500/10',
      sampleBenchmark: 'network-device-ssh-starter',
    },
  ];

  // Filter fleet assets
  const filteredAssets = (fleet?.assets || []).filter((a) => {
    if (selectedCategoryFilter !== 'all' && a.category !== selectedCategoryFilter) return false;
    if (deviceSearch) {
      const q = deviceSearch.toLowerCase();
      const matchName = a.name.toLowerCase().includes(q);
      const matchBench = a.benchmark_title.toLowerCase().includes(q);
      const matchTarget = a.target_display.toLowerCase().includes(q);
      if (!matchName && !matchBench && !matchTarget) return false;
    }
    return true;
  });

  const getAssetIcon = (category: string) => {
    switch (category) {
      case 'windows': return Laptop;
      case 'linux': return Server;
      case 'firewall': return Shield;
      case 'network': return Network;
      default: return HardDrive;
    }
  };

  const getCategoryBadgeClass = (category: string) => {
    switch (category) {
      case 'windows': return 'border-blue-500/30 text-blue-400 bg-blue-500/10';
      case 'linux': return 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10';
      case 'firewall': return 'border-amber-500/30 text-amber-400 bg-amber-500/10';
      case 'network': return 'border-purple-500/30 text-purple-400 bg-purple-500/10';
      default: return 'border-zinc-500/30 text-zinc-400 bg-zinc-500/10';
    }
  };

  return (
    <div className="space-y-7 animate-in fade-in duration-200">
      {/* Top Banner & Consolidated Posture Header */}
      <div className="p-7 rounded-2xl bg-gradient-to-br from-zinc-900 via-[#13111f] to-[#0d0d12] border border-purple-500/20 shadow-xl shadow-purple-950/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Fleet CIS Benchmark Compliance & Hardening</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
              {totalAssets > 0 ? `Enterprise Fleet Posture (${totalAssets} Systems Audited)` : 'Fleet Ready for Baseline Audit'}
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Consolidated security posture across all evaluated endpoints, servers, and network devices.
              Track persistent device reports, identify systemic misconfigurations, and execute automated remediation.
            </p>
          </div>

          {/* Radial Fleet Compliance Gauge */}
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
                  className={fleetScore >= 70 ? 'text-emerald-500' : fleetScore >= 40 ? 'text-amber-500' : 'text-rose-500'}
                  strokeDasharray={`${fleetScore}, 100`}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black text-white tracking-tighter">{fleetScore}%</span>
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Fleet</span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-semibold text-zinc-300">Fleet Compliance Posture</div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className={`font-semibold ${fleetScore >= 70 ? 'text-emerald-400' : fleetScore >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {fleetScore >= 70 ? 'Satisfactory Posture' : fleetScore >= 40 ? 'Hardening Needed' : 'Critical Exposure'}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {totalAssets > 0 ? `${totalPassed} passed / ${totalEvaluated} evaluated checks` : 'No scans executed'}
              </p>
              {fleet?.last_audit && (
                <p className="text-[10px] text-zinc-500">
                  Last audit: {formatTimestamp(fleet.last_audit)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Audited Systems</span>
            <Layers className="w-4 h-4 text-zinc-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{totalAssets}</div>
          <span className="text-[11px] text-zinc-400">Unique fleet devices</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Compliant Checks</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{totalPassed}</div>
          <span className="text-[11px] text-zinc-400">Satisfying CIS controls</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">Active Deviations</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">{totalFailed}</div>
          <span className="text-[11px] text-zinc-400">Requiring hardening fixes</span>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/80 hover:border-purple-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-purple-400">Total Probes</span>
            <ShieldCheck className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-purple-300">{totalEvaluated}</div>
          <span className="text-[11px] text-zinc-400">Rules evaluated fleet-wide</span>
        </div>
      </div>

      {/* The 4 PS Asset Category Cards (Section 3 Targets) */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Infrastructure Posture by Asset Type</span>
              <span className="text-xs font-normal text-zinc-400">(PS Section 3 Scope)</span>
            </h3>
            <p className="text-xs text-zinc-400">Real compliance score broken down across heterogeneous OS, firewalls, and routers</p>
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
          {assetPillars.map((asset) => {
            const Icon = asset.icon;
            const isSelected = selectedCategoryFilter === asset.id;
            return (
              <div
                key={asset.id}
                onClick={() => setSelectedCategoryFilter(isSelected ? 'all' : asset.id)}
                className={`p-5 rounded-xl border transition-all duration-200 group flex flex-col justify-between cursor-pointer ${
                  isSelected 
                    ? 'bg-purple-950/30 border-purple-500 shadow-lg shadow-purple-950/30' 
                    : 'bg-zinc-900/60 border-zinc-800/80 hover:border-purple-500/40 hover:bg-zinc-900/80'
                }`}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onLaunchBenchmark(asset.sampleBenchmark);
                    }}
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

      {/* PS Requirement: Active Fleet Asset Inventory & Findings Table */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Audited Fleet Asset Inventory</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-mono font-semibold">
                {filteredAssets.length} active device{filteredAssets.length !== 1 ? 's' : ''}
              </span>
            </h3>
            <p className="text-xs text-zinc-400">
              Persistent inventory of audited appliances. Click &quot;View Findings&quot; to inspect any machine&apos;s CIS control results.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-zinc-950/60 p-1 rounded-xl border border-zinc-800 text-xs">
              {['all', 'windows', 'linux', 'firewall', 'network'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer capitalize ${
                    selectedCategoryFilter === cat
                      ? 'bg-purple-600 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {cat === 'all' ? 'All Assets' : cat}
                </button>
              ))}
            </div>

            {/* Device search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search host, benchmark, IP..."
                value={deviceSearch}
                onChange={(e) => setDeviceSearch(e.target.value)}
                className="bg-zinc-950/70 border border-zinc-800 rounded-xl pl-8 pr-3 py-1 text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors w-48"
              />
            </div>
          </div>
        </div>

        {/* Assets Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-800/80">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/70 text-zinc-400 font-semibold border-b border-zinc-800/80 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Device / Hostname</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Benchmark Baseline</th>
                <th className="py-3 px-4">Compliance %</th>
                <th className="py-3 px-4">Passed / Total</th>
                <th className="py-3 px-4">Last Audited</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-200">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-zinc-400">
                    No audited devices found matching your criteria. Execute a scan from the Benchmark Catalog.
                  </td>
                </tr>
              ) : (
                filteredAssets.map((asset) => {
                  const Icon = getAssetIcon(asset.category);
                  const isScoreGood = asset.score >= 70;
                  const isScoreMed = asset.score >= 40 && asset.score < 70;
                  return (
                    <tr
                      key={asset.asset_id}
                      className="hover:bg-zinc-800/30 transition-colors group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-purple-400 shrink-0">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-semibold text-white block text-xs group-hover:text-purple-300 transition-colors">
                              {asset.name}
                            </span>
                            <span className="text-[11px] text-zinc-400 block font-mono">
                              {asset.target_display}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border capitalize ${getCategoryBadgeClass(asset.category)}`}>
                          {asset.category}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-zinc-300 font-medium line-clamp-1 max-w-[220px]" title={asset.benchmark_title}>
                          {asset.benchmark_title || 'CIS Baseline'}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-bold text-xs ${isScoreGood ? 'text-emerald-400' : isScoreMed ? 'text-amber-400' : 'text-rose-400'}`}>
                            {asset.score}%
                          </span>
                          <div className="w-16 bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${isScoreGood ? 'bg-emerald-500' : isScoreMed ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(100, Math.max(5, asset.score))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-300">
                        <span className="text-emerald-400 font-bold">{asset.passed} pass</span> / <span className="text-rose-400 font-bold">{asset.failed} fail</span>
                        <span className="text-zinc-500 ml-1">({asset.total_checks} total)</span>
                      </td>

                      <td className="py-3.5 px-4 text-zinc-400 text-[11px]">
                        {formatTimestamp(asset.finished_at)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => onSelectAsset(asset.asset_id)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1"
                            title="Inspect full CIS control findings for this asset"
                          >
                            <span>View Findings</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fleet Severity Exposure & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-white text-sm">Fleet Severity Risk Distribution</h3>
              <p className="text-xs text-zinc-400">Total unpatched misconfigurations aggregated across all audited infrastructure</p>
            </div>
            <button
              onClick={() => onNavigateTab('analytics')}
              className="text-xs text-purple-400 hover:text-purple-300 font-medium cursor-pointer"
            >
              Analytics Trends &rarr;
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            {[
              { level: 'Critical', count: fleet?.severity_counts?.CRITICAL ?? 0, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
              { level: 'High', count: fleet?.severity_counts?.HIGH ?? (report?.summary?.severity_counts?.high ?? 0), color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
              { level: 'Medium', count: fleet?.severity_counts?.MEDIUM ?? (report?.summary?.severity_counts?.medium ?? 0), color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
              { level: 'Low / Info', count: fleet?.severity_counts?.LOW ?? 0, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
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
            <h3 className="font-bold text-white text-sm">Quick Audit Triggers</h3>
            <p className="text-xs text-zinc-400">One-click evaluation runners</p>
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
                <span className="text-xs font-semibold text-zinc-200 block">Configure Remote Device</span>
                <span className="text-[11px] text-zinc-400">SSH / Network appliances</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
