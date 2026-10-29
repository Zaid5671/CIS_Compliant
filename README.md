<div align="center">

# 🛡️ CISGuard

### Automated CIS Compliance & Hardening Console

A **dependency-free CIS benchmark scanner** with a polished dashboard.
Audit Windows, Linux, macOS, cloud, containers, databases, hypervisors, and network devices — locally or over SSH — and export analyst-ready findings.

<br>

[![CI](https://github.com/Zaid5671/CIS_Compliant/actions/workflows/ci.yml/badge.svg)](https://github.com/Zaid5671/CIS_Compliant/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-7c3aed.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-7c3aed.svg)](https://www.python.org/downloads/)
[![Dependencies: zero](https://img.shields.io/badge/dependencies-zero-22d3a0.svg)](pyproject.toml)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-22d3a0.svg)](CONTRIBUTING.md)

[**Install**](#install) · [**Quick start**](#quick-start) · [**Coverage**](#coverage) · [**Security**](#security) · [**Contributing**](#contributing)

</div>

---

## ✨ Features

- 🧩 **30 built-in CIS benchmarks** across 12 categories — OS, cloud, containers, databases, web servers, hypervisors, network, and Microsoft 365.
- 🖥️ **Local & remote scanning** — audit this machine or an authenticated SSH target (SSH **key** or **password**).
- 🎛️ **Security Console dashboard** — a dark, keyboard-accessible UI with live charts, a benchmark library, a findings explorer, and scan history.
- 📦 **Zero dependencies** — pure Python standard library. No pip tree, no external network calls, fonts and assets self-hosted.
- 🔐 **Secure by default** — loopback-only bind, token-gated API, host-header and CSRF defenses, and a strict Content-Security-Policy.
- 📤 **Analyst-ready exports** — JSON, CSV, and a standalone HTML report, all sanitized.
- 🧱 **Bring your own benchmarks** — load any CIS, custom, or `mitre/cis-bench` JSON via the **Import** page (drop / paste → auto-detect → preview → load or save to Library). Benchmark prose is never executed as a command.
- 🚀 **Trivial deploy** — one-line install, a systemd unit, a Windows scheduled task, or Docker.

> [!NOTE]
> OmniBench performs **read-only** audits. It reports posture and remediation guidance; it never changes system state.

---

<a id="coverage"></a>

## 📊 Benchmark coverage

| Category | Benchmarks |
| --- | --- |
| **Endpoint** | Windows 10 · macOS |
| **Server** | Windows Server (Datacenter / Core) · Ubuntu 22.04 · RHEL 9 · Debian 12 |
| **Identity** | Windows Domain Controller |
| **Virtualization** | Hyper-V · VMware ESXi · Proxmox VE · Linux KVM |
| **Containers** | Docker Engine · Kubernetes |
| **Databases** | PostgreSQL · MySQL 8 · MongoDB |
| **Web servers** | nginx · Apache httpd · IIS |
| **Cloud** | AWS · Azure · GCP foundations |
| **Office** | Microsoft 365 |
| **Network** | Cisco IOS / IOS XE |

Browse and filter them all on the **Library** page, or run `omnibench` and click in.

---

<a id="install"></a>

## ⚡ Install

> [!TIP]
> Requires **Python 3.10+**. There is nothing else to install.

**Linux / macOS**

```bash
git clone https://github.com/Zaid5671/CIS_Compliant.git cisguard && cd cisguard
./install.sh
cisguard
```

**Windows (PowerShell)**

```powershell
git clone https://github.com/Zaid5671/CIS_Compliant.git cisguard; cd cisguard
.\install.ps1
cisguard
```

<details>
<summary><b>Docker</b></summary>

```bash
docker compose up -d --build
# dashboard → http://127.0.0.1:8507  (token is printed in the container logs)
docker compose logs cisguard
```

The compose file maps the dashboard to host `127.0.0.1:8507` only. Reports persist in the `cisguard-data` volume. Drop an `omnibench.ini` next to `docker-compose.yml` and uncomment the bind mount to override defaults.

</details>

<details>
<summary><b>pipx / pip (single user)</b></summary>

```bash
pipx install git+https://github.com/Zaid5671/CIS_Compliant.git
# or
python -m pip install git+https://github.com/Zaid5671/CIS_Compliant.git

cisguard
```

</details>

<details>
<summary><b>Managed service (systemd / Windows scheduled task)</b></summary>

**Linux** — installs into `/opt/omnibench`, creates an `omnibench` user, writes `/etc/omnibench/config.ini`, and registers the systemd unit:

```bash
WITH_SERVICE=1 sudo ./install.sh
systemctl status omnibench
```

**Windows** — registers a scheduled task named `OmniBench` that runs at boot as SYSTEM and writes `C:\ProgramData\OmniBench\config.ini`:

```powershell
.\install.ps1 -Service
```

</details>

---

<a id="quick-start"></a>

## 🚀 Quick start

After install, just run:

```bash
omnibench
```

Open the dashboard at **http://127.0.0.1:8507**.

On startup the server prints a one-shot **session token** (or the path it persisted to, if `token_file` is set). On loopback the browser uses it automatically; you only need it for direct API calls.

Run a scan straight from the terminal:

```bash
omnibench scan /path/to/benchmark.json --output-dir reports --name my-report
```

### CLI

```text
omnibench                  # runs the dashboard server (= omnibench serve)
omnibench serve [--host H] [--port P] [--allow-remote] [--config FILE]
omnibench scan BENCHMARK_JSON [--output-dir DIR] [--workers N] [--name STEM]
omnibench init [--to PATH]   # write a default omnibench.ini
omnibench --version
```

---

## ⚙️ Configuration

OmniBench looks for an INI config in this order:

1. `--config /path/to/omnibench.ini`
2. `$OMNIBENCH_CONFIG`
3. `./omnibench.ini` (current working directory)

A starter config (also generated by `omnibench init`):

```ini
[server]
host = 127.0.0.1
port = 8507
allow_remote = false

[security]
# Optional. If set, the session token persists between restarts via this file.
token_file = /var/lib/omnibench/session.token

[paths]
# Override the report output directory. Default: ./reports.
reports = /var/lib/omnibench/reports
```

Setting `token_file` is recommended for long-running deployments so existing browser tabs survive a restart.

Environment overrides: `OMNIBENCH_CONFIG` (path to a config file) and `OMNIBENCH_REPORTS_DIR` (report output directory).

---

## 🔑 Authenticated remote scans

OmniBench ships with an SSH-driven remote runner.

1. In the dashboard, switch the **Target** panel from Local to Remote.
2. Enter the host (IP or FQDN), port, username, and either an SSH **private key** path or a **password** (password auth needs the `ssh-password` extra).
3. Click **Test Connection** to verify reachability, then **Run Scan**.

**On the scanning host:** an OpenSSH client (`ssh` on PATH) — shipped with Windows 10/11, all Linux distros, and macOS.
**On the target:** an SSH server, and a user permitted to run the commands the benchmark requires.

> [!NOTE]
> SSH **key** auth works with zero dependencies. **Password** auth is optional — `pip install "omnibench[ssh-password]"` (adds `paramiko`). Keys are recommended; passwords are weaker, and are held in memory only (never stored or logged).

---

## 📚 Benchmarks

The **Library** page lists every shipped benchmark with platform / category / profile facets, a sample-check preview, and one-click load + scan. To add your own, drop a `*.json` file in `omnibench/data/sample_benchmarks/` and register it in `omnibench/web.py:BENCHMARK_CATALOG` (see [CONTRIBUTING.md](CONTRIBUTING.md)).

<details>
<summary><b>Benchmark JSON format</b></summary>

The loader accepts top-level `checks`, `rules`, `controls`, `recommendations`, or nested `groups`.

```json
{
  "benchmark": { "title": "Windows Local Baseline", "version": "1.0", "platform": "windows" },
  "checks": [
    {
      "id": "1.1",
      "title": "Ensure a service is running",
      "severity": "high",
      "profile": "Level 1",
      "category": "Services",
      "type": "service",
      "service": "WinDefend",
      "expect": { "field": "status", "operator": "equals", "value": "running" },
      "remediation": "Start and enable the service.",
      "rationale": "Required security service should be active."
    }
  ]
}
```

**Supported check types:** `command`, `file_exists`, `file_contains`, `registry`, `service`, `manual`.

**`expect` operators:** `equals`, `not_equals`, `contains`, `not_contains`, `regex`, `not_regex`, `gt`, `gte`, `lt`, `lte`, `in`, `not_in`, `exists`, `is_true`, `is_false`. With no `expect` block, a `command` check passes when the command exits `0`.

**Path placeholders** — reference bundled probe scripts with `{omni_data}` (expanded to the absolute path of `omnibench/data/`). Quote it so paths with spaces work:

```json
"command": "powershell -File \"{omni_data}/checks/windows10_cis_probe.ps1\" password-history"
```

</details>

<details>
<summary><b>Importing mitre/cis-bench exports</b></summary>

OmniBench auto-detects `mitre/cis-bench` JSON exports and preserves profiles, audit text, remediation, source URLs, CIS Controls, MITRE ATT&CK, NIST mappings, and artifact references. Imported recommendations are marked `MANUAL` until a concrete check type is supplied — benchmark prose is never executed as a shell command.

</details>

---

<a id="security"></a>

## 🔒 Security model

- The dashboard binds to **127.0.0.1** by default; non-loopback binding requires `--allow-remote`.
- Every `/api/*` request (except the `/api/health` liveness probe) is gated by:
  - **Host-header validation** (DNS-rebinding defense)
  - a **session token** in the `X-OMNI-Token` header, required on **both GET and POST** (CSRF + unauthenticated-read defense)
  - **Content-Type enforcement** on POSTs (cross-origin POST defense)
- Under `--allow-remote` the token is **not** embedded in the page; the operator authenticates with the `?token=...` URL printed at startup.
- POST bodies are capped at 32 MB. HTML/CSV exports sanitize URLs and escape CSV-injection prefixes.
- All responses send `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and a strict `Content-Security-Policy`.
- The systemd unit ships with `NoNewPrivileges`, `ProtectSystem=strict`, `ProtectHome`, and a narrow `ReadWritePaths`.

> [!WARNING]
> `command` checks execute commands from the loaded benchmark on the chosen target. **Only run benchmark files you trust**, and authorize SSH targets explicitly. `--allow-remote` provides authentication only — put TLS and a network ACL in front of any non-loopback deployment.

Found a vulnerability? Please report it **privately** — see [SECURITY.md](SECURITY.md).

---

## 🧪 Development

```bash
python -m pip install -e ".[dev]"
omnibench                            # run the dashboard
python -m compileall -q omnibench    # syntax gate
ruff check .                         # lint
```

CI builds the package and verifies the CLI and bundled data on each push.

---

## 🧹 Uninstall

<details>
<summary>Remove OmniBench and its data</summary>

**Linux / macOS**

```bash
sudo systemctl disable --now omnibench   # if you installed the service
sudo rm -rf /opt/omnibench /etc/omnibench /var/lib/omnibench
sudo rm -f /usr/local/bin/omnibench /etc/systemd/system/omnibench.service
sudo userdel omnibench || true
```

**Windows**

```powershell
Unregister-ScheduledTask -TaskName OmniBench -Confirm:$false
Remove-Item -Recurse -Force "$env:ProgramFiles\OmniBench", "C:\ProgramData\OmniBench", "$env:LOCALAPPDATA\OmniBench"
```

**Docker**

```bash
docker compose down -v
```

</details>

---

<a id="contributing"></a>

## 🤝 Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, the standard-library-only policy, and how to add a benchmark, and please read the [Code of Conduct](CODE_OF_CONDUCT.md).

## 📄 License

[MIT](LICENSE) © The OmniBench Authors
