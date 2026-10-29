from __future__ import annotations

import argparse
import json
from pathlib import Path

from .loader import load_benchmark
from .reporting import results_to_csv, results_to_html_report
from .runner import run_scan
from .runners import LocalRunner
from .targets import Target


def scan_command(args: argparse.Namespace) -> None:
    benchmark_path = Path(args.benchmark).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    with benchmark_path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    meta, checks = load_benchmark(payload, source=str(benchmark_path))
    runner = LocalRunner()
    report = run_scan(meta, checks, runner=runner, workers=args.workers, target=Target.local()).to_dict()

    stem = args.name or _safe_stem(meta.title)
    json_path = output_dir / f"{stem}.json"
    csv_path = output_dir / f"{stem}.csv"
    html_path = output_dir / f"{stem}.html"

    json_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    csv_path.write_text(results_to_csv(report), encoding="utf-8")
    html_path.write_text(results_to_html_report(report), encoding="utf-8")

    print(f"JSON report: {json_path}")
    print(f"CSV findings: {csv_path}")
    print(f"HTML report: {html_path}")


def _safe_stem(value: str) -> str:
    text = "".join(char.lower() if char.isalnum() else "-" for char in value)
    text = "-".join(part for part in text.split("-") if part)
    return text or "omni-benchmark-report"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="OmniBench commands.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    scan_parser = subparsers.add_parser("scan", help="Run a benchmark JSON and export reports.")
    scan_parser.add_argument("benchmark", help="Path to a benchmark JSON file.")
    scan_parser.add_argument("--output-dir", default="reports", help="Directory for JSON, CSV, and HTML reports.")
    scan_parser.add_argument("--workers", type=int, default=4, help="Number of parallel check workers.")
    scan_parser.add_argument("--name", default="", help="Output file stem. Defaults to the benchmark title.")
    scan_parser.set_defaults(func=scan_command)

    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
