from __future__ import annotations

import re
from html import unescape
from html.parser import HTMLParser
from typing import Any

from .models import BenchmarkMeta, Check, normalize_severity


CONTROL_KEYS = ("checks", "rules", "controls", "recommendations", "items", "tests")
GROUP_KEYS = ("groups", "sections", "children")
PARAM_KEYS = (
    "command",
    "shell",
    "timeout",
    "path",
    "pattern",
    "contains",
    "encoding",
    "registry_path",
    "hive",
    "key",
    "value_name",
    "service",
    "service_name",
    "start_type",
)


def load_benchmark(payload: dict[str, Any], source: str = "uploaded") -> tuple[BenchmarkMeta, list[Check]]:
    if not isinstance(payload, dict):
        raise ValueError("Benchmark JSON must be an object.")

    if _is_cis_bench_payload(payload):
        return _load_cis_bench_payload(payload, source)

    meta_source = payload.get("benchmark") or payload.get("metadata") or payload.get("meta") or payload
    meta = BenchmarkMeta(
        title=_first_text(meta_source, "title", "name", "benchmark_title", default="Untitled Benchmark"),
        version=_first_text(meta_source, "version", "benchmark_version", "release", default="unknown"),
        platform=_first_text(meta_source, "platform", "os", "target", "target_platform", default="local"),
        source=source,
    )

    checks: list[Check] = []
    _collect_checks(payload, checks, inherited={})

    if not checks:
        raise ValueError("No checks were found. Use a top-level checks, rules, controls, recommendations, or groups array.")

    return meta, checks


def _collect_checks(node: Any, checks: list[Check], inherited: dict[str, str]) -> None:
    if isinstance(node, list):
        for item in node:
            _collect_checks(item, checks, inherited)
        return

    if not isinstance(node, dict):
        return

    next_inherited = dict(inherited)
    category = _first_text(node, "category", "section", "group_title", "group", default="")
    if category:
        next_inherited["category"] = category
    profile = _first_text(node, "profile", "level", default="")
    if profile:
        next_inherited["profile"] = profile

    has_child_array = any(isinstance(node.get(key), list) for key in CONTROL_KEYS + GROUP_KEYS)

    # Do not double-count a node that both looks like a check and contains children.
    # Prefer the children and treat the outer node as a group container.
    if _looks_like_check(node) and not has_child_array:
        checks.append(_normalize_check(node, next_inherited, len(checks) + 1))
        return

    for key in CONTROL_KEYS:
        value = node.get(key)
        if isinstance(value, list):
            for item in value:
                if isinstance(item, dict) and _looks_like_group(item) and not _looks_like_check(item):
                    _collect_checks(item, checks, next_inherited)
                elif isinstance(item, dict):
                    checks.append(_normalize_check(item, next_inherited, len(checks) + 1))

    for key in GROUP_KEYS:
        value = node.get(key)
        if isinstance(value, list):
            for item in value:
                _collect_checks(item, checks, next_inherited)


def _normalize_check(raw: dict[str, Any], inherited: dict[str, str], ordinal: int) -> Check:
    expect = raw.get("expect") or raw.get("expected") or raw.get("condition") or {}
    if not isinstance(expect, dict):
        expect = {"operator": "equals", "value": expect}

    check_type = _first_text(raw, "type", "check_type", "kind", default="")
    params = _extract_params(raw)
    if not check_type:
        check_type = _infer_check_type(raw, params)

    return Check(
        id=_first_text(raw, "id", "ref", "rule_id", "control_id", "cis_id", "xccdf_id", default=f"check-{ordinal}"),
        title=_first_text(raw, "title", "name", "description", default=f"Check {ordinal}"),
        type=check_type.lower().replace("-", "_"),
        severity=normalize_severity(_first_text(raw, "severity", "risk", "impact", default="medium")),
        profile=_profile_text(raw, inherited.get("profile", "Unprofiled")),
        category=_first_text(raw, "category", "section", "group", default=inherited.get("category", "General")),
        description=_html_to_text(_first_text(raw, "description", "summary", default="")),
        rationale=_html_to_text(_first_text(raw, "rationale", "reason", default="")),
        remediation=_html_to_text(_first_text(raw, "remediation", "fix", "solution", default="")),
        audit=_html_to_text(_first_text(raw, "audit", "audit_procedure", "check", default="")),
        references=_extract_references(raw),
        expect=expect,
        params=params,
        metadata=_extract_metadata(raw),
        raw=raw,
    )


def _extract_params(raw: dict[str, Any]) -> dict[str, Any]:
    params = dict(raw.get("params") or raw.get("parameters") or {})
    for key in PARAM_KEYS:
        if key in raw and key not in params:
            params[key] = raw[key]
    return params


def _extract_references(raw: dict[str, Any]) -> list[str]:
    refs = raw.get("references") or raw.get("refs") or []
    if isinstance(refs, str):
        return [_html_to_text(refs)]
    if isinstance(refs, list):
        return [str(ref) for ref in refs]
    return []


def _extract_metadata(raw: dict[str, Any]) -> dict[str, Any]:
    metadata = dict(raw.get("metadata") or {})
    for key in ("url", "assessment_status", "nist_controls", "cis_controls", "mitre_mapping", "artifacts", "tags"):
        if key in raw and key not in metadata:
            metadata[key] = raw[key]
    return metadata


def _infer_check_type(raw: dict[str, Any], params: dict[str, Any]) -> str:
    if "command" in params:
        return "command"
    if "registry_path" in params or "hive" in params:
        return "registry"
    if "service" in params or "service_name" in params:
        return "service"
    if "path" in params and ("pattern" in params or "contains" in params):
        return "file_contains"
    if "path" in params:
        return "file_exists"
    return "manual"


def _looks_like_check(node: dict[str, Any]) -> bool:
    has_identifier = any(key in node for key in ("id", "ref", "rule_id", "control_id", "cis_id", "xccdf_id"))
    has_check_signal = any(
        key in node for key in ("command", "registry_path", "service", "service_name", "path", "type")
    )
    if has_identifier and (
        any(key in node for key in ("title", "name", "description")) or has_check_signal
    ):
        return True
    return has_check_signal and "title" in node


def _looks_like_group(node: dict[str, Any]) -> bool:
    has_group_signal = any(isinstance(node.get(key), list) for key in GROUP_KEYS + CONTROL_KEYS)
    has_check_signal = any(
        key in node for key in ("command", "registry_path", "service", "service_name", "type")
    )
    return has_group_signal and not has_check_signal


def _first_text(source: dict[str, Any], *keys: str, default: str = "") -> str:
    for key in keys:
        value = source.get(key)
        if value is None:
            continue
        if isinstance(value, (dict, list)):
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def _profile_text(raw: dict[str, Any], default: str) -> str:
    value = raw.get("profile")
    if value is None:
        value = raw.get("profiles")
    if value is None:
        value = raw.get("level")
    if isinstance(value, list):
        parts = [str(item).strip() for item in value if str(item).strip()]
        return ", ".join(parts) if parts else default
    if value is not None:
        text = str(value).strip()
        if text:
            return text
    return default


def _is_cis_bench_payload(payload: dict[str, Any]) -> bool:
    recommendations = payload.get("recommendations")
    if not isinstance(recommendations, list):
        return False
    if "benchmark_id" in payload and "total_recommendations" in payload:
        return True
    return any(
        isinstance(item, dict) and {"ref", "assessment_status"}.issubset(item)
        for item in recommendations
    )


def _load_cis_bench_payload(payload: dict[str, Any], source: str) -> tuple[BenchmarkMeta, list[Check]]:
    title = _first_text(payload, "title", "name", default="Untitled Benchmark")
    meta = BenchmarkMeta(
        title=title,
        version=_first_text(payload, "version", default="unknown"),
        platform=_first_text(payload, "platform", "target", default=_infer_platform(title)),
        source=source,
    )

    checks = [
        _normalize_cis_bench_recommendation(recommendation, index + 1)
        for index, recommendation in enumerate(payload.get("recommendations") or [])
        if isinstance(recommendation, dict)
    ]
    if not checks:
        raise ValueError("cis-bench JSON did not contain any recommendations.")
    return meta, checks


def _normalize_cis_bench_recommendation(raw: dict[str, Any], ordinal: int) -> Check:
    assessment_status = _first_text(raw, "assessment_status", default="Manual")
    parent = raw.get("parent") if isinstance(raw.get("parent"), dict) else {}
    category = _html_to_text(_first_text(parent, "title", default="CIS Recommendations"))
    audit = _html_to_text(_first_text(raw, "audit", default=""))
    description = _html_to_text(_first_text(raw, "description", default=""))
    artifacts = raw.get("artifacts") if isinstance(raw.get("artifacts"), list) else []

    metadata = {
        "source": "cis-bench",
        "assessment_status": assessment_status,
        "source_url": _first_text(raw, "url", default=""),
        "cis_controls": _format_cis_controls(raw.get("cis_controls")),
        "mitre_mapping": _format_mitre_mapping(raw.get("mitre_mapping")),
        "nist_controls": raw.get("nist_controls") if isinstance(raw.get("nist_controls"), list) else [],
        "artifacts": _format_artifacts(artifacts),
        "artifact_count": len(artifacts),
    }

    evidence_parts = [
        f"CIS assessment status: {assessment_status}.",
        "Imported from mitre/cis-bench JSON.",
    ]
    if audit:
        evidence_parts.append(audit)
    elif description:
        evidence_parts.append(description)

    return Check(
        id=_first_text(raw, "ref", "id", default=f"recommendation-{ordinal}"),
        title=_html_to_text(_first_text(raw, "title", default=f"Recommendation {ordinal}")),
        type="manual",
        severity=_cis_bench_severity(raw),
        profile=_profile_text(raw, "Unprofiled"),
        category=category,
        description=description,
        rationale=_html_to_text(_first_text(raw, "rationale", default="")),
        remediation=_html_to_text(_first_text(raw, "remediation", default="")),
        audit="\n\n".join(part for part in evidence_parts if part),
        references=_extract_references(raw),
        expect={"operator": "review", "value": f"CIS assessment status: {assessment_status}"},
        params={},
        metadata=metadata,
        raw=raw,
    )


def _cis_bench_severity(raw: dict[str, Any]) -> str:
    severity = _first_text(raw, "severity", "risk", default="")
    if severity:
        return normalize_severity(severity)
    profiles = _profile_text(raw, "").lower()
    if "level 2" in profiles and "level 1" not in profiles:
        return "high"
    return "medium"


def _format_cis_controls(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    controls = []
    for item in value:
        if isinstance(item, dict):
            control = str(item.get("control") or item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            version = str(item.get("version") or "").strip()
            label = f"v{version} {control}".strip()
            controls.append(f"{label} - {title}" if title else label)
        else:
            controls.append(str(item))
    return [control for control in controls if control.strip()]


def _format_mitre_mapping(value: Any) -> dict[str, list[str]]:
    if not isinstance(value, dict):
        return {"techniques": [], "tactics": [], "mitigations": []}
    return {
        "techniques": [str(item) for item in value.get("techniques", [])],
        "tactics": [str(item) for item in value.get("tactics", [])],
        "mitigations": [str(item) for item in value.get("mitigations", [])],
    }


def _format_artifacts(value: list[Any]) -> list[str]:
    artifacts = []
    for item in value:
        if isinstance(item, dict):
            ref = str(item.get("view_level") or item.get("id") or "").strip()
            title = str(item.get("title") or "").strip()
            status = str(item.get("status") or "").strip()
            text = " - ".join(part for part in (ref, title, status) if part)
            if text:
                artifacts.append(text)
        else:
            artifacts.append(str(item))
    return artifacts


def _infer_platform(title: str) -> str:
    lowered = title.lower()
    known = {
        "windows": "windows",
        "ubuntu": "ubuntu",
        "debian": "debian",
        "red hat": "rhel",
        "rhel": "rhel",
        "almalinux": "almalinux",
        "oracle linux": "oracle-linux",
        "amazon linux": "amazon-linux",
        "macos": "macos",
        "aws": "aws",
        "azure": "azure",
        "google cloud": "gcp",
        "kubernetes": "kubernetes",
        "docker": "docker",
    }
    for needle, platform in known.items():
        if needle in lowered:
            return platform
    return "local"


class _TextExtractor(HTMLParser):
    block_tags = {"br", "p", "div", "li", "tr", "table", "ul", "ol", "pre", "code", "h1", "h2", "h3", "h4"}

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() in self.block_tags:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() in self.block_tags:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        text = data.strip()
        if text:
            self.parts.append(text)

    def text(self) -> str:
        joined = " ".join(self.parts)
        joined = unescape(joined)
        joined = re.sub(r"[ \t]+\n", "\n", joined)
        joined = re.sub(r"\n[ \t]+", "\n", joined)
        joined = re.sub(r"[ \t]{2,}", " ", joined)
        joined = re.sub(r"\n{3,}", "\n\n", joined)
        return joined.strip()


def _html_to_text(value: str) -> str:
    if not value:
        return ""
    if "<" not in value or ">" not in value:
        return unescape(str(value)).strip()
    parser = _TextExtractor()
    parser.feed(str(value))
    parser.close()
    return parser.text()
