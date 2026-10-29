# Security Policy

CISGuard is a security auditing tool, so its own security posture matters. This
document explains how to report vulnerabilities and the threat model the project
is built around.

## Reporting a vulnerability

Please **do not** open a public issue for security vulnerabilities.

Report privately through GitHub's [Security Advisories](https://github.com/Zaid5671/CIS_Compliant/security/advisories/new)
("Report a vulnerability"). Include:

- A description of the issue and its impact.
- Steps to reproduce, or a proof of concept.
- Affected version (`cisguard --version`) and platform.

You can expect an initial response within a few days. Once a fix is available,
we will coordinate disclosure and credit you in the release notes (unless you
prefer to stay anonymous).

## Supported versions

CISGuard is pre-1.0 and ships fixes on the latest release line only. Always run
the most recent version.

| Version | Supported |
| ------- | --------- |
| 0.5.x   | ✅        |
| < 0.5   | ❌        |

## Threat model

CISGuard loads benchmark definitions and runs read-only audit commands against a
local machine or an authenticated SSH target, then serves results over a local
web dashboard. The trust boundaries:

### The dashboard executes commands by design

A `command` check runs the command in the benchmark definition on the chosen
target. **Only load benchmark files you trust**, and only point remote scans at
hosts you are authorized to audit. Imported `mitre/cis-bench` recommendations are
marked `MANUAL` and are never executed as shell commands.

### Network exposure

- The dashboard binds to **127.0.0.1** by default and refuses to bind to a
  non-loopback address unless you pass `--allow-remote`.
- Every `/api/*` request (except the unauthenticated `/api/health` liveness probe)
  requires a session token sent in the `X-OMNI-Token` header.
- **Loopback mode:** the token is embedded in the page for zero-friction local
  use. The browser same-origin policy keeps it private to the page; cross-origin
  pages cannot read it, and POSTs require the custom token header (which triggers
  a CORS preflight that is never granted).
- **`--allow-remote` mode:** the token is **not** embedded in the page. The
  operator authenticates using the `?token=...` URL printed at startup, which the
  frontend stores in `sessionStorage`. This means a network client cannot reach
  any data or scan endpoint without the token.

`--allow-remote` provides authentication, not transport security. If you expose
the dashboard beyond loopback, place it behind TLS and a network access control
(reverse proxy with auth, VPN, or firewall allowlist). Treat the session token as
a credential.

### Other protections

- Host header validation on every request (DNS-rebinding defense).
- `Content-Type` enforcement on POSTs and a 32 MB body cap.
- HTML/CSV exports sanitize URLs (rejecting `javascript:`/`data:`/`file:`) and
  escape CSV-injection prefixes (`= + - @ \t \r`).
- Strict response headers: `Content-Security-Policy`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
- Remote scanning uses the system `ssh` binary for **key authentication** (zero
  dependencies). **Password** authentication is optional and, when used, runs through
  `paramiko` (install via `cisguard[ssh-password]`). Credentials are held in memory
  only for the duration of the scan — never written to disk, logs, reports, or history
  (`Auth.safe_summary()` redacts them). Key auth is recommended over passwords.
- Fonts and all assets are self-hosted; the dashboard makes no external network
  calls.

## Hardening checklist for deployments

- Keep the default loopback bind unless you genuinely need remote access.
- Set a persistent `token_file` so the token survives restarts, and protect that
  file's permissions.
- Run the bundled systemd unit (Linux) which ships with `NoNewPrivileges`,
  `ProtectSystem=strict`, `ProtectHome`, and a narrow `ReadWritePaths`.
- Run scans as the least-privileged account that can read the required state.
