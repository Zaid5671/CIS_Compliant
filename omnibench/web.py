from __future__ import annotations

import argparse
import getpass
import json
import mimetypes
import platform
import re
import sys
import threading
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from . import __version__
from .loader import load_benchmark
from .paths import SAMPLE_DIR, STATIC_DIR, reports_dir as default_reports_dir
from .reporting import results_to_csv, results_to_html_report
from .runner import run_scan
from .runners import LocalRunner, make_runner
from .security import (
    MAX_BODY_BYTES,
    constant_time_compare,
    generate_session_token,
    host_allowed,
)
from .targets import LOCAL, Target


TOKEN_PLACEHOLDER = "__OMNI_TOKEN__"
TOKEN_HEADER = "X-OMNI-Token"
HISTORY_FILENAME = "history.jsonl"
HISTORY_LIMIT = 25

BENCHMARK_CATALOG: list[dict[str, Any]] = [
    {
        "name": "windows10-local-cis",
        "title": "Windows 10 Local",
        "platform": "Windows 10",
        "os_family": "windows",
        "category": "Endpoint",
        "tags": ["windows", "endpoint", "local", "cis"],
        "description": "Read-only local checks for Windows 10 Enterprise and workstation baselines.",
        "profile": "Level 1",
        "recommended": True,
    },
    {
        "name": "windows-server-datacenter-cis",
        "title": "Windows Server Datacenter",
        "platform": "Windows Server",
        "os_family": "windows",
        "category": "Server",
        "tags": ["windows", "server", "cis"],
        "description": "Server hardening checks for Datacenter member servers and general server workloads.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "windows-server-core-cis",
        "title": "Windows Server Core",
        "platform": "Windows Server Core",
        "os_family": "windows",
        "category": "Server",
        "tags": ["windows", "server-core", "cis"],
        "description": "Core-friendly server checks without interactive desktop controls.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "windows-domain-controller-cis",
        "title": "Windows Domain Controller",
        "platform": "Windows Server AD DS",
        "os_family": "windows",
        "category": "Identity",
        "tags": ["windows", "ad-ds", "domain-controller", "cis"],
        "description": "Domain controller service and policy checks for AD DS hosts.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "windows-hyper-v-cis",
        "title": "Windows Hyper-V Host",
        "platform": "Windows Hyper-V",
        "os_family": "windows",
        "category": "Virtualization",
        "tags": ["windows", "hyper-v", "virtualization", "cis"],
        "description": "Hyper-V host checks for core services, firewall, Defender, and legacy protocol exposure.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "cis-bench-sample",
        "title": "CIS-Bench JSON Import",
        "platform": "Imported Benchmark",
        "os_family": "mixed",
        "category": "Importer",
        "tags": ["importer", "cis-bench"],
        "description": "Sample of the mitre/cis-bench JSON import workflow with mappings preserved.",
        "profile": "Imported",
        "recommended": False,
    },
    {
        "name": "windows-basic",
        "title": "Windows Starter",
        "platform": "Windows",
        "os_family": "windows",
        "category": "Sample",
        "tags": ["windows", "starter", "sample"],
        "description": "Small starter benchmark for quick UI and scanner validation.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "linux-basic",
        "title": "Linux Starter",
        "platform": "Linux",
        "os_family": "linux",
        "category": "Sample",
        "tags": ["linux", "starter", "sample"],
        "description": "Small sample benchmark for Linux-compatible local checks.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "ubuntu-22-04-cis-starter",
        "title": "Ubuntu 22.04 Starter",
        "platform": "Ubuntu 22.04",
        "os_family": "linux",
        "category": "Server",
        "tags": ["linux", "ubuntu", "cis", "remote-friendly"],
        "description": "Starter set of Ubuntu hardening checks suitable for SSH remote scans.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "macos-starter",
        "title": "macOS Starter",
        "platform": "macOS",
        "os_family": "macos",
        "category": "Endpoint",
        "tags": ["macos", "endpoint", "starter"],
        "description": "Starter macOS posture review with primarily manual recommendations.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "network-device-ssh-starter",
        "title": "Network Device Starter",
        "platform": "Network Devices",
        "os_family": "network",
        "category": "Network",
        "tags": ["network", "ssh", "starter"],
        "description": "Starter SSH-driven checks for network appliances (banner, version, MOTD).",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "hyperv-local-cis",
        "title": "Hyper-V Local Role Audit",
        "platform": "Windows Hyper-V",
        "os_family": "hypervisor",
        "category": "Virtualization",
        "tags": ["hyperv", "windows", "virtualization", "cis", "local"],
        "description": "Hyper-V role configuration audit on the local host: VMs, Secure Boot, vTPM, switches, Live Migration, Device Guard.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "esxi-host-cis",
        "title": "VMware ESXi Host",
        "platform": "VMware ESXi",
        "os_family": "hypervisor",
        "category": "Virtualization",
        "tags": ["esxi", "vmware", "virtualization", "cis", "ssh"],
        "description": "ESXi host hardening via SSH (esxcli + vim-cmd): lockdown mode, NTP, banner, Secure Boot, services.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "proxmox-host-cis",
        "title": "Proxmox VE Host",
        "platform": "Proxmox VE",
        "os_family": "hypervisor",
        "category": "Virtualization",
        "tags": ["proxmox", "kvm", "virtualization", "cis", "ssh"],
        "description": "Proxmox VE host audit via SSH: version, datacenter firewall, backups, MFA, SSH hardening.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "kvm-host-cis",
        "title": "Linux KVM / libvirt Host",
        "platform": "Linux KVM",
        "os_family": "hypervisor",
        "category": "Virtualization",
        "tags": ["kvm", "libvirt", "linux", "virtualization", "ssh"],
        "description": "KVM hypervisor audit via SSH: libvirtd, IOMMU, AppArmor/SELinux, VM privilege separation, default network.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "rhel-9-cis-starter",
        "title": "RHEL 9 / Rocky / Alma / CentOS Stream 9",
        "platform": "RHEL 9",
        "os_family": "linux",
        "category": "Server",
        "tags": ["linux", "rhel", "rocky", "alma", "centos", "cis"],
        "description": "RHEL 9-family host hardening: SELinux, firewalld, chronyd, auditd, SSH, AIDE, dnf-automatic.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "debian-12-cis-starter",
        "title": "Debian 12 Bookworm",
        "platform": "Debian 12",
        "os_family": "linux",
        "category": "Server",
        "tags": ["linux", "debian", "bookworm", "cis"],
        "description": "Debian 12 host hardening: AppArmor, nftables, timesyncd/chrony, auditd, SSH, unattended-upgrades.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "docker-cis-starter",
        "title": "Docker Engine",
        "platform": "Docker",
        "os_family": "container",
        "category": "Container",
        "tags": ["docker", "container", "cis"],
        "description": "Docker daemon + container runtime audit: live-restore, overlay2, socket perms, privileged/root containers, AppArmor.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "kubernetes-cis-starter",
        "title": "Kubernetes Control Plane + Worker",
        "platform": "Kubernetes",
        "os_family": "container",
        "category": "Container",
        "tags": ["kubernetes", "k8s", "container", "cis"],
        "description": "kube-apiserver, etcd, kubelet hardening: anonymous-auth, authz mode, TLS, audit log, Pod Security Standards.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "postgresql-cis-starter",
        "title": "PostgreSQL 15+",
        "platform": "PostgreSQL",
        "os_family": "database",
        "category": "Database",
        "tags": ["postgresql", "postgres", "database", "cis"],
        "description": "PostgreSQL server hardening: SSL, scram-sha-256, log_connections, listen_addresses, pgaudit, pg_hba.conf.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "mysql-8-cis-starter",
        "title": "MySQL 8.0",
        "platform": "MySQL 8",
        "os_family": "database",
        "category": "Database",
        "tags": ["mysql", "database", "cis"],
        "description": "MySQL 8.0 audit: TLS, caching_sha2_password, local_infile, secure_file_priv, empty passwords, SUPER privilege review.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "mongodb-cis-starter",
        "title": "MongoDB 6+",
        "platform": "MongoDB",
        "os_family": "database",
        "category": "Database",
        "tags": ["mongodb", "database", "nosql", "cis"],
        "description": "MongoDB audit: authorization enabled, requireTLS, JS disabled, bindIp, audit log, keyFile / x.509 cluster auth.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "nginx-cis-starter",
        "title": "nginx Web Server",
        "platform": "nginx",
        "os_family": "web-server",
        "category": "Web Server",
        "tags": ["nginx", "web", "tls", "cis"],
        "description": "nginx hardening: server_tokens, TLS 1.2/1.3 only, prefer-server-ciphers, security headers, access_log, rate limiting.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "apache-cis-starter",
        "title": "Apache httpd",
        "platform": "Apache httpd 2.4",
        "os_family": "web-server",
        "category": "Web Server",
        "tags": ["apache", "httpd", "web", "tls", "cis"],
        "description": "Apache hardening: ServerTokens Prod, TraceEnable Off, TLS protocols, -Indexes, X-Frame-Options, HSTS, mod_security.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "iis-cis-starter",
        "title": "Windows IIS 10",
        "platform": "Windows IIS",
        "os_family": "web-server",
        "category": "Web Server",
        "tags": ["iis", "windows", "web", "tls", "cis"],
        "description": "IIS hardening via PowerShell + registry: legacy TLS disabled, request filtering, security headers, app-pool isolation.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "aws-foundations-cis-starter",
        "title": "AWS Foundations",
        "platform": "AWS",
        "os_family": "cloud",
        "category": "Cloud",
        "tags": ["aws", "cloud", "cis", "foundations", "aws-cli"],
        "description": "AWS account-level baseline: root MFA, IAM password policy, multi-region CloudTrail, S3 public access block, default SG.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "azure-foundations-cis-starter",
        "title": "Azure Foundations",
        "platform": "Microsoft Azure",
        "os_family": "cloud",
        "category": "Cloud",
        "tags": ["azure", "cloud", "cis", "foundations", "az-cli"],
        "description": "Azure subscription baseline: Entra ID admin / MFA / legacy auth, Defender for Cloud, Storage, SQL TLS, NSG admin ports.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "gcp-foundations-cis-starter",
        "title": "GCP Foundations",
        "platform": "Google Cloud Platform",
        "os_family": "cloud",
        "category": "Cloud",
        "tags": ["gcp", "google-cloud", "cis", "foundations", "gcloud"],
        "description": "GCP organization/project baseline: IAM, SA keys, audit logging, firewall, GCS public access, Cloud SQL SSL, SCC.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "m365-cis-starter",
        "title": "Microsoft 365",
        "platform": "Microsoft 365",
        "os_family": "office-suite",
        "category": "Office Suite",
        "tags": ["m365", "office365", "entra", "cis"],
        "description": "M365 tenant baseline: legacy auth block, MFA, SSPR methods, Exchange Online forwarding, Defender Safe Links, SharePoint sharing.",
        "profile": "Level 1",
        "recommended": False,
    },
    {
        "name": "cisco-ios-cis-starter",
        "title": "Cisco IOS / IOS XE",
        "platform": "Cisco IOS",
        "os_family": "network",
        "category": "Network",
        "tags": ["cisco", "ios", "network", "ssh", "cis"],
        "description": "Cisco IOS device audit via SSH: ssh v2, http server, password-encryption, enable secret, vty access-class, NTP authentication.",
        "profile": "Level 1",
        "recommended": False,
    },
]


class CatalogCache:
    """Caches parsed benchmark previews keyed by file mtime."""

    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def get(self, name: str) -> dict[str, Any] | None:
        sample_path = SAMPLE_DIR / f"{name}.json"
        with self._lock:
            try:
                mtime = sample_path.stat().st_mtime
            except OSError:
                self._entries.pop(name, None)
                return None
            cached = self._entries.get(name)
            if cached and cached[0] == mtime:
                return cached[1]
            try:
                payload = json.loads(sample_path.read_text(encoding="utf-8"))
                meta, checks = load_benchmark(payload, source=str(sample_path))
                data: dict[str, Any] = {
                    "checks": len(checks),
                    "title": meta.title,
                    "version": meta.version,
                    "platform": meta.platform,
                    "preview": _preview(checks),
                }
            except Exception as exc:  # noqa: BLE001 - keep catalog alive on bad sample
                data = {"checks": 0, "error": str(exc)}
            self._entries[name] = (mtime, data)
            return data


def _preview(checks) -> list[dict[str, Any]]:
    items = []
    for check in checks[:5]:
        items.append({
            "id": check.id,
            "title": check.title,
            "type": check.type,
            "severity": check.severity,
            "category": check.category,
            "profile": check.profile,
        })
    return items


_history_lock = threading.Lock()


def _history_path(reports: Path) -> Path:
    return Path(reports) / HISTORY_FILENAME


def append_history(reports: Path, entry: dict[str, Any]) -> None:
    """Append a scan summary to history.jsonl, best-effort."""
    try:
        reports = Path(reports)
        reports.mkdir(parents=True, exist_ok=True)
        path = _history_path(reports)
        with _history_lock:
            with path.open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(entry) + "\n")
    except OSError as exc:
        print(f"warning: could not append history: {exc}", file=sys.stderr)


def read_history(reports: Path, limit: int = HISTORY_LIMIT) -> list[dict[str, Any]]:
    """Read up to `limit` most recent history entries (newest first)."""
    path = _history_path(Path(reports))
    if not path.exists():
        return []
    entries: list[dict[str, Any]] = []
    try:
        with path.open("r", encoding="utf-8") as handle:
            for line in handle:
                line = line.strip()
                if not line:
                    continue
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except OSError:
        return []
    entries.reverse()
    return entries[:limit]


def _classify_asset_category(platform_str: str = "", title: str = "", os_family: str = "") -> str:
    combined = f"{platform_str} {title} {os_family}".lower()
    if any(k in combined for k in ("firewall", "palo alto", "fortinet", "fortios", "asa", "checkpoint", "pfsense", "opnsense")):
        return "firewall"
    if any(k in combined for k in ("cisco", "switch", "router", "ios-xe", "ios xe", "juniper", "arista", "network")):
        return "network"
    if any(k in combined for k in ("linux", "ubuntu", "debian", "rhel", "centos", "redhat", "fedora", "suse", "alpine")):
        return "linux"
    if any(k in combined for k in ("windows", "win10", "win11", "server", "hyper-v", "domain-controller", "ad ds")):
        return "windows"
    return "other"


def _resolve_asset_id(target: dict[str, Any], benchmark: dict[str, Any], host_context: dict[str, Any]) -> str:
    category = _classify_asset_category(
        benchmark.get("platform", ""),
        benchmark.get("title", ""),
        benchmark.get("os_family", ""),
    )
    target_type = target.get("type", "local")
    host = target.get("host") or host_context.get("host") or ""
    if target_type == "local":
        node = host or platform.node() or "localhost"
        safe_node = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", node)
        return f"local-{category}-{safe_node}".lower()
    elif target_type in {"remote", "ssh"}:
        port = target.get("port", 22)
        safe_host = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", str(host or "host"))
        return f"ssh-{safe_host}-{port}".lower()
    else:
        title = benchmark.get("title") or "target"
        safe_title = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", title)
        return f"config-{safe_title}".lower()


def _resolve_asset_name(target: dict[str, Any], host_context: dict[str, Any], benchmark: dict[str, Any]) -> str:
    category = _classify_asset_category(
        benchmark.get("platform", ""),
        benchmark.get("title", ""),
        benchmark.get("os_family", ""),
    )
    cat_label = {
        "windows": "Windows",
        "linux": "Linux",
        "firewall": "Firewall",
        "network": "Network",
    }.get(category, "Device")
    if target.get("type") == "local":
        node = host_context.get("host") or platform.node() or "Local Machine"
        return f"{node} ({cat_label})"
    elif target.get("host"):
        user = target.get("username")
        host = target.get("host")
        port = target.get("port") or 22
        prefix = f"{user}@" if user else ""
        return f"{prefix}{host}:{port} ({cat_label})"
    title = benchmark.get("title") or "Asset"
    return f"{title} ({cat_label})"


def _summary_to_history(report: dict[str, Any]) -> dict[str, Any]:
    benchmark = report.get("benchmark", {}) if isinstance(report.get("benchmark"), dict) else {}
    target = report.get("target", {}) if isinstance(report.get("target"), dict) else {}
    summary = report.get("summary", {}) if isinstance(report.get("summary"), dict) else {}
    host_context = report.get("host_context", {}) if isinstance(report.get("host_context"), dict) else {}

    asset_id = report.get("asset_id") or _resolve_asset_id(target, benchmark, host_context)
    asset_category = report.get("asset_category") or _classify_asset_category(
        benchmark.get("platform", ""), benchmark.get("title", ""), benchmark.get("os_family", "")
    )
    asset_name = report.get("asset_name") or _resolve_asset_name(target, host_context, benchmark)

    return {
        "asset_id": asset_id,
        "asset_category": asset_category,
        "asset_name": asset_name,
        "benchmark_title": benchmark.get("title"),
        "benchmark_version": benchmark.get("version"),
        "platform": benchmark.get("platform"),
        "target_display": target.get("display") or target.get("type") or "local",
        "target_type": target.get("type") or "local",
        "score": summary.get("score", 0),
        "passed": summary.get("passed", 0),
        "failed": summary.get("failed", 0),
        "errored": summary.get("errored", 0),
        "manual": summary.get("manual", 0),
        "total_checks": summary.get("total", 0),
        "duration_ms": report.get("duration_ms", 0),
        "started_at": report.get("started_at"),
        "finished_at": report.get("finished_at"),
    }


def _load_fleet_data(reports_dir: Path) -> dict[str, Any]:
    assets_dir = reports_dir / "assets"
    assets_by_id: dict[str, dict[str, Any]] = {}

    # 1. Load persisted asset reports
    if assets_dir.exists():
        for file in assets_dir.glob("*.json"):
            try:
                report = json.loads(file.read_text(encoding="utf-8"))
                target = report.get("target") or {}
                benchmark = report.get("benchmark") or {}
                summary = report.get("summary") or {}
                host_context = report.get("host_context") or {}
                asset_id = report.get("asset_id") or file.stem
                category = report.get("asset_category") or _classify_asset_category(
                    benchmark.get("platform", ""), benchmark.get("title", ""), benchmark.get("os_family", "")
                )
                name = report.get("asset_name") or _resolve_asset_name(target, host_context, benchmark)

                assets_by_id[asset_id] = {
                    "asset_id": asset_id,
                    "name": name,
                    "category": category,
                    "target_type": target.get("type", "local"),
                    "target_display": target.get("display") or target.get("host") or "Local device",
                    "benchmark_title": benchmark.get("title", ""),
                    "score": summary.get("score", 0),
                    "passed": summary.get("passed", 0),
                    "failed": summary.get("failed", 0),
                    "errored": summary.get("errored", 0),
                    "manual": summary.get("manual", 0),
                    "total_checks": summary.get("total", 0),
                    "finished_at": report.get("finished_at", ""),
                    "severity_counts": summary.get("severity_counts", {}),
                    "scored": summary.get("scored", True),
                }
            except Exception:
                continue

    # 2. Check history.jsonl for past scans not yet saved in assets/
    history_entries = read_history(reports_dir, limit=100)
    for entry in history_entries:
        cat = entry.get("asset_category") or _classify_asset_category(
            entry.get("platform", ""), entry.get("benchmark_title", "")
        )
        asset_id = entry.get("asset_id")
        if not asset_id:
            disp = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", entry.get("target_display", "local"))
            asset_id = f"legacy-{cat}-{disp}".lower()
        if asset_id not in assets_by_id:
            name = entry.get("asset_name") or f"{entry.get('benchmark_title', 'Legacy')} ({cat.title()})"
            assets_by_id[asset_id] = {
                "asset_id": asset_id,
                "name": name,
                "category": cat,
                "target_type": entry.get("target_type", "local"),
                "target_display": entry.get("target_display", "Local device"),
                "benchmark_title": entry.get("benchmark_title", ""),
                "score": entry.get("score", 0),
                "passed": entry.get("passed", 0),
                "failed": entry.get("failed", 0),
                "errored": entry.get("errored", 0),
                "manual": entry.get("manual", 0),
                "total_checks": entry.get("total_checks", 0),
                "finished_at": entry.get("finished_at", ""),
                "severity_counts": {},
                "scored": True,
            }

    assets = sorted(assets_by_id.values(), key=lambda a: a.get("finished_at") or "", reverse=True)

    # Calculate overall fleet score
    scored_assets = [a for a in assets if a.get("scored", True) and (a.get("passed", 0) + a.get("failed", 0)) > 0]
    total_passed = sum(a.get("passed", 0) for a in scored_assets)
    total_failed = sum(a.get("failed", 0) for a in scored_assets)
    total_evaluated = total_passed + total_failed
    fleet_score = round((total_passed / total_evaluated) * 100, 1) if total_evaluated > 0 else 0.0

    # 4 Pillar Breakdown
    pillar_keys = ("windows", "linux", "firewall", "network")
    category_scores: dict[str, dict[str, Any]] = {}
    for p_key in pillar_keys:
        p_assets = [a for a in assets if a.get("category") == p_key]
        p_passed = sum(a.get("passed", 0) for a in p_assets)
        p_failed = sum(a.get("failed", 0) for a in p_assets)
        p_total_checks = sum(a.get("total_checks", 0) for a in p_assets)
        p_eval = p_passed + p_failed
        p_score = round((p_passed / p_eval) * 100, 1) if p_eval > 0 else 0.0
        category_scores[p_key] = {
            "score": p_score,
            "count": len(p_assets),
            "passed": p_passed,
            "failed": p_failed,
            "total_checks": p_total_checks,
        }

    # Aggregate Fleet Severity Counts
    fleet_severity = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for a in assets:
        for sev, cnt in a.get("severity_counts", {}).items():
            s = str(sev).upper()
            if s in fleet_severity:
                fleet_severity[s] += cnt

    return {
        "fleet_score": fleet_score,
        "total_assets": len(assets),
        "total_evaluated_checks": total_evaluated,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "last_audit": assets[0]["finished_at"] if assets else None,
        "category_scores": category_scores,
        "severity_counts": fleet_severity,
        "assets": assets,
    }


def _load_asset_report(reports_dir: Path, asset_id: str) -> dict[str, Any] | None:
    safe_id = re.sub(r"[^a-zA-Z0-9_\-\.]", "_", asset_id)
    path = reports_dir / "assets" / f"{safe_id}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return None
    # Fallback to main reports dir
    alt_path = reports_dir / f"{safe_id}.json"
    if alt_path.exists():
        try:
            return json.loads(alt_path.read_text(encoding="utf-8"))
        except Exception:
            return None
    return None


def _load_analytics_summary(reports_dir: Path) -> dict[str, Any]:
    history_entries = read_history(reports_dir, limit=50)
    chrono_history = list(reversed(history_entries))
    timeline = []
    for h in chrono_history:
        cat = h.get("asset_category") or _classify_asset_category(
            h.get("platform", ""), h.get("benchmark_title", "")
        )
        timeline.append({
            "date": h.get("finished_at") or h.get("started_at") or "",
            "score": h.get("score", 0),
            "asset_name": h.get("asset_name") or h.get("benchmark_title") or "Device",
            "category": cat,
            "passed": h.get("passed", 0),
            "failed": h.get("failed", 0),
            "total": h.get("total_checks", 0),
        })

    assets_dir = reports_dir / "assets"
    failing_controls_map: dict[str, dict[str, Any]] = {}
    cross_asset_severity = {
        "windows": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "linux": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "firewall": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
        "network": {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0},
    }

    if assets_dir.exists():
        for file in assets_dir.glob("*.json"):
            try:
                report = json.loads(file.read_text(encoding="utf-8"))
                cat = report.get("asset_category") or "windows"
                results = report.get("results") or []
                for res in results:
                    sev = str(res.get("severity", "MEDIUM")).upper()
                    if cat in cross_asset_severity and sev in cross_asset_severity[cat]:
                        if res.get("status") in {"FAIL", "WARN"}:
                            cross_asset_severity[cat][sev] += 1

                    if res.get("status") in {"FAIL", "WARN"}:
                        cid = str(res.get("check_id") or res.get("id") or "")
                        if not cid:
                            continue
                        if cid not in failing_controls_map:
                            failing_controls_map[cid] = {
                                "id": cid,
                                "title": res.get("title", ""),
                                "severity": sev,
                                "category": res.get("category", "General"),
                                "fail_count": 0,
                                "affected_assets": [],
                            }
                        failing_controls_map[cid]["fail_count"] += 1
                        asset_disp = report.get("asset_name") or file.stem
                        if asset_disp not in failing_controls_map[cid]["affected_assets"]:
                            failing_controls_map[cid]["affected_assets"].append(asset_disp)
            except Exception:
                continue

    top_failing = sorted(failing_controls_map.values(), key=lambda x: x["fail_count"], reverse=True)[:8]

    return {
        "timeline": timeline,
        "top_failing_controls": top_failing,
        "cross_asset_severity": cross_asset_severity,
    }


class OMNIRequestHandler(BaseHTTPRequestHandler):
    server_version = f"OmniBench/{__version__}"
    catalog_cache = CatalogCache()

    def log_message(self, format: str, *args) -> None:  # noqa: A002 - inherited API name
        print(f"{self.address_string()} - {format % args}")

    def _allow_remote(self) -> bool:
        return bool(getattr(self.server, "allow_remote", False))

    def _expected_token(self) -> str:
        return str(getattr(self.server, "omni_token", ""))

    def _reports_dir(self) -> Path:
        return Path(getattr(self.server, "reports_dir", None) or default_reports_dir())

    def _enforce_host(self) -> bool:
        host_header = self.headers.get("Host", "")
        if not host_allowed(host_header, self._allow_remote()):
            self._send_error(HTTPStatus.FORBIDDEN, "Host not permitted. The dashboard only accepts loopback requests.")
            return False
        return True

    def _enforce_token(self) -> bool:
        expected = self._expected_token()
        if not expected:
            return True
        provided = self.headers.get(TOKEN_HEADER, "")
        if not constant_time_compare(provided, expected):
            self._send_error(HTTPStatus.FORBIDDEN, "Missing or invalid session token.")
            return False
        return True

    def _enforce_json_content_type(self) -> bool:
        content_type = self.headers.get("Content-Type", "").lower()
        if "application/json" not in content_type:
            self._send_error(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Requests must use application/json.")
            return False
        return True

    def do_GET(self) -> None:
        if not self._enforce_host():
            return
        parsed = urlparse(self.path)
        path = parsed.path
        # Bootstrap assets (index + static) load without a token so the page can
        # render and then authenticate; /api/health is an unauthenticated liveness
        # probe. Every other /api/* route requires the session token in ALL bind
        # modes (closes the unauthenticated read surface under --allow-remote).
        if path in {"/", "/index.html"}:
            self._send_index()
            return
        if path.startswith("/static/"):
            self._send_file(STATIC_DIR / path.removeprefix("/static/"))
            return
        if path == "/api/health":
            self._send_json({"ok": True, "service": "omnibench", "version": __version__})
            return
        if path.startswith("/api/") and not self._enforce_token():
            return
        if path == "/api/version":
            self._send_json({"version": __version__, "service": "omnibench"})
            return
        if path == "/api/device":
            self._send_json(_device_context())
            return
        if path == "/api/library":
            self._send_json({"benchmarks": _benchmark_library(self._imported_dir())})
            return
        if path == "/api/benchmarks":
            self._send_json({"benchmarks": _benchmark_catalog(self._imported_dir())})
            return
        if path == "/api/library/preview":
            params = parse_qs(parsed.query)
            self._send_library_preview(params.get("name", [""])[0], self._imported_dir())
            return
        if path == "/api/sample":
            params = parse_qs(parsed.query)
            self._send_sample(params.get("name", ["windows-basic"])[0], self._imported_dir())
            return
        if path == "/api/history":
            entries = read_history(self._reports_dir())
            self._send_json({"entries": entries, "limit": HISTORY_LIMIT})
            return
        if path == "/api/fleet":
            self._send_json(_load_fleet_data(self._reports_dir()))
            return
        if path == "/api/fleet/asset":
            params = parse_qs(parsed.query)
            asset_id = params.get("id", [""])[0]
            data = _load_asset_report(self._reports_dir(), asset_id)
            if data:
                self._send_json(data)
            else:
                self._send_error(HTTPStatus.NOT_FOUND, f"Asset report '{asset_id}' not found.")
            return
        if path == "/api/analytics/summary":
            self._send_json(_load_analytics_summary(self._reports_dir()))
            return
        self._send_error(HTTPStatus.NOT_FOUND, "Route not found.")

    def do_POST(self) -> None:
        if not self._enforce_host():
            return
        if not self._enforce_token():
            return
        if not self._enforce_json_content_type():
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/scan":
            self._handle_scan()
            return
        if parsed.path == "/api/targets/test":
            self._handle_target_test()
            return
        if parsed.path == "/api/export/csv":
            self._handle_csv_export()
            return
        if parsed.path == "/api/export/html":
            self._handle_html_export()
            return
        if parsed.path == "/api/reports/save":
            self._handle_save_report()
            return
        if parsed.path == "/api/import":
            self._handle_import()
            return
        if parsed.path == "/api/library/save":
            self._handle_library_save()
            return
        self._send_error(HTTPStatus.NOT_FOUND, "Route not found.")

    def _handle_scan(self) -> None:
        try:
            payload = self._read_json()
            benchmark_payload = payload.get("benchmark_json", payload)
            options = payload.get("options") or {}
            target_payload = payload.get("target")
            target = Target.from_dict(target_payload) if target_payload else Target.local()
            error = target.validate()
            if error:
                self._send_error(HTTPStatus.BAD_REQUEST, error)
                return
            try:
                runner = make_runner(target)
            except ValueError as exc:
                self._send_error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            try:
                meta, checks = load_benchmark(benchmark_payload)
                workers = _safe_workers(options.get("workers"), 4)
                report = run_scan(meta, checks, runner=runner, workers=workers, target=target).to_dict()

                # Enrich report with Asset identity
                target_dict = report.get("target") or {}
                bench_dict = report.get("benchmark") or {}
                host_dict = report.get("host_context") or {}

                asset_cat = _classify_asset_category(
                    bench_dict.get("platform", ""),
                    bench_dict.get("title", ""),
                    bench_dict.get("os_family", ""),
                )
                asset_id = _resolve_asset_id(target_dict, bench_dict, host_dict)
                asset_name = _resolve_asset_name(target_dict, host_dict, bench_dict)

                report["asset_id"] = asset_id
                report["asset_category"] = asset_cat
                report["asset_name"] = asset_name

                # Persist to reports/assets/<asset_id>.json
                assets_dir = self._reports_dir() / "assets"
                assets_dir.mkdir(parents=True, exist_ok=True)
                asset_file = assets_dir / f"{asset_id}.json"
                try:
                    with asset_file.open("w", encoding="utf-8") as f:
                        json.dump(report, f, indent=2)
                except OSError as exc:
                    print(f"warning: could not save asset report: {exc}", file=sys.stderr)

                append_history(self._reports_dir(), _summary_to_history(report))
                self._send_json(report)
            finally:
                runner.close()
        except json.JSONDecodeError as exc:
            self._send_error(HTTPStatus.BAD_REQUEST, f"Invalid JSON: {exc}")
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _handle_target_test(self) -> None:
        try:
            payload = self._read_json()
            target_data = payload.get("target") if isinstance(payload.get("target"), dict) else payload
            target = Target.from_dict(target_data)
            error = target.validate()
            if error:
                self._send_error(HTTPStatus.BAD_REQUEST, error)
                return
            if target.type == LOCAL:
                self._send_json({"ok": True, "context": LocalRunner().describe()})
                return
            try:
                runner = make_runner(target)
            except ValueError as exc:
                self._send_error(HTTPStatus.BAD_REQUEST, str(exc))
                return
            try:
                result = runner.run_command("uname -a 2>/dev/null || ver", timeout=15)
                if result.returncode != 0 and not result.stdout:
                    self._send_error(HTTPStatus.BAD_GATEWAY, result.stderr or "Connection test failed.")
                    return
                self._send_json({
                    "ok": True,
                    "context": {"target": "remote", "host": target.host, "uname": result.stdout},
                })
            finally:
                runner.close()
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _handle_csv_export(self) -> None:
        try:
            payload = self._read_json()
            csv_text = results_to_csv(payload)
            self._send_bytes(csv_text.encode("utf-8"), "text/csv; charset=utf-8")
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _handle_html_export(self) -> None:
        try:
            payload = self._read_json()
            html_text = results_to_html_report(payload)
            self._send_bytes(html_text.encode("utf-8"), "text/html; charset=utf-8")
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _handle_save_report(self) -> None:
        try:
            payload = self._read_json()
            report = payload.get("report") if isinstance(payload.get("report"), dict) else payload
            requested_name = str(payload.get("name") or "")
            benchmark = report.get("benchmark", {}) if isinstance(report, dict) else {}
            default_name = benchmark.get("title") or "omni-benchmark-report"
            stem = _safe_report_stem(requested_name or str(default_name))
            reports = self._reports_dir()
            reports.mkdir(parents=True, exist_ok=True)

            json_path = reports / f"{stem}.json"
            csv_path = reports / f"{stem}.csv"
            html_path = reports / f"{stem}.html"

            json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
            csv_path.write_text(results_to_csv(report), encoding="utf-8")
            html_path.write_text(results_to_html_report(report), encoding="utf-8")

            self._send_json(
                {
                    "ok": True,
                    "files": {
                        "json": str(json_path),
                        "csv": str(csv_path),
                        "html": str(html_path),
                    },
                }
            )
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _imported_dir(self) -> Path:
        return self._reports_dir() / "imported-benchmarks"

    def _handle_import(self) -> None:
        """Parse a pasted/uploaded benchmark and return a preview (no persistence)."""
        try:
            payload = self._read_json()
            benchmark_payload = payload.get("benchmark_json", payload)
            meta, checks = load_benchmark(benchmark_payload)
            self._send_json({
                "ok": True,
                "format": _detect_format(benchmark_payload),
                "benchmark": {"title": meta.title, "version": meta.version, "platform": meta.platform},
                "total": len(checks),
                "preview": _preview(checks),
            })
        except json.JSONDecodeError as exc:
            self._send_error(HTTPStatus.BAD_REQUEST, f"Invalid JSON: {exc}")
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _handle_library_save(self) -> None:
        """Persist an imported benchmark so it appears in the Library across restarts."""
        try:
            payload = self._read_json()
            benchmark_payload = payload.get("benchmark_json", payload)
            meta, checks = load_benchmark(benchmark_payload)  # validate before writing
            requested = str(payload.get("name") or meta.title or "imported-benchmark")
            stem = _safe_report_stem(requested)
            imported_dir = self._imported_dir()
            imported_dir.mkdir(parents=True, exist_ok=True)
            path = imported_dir / f"{stem}.json"
            path.write_text(json.dumps(benchmark_payload, indent=2), encoding="utf-8")
            self._send_json({"ok": True, "name": stem, "checks": len(checks), "file": str(path)})
        except json.JSONDecodeError as exc:
            self._send_error(HTTPStatus.BAD_REQUEST, f"Invalid JSON: {exc}")
        except Exception as exc:  # noqa: BLE001
            self._send_error(HTTPStatus.BAD_REQUEST, str(exc))

    def _send_index(self) -> None:
        index_path = STATIC_DIR / "index.html"
        if not index_path.exists():
            self._send_error(HTTPStatus.NOT_FOUND, "Index not found.")
            return
        # Loopback: embed the token for zero-friction local use (same-origin
        # policy keeps it private to the page). Non-loopback (--allow-remote):
        # do NOT embed it — the operator authenticates with the ?token=... URL
        # printed at startup, which the frontend stores in sessionStorage.
        token = "" if self._allow_remote() else self._expected_token()
        body = index_path.read_text(encoding="utf-8").replace(TOKEN_PLACEHOLDER, token)
        self._send_bytes(body.encode("utf-8"), "text/html; charset=utf-8")

    def _send_sample(self, name: str, imported_dir: Path | None = None) -> None:
        safe_name = _safe_sample_name(name)
        if not safe_name:
            self._send_error(HTTPStatus.BAD_REQUEST, "Invalid sample name.")
            return
        sample_path = SAMPLE_DIR / f"{safe_name}.json"
        if sample_path.exists():
            self._send_file(sample_path, "application/json; charset=utf-8")
            return
        if imported_dir is not None:
            try:
                resolved = (Path(imported_dir) / f"{safe_name}.json").resolve()
                if resolved.is_relative_to(Path(imported_dir).resolve()) and resolved.is_file():
                    self._send_bytes(resolved.read_bytes(), "application/json; charset=utf-8")
                    return
            except OSError:
                pass
        self._send_error(HTTPStatus.NOT_FOUND, "Sample benchmark not found.")

    def _send_library_preview(self, name: str, imported_dir: Path | None = None) -> None:
        safe_name = _safe_sample_name(name)
        if not safe_name:
            self._send_error(HTTPStatus.BAD_REQUEST, "Invalid benchmark name.")
            return
        details = self.catalog_cache.get(safe_name)
        if details is None and imported_dir is not None:
            details = _imported_summary(imported_dir, safe_name)
        if details is None:
            self._send_error(HTTPStatus.NOT_FOUND, "Benchmark not in library.")
            return
        self._send_json(details)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length") or "0")
        if length <= 0:
            raise ValueError("Missing JSON request body.")
        if length > MAX_BODY_BYTES:
            raise ValueError("Request body exceeds maximum size.")
        body = self.rfile.read(length)
        return json.loads(body.decode("utf-8"))

    def _send_file(self, path: Path, content_type: str | None = None) -> None:
        try:
            resolved = path.resolve()
            if not (resolved.is_relative_to(STATIC_DIR.resolve()) or resolved.is_relative_to(SAMPLE_DIR.resolve())):
                self._send_error(HTTPStatus.FORBIDDEN, "Forbidden.")
                return
            if not resolved.exists() or not resolved.is_file():
                self._send_error(HTTPStatus.NOT_FOUND, "File not found.")
                return
            mime = content_type or mimetypes.guess_type(str(resolved))[0] or "application/octet-stream"
            self._send_bytes(resolved.read_bytes(), mime)
        except OSError as exc:
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def _send_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, indent=2).encode("utf-8")
        self._write_response(status, body, "application/json; charset=utf-8")

    def _send_bytes(self, body: bytes, content_type: str, status: HTTPStatus = HTTPStatus.OK) -> None:
        self._write_response(status, body, content_type)

    def _send_error(self, status: HTTPStatus, message: str) -> None:
        body = json.dumps({"ok": False, "error": message}).encode("utf-8")
        self._write_response(status, body, "application/json; charset=utf-8")

    def _write_response(self, status: HTTPStatus, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'",
        )
        self.end_headers()
        self.wfile.write(body)


def _resolve_session_token(token_file: str) -> str:
    if not token_file:
        return generate_session_token()
    path = Path(token_file)
    if path.exists():
        existing = path.read_text(encoding="utf-8").strip()
        if existing:
            return existing
    token = generate_session_token()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(token, encoding="utf-8")
        try:
            path.chmod(0o600)
        except (OSError, NotImplementedError):
            pass
    except OSError as exc:
        print(f"warning: could not persist session token to {path}: {exc}", file=sys.stderr)
    return token


def run(
    host: str,
    port: int,
    allow_remote: bool = False,
    token_file: str = "",
    reports_dir: str = "",
) -> None:
    if host not in {"127.0.0.1", "localhost", "::1"} and not allow_remote:
        print(
            f"Refusing to bind to {host}. The dashboard exposes the host to command execution; "
            "pass --allow-remote (or set allow_remote = true in omnibench.ini) to opt in.",
            file=sys.stderr,
        )
        sys.exit(2)
    server = ThreadingHTTPServer((host, port), OMNIRequestHandler)
    server.omni_token = _resolve_session_token(token_file)  # type: ignore[attr-defined]
    server.allow_remote = allow_remote  # type: ignore[attr-defined]
    server.reports_dir = Path(reports_dir) if reports_dir else default_reports_dir()  # type: ignore[attr-defined]
    is_loopback = host in {"127.0.0.1", "localhost", "::1"}
    token = server.omni_token  # type: ignore[attr-defined]
    # In remote mode the token is not embedded in the page, so hand the operator
    # a ready-to-use authenticated URL. Loopback gets a clean URL (token auto-injected).
    dashboard_url = f"http://{host}:{port}" if is_loopback else f"http://{host}:{port}/?token={token}"
    print("")
    print("  CISGuard — Security Compliance Console")
    print(f"  Version:      {__version__}")
    print(f"  Dashboard:    {dashboard_url}")
    if not is_loopback:
        print("  Mode:         network-visible (--allow-remote) — token REQUIRED on every request")
    print(f"  Reports dir:  {server.reports_dir}")  # type: ignore[attr-defined]
    if not token_file:
        print(f"  Session token (ephemeral): {token}")
    else:
        print(f"  Session token persisted to: {token_file}")
    print("")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
    finally:
        server.server_close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the OmniBench dashboard.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8507, type=int)
    parser.add_argument(
        "--allow-remote",
        action="store_true",
        help="Opt in to non-loopback binding. NOT recommended without additional access controls.",
    )
    args = parser.parse_args()
    run(args.host, args.port, allow_remote=args.allow_remote)


def _device_context() -> dict:
    try:
        uname = platform.uname()
        return {
            "hostname": uname.node or platform.node() or "local-device",
            "system": uname.system or platform.system(),
            "release": uname.release or platform.release(),
            "version": uname.version or platform.version(),
            "machine": uname.machine or platform.machine(),
            "user": _safe_user(),
            "local_time": datetime.now(timezone.utc).astimezone().isoformat(),
        }
    except Exception as exc:  # noqa: BLE001
        return {"error": str(exc)}


def _safe_user() -> str:
    try:
        return getpass.getuser()
    except Exception:  # noqa: BLE001
        return "unknown"


def _detect_format(payload: Any) -> str:
    if not isinstance(payload, dict):
        return "unknown"
    keys = {str(k).lower() for k in payload.keys()}
    if keys & {"recommendations", "cis", "site_data", "benchmark_refinement"}:
        return "mitre/cis-bench"
    if keys & {"checks", "rules", "controls", "groups"}:
        return "native"
    return "generic"


def _imported_summary(imported_dir: Path, name: str) -> dict[str, Any] | None:
    safe = _safe_sample_name(name)
    if not safe:
        return None
    try:
        resolved = (Path(imported_dir) / f"{safe}.json").resolve()
        if not resolved.is_relative_to(Path(imported_dir).resolve()) or not resolved.is_file():
            return None
        payload = json.loads(resolved.read_text(encoding="utf-8"))
        meta, checks = load_benchmark(payload, source=str(resolved))
        return {
            "checks": len(checks),
            "title": meta.title,
            "version": meta.version,
            "platform": meta.platform,
            "preview": _preview(checks),
        }
    except Exception as exc:  # noqa: BLE001 - keep the library alive on a bad import
        return {"checks": 0, "error": str(exc)}


def _imported_catalog_entries(imported_dir: Path) -> list[dict]:
    entries: list[dict] = []
    try:
        files = sorted(Path(imported_dir).glob("*.json"))
    except OSError:
        return entries
    for path in files:
        summary = _imported_summary(imported_dir, path.stem) or {}
        entries.append({
            "name": path.stem,
            "title": summary.get("title") or path.stem,
            "platform": summary.get("platform") or "Imported",
            "os_family": "imported",
            "category": "Imported",
            "tags": ["imported"],
            "description": "Imported benchmark (saved to the local library).",
            "profile": "Imported",
            "recommended": False,
            "available": "error" not in summary,
            "checks": summary.get("checks", 0),
            "version": summary.get("version") or "unknown",
            "file": path.name,
            "imported": True,
        })
    return entries


def _benchmark_catalog(imported_dir: Path | None = None) -> list[dict]:
    catalog = []
    for entry in BENCHMARK_CATALOG:
        item = dict(entry)
        sample_path = SAMPLE_DIR / f"{entry['name']}.json"
        item["available"] = sample_path.exists()
        item["checks"] = 0
        item["file"] = f"{entry['name']}.json"
        if sample_path.exists():
            details = OMNIRequestHandler.catalog_cache.get(entry["name"])
            if details and "error" not in details:
                item["checks"] = details.get("checks", 0)
                item["version"] = details.get("version") or item.get("version") or "unknown"
            elif details:
                item["available"] = False
                item["error"] = details.get("error", "")
        catalog.append(item)
    if imported_dir is not None:
        catalog.extend(_imported_catalog_entries(imported_dir))
    return catalog


def _benchmark_library(imported_dir: Path | None = None) -> list[dict]:
    catalog = _benchmark_catalog(imported_dir)
    severities = ["critical", "high", "medium", "low", "info"]
    enriched = []
    for item in catalog:
        if item.get("imported") and imported_dir is not None:
            details = _imported_summary(imported_dir, item["name"])
        else:
            details = OMNIRequestHandler.catalog_cache.get(item["name"])
        item["preview"] = details.get("preview", []) if details else []
        breakdown = {sev: 0 for sev in severities}
        if details and "preview" in details:
            for check in details["preview"]:
                sev = (check.get("severity") or "medium").lower()
                if sev in breakdown:
                    breakdown[sev] += 1
        item["severity_breakdown"] = breakdown
        enriched.append(item)
    return enriched


def _safe_report_stem(value: str) -> str:
    text = re.sub(r"[^A-Za-z0-9._-]+", "-", value.strip().lower())
    text = re.sub(r"-{2,}", "-", text).strip("-._")
    return text or "omni-benchmark-report"


def _safe_sample_name(name: str) -> str:
    return "".join(char for char in name if char.isalnum() or char in {"-", "_"})


def _safe_workers(value: Any, fallback: int) -> int:
    try:
        out = int(value)
        return out if out > 0 else fallback
    except (TypeError, ValueError):
        return fallback


if __name__ == "__main__":
    main()
