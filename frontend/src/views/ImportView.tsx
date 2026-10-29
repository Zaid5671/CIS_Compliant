import React, { useState } from 'react';
import { FileUp, FileCode, Play, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../api/client';

interface ImportViewProps {
  onScanCustomJson: (parsedJson: any) => void;
  isScanning: boolean;
}

export const ImportView: React.FC<ImportViewProps> = ({ onScanCustomJson, isScanning }) => {
  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParse = async () => {
    setError(null);
    if (!jsonText.trim()) {
      setError('Please enter or paste valid benchmark JSON.');
      return;
    }
    try {
      const res = await api.importBenchmark(jsonText);
      setPreview(res);
    } catch (err: any) {
      setError(err.message || 'Failed to parse benchmark JSON.');
    }
  };

  const handleFileDrop = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setJsonText(String(event.target?.result || ''));
    };
    reader.readAsText(file);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h2 className="text-lg font-bold text-white tracking-tight">Import Custom Benchmark</h2>
        <p className="text-xs text-zinc-400">
          Upload or paste any CIS Benchmark JSON or custom organizational baseline
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="block p-8 border-2 border-dashed border-zinc-800 hover:border-purple-500/50 rounded-2xl bg-zinc-900/40 text-center cursor-pointer transition-colors group">
            <FileUp className="w-8 h-8 text-zinc-400 group-hover:text-purple-400 mx-auto transition-colors" />
            <span className="mt-2 block text-xs font-semibold text-zinc-200">
              Click to choose .json file or drop here
            </span>
            <span className="text-[11px] text-zinc-400 block mt-0.5">Supports standard CIS & MITRE schemas</span>
            <input type="file" accept=".json,application/json" onChange={handleFileDrop} className="hidden" />
          </label>

          <div className="space-y-1.5">
            <span className="text-xs text-zinc-400 font-medium">Or paste JSON directly:</span>
            <textarea
              rows={12}
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='{ "benchmark": { "title": "Custom Baseline" }, "checks": [ ... ] }'
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 font-mono text-xs text-zinc-200 focus:outline-none focus:border-purple-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={handleParse}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-colors cursor-pointer"
            >
              Detect & Preview Schema
            </button>
            {error && (
              <span className="text-xs text-rose-400 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {error}
              </span>
            )}
          </div>
        </div>

        {/* Preview Panel */}
        <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Benchmark Preview</h3>
            <p className="text-xs text-zinc-400 mt-0.5">Detected structure and rule items</p>

            {preview ? (
              <div className="mt-4 space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1.5">
                  <div className="text-zinc-400">Title: <strong className="text-white">{preview.title || preview.benchmark?.title}</strong></div>
                  <div className="text-zinc-400">Total Checks: <strong className="text-purple-400">{preview.checks?.length || preview.count || 0} rules</strong></div>
                </div>

                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {(preview.checks || preview.preview || []).slice(0, 10).map((c: any, i: number) => (
                    <div key={i} className="p-2.5 rounded-lg bg-zinc-900/90 border border-zinc-800/80 text-[11px] flex justify-between">
                      <span className="font-mono text-purple-400 font-semibold">{c.id || i + 1}</span>
                      <span className="text-zinc-200 truncate max-w-xs">{c.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-zinc-400 text-xs">
                <FileCode className="w-8 h-8 opacity-40 mb-2" />
                Upload or paste a JSON benchmark to preview.
              </div>
            )}
          </div>

          {preview && (
            <div className="pt-4 border-t border-zinc-800">
              <button
                onClick={() => onScanCustomJson(preview.payload || preview)}
                disabled={isScanning}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-600/25"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute Audit With This Custom Benchmark</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

