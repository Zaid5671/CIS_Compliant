import React, { useState } from 'react';
import { 
  Laptop, 
  Server, 
  FileText, 
  Play, 
  Key, 
  Lock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Shield,
  Layers,
  ChevronRight
} from 'lucide-react';
import { BenchmarkCatalogItem, DeviceContext, TargetConfig } from '../types';
import { api } from '../api/client';

interface SetupViewProps {
  device: DeviceContext | null;
  library: BenchmarkCatalogItem[];
  selectedBenchmark: string;
  onSelectBenchmark: (name: string) => void;
  onExecuteScan: (benchmarkName: string, target: TargetConfig) => void;
  isScanning: boolean;
}

export const SetupView: React.FC<SetupViewProps> = ({
  device,
  library,
  selectedBenchmark,
  onSelectBenchmark,
  onExecuteScan,
  isScanning,
}) => {
  const [targetType, setTargetType] = useState<'local' | 'remote'>('local');
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState(22);
  const [remoteUser, setRemoteUser] = useState('');
  const [authMethod, setAuthMethod] = useState<'key' | 'password'>('key');
  const [keyPath, setKeyPath] = useState('');
  const [password, setPassword] = useState('');
  const [testResult, setTestResult] = useState<{ testing: boolean; ok?: boolean; message?: string }>({ testing: false });

  const activeBenchmark = library.find((b) => b.name === selectedBenchmark) || library[0];

  const handleTestConnection = async () => {
    setTestResult({ testing: true });
    try {
      const res = await api.testTarget({
        type: targetType,
        host: remoteHost,
        port: remotePort,
        username: remoteUser,
        authMethod,
        keyPath,
        password,
      });
      if (res.ok) {
        setTestResult({ testing: false, ok: true, message: 'SSH Connection successful!' });
      } else {
        setTestResult({ testing: false, ok: false, message: res.error || 'Connection refused.' });
      }
    } catch (err: any) {
      setTestResult({ testing: false, ok: false, message: err.message || 'Connection failed' });
    }
  };

  const handleRun = () => {
    onExecuteScan(selectedBenchmark || 'windows10-local-cis', {
      type: targetType,
      host: remoteHost,
      port: remotePort,
      username: remoteUser,
      authMethod,
      keyPath,
      password,
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Target Environment Configurator */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Step 1: Choose Target Environment</h2>
          <p className="text-xs text-zinc-400">Select whether to audit this workstation or connect to a remote server over SSH</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setTargetType('local')}
            className={`p-5 rounded-2xl text-left border transition-all cursor-pointer relative ${
              targetType === 'local'
                ? 'bg-purple-950/20 border-purple-500/60 shadow-lg shadow-purple-950/30'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-purple-400 border border-zinc-700/60">
                <Laptop className="w-5 h-5" />
              </div>
              {targetType === 'local' && (
                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Current Local Workstation</h3>
            <p className="text-xs text-zinc-400 mt-1">Audit this Windows PC via direct Registry and PowerShell CIS probes</p>

            {device && (
              <div className="mt-4 pt-3 border-t border-zinc-800/80 font-mono text-[11px] text-zinc-400 space-y-1">
                <div>Host: <span className="text-zinc-200">{device.host}</span></div>
                <div>OS: <span className="text-zinc-200">{device.os} ({device.arch})</span></div>
              </div>
            )}
          </button>

          <button
            onClick={() => setTargetType('remote')}
            className={`p-5 rounded-2xl text-left border transition-all cursor-pointer relative ${
              targetType === 'remote'
                ? 'bg-purple-950/20 border-purple-500/60 shadow-lg shadow-purple-950/30'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center text-cyan-400 border border-zinc-700/60">
                <Server className="w-5 h-5" />
              </div>
              {targetType === 'remote' && (
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              )}
            </div>
            <h3 className="font-bold text-white text-sm">Remote Host / Network Appliance</h3>
            <p className="text-xs text-zinc-400 mt-1">Audit Ubuntu, RHEL, or Cisco infrastructure remotely over OpenSSH</p>
            <div className="mt-4 pt-3 border-t border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">SSH Key Auth</span>
              <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">Port 22</span>
            </div>
          </button>
        </div>

        {/* Remote Host Form */}
        {targetType === 'remote' && (
          <div className="p-6 rounded-2xl bg-zinc-900/70 border border-zinc-800 space-y-4 animate-in fade-in duration-150">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Server className="w-4 h-4" />
              SSH Target Parameters
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs text-zinc-400 font-medium">Host IP or FQDN</label>
                <input
                  type="text"
                  placeholder="192.168.1.50 or host.internal"
                  value={remoteHost}
                  onChange={(e) => setRemoteHost(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Port</label>
                <input
                  type="number"
                  value={remotePort}
                  onChange={(e) => setRemotePort(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Username</label>
                <input
                  type="text"
                  placeholder="e.g. ubuntu, admin, root"
                  value={remoteUser}
                  onChange={(e) => setRemoteUser(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Authentication Type</label>
                <select
                  value={authMethod}
                  onChange={(e: any) => setAuthMethod(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                >
                  <option value="key">SSH Private Key</option>
                  <option value="password">Password (paramiko)</option>
                </select>
              </div>
            </div>

            {authMethod === 'key' ? (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Private Key Path</label>
                <input
                  type="text"
                  placeholder="C:\Users\zaid\.ssh\id_ed25519"
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="text-xs text-zinc-400 font-medium">Password</label>
                <input
                  type="password"
                  placeholder="SSH Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-100 focus:outline-none focus:border-purple-500"
                />
              </div>
            )}

            <div className="pt-2 flex items-center justify-between">
              <button
                onClick={handleTestConnection}
                disabled={testResult.testing || !remoteHost || !remoteUser}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                {testResult.testing ? 'Pinging Target...' : 'Test SSH Reachability'}
              </button>

              {testResult.message && (
                <div className={`text-xs flex items-center gap-1.5 ${testResult.ok ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {testResult.ok ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <span>{testResult.message}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Select Benchmark */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Step 2: Choose Benchmark Baseline</h2>
          <p className="text-xs text-zinc-400">Select the CIS benchmark catalog profile to evaluate against this target</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {library.slice(0, 6).map((item) => (
            <div
              key={item.name}
              onClick={() => onSelectBenchmark(item.name)}
              className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                selectedBenchmark === item.name
                  ? 'bg-purple-950/30 border-purple-500 text-white shadow-md shadow-purple-900/20'
                  : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 text-zinc-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                  <span className="font-semibold uppercase tracking-wider text-purple-400">{item.platform}</span>
                  <span>{item.checks} checks</span>
                </div>
                <h4 className="font-bold text-sm leading-snug">{item.title}</h4>
                <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{item.description}</p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">{item.profile}</span>
                {selectedBenchmark === item.name && (
                  <span className="text-purple-400 font-semibold flex items-center gap-1">
                    Selected <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Trigger */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-900/30 via-indigo-900/30 to-zinc-900 border border-purple-500/30 flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-sm font-bold text-white">
            Ready to evaluate {activeBenchmark?.title || 'Windows 10 Local'}
          </div>
          <p className="text-xs text-zinc-400">
            Target: <span className="font-semibold text-zinc-300 capitalize">{targetType} ({targetType === 'local' ? (device?.host || 'Windows PC') : (remoteHost || 'Remote')})</span> &bull; 6 parallel workers
          </p>
        </div>

        <button
          onClick={handleRun}
          disabled={isScanning || (targetType === 'remote' && (!remoteHost || !remoteUser))}
          className="px-6 py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-600/30 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isScanning ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{isScanning ? 'Auditing in Progress...' : 'Execute Compliance Audit'}</span>
        </button>
      </div>
    </div>
  );
};

