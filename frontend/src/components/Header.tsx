import React from 'react';
import { Play, Download, Laptop, CheckCircle2 } from 'lucide-react';
import { DeviceContext, ScanReport } from '../types';

interface HeaderProps {
  title: string;
  subtitle: string;
  device?: DeviceContext | null;
  report?: ScanReport | null;
  onQuickLocalScan: () => void;
  onExport: (format: 'html' | 'csv' | 'json') => void;
  isScanning: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  device,
  report,
  onQuickLocalScan,
  onExport,
  isScanning,
}) => {
  return (
    <header className="h-20 border-b border-zinc-800/80 px-8 flex items-center justify-between bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-20">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          {title}
        </h1>
        <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {device && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-400 font-mono">
            <Laptop className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-300 font-medium">{device.host || 'Windows PC'}</span>
            <span className="text-zinc-400">&bull;</span>
            <span>{device.os} {device.arch}</span>
          </div>
        )}

        {report && (
          <div className="flex items-center gap-1.5 bg-zinc-900/80 p-1 rounded-xl border border-zinc-800">
            <button
              onClick={() => onExport('html')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
              title="Download Standalone HTML Report"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>HTML</span>
            </button>
            <button
              onClick={() => onExport('csv')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Download CSV findings"
            >
              CSV
            </button>
            <button
              onClick={() => onExport('json')}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Download JSON report"
            >
              JSON
            </button>
          </div>
        )}

        <button
          onClick={onQuickLocalScan}
          disabled={isScanning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/25 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95"
        >
          {isScanning ? (
            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>{isScanning ? 'Auditing...' : 'Quick Local Audit'}</span>
        </button>
      </div>
    </header>
  );
};

