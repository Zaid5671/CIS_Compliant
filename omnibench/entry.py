from __future__ import annotations

import argparse
import sys
from pathlib import Path

from . import __version__


def main(argv: list[str] | None = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)
    if not getattr(args, "command", None):
        args = _default_serve_args()
    args.func(args)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="cisguard",
        description="CISGuard - Automated CIS Benchmark Compliance & Hardening Auditor",
    )
    parser.add_argument("--version", action="version", version=__version__)
    sub = parser.add_subparsers(dest="command")

    serve = sub.add_parser("serve", help="Run the dashboard server (default).")
    serve.add_argument("--host", default=None, help="Listen host. Default 127.0.0.1.")
    serve.add_argument("--port", type=int, default=None, help="Listen port. Default 8507.")
    serve.add_argument(
        "--allow-remote",
        action="store_true",
        default=None,
        help="Opt in to non-loopback binding. NOT recommended without additional access controls.",
    )
    serve.add_argument("--config", default=None, help="Path to an omnibench.ini config file.")
    serve.set_defaults(func=_serve)

    scan = sub.add_parser("scan", help="Run a benchmark from the CLI.")
    scan.add_argument("benchmark", help="Path to a benchmark JSON file.")
    scan.add_argument("--output-dir", default="reports", help="Directory for JSON, CSV, and HTML reports.")
    scan.add_argument("--workers", type=int, default=4, help="Number of parallel check workers.")
    scan.add_argument("--name", default="", help="Output file stem. Defaults to the benchmark title.")
    scan.set_defaults(func=_scan)

    init = sub.add_parser("init", help="Generate a default omnibench.ini in the current directory.")
    init.add_argument("--to", default="", help="Destination path. Defaults to ./omnibench.ini.")
    init.set_defaults(func=_init)

    return parser


def _default_serve_args() -> argparse.Namespace:
    namespace = argparse.Namespace()
    namespace.command = "serve"
    namespace.host = None
    namespace.port = None
    namespace.allow_remote = None
    namespace.config = None
    namespace.func = _serve
    return namespace


def _serve(args: argparse.Namespace) -> None:
    from .config import load_config
    from .web import run

    cfg = load_config(args.config)
    host = args.host or cfg.host
    port = args.port or cfg.port
    allow_remote = bool(args.allow_remote) if args.allow_remote is not None else cfg.allow_remote
    run(
        host,
        port,
        allow_remote=allow_remote,
        token_file=cfg.token_file,
        reports_dir=cfg.reports_dir,
    )


def _scan(args: argparse.Namespace) -> None:
    from .cli import scan_command
    scan_command(args)


def _init(args: argparse.Namespace) -> None:
    from .config import DEFAULT_FILENAME, default_config_text

    destination = Path(args.to) if args.to else Path.cwd() / DEFAULT_FILENAME
    if destination.exists():
        print(f"{destination} already exists; not overwriting.", file=sys.stderr)
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(default_config_text(), encoding="utf-8")
    print(f"Wrote {destination}")


if __name__ == "__main__":
    main()
