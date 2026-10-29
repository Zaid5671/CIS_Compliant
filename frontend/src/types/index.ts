export type CheckStatus = 'PASS' | 'FAIL' | 'WARN' | 'ERROR' | 'MANUAL';
export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface CheckResult {
  check_id: string;
  title: string;
  status: CheckStatus;
  severity: Severity;
  profile: string;
  category: string;
  type: string;
  evidence: string;
  expected: string;
  actual: string;
  remediation: string;
  rationale: string;
  duration_ms: number;
  error?: string;
  command?: string;
  metadata?: {
    assessment_status?: string;
    source_url?: string;
    url?: string;
    nist_controls?: string[];
    cis_controls?: string[];
    [key: string]: any;
  };
}

export interface ScanSummary {
  total: number;
  score: number;
  scored: boolean;
  failed: number;
  errored: number;
  passed: number;
  manual: number;
  warn: number;
  status_counts: Record<CheckStatus, number>;
  severity_counts: Record<Severity, number>;
  profile_counts: Record<string, number>;
  category_risk: Record<string, number>;
}

export interface ScanReport {
  benchmark: {
    title: string;
    version: string;
    platform: string;
    source: string;
    loaded_at: string;
  };
  target: {
    type: 'local' | 'remote' | 'offline_config';
    display?: string;
    host?: string;
    port?: number;
    username?: string;
    auth?: { method: string; key_path?: string };
  };
  host_context: Record<string, any>;
  summary: ScanSummary;
  started_at: string;
  finished_at: string;
  duration_ms: number;
  results: CheckResult[];
}

export interface TargetConfig {
  type: 'local' | 'remote';
  host?: string;
  port?: number;
  username?: string;
  authMethod?: 'key' | 'password';
  keyPath?: string;
  keyPassphrase?: string;
  password?: string;
}

export interface BenchmarkCatalogItem {
  name: string;
  title: string;
  platform: string;
  os_family: string;
  category: string;
  tags: string[];
  description: string;
  profile: string;
  recommended: boolean;
  available: boolean;
  checks: number;
  version?: string;
  preview?: Array<{ id: string; title: string; severity: string }>;
  severity_breakdown?: Record<Severity, number>;
}

export interface HistoryItem {
  title: string;
  score: number;
  total: number;
  passed: number;
  failed: number;
  manual: number;
  started_at: string;
  target: string;
  platform: string;
  report_file?: string;
}

export interface DeviceContext {
  host: string;
  os: string;
  release: string;
  user: string;
  arch: string;
}

