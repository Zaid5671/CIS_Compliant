from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any

from .evaluators import evaluate_check
from .models import BenchmarkMeta, Check, ScanReport
from .runners import LocalRunner, Runner
from .targets import Target


def run_scan(
    meta: BenchmarkMeta,
    checks: list[Check],
    runner: Runner | None = None,
    workers: int = 4,
    target: Target | None = None,
) -> ScanReport:
    started_clock = datetime.now(timezone.utc)
    started = time.perf_counter()

    runner = runner or LocalRunner()
    target = target or Target.local()

    max_workers = max(1, min(workers, 16, len(checks) or 1))

    ordered: list[Any] = [None] * len(checks)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(evaluate_check, check, runner): index for index, check in enumerate(checks)}
        for future in as_completed(futures):
            ordered[futures[future]] = future.result()

    results = [result for result in ordered if result is not None]
    finished_clock = datetime.now(timezone.utc)

    return ScanReport(
        benchmark=meta,
        results=results,
        started_at=started_clock.isoformat(),
        finished_at=finished_clock.isoformat(),
        duration_ms=int((time.perf_counter() - started) * 1000),
        target=target.safe_summary(),
        host_context=runner.describe(),
    )
