import {
  AnalyticsSummary,
  BenchmarkCatalogItem,
  DeviceContext,
  FleetSummary,
  HistoryItem,
  ScanReport,
  TargetConfig,
} from '../types';

function getSessionToken(): string {
  const metaToken = document.querySelector('meta[name="omni-token"]')?.getAttribute('content');
  if (metaToken && metaToken !== '__OMNI_TOKEN__') {
    return metaToken;
  }
  const urlParams = new URLSearchParams(window.location.search);
  const paramToken = urlParams.get('token');
  if (paramToken) {
    return paramToken;
  }
  return sessionStorage.getItem('omni_token') || '';
}

export function saveSessionToken(token: string) {
  if (token) sessionStorage.setItem('omni_token', token);
}

function getHeaders(extra: HeadersInit = {}): HeadersInit {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string>),
  };
  if (token) {
    headers['X-OMNI-Token'] = token;
  }
  return headers;
}

export const api = {
  async getHealth(): Promise<{ ok: boolean; service: string; version: string }> {
    const res = await fetch('/api/health');
    return res.json();
  },

  async getDeviceContext(): Promise<DeviceContext> {
    const res = await fetch('/api/device', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch device context');
    return res.json();
  },

  async getLibrary(): Promise<BenchmarkCatalogItem[]> {
    const res = await fetch('/api/library', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch benchmark library');
    const data = await res.json();
    return data.benchmarks || [];
  },

  async getBenchmarkPreview(name: string): Promise<any> {
    const res = await fetch(`/api/library/preview?name=${encodeURIComponent(name)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to preview benchmark');
    return res.json();
  },

  async getSample(name: string): Promise<any> {
    const res = await fetch(`/api/sample?name=${encodeURIComponent(name)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load sample benchmark');
    return res.json();
  },

  async testTarget(target: TargetConfig): Promise<{ ok: boolean; context?: any; error?: string }> {
    const payload = target.type === 'local' ? { type: 'local' } : {
      type: 'remote',
      host: target.host,
      port: target.port || 22,
      username: target.username,
      protocol: 'ssh',
      auth: {
        method: target.authMethod || 'key',
        key_path: target.keyPath || '',
        key_passphrase: target.keyPassphrase || '',
        password: target.password || '',
      },
    };
    const res = await fetch('/api/targets/test', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return res.json();
  },

  async runScan(benchmarkJson: any, target: TargetConfig, workers = 6): Promise<ScanReport> {
    const targetPayload = target.type === 'local' ? { type: 'local' } : {
      type: 'remote',
      host: target.host,
      port: target.port || 22,
      username: target.username,
      protocol: 'ssh',
      auth: {
        method: target.authMethod || 'key',
        key_path: target.keyPath || '',
        key_passphrase: target.keyPassphrase || '',
        password: target.password || '',
      },
    };

    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        benchmark_json: benchmarkJson,
        target: targetPayload,
        options: { workers },
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Scan failed to execute');
    }

    return res.json();
  },

  async getHistory(): Promise<HistoryItem[]> {
    const res = await fetch('/api/history', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch history');
    const data = await res.json();
    return data.entries || [];
  },

  async exportReport(report: ScanReport, format: 'html' | 'csv' | 'json'): Promise<Blob> {
    if (format === 'json') {
      const jsonStr = JSON.stringify(report, null, 2);
      return new Blob([jsonStr], { type: 'application/json' });
    }

    const endpoint = format === 'csv' ? '/api/export/csv' : '/api/export/html';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ report }),
    });

    if (!res.ok) throw new Error(`Failed to export ${format}`);
    return res.blob();
  },

  async importBenchmark(text: string): Promise<any> {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to parse benchmark');
    }
    return res.json();
  },

  async getFleet(): Promise<FleetSummary> {
    const res = await fetch('/api/fleet', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch fleet aggregation');
    return res.json();
  },

  async getAssetReport(assetId: string): Promise<ScanReport> {
    const res = await fetch(`/api/fleet/asset?id=${encodeURIComponent(assetId)}`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to load asset report for ${assetId}`);
    return res.json();
  },

  async getAnalyticsSummary(): Promise<AnalyticsSummary> {
    const res = await fetch('/api/analytics/summary', { headers: getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch analytics summary');
    return res.json();
  },
};

