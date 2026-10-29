from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
SAMPLE_DIR = DATA_DIR / "sample_benchmarks"
CHECKS_DIR = DATA_DIR / "checks"
STATIC_DIR = ROOT / "static"


def reports_dir(override: str | os.PathLike[str] | None = None) -> Path:
    """Resolve the report output directory.

    Priority: explicit argument -> OMNIBENCH_REPORTS_DIR env var -> cwd/reports.
    """
    if override:
        return Path(override)
    env = os.environ.get("OMNIBENCH_REPORTS_DIR")
    if env:
        return Path(env)
    return Path.cwd() / "reports"


def data_dir_for_env() -> str:
    """Return the data dir as a forward-slash string (portable across Windows + POSIX shells)."""
    return str(DATA_DIR).replace("\\", "/")
