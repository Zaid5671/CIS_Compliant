import React from 'react';
import { History, Calendar, Server, Laptop, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { HistoryItem } from '../types';

interface HistoryViewProps {
  history: HistoryItem[];
  onRefresh: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({ history, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">Audit Log & History</h2>
          <p className="text-xs text-zinc-400">Chronological history of compliance scans executed on this console</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
        >
          Refresh Log
        </button>
      </div>

      <div className="space-y-3">
        {history.length === 0 ? (
          <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80 text-zinc-400 text-xs">
            No audit history found. Run your first benchmark from Setup Scan.
          </div>
        ) : (
          history.map((item, index) => {
            const isPassing = item.score >= 70;
            return (
              <div
                key={index}
                className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight border ${
                    isPassing ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-rose-500/10 text-rose-400 border-rose-500/25'
                  }`}>
                    {item.score}%
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-zinc-100 group-hover:text-purple-300 transition-colors">
                      {item.title}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {new Date(item.started_at).toLocaleString()}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1 font-mono text-[11px]">
                        <Server className="w-3.5 h-3.5 text-zinc-400" />
                        {item.target || 'Local device'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {item.passed} Pass
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      {item.failed} Fail
                    </span>
                    {item.manual > 0 && (
                      <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {item.manual} Manual
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

