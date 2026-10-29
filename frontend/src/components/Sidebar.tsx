import React from 'react';
import { 
  LayoutDashboard, 
  PlayCircle, 
  BookOpen, 
  ShieldAlert, 
  BarChart3, 
  History, 
  FileUp, 
  ShieldCheck,
  Server,
  Terminal
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  targetType: string;
  activeScan: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  targetType,
  activeScan,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'setup', label: 'Setup Scan', icon: PlayCircle },
    { id: 'findings', label: 'Findings', icon: ShieldAlert },
    { id: 'library', label: 'Benchmark Library', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'history', label: 'Scan History', icon: History },
    { id: 'import', label: 'Import Custom', icon: FileUp },
  ];

  return (
    <aside className="w-64 border-r border-zinc-800/80 bg-[#0d0d12]/95 backdrop-blur-xl flex flex-col justify-between shrink-0 h-screen sticky top-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 flex items-center gap-3.5 border-b border-zinc-800/60">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-500 p-[1px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-[#0d0d12] rounded-[11px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-purple-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold tracking-tight text-white text-base">CISGuard</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">v0.5</span>
            </div>
            <p className="text-xs text-zinc-400 font-medium tracking-tight">Compliance & Hardening</p>
          </div>
        </div>

        {/* Navigation list */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 group relative ${
                  isActive
                    ? 'bg-purple-600/15 text-purple-300 shadow-sm shadow-purple-500/10 border border-purple-500/25'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-purple-400' : 'text-zinc-400 group-hover:text-zinc-200'}`} />
                <span>{item.label}</span>
                {isActive && (
                  <div className="absolute right-2.5 w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.8)]" />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Target Status & Footer */}
      <div className="p-4 border-t border-zinc-800/60 space-y-3">
        <div className="p-3 rounded-xl bg-zinc-900/70 border border-zinc-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
              <Server className="w-3.5 h-3.5 text-zinc-400" />
              Target Mode
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
              {targetType}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Audit Status</span>
            <span className="flex items-center gap-1 text-zinc-300">
              <span className={`w-2 h-2 rounded-full ${activeScan ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`} />
              {activeScan ? 'Scanning...' : 'Idle / Ready'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between px-1 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3 text-zinc-400" />
            Port 8507
          </span>
          <span>Zero AI/ML &bull; Local</span>
        </div>
      </div>
    </aside>
  );
};

