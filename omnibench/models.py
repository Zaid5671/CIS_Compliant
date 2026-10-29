from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any


PASS = "PASS"
FAIL = "FAIL"
WARN = "WARN"
ERROR = "ERROR"
MANUAL = "MANUAL"

STATUS_ORDER = [FAIL, ERROR, WARN, MANUAL, PASS]

SEVERITY_WEIGHTS = {
    "critical": 10,
    "high": 7,
    "medium": 4,
    "low": 2,
    "info": 0,
    "informational": 0,
}


@dataclass(slots=True)
class BenchmarkMeta:
    title: str = "Untitled Benchmark"
    version: str = "unknown"
    platform: str = "local"
    source: str = "uploaded"
    loaded_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass(slots=True)
class Check:
    id: str
    title: str
    type: str = "manual"
    severity: str = "medium"
    profile: str = "Unprofiled"
    category: str = "General"
    description: str = ""
    rationale: str = ""
    remediation: str = ""
    audit: str = ""
    references: list[str] = field(default_factory=list)
    expect: dict[str, Any] = field(default_factory=dict)
    params: dict[str, Any] = field(default_factory=dict)
    metadata: dict[str, Any] = field(default_factory=dict)
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CheckResult:
    check_id: str
    title: str
    status: str
    severity: str
    profile: str
    category: str
    type: str
    evidence: str = ""
    expected: str = ""
    actual: str = ""
    remediation: str = ""
    rationale: str = ""
    duration_ms: int = 0
    error: str = ""
    command: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class ScanReport:
    benchmark: BenchmarkMeta
    results: list[CheckResult]
    started_at: str
    finished_at: str
    duration_ms: int
    target: dict[str, Any] = field(default_factory=dict)
    host_context: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "benchmark": {
                "title": self.benchmark.title,
                "version": self.benchmark.version,
                "platform": self.benchmark.platform,
                "source": self.benchmark.source,
                "loaded_at": self.benchmark.loaded_at,
            },
            "target": self.target,
            "host_context": self.host_context,
            "summary": summarize_results(self.results),
            "started_at": self.started_at,
            "finished_at": self.finished_at,
            "duration_ms": self.duration_ms,
            "results": [asdict(result) for result in self.results],
        }


def normalize_severity(value: Any) -> str:
    text = str(value or "medium").strip().lower()
    aliases = {
        "cat i": "critical",
        "category i": "critical",
        "severe": "critical",
        "cat ii": "high",
        "category ii": "high",
        "moderate": "medium",
        "cat iii": "low",
        "category iii": "low",
        "none": "info",
    }
    return aliases.get(text, text if text in SEVERITY_WEIGHTS else "medium")


def risk_score(result: CheckResult) -> int:
    if result.status not in {FAIL, WARN}:
        return 0
    return SEVERITY_WEIGHTS.get(normalize_severity(result.severity), 4)


def summarize_results(results: list[CheckResult]) -> dict[str, Any]:
    total = len(results)
    status_counts = {status: 0 for status in [PASS, FAIL, WARN, ERROR, MANUAL]}
    severity_counts = {severity: 0 for severity in ["critical", "high", "medium", "low", "info"]}
    category_risk: dict[str, int] = {}
    profile_counts: dict[str, int] = {}

    weighted_possible = 0
    weighted_passed = 0

    for result in results:
        status_counts[result.status] = status_counts.get(result.status, 0) + 1
        severity = normalize_severity(result.severity)
        severity_counts[severity] = severity_counts.get(severity, 0) + 1
        profile_counts[result.profile] = profile_counts.get(result.profile, 0) + 1

        weight = max(SEVERITY_WEIGHTS.get(severity, 4), 1)
        # ERROR and MANUAL are inconclusive and excluded from the scoring base.
        if result.status in {PASS, FAIL, WARN}:
            weighted_possible += weight
            if result.status == PASS:
                weighted_passed += weight
        category_risk[result.category] = category_risk.get(result.category, 0) + risk_score(result)

    score = round((weighted_passed / weighted_possible) * 100, 1) if weighted_possible else 0
    failed = status_counts.get(FAIL, 0)
    errored = status_counts.get(ERROR, 0)

    return {
        "total": total,
        "score": score,
        # False when no auto-evaluable controls exist (e.g. all-manual cloud benchmarks),
        # so the UI can show "N/A" instead of a misleading 0%.
        "scored": weighted_possible > 0,
        "failed": failed,
        "errored": errored,
        "passed": status_counts.get(PASS, 0),
        "manual": status_counts.get(MANUAL, 0),
        "warn": status_counts.get(WARN, 0),
        "status_counts": status_counts,
        "severity_counts": severity_counts,
        "profile_counts": profile_counts,
        "category_risk": dict(sorted(category_risk.items(), key=lambda item: item[1], reverse=True)),
    }
