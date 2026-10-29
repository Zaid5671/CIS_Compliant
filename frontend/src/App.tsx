import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './views/DashboardView';
import { SetupView } from './views/SetupView';
import { FindingsView } from './views/FindingsView';
import { LibraryView } from './views/LibraryView';
import { AnalyticsView } from './views/AnalyticsView';
import { HistoryView } from './views/HistoryView';
import { ImportView } from './views/ImportView';
import { api } from './api/client';
import { BenchmarkCatalogItem, DeviceContext, HistoryItem, ScanReport, TargetConfig } from './types';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [device, setDevice] = useState<DeviceContext | null>(null);
  const [library, setLibrary] = useState<BenchmarkCatalogItem[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [selectedBenchmark, setSelectedBenchmark] = useState('windows10-local-cis');
  const [isScanning, setIsScanning] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    // Initial fetch of system info, benchmark library, and audit history
    const initData = async () => {
      try {
        const [dev, lib, hist] = await Promise.all([
          api.getDeviceContext().catch(() => ({ host: 'Windows PC', os: 'Windows', release: '10/11', user: 'Administrator', arch: 'x64' })),
          api.getLibrary().catch(() => []),
          api.getHistory().catch(() => []),
        ]);
        setDevice(dev);
        setLibrary(lib);
        setHistory(hist);
      } catch (err: any) {
        console.error('Initialization error:', err);
      }
    };
    initData();
  }, []);

  const handleLaunchBenchmark = async (benchmarkName: string) => {
    setIsScanning(true);
    showToast(`Loading and auditing ${benchmarkName}...`, 'success');
    try {
      const sample = await api.getSample(benchmarkName);
      const scanReport = await api.runScan(sample, { type: 'local' });
      setReport(scanReport);
      setCurrentTab('findings');
      showToast(`Scan complete: ${scanReport.summary.score}% compliance score`, 'success');
      // Refresh history
      api.getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Audit failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleExecuteScan = async (benchmarkName: string, target: TargetConfig) => {
    setIsScanning(true);
    showToast(`Executing audit against ${target.type === 'local' ? 'Local Workstation' : target.host}...`, 'success');
    try {
      const sample = await api.getSample(benchmarkName);
      const scanReport = await api.runScan(sample, target);
      setReport(scanReport);
      setCurrentTab('findings');
      showToast(`Audit completed successfully with ${scanReport.summary.score}% score`, 'success');
      api.getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Audit execution failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleScanCustomJson = async (customJson: any) => {
    setIsScanning(true);
    showToast('Executing custom benchmark audit...', 'success');
    try {
      const scanReport = await api.runScan(customJson, { type: 'local' });
      setReport(scanReport);
      setCurrentTab('findings');
      showToast(`Audit completed with ${scanReport.summary.score}% score`, 'success');
      api.getHistory().then(setHistory).catch(() => {});
    } catch (err: any) {
      showToast(err.message || 'Custom scan failed', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  const handleExport = async (format: 'html' | 'csv' | 'json') => {
    if (!report) return;
    try {
      const blob = await api.exportReport(report, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cisguard-report-${Date.now()}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast(`Exported ${format.toUpperCase()} report successfully`, 'success');
    } catch (err: any) {
      showToast(err.message || `Failed to export ${format}`, 'error');
    }
  };

  const titles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: 'Security Console Dashboard', subtitle: 'Executive compliance overview and asset breakdown' },
    setup: { title: 'Setup & Execute Scan', subtitle: 'Target environment and benchmark configuration' },
    findings: { title: 'Audit Findings & Deviations', subtitle: 'Detailed control results and remediation commands' },
    library: { title: 'CIS Benchmark Catalog', subtitle: '30+ modular hardening templates across OS, network, and cloud' },
    analytics: { title: 'Compliance Insights & Risk', subtitle: 'Visual risk metrics, status distribution, and severity exposure' },
    history: { title: 'Historical Audit Log', subtitle: 'Chronological timeline of executed baseline evaluations' },
    import: { title: 'Custom Baseline Ingestion', subtitle: 'Upload and audit custom JSON policies and MITRE baselines' },
  };

  return (
    <div className="flex min-h-screen bg-[#09090b] text-zinc-100 font-sans selection:bg-purple-600/30 selection:text-purple-200">
      {/* Sleek Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        targetType={report?.target?.type || 'local'}
        activeScan={isScanning}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={titles[currentTab]?.title || 'CISGuard'}
          subtitle={titles[currentTab]?.subtitle || 'Compliance Platform'}
          device={device}
          report={report}
          onQuickLocalScan={() => handleLaunchBenchmark('windows10-local-cis')}
          onExport={handleExport}
          isScanning={isScanning}
        />

        <main className="p-8 max-w-7xl w-full mx-auto flex-1">
          {currentTab === 'dashboard' && (
            <DashboardView
              report={report}
              onNavigateTab={setCurrentTab}
              onLaunchBenchmark={handleLaunchBenchmark}
            />
          )}

          {currentTab === 'setup' && (
            <SetupView
              device={device}
              library={library}
              selectedBenchmark={selectedBenchmark}
              onSelectBenchmark={setSelectedBenchmark}
              onExecuteScan={handleExecuteScan}
              isScanning={isScanning}
            />
          )}

          {currentTab === 'findings' && (
            <FindingsView
              report={report}
              onNavigateTab={setCurrentTab}
            />
          )}

          {currentTab === 'library' && (
            <LibraryView
              library={library}
              onLaunchBenchmark={handleLaunchBenchmark}
              isScanning={isScanning}
            />
          )}

          {currentTab === 'analytics' && (
            <AnalyticsView report={report} />
          )}

          {currentTab === 'history' && (
            <HistoryView
              history={history}
              onRefresh={() => api.getHistory().then(setHistory).catch(() => {})}
            />
          )}

          {currentTab === 'import' && (
            <ImportView
              onScanCustomJson={handleScanCustomJson}
              isScanning={isScanning}
            />
          )}
        </main>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-700 shadow-2xl animate-in slide-in-from-bottom duration-200">
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400" />
          )}
          <span className="text-xs font-medium text-zinc-100">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-zinc-400 hover:text-white cursor-pointer">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
