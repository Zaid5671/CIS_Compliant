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
  ChevronRight,
  Laptop,
  Server,
  Shield,
  HardDrive,
  ShieldAlert,
  Clock,
  Share2,
  Layers,
  Lock,
  BookOpen,
  Info,
  ListChecks,
  Activity,
  Sparkles,
  Wrench,
  ShieldCheck
} from 'lucide-react';
import { CheckResult, CheckStatus, FleetSummary, ScanReport, Severity } from '../types';
import { enrichFinding, generateMarkdownTicket } from '../utils/findingEnricher';

interface FindingsViewProps {
  report: ScanReport | null;
  fleet?: FleetSummary | null;
  onNavigateTab: (tab: string) => void;
  onSelectAsset?: (assetId: string) => void;
}

export const FindingsView: React.FC<FindingsViewProps> = ({
  report,
  fleet,
  onNavigateTab,
  onSelectAsset,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [selectedFinding, setSelectedFinding] = useState<CheckResult | null>(null);
  const [copiedAuditCmd, setCopiedAuditCmd] = useState(false);
  const [copiedFixCmd, setCopiedFixCmd] = useState(false);
  const [copiedEvidence, setCopiedEvidence] = useState(false);
  const [copiedTicket, setCopiedTicket] = useState(false);

  const copyAuditCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedAuditCmd(true);
    setTimeout(() => setCopiedAuditCmd(false), 2000);
  };

  const copyFixCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedFixCmd(true);
    setTimeout(() => setCopiedFixCmd(false), 2000);
  };

  const copyEvidence = (ev: string) => {
    navigator.clipboard.writeText(ev);
    setCopiedEvidence(true);
    setTimeout(() => setCopiedEvidence(false), 2000);
  };

  const copyTicket = (finding: CheckResult) => {
    const ticket = generateMarkdownTicket(finding, report?.asset_name || report?.target.display || 'Local Machine');
    navigator.clipboard.writeText(ticket);
    setCopiedTicket(true);
    setTimeout(() => setCopiedTicket(false), 2000);
  };

  if (!report || !report.results.length) {
    return (
      <div className="p-16 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/80 max-w-xl mx-auto my-12 space-y-4">
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mx-auto">
          <Terminal className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-white">No Active Audit Findings</h3>
        <p className="text-sm text-zinc-400">
          Load a CIS benchmark and execute a scan against your local device or remote host to view control evaluation details.
        </p>

        {fleet && fleet.assets && fleet.assets.length > 0 && onSelectAsset && (
          <div className="pt-2 border-t border-zinc-800 space-y-2">
            <span className="text-xs text-zinc-400 block font-medium">Or select an audited device from the fleet:</span>
            <div className="flex flex-wrap justify-center gap-2">
              {fleet.assets.map((a) => (
                <button
                  key={a.asset_id}
                  onClick={() => onSelectAsset(a.asset_id)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-purple-600 text-xs font-semibold text-zinc-200 hover:text-white transition-colors cursor-pointer"
                >
                  {a.name} ({a.score}%)
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => onNavigateTab('setup')}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
          >
            Go to Setup Scan &rarr;
          </button>
        </div>
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

  const downloadRemediationPlaybook = () => {
    const failedChecks = report.results.filter(r => (r.status === 'FAIL' || r.status === 'WARN'));
    const title = report.benchmark.title.toLowerCase();
    const isWindows = title.includes('windows');
    const isCisco = title.includes('cisco') || title.includes('catalyst') || title.includes('ios') || title.includes('asa');
    const isFortinet = title.includes('fortinet') || title.includes('fortios');
    const isPaloAlto = title.includes('palo alto') || title.includes('pan-os');
    
    let scriptContent = '';
    let filename = '';

    if (isCisco) {
      filename = 'cisguard-remediation-cisco.ios';
      scriptContent = [
        '! ==========================================================================',
        '! CISGuard Automated Hardening Configuration (Cisco CLI Playbook)',
        `! Benchmark: ${report.benchmark.title}`,
        `! Generated: ${new Date().toISOString()}`,
        '! Paste into "configure terminal" session on the Cisco appliance:',
        '! ==========================================================================\n',
        'configure terminal',
        ...failedChecks.map(c => {
          const enriched = enrichFinding(c, report.asset_name);
          return `! --- [${c.check_id}] ${c.title} ---\n${enriched.remediationCommand || c.remediation}\n`;
        }),
        'end',
        'write memory\n',
      ].join('\n');
    } else if (isFortinet) {
      filename = 'cisguard-remediation-fortigate.conf';
      scriptContent = [
        '# ==========================================================================',
        '# CISGuard Automated Hardening Script (Fortinet FortiOS CLI)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Generated: ${new Date().toISOString()}`,
        '# Paste directly into FortiGate SSH CLI:',
        '# ==========================================================================\n',
        ...failedChecks.map(c => {
          const enriched = enrichFinding(c, report.asset_name);
          return `# --- [${c.check_id}] ${c.title} ---\n${enriched.remediationCommand || c.remediation}\n`;
        }),
      ].join('\n');
    } else if (isPaloAlto) {
      filename = 'cisguard-remediation-panos.set';
      scriptContent = [
        '# ==========================================================================',
        '# CISGuard Automated Hardening Script (Palo Alto PAN-OS CLI)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Generated: ${new Date().toISOString()}`,
        '# Paste in PAN-OS CLI configuration mode:',
        '# ==========================================================================\n',
        'set cli scripting-mode on',
        'configure',
        ...failedChecks.map(c => {
          const enriched = enrichFinding(c, report.asset_name);
          return `# --- [${c.check_id}] ${c.title} ---\n${enriched.remediationCommand || c.remediation}\n`;
        }),
        'commit',
      ].join('\n');
    } else if (isWindows) {
      filename = 'cisguard-remediation.ps1';
      scriptContent = [
        '# ==========================================================================',
        '# CISGuard Automated Remediation Playbook (PowerShell)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Target: ${report.asset_name || 'Local Windows Device'}`,
        `# Generated: ${new Date().toISOString()}`,
        '# DISCLAIMER: Review each command before executing in production.',
        '# ==========================================================================\n',
        ...failedChecks.map(c => {
          const enriched = enrichFinding(c, report.asset_name);
          return `Write-Host "Applying fix for: [${c.check_id}] ${c.title}" -ForegroundColor Cyan\n# Guidance: ${enriched.remediationInstructions}\n${enriched.remediationCommand}\n`;
        }),
      ].join('\n');
    } else {
      filename = 'cisguard-remediation.sh';
      scriptContent = [
        '#!/usr/bin/env bash',
        '# ==========================================================================',
        '# CISGuard Automated Remediation Playbook (Bash)',
        `# Benchmark: ${report.benchmark.title}`,
        `# Generated: ${new Date().toISOString()}`,
        '# DISCLAIMER: Review each command before executing in production.',
        '# ==========================================================================\nset -e\n',
        ...failedChecks.map(c => {
          const enriched = enrichFinding(c, report.asset_name);
          return `echo "Applying fix for: [${c.check_id}] ${c.title}"\n# Rationale: ${c.rationale}\n${enriched.remediationCommand || c.remediation}\n`;
        }),
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
      {/* Device Switcher & Context Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <Laptop className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-400">Audited Appliance</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-800 text-zinc-300 font-mono">
                {report.summary?.score ?? 0}% Compliance
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">
                ({report.results.length} Controls)
              </span>
            </div>
            <h3 className="font-bold text-white text-sm">
              {report.asset_name || report.target.display || report.target.host || 'Local Workstation'}
            </h3>
          </div>
        </div>

        {/* Device Switcher Dropdown */}
        {fleet && fleet.assets && fleet.assets.length > 1 && onSelectAsset && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs text-zinc-400 font-medium">Switch Target:</span>
            <select
              value={report.asset_id || ''}
              onChange={(e) => onSelectAsset(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 hover:border-purple-500 text-zinc-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-purple-500 cursor-pointer transition-colors"
            >
              {fleet.assets.map((a) => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.name} — {a.score}% ({a.total_checks} checks)
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

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
      {selectedFinding && (() => {
        const enriched = enrichFinding(selectedFinding, report.asset_name || report.target.display || 'Local Machine');
        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
            <div className="w-full max-w-2xl bg-[#0b0c10] border-l border-zinc-800/90 h-full p-6 overflow-y-auto space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
              
              {/* 1. Drawer Header & Meta */}
              <div className="space-y-3 pb-4 border-b border-zinc-800/80">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded bg-zinc-800 text-purple-300 border border-zinc-700">
                      {selectedFinding.check_id}
                    </span>
                    {getStatusBadge(selectedFinding.status)}
                    {getSeverityBadge(selectedFinding.severity)}
                    <span className="text-[11px] font-medium text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                      {selectedFinding.profile || 'Level 1'}
                    </span>
                    {selectedFinding.status === 'FAIL' && enriched.scorePenalty > 0 && (
                      <span className="text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/25 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        -{enriched.scorePenalty} pts Penalty
                      </span>
                    )}
                    {selectedFinding.status === 'PASS' && (
                      <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Compliant
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyTicket(selectedFinding)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 text-xs font-medium transition-colors cursor-pointer"
                      title="Copy full finding report formatted for Jira / ServiceNow tickets"
                    >
                      {copiedTicket ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5 text-purple-400" />}
                      <span>{copiedTicket ? 'Ticket Copied!' : 'Copy Ticket'}</span>
                    </button>
                    <button
                      onClick={() => setSelectedFinding(null)}
                      className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      title="Close side panel"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-bold text-white leading-snug">
                    {selectedFinding.title}
                  </h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 mt-1">
                    <span>Category: <strong className="text-zinc-300 font-medium">{selectedFinding.category}</strong></span>
                    <span>•</span>
                    <span>Target: <strong className="text-zinc-300 font-medium">{report.asset_name || report.target.display || 'Local Host'}</strong></span>
                    {selectedFinding.duration_ms > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono text-[11px] text-zinc-500">
                          <Clock className="w-3 h-3" />
                          {selectedFinding.duration_ms} ms probe latency
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. Audit Probe Command Box (Exact command CISGuard runs) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Audit Probe & Executed Command
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                      {enriched.auditType}
                    </span>
                    <button
                      onClick={() => copyAuditCommand(enriched.auditCommand)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer"
                    >
                      {copiedAuditCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedAuditCmd ? 'Copied' : 'Copy Command'}</span>
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-black border border-zinc-800 p-3.5 font-mono text-xs text-purple-300 overflow-x-auto shadow-inner">
                  <div className="text-[10px] text-zinc-500 mb-1 select-none"># Audit verification command executed against target:</div>
                  <div className="select-all text-purple-200 whitespace-pre-wrap">{enriched.auditCommand}</div>
                </div>
              </div>

              {/* 3. Deterministic Value Comparison Box (PS Section 4 Requirement) */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-zinc-400" />
                  Deterministic Baseline Comparison
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-zinc-900/80 border border-zinc-800">
                  {/* Expected CIS Value */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                        Expected CIS Baseline
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">Target Standard</span>
                    </div>
                    <div className="font-mono text-xs font-bold text-emerald-300 bg-emerald-950/30 p-2.5 rounded-lg border border-emerald-900/50 overflow-x-auto">
                      {enriched.expectedBaseline}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {enriched.expectedDescription}
                    </p>
                  </div>

                  {/* Actual Device Output */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold flex items-center gap-1 ${
                        selectedFinding.status === 'PASS' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        <span className={`w-2 h-2 rounded-full inline-block ${
                          selectedFinding.status === 'PASS' ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}></span>
                        Actual Machine Output
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">Audited State</span>
                    </div>
                    <div className={`font-mono text-xs font-bold p-2.5 rounded-lg border overflow-x-auto ${
                      selectedFinding.status === 'PASS' 
                        ? 'text-emerald-300 bg-emerald-950/30 border-emerald-900/50' 
                        : 'text-rose-300 bg-rose-950/30 border-rose-900/50'
                    }`}>
                      {enriched.actualValue}
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      {enriched.actualDescription}
                    </p>
                  </div>
                </div>
              </div>

              {/* 4. Evidence / Command Stdout */}
              {selectedFinding.evidence && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                      Raw Terminal Output & Evidence
                    </span>
                    <button
                      onClick={() => copyEvidence(selectedFinding.evidence)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {copiedEvidence ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedEvidence ? 'Copied' : 'Copy Output'}</span>
                    </button>
                  </div>
                  <pre className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 font-mono text-xs text-zinc-300 overflow-x-auto max-h-40 whitespace-pre-wrap leading-relaxed">
                    {selectedFinding.evidence}
                  </pre>
                </div>
              )}

              {/* 5. Remediation & Hardening (Dual View: Plain English + Runnable CLI Command) */}
              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                  Actionable Remediation & Resolution
                </span>

                {/* Sub-block A: Plain English Instructions */}
                <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/25 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                    <Info className="w-3.5 h-3.5 text-purple-400" />
                    <span>Resolution Guidance (Plain English / GUI Policy)</span>
                  </div>
                  <p className="text-xs text-zinc-200 leading-relaxed">
                    {enriched.remediationInstructions}
                  </p>
                </div>

                {/* Sub-block B: Exact CLI Fix Command */}
                {enriched.remediationCommand && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
                        <Terminal className="w-3.5 h-3.5" />
                        Exact CLI Remediation Command
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
                          {enriched.remediationShell}
                        </span>
                        <button
                          onClick={() => copyFixCommand(enriched.remediationCommand)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                        >
                          {copiedFixCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedFixCmd ? 'Copied!' : 'Copy Fix Command'}</span>
                        </button>
                      </div>
                    </div>
                    <div className="p-3.5 rounded-xl bg-black border border-emerald-500/30 font-mono text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap leading-relaxed shadow-inner">
                      {enriched.remediationCommand}
                    </div>
                  </div>
                )}
              </div>

              {/* 6. Regulatory Framework Mappings (NIST SP 800-53 / CIS Controls v8 / MITRE ATT&CK) */}
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  Compliance Framework Cross-Mapping
                </span>
                <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-2.5">
                  {/* NIST Controls */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                      NIST SP 800-53 Rev 5 Controls
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {enriched.nistControls.map((ctrl) => (
                        <span key={ctrl} className="px-2.5 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/25 text-[11px] font-mono">
                          {ctrl}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* CIS Safeguards */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                      CIS Controls v8 Safeguards
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {enriched.cisSafeguards.map((sg) => (
                        <span key={sg} className="px-2.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[11px] font-mono">
                          {sg}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* MITRE ATT&CK Mitigation */}
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block mb-1">
                      MITRE ATT&CK Threat Alignment
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {enriched.mitreAttack.map((atk) => (
                        <span key={atk} className="px-2.5 py-0.5 rounded-md bg-rose-500/10 text-rose-300 border border-rose-500/25 text-[11px] font-mono">
                          {atk}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 7. CIS Audit Rationale & Threat Mitigation */}
              {selectedFinding.rationale && (
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5 text-zinc-400" />
                    Audit Rationale & Threat Mitigation
                  </span>
                  <p className="text-xs text-zinc-300 leading-relaxed p-3.5 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    {selectedFinding.rationale}
                  </p>
                </div>
              )}

              {/* 8. Audit Engine Telemetry */}
              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400" />
                  Evaluation Engine: Deterministic Rule Matcher
                </span>
                <span>CIS Profile: {selectedFinding.profile || 'Level 1'}</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

