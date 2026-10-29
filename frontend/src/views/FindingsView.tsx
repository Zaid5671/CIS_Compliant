import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  Copy, 
  Check, 
  FileCode, 
  Download, 
  X, 
  ExternalLink,
  Terminal,
  ChevronRight
} from 'lucide-react';
import { CheckResult, CheckStatus, ScanReport, Severity } from '../types';

interface FindingsViewProps {
  report: ScanReport | null;
  onNavigateTab: (tab: string) => void;
}

export const FindingsView: React.FC<FindingsViewProps> = ({ report, onNavigateTab }) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<CheckResult | null>(null);
  const [copied, setCopied] = useState(false);

  if (!report || !report.results.length) {
    return (
      <div className="p-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 max-w-xl mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
          <Terminal className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Audit Findings Yet</h3>
        <p className="text-sm text-zinc-400">
          Load a CIS benchmark and execute a scan against your local device or remote host to view control evaluation details.
        </p>
        <button
          onClick={() => onNavigateTab('setup')}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
        >
          Go to Setup Scan &rarr;
        </button>
      </div>
    );
  }

  const results = report.results.filter((item) => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (severityFilter !== 'all' && item.severity !== severityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchId = item.check_id.toLowerCase().includes(q);
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchCat = item.category.toLowerCase().includes(q);
      const matchEv = item.evidence?.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchCat && !matchEv) return false;
    }
    return true;
  });

  const copyRemediation = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadRemediationPlaybook = () => {
    const failedChecks = report.results.filter(r => (r.status === 'FAIL' || r.status === 'WARN') && r.remediation);
    const isWindows = report.benchmark.title.toLowerCase().includes('windows');
    
    let scriptContent = '';
    let filename = '';

    if (isWindows) {
      filename = 'cisguard-remediation.ps1';
      scriptContent = [
        '# CISGuard Automated Remediation Playbook (PowerShell)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Generated: ${new Date().toISOString()}`,
        '# DISCLAIMER: Review each command before executing in production.\n',
        ...failedChecks.map(c => `Write-Host "Applying fix for: [${c.check_id}] ${c.title}" -ForegroundColor Cyan\n# Rationale: ${c.rationale}\n# Remediation: ${c.remediation}\n`),
      ].join('\n');
    } else {
      filename = 'cisguard-remediation.sh';
      scriptContent = [
        '#!/usr/bin/env bash',
        '# CISGuard Automated Remediation Playbook (Bash)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Generated: ${new Date().toISOString()}`,
        '# DISCLAIMER: Review each command before executing in production.\nset -e\n',
        ...failedChecks.map(c => `echo "Applying fix for: [${c.check_id}] ${c.title}"\n# Rationale: ${c.rationale}\n# Remediation: ${c.remediation}\n`),
      ].join('\n');
    }

    const blob = new Blob([scriptContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: CheckStatus) => {
    switch (status) {
      case 'PASS':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"><CheckCircle2 className="w-3.5 h-3.5" /> Pass</span>;
      case 'FAIL':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/25"><XCircle className="w-3.5 h-3.5" /> Fail</span>;
      case 'WARN':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25"><AlertTriangle className="w-3.5 h-3.5" /> Warn</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/25"><HelpCircle className="w-3.5 h-3.5" /> {status}</span>;
    }
  };

  const getSeverityBadge = (sev: Severity) => {
    const s = sev?.toLowerCase() || 'medium';
    switch (s) {
      case 'critical':
        return <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30">Critical</span>;
      case 'high':
        return <span className="text-[11px] font-bold uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/30">High</span>;
      case 'medium':
        return <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">Medium</span>;
      default:
        return <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">Low</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Toolbar */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by ID, control title, category, or evidence..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-950/70 border border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {['all', 'FAIL', 'WARN', 'PASS', 'MANUAL'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer capitalize ${
                  statusFilter === st
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/40'
                    : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/40 border border-transparent'
                }`}
              >
                {st === 'all' ? 'All Status' : st.toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={downloadRemediationPlaybook}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-purple-300 hover:text-white border border-purple-500/20 text-xs font-medium transition-colors cursor-pointer"
            title="Download executable fix script for failed checks"
          >
            <FileCode className="w-3.5 h-3.5 text-purple-400" />
            <span>Export Remediation Script</span>
          </button>
        </div>
      </div>

      {/* Findings Table */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-950/60 border-b border-zinc-800/80 text-zinc-400 uppercase font-semibold text-[11px] tracking-wider select-none">
              <tr>
                <th className="py-3 px-4 w-28">Control ID</th>
                <th className="py-3 px-4">Title & Description</th>
                <th className="py-3 px-4 w-28">Status</th>
                <th className="py-3 px-4 w-24">Severity</th>
                <th className="py-3 px-4 w-40">Expected CIS Value</th>
                <th className="py-3 px-4 w-40">Actual Device State</th>
                <th className="py-3 px-4 w-20 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {results.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-400">
                    No findings match your filter criteria.
                  </td>
                </tr>
              ) : (
                results.map((finding) => (
                  <tr
                    key={finding.check_id}
                    onClick={() => setSelectedFinding(finding)}
                    className="hover:bg-zinc-800/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-3.5 px-4 font-mono font-medium text-zinc-300">
                      {finding.check_id}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-100 group-hover:text-purple-300 transition-colors">
                        {finding.title}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{finding.category}</div>
                    </td>
                    <td className="py-3.5 px-4">{getStatusBadge(finding.status)}</td>
                    <td className="py-3.5 px-4">{getSeverityBadge(finding.severity)}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-300 truncate max-w-[160px]">
                      {finding.expected || 'exit code 0'}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400 truncate max-w-[160px]">
                      {finding.actual || '-'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button className="p-1 rounded-md bg-zinc-800 group-hover:bg-purple-600 group-hover:text-white text-zinc-400 transition-colors">
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Remediation & Details Drawer */}
      {selectedFinding && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-[#0e0e14] border-l border-zinc-800 h-full p-6 overflow-y-auto space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-start justify-between pb-4 border-b border-zinc-800/80">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-zinc-800 text-purple-300 border border-zinc-700">
                    {selectedFinding.check_id}
                  </span>
                  {getStatusBadge(selectedFinding.status)}
                  {getSeverityBadge(selectedFinding.severity)}
                </div>
                <h3 className="text-base font-bold text-white leading-snug">{selectedFinding.title}</h3>
                <p className="text-xs text-zinc-400">Category: {selectedFinding.category}</p>
              </div>
              <button
                onClick={() => setSelectedFinding(null)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Side-by-Side Comparison Box (PS Requirement) */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Deterministic Comparison</span>
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <div>
                  <span className="text-[11px] text-zinc-400 font-semibold block">Expected CIS Value</span>
                  <div className="mt-1 font-mono text-xs text-emerald-400 bg-emerald-950/20 p-2 rounded border border-emerald-900/40 overflow-x-auto">
                    {selectedFinding.expected || 'exit code 0'}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-zinc-400 font-semibold block">Actual Device Output</span>
                  <div className="mt-1 font-mono text-xs text-rose-400 bg-rose-950/20 p-2 rounded border border-rose-950/40 overflow-x-auto">
                    {selectedFinding.actual || 'Null / Not set'}
                  </div>
                </div>
              </div>
            </div>

            {/* Evidence Block */}
            {selectedFinding.evidence && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Evidence / Command Output</span>
                <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-zinc-300 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {selectedFinding.evidence}
                </pre>
              </div>
            )}

            {/* Remediation CLI Terminal (PS Requirement) */}
            {selectedFinding.remediation && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Exact CLI Remediation Command
                  </span>
                  <button
                    onClick={() => copyRemediation(selectedFinding.remediation)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Fix'}</span>
                  </button>
                </div>
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-purple-500/30 text-purple-200 font-mono text-xs leading-relaxed">
                  {selectedFinding.remediation}
                </div>
              </div>
            )}

            {/* CIS Rationale */}
            {selectedFinding.rationale && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Audit Rationale</span>
                <p className="text-xs text-zinc-300 leading-relaxed p-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  {selectedFinding.rationale}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

