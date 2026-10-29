# Changelog

All notable changes to OmniBench are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.0] - 2026-06-03

### Added
- **SSH password authentication** for remote scans via an optional `paramiko` backend
  (`pip install "omnibench[ssh-password]"`). Key auth still uses the dependency-free
  system-`ssh` path, so the default install stays zero-dependency. Credentials are held
  in memory only and are never logged, stored, or written to reports/history.
- **Import page** — drop or paste a CIS, `mitre/cis-bench`, or custom benchmark JSON,
  auto-detect the format, preview the parsed checks, then Load, Load + Scan, or Save to
  the Library. Saved imports persist under the reports directory and appear in the
  Library across restarts.
- Deepened the priority benchmarks with ~74 additional CIS checks: Windows 10 (27),
  Ubuntu 22.04 (26), RHEL 9 (27), Docker (22), Kubernetes (25), AWS Foundations (22).

### Changed
- The remote target form now has an auth-method selector (SSH key | Password) with
  contextual fields.

## [0.4.0] - 2026-06-01

### Added
- Full CIS benchmark catalog spanning 30 platforms: Windows (10, Server,
  Domain Controller, Hyper-V), Linux (Ubuntu, RHEL 9, Debian 12), macOS,
  virtualization (ESXi, Proxmox, KVM), containers (Docker, Kubernetes),
  databases (PostgreSQL, MySQL, MongoDB), web servers (nginx, Apache, IIS),
  cloud (AWS, Azure, GCP), Microsoft 365, and Cisco IOS.
- Self-hosted JetBrains Mono and IBM Plex Sans fonts (no external font requests).
- `scored` flag in scan summaries so all-manual benchmarks report "N/A" instead
  of a misleading 0%.
- Security regression tests for the token gate and removed endpoints.

### Changed
- **Rebranded the project to OmniBench** ("Security Console") across the UI, CLI,
  reports, docs, and packaging.
- Complete UI/UX redesign to a dark "Security Console" theme: obsidian canvas,
  electric-violet signal accent, monospace-led typography, glowing status states,
  and accessibility passes (focus-visible rings, tabular numerals, reduced-motion,
  `color-scheme: dark`).
- Synced the package version with the runtime version.

### Security
- **Closed an unauthenticated access path under `--allow-remote`.** Every
  `/api/*` route except `/api/health` now requires the session token in all bind
  modes. In remote mode the token is no longer embedded in the page; the operator
  authenticates with the `?token=...` startup URL (stored in `sessionStorage`).
- Removed the `/api/session` endpoint that returned the token over the wire.
- Added an explicit `font-src 'self'` to the Content-Security-Policy.

### Fixed
- Quoted the `{omni_data}` path in probe-based Windows and Hyper-V checks so
  installs into directories containing spaces (e.g. `C:\Program Files`) work.

## [0.3.0] - 2026-05

### Added
- Dedicated dashboard pages (Dashboard, Setup, Library, Findings, Analytics,
  History) with a hash-based client-side router.
- Hyper-V and VM hypervisor scanning.
- Scan history persistence and a benchmark Library browser.

## [0.2.0] - 2026-05

### Added
- Web dashboard with host-header gating, session-token auth, and security headers.
- Authenticated remote scanning over SSH (key authentication).
- Packaging (`pyproject.toml`, console entry point), Docker, systemd, and Windows
  scheduled-task deployment paths.

[0.4.0]: https://github.com/Zaid5671/CIS_Compliant/releases/tag/v0.4.0
