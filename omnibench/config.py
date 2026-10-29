from __future__ import annotations

import configparser
import os
from dataclasses import dataclass
from pathlib import Path


DEFAULT_FILENAME = "omnibench.ini"


@dataclass(slots=True)
class Config:
    host: str = "127.0.0.1"
    port: int = 8507
    allow_remote: bool = False
    token_file: str = ""
    reports_dir: str = ""


def load_config(explicit_path: str | os.PathLike[str] | None = None) -> Config:
    """Load configuration from an INI file.

    Resolution order:
      1. explicit_path argument
      2. OMNIBENCH_CONFIG env var
      3. ./omnibench.ini in the current working directory
    Missing files yield default values.
    """
    path = _resolve_path(explicit_path)
    config = Config()
    if path is None:
        return config

    parser = configparser.ConfigParser()
    try:
        parser.read(path, encoding="utf-8")
    except (OSError, configparser.Error):
        return config

    if parser.has_section("server"):
        config.host = parser.get("server", "host", fallback=config.host).strip() or config.host
        try:
            config.port = parser.getint("server", "port", fallback=config.port)
        except ValueError:
            pass
        try:
            config.allow_remote = parser.getboolean("server", "allow_remote", fallback=config.allow_remote)
        except ValueError:
            pass
    if parser.has_section("security"):
        config.token_file = parser.get("security", "token_file", fallback="").strip()
    if parser.has_section("paths"):
        config.reports_dir = parser.get("paths", "reports", fallback="").strip()
    return config


def _resolve_path(explicit: str | os.PathLike[str] | None) -> Path | None:
    if explicit:
        candidate = Path(explicit)
        return candidate if candidate.exists() else None
    env = os.environ.get("OMNIBENCH_CONFIG")
    if env:
        candidate = Path(env)
        return candidate if candidate.exists() else None
    cwd_candidate = Path.cwd() / DEFAULT_FILENAME
    return cwd_candidate if cwd_candidate.exists() else None


def default_config_text() -> str:
    return """# OmniBench configuration

[server]
host = 127.0.0.1
port = 8507
# Set to true to bind to non-loopback. Pair with network access controls.
allow_remote = false

[security]
# Optional. If set, the session token persists between restarts via this file.
# Leave empty to generate a fresh token on each start.
token_file =

[paths]
# Override the report output directory. Defaults to ./reports relative to the
# working directory (or the OMNIBENCH_REPORTS_DIR env var if set).
reports =
"""
