import React, { useState } from 'react';
import { 
  Search, 
  BookOpen, 
  Play, 
  Eye, 
  Layers, 
  X, 
  ShieldCheck, 
  CheckCircle2, 
  ChevronRight 
} from 'lucide-react';
import { BenchmarkCatalogItem } from '../types';
import { api } from '../api/client';

interface LibraryViewProps {
  library: BenchmarkCatalogItem[];
  onLaunchBenchmark: (name: string) => void;
  isScanning: boolean;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  library,
  onLaunchBenchmark,
  isScanning,
}) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [previewItem, setPreviewItem] = useState<any | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const categories = ['All', 'Endpoint', 'Server', 'Firewall', 'Network', 'Cloud', 'Container', 'Database', 'Virtualization'];

  const filtered = library.filter((item) => {
    if (activeCategory !== 'All' && item.category?.toLowerCase() !== activeCategory.toLowerCase()) {
      return false;
    }
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchTags = (item.tags || []).some(t => t.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchTags) return false;
    }
    return true;
  });

  const handlePreview = async (item: BenchmarkCatalogItem) => {
    setLoadingPreview(true);
    try {
      const details = await api.getBenchmarkPreview(item.name);
      setPreviewItem({ ...item, details });
    } catch {
      setPreviewItem({ ...item, details: { preview: [] } });
    } finally {
      setLoadingPreview(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                  : 'bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search 30+ CIS benchmarks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-9 pr-3.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-purple-500 transition-colors"
          />
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((benchmark) => (
          <div
            key={benchmark.name}
            className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 hover:bg-zinc-900/70 transition-all flex flex-col justify-between group"
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-purple-500/10 text-purple-300 border border-purple-500/20">
                  {benchmark.category || 'Benchmark'}
                </span>
                <span className="font-mono text-zinc-400 text-[11px] font-medium">
                  {benchmark.checks} checks
                </span>
              </div>

              <h3 className="font-bold text-white text-base group-hover:text-purple-300 transition-colors">
                {benchmark.title}
              </h3>
              <p className="text-xs text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                {benchmark.description}
              </p>

              <div className="flex flex-wrap gap-1.5 mt-3">
                {(benchmark.tags || []).slice(0, 3).map((tag) => (
                  <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-zinc-800/60 flex items-center justify-between">
              <button
                onClick={() => handlePreview(benchmark)}
                className="text-xs text-zinc-400 hover:text-zinc-200 font-medium flex items-center gap-1.5 cursor-pointer py-1"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Preview Rules</span>
              </button>

              <button
                onClick={() => onLaunchBenchmark(benchmark.name)}
                disabled={isScanning}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-current" />
                <span>Audit</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-[#101017] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-zinc-800/80 flex items-start justify-between">
              <div>
                <span className="text-xs font-semibold text-purple-400 uppercase tracking-wider">{previewItem.category} &bull; {previewItem.platform}</span>
                <h3 className="text-lg font-bold text-white mt-1">{previewItem.title}</h3>
                <p className="text-xs text-zinc-400 mt-1">{previewItem.description}</p>
              </div>
              <button
                onClick={() => setPreviewItem(null)}
                className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1 text-xs max-h-[55vh]">
              <div className="flex items-center justify-between pb-1 border-b border-zinc-800/60">
                <h4 className="font-semibold text-zinc-300 uppercase tracking-wider text-[11px]">
                  Included Benchmark Rules ({previewItem.checks} checks)
                </h4>
              </div>
              <div className="space-y-2 pt-1">
                {(previewItem.details?.preview || []).map((check: any) => (
                  <div key={check.id} className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800/70 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-purple-400 font-semibold">{check.id}</span>
                        {check.category && (
                          <span className="text-[10px] text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50">
                            {check.category}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-zinc-200 mt-1 leading-snug">{check.title}</p>
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                      {check.severity}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-zinc-800/80 bg-zinc-950/60 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono">Profile: {previewItem.profile}</span>
              <button
                onClick={() => {
                  const name = previewItem.name;
                  setPreviewItem(null);
                  onLaunchBenchmark(name);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch This Benchmark</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

