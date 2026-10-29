# Contributing to CISGuard

Thanks for your interest in improving CISGuard. This guide covers local setup,
the project's conventions, and how to add new benchmarks.

## Project principles

- **Standard library only.** The scanner and dashboard depend on nothing outside
  the Python standard library. Please keep runtime dependencies at zero. Dev-only
  tooling (linters, build) is fine under the `dev` optional extra.
- **Read-only by default.** Shipped benchmarks audit state; they do not change it.
  Remediation belongs in the `remediation` field as guidance, not as executed
  commands.
- **Security first.** This is a security tool. Changes to the web server, command
  execution, or auth path get extra scrutiny — see [SECURITY.md](SECURITY.md).

## Local setup

Requires Python 3.10+.

```bash
git clone https://github.com/Zaid5671/CIS_Compliant.git cisguard
cd cisguard
python -m pip install -e ".[dev]"
cisguard            # launches the dashboard at http://127.0.0.1:8507
```

## Quality checks

```bash
python -m compileall -q omnibench   # syntax gate
ruff check .                        # lint (requires the dev extra)
```

CI builds the package and verifies the CLI and bundled data on each push.

## Adding a benchmark

1. Drop a JSON file in `omnibench/data/sample_benchmarks/`. See the **Benchmarks**
   section of the [README](README.md) for the schema and supported check types.
2. Register it in `BENCHMARK_CATALOG` in `omnibench/web.py` (name, title,
   platform, `os_family`, category, tags, description, profile).
3. Load it from the dashboard **Library** (or `omnibench scan`) to confirm it
   parses and runs.
4. Keep `command` checks portable and read-only. Reference bundled probe scripts
   with the `{omni_data}` placeholder, and **quote the path** so installs into
   directories with spaces still work:
   `-File "{omni_data}/checks/your_probe.ps1"`.

## Pull requests

- Branch from `main`; keep PRs focused.
- Describe what changed and why. Link any related issue.
- Run the quality checks above and verify your change in the dashboard.
- Use clear, present-tense commit messages.

By contributing, you agree that your contributions are licensed under the
project's [MIT License](LICENSE).
