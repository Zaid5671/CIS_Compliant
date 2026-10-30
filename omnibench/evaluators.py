from __future__ import annotations

import os
import re
import time
from typing import Any

from .models import ERROR, FAIL, MANUAL, PASS, WARN, Check, CheckResult
from .runners import Runner


def evaluate_check(check: Check, runner: Runner) -> CheckResult:
    started = time.perf_counter()
    try:
        if check.type == "command":
            result = _evaluate_command(check, runner)
        elif check.type == "file_exists":
            result = _evaluate_file_exists(check, runner)
        elif check.type == "file_contains":
            result = _evaluate_file_contains(check, runner)
        elif check.type == "registry":
            result = _evaluate_registry(check, runner)
        elif check.type == "service":
            result = _evaluate_service(check, runner)
        elif check.type == "manual":
            result = _manual_result(check)
        else:
            result = _base_result(
                check,
                WARN,
                evidence=f"Unsupported check type: {check.type}",
                expected=_expect_text(check.expect),
            )
    except Exception as exc:  # noqa: BLE001 - scanner captures per-check failures
        result = _base_result(
            check,
            ERROR,
            evidence="The check could not be evaluated.",
            expected=_expect_text(check.expect),
            error=str(exc),
        )

    result.duration_ms = int((time.perf_counter() - started) * 1000)
    return result


def _evaluate_command(check: Check, runner: Runner) -> CheckResult:
    command = check.params.get("command")
    if not command:
        return _base_result(check, ERROR, evidence="Missing command.", expected=_expect_text(check.expect))

    timeout = _safe_timeout(check.params.get("timeout"), 30)
    completed = runner.run_command(command, timeout=timeout)
    output = completed.stdout
    stderr = completed.stderr
    combined = output if not stderr else f"{output}\n[stderr]\n{stderr}".strip()
    display_command = _display_command(command)

    # Empty expect -> Nessus convention: exit code 0 means PASS.
    if not check.expect:
        status = PASS if completed.returncode == 0 else FAIL
        if completed.returncode != 0 and not output and stderr:
            status = ERROR
        return _base_result(
            check,
            status,
            evidence=_clip(combined or f"Command exited with code {completed.returncode}."),
            expected="exit code 0",
            actual=str(completed.returncode),
            command=display_command,
            error=stderr if status == ERROR else "",
        )

    matched, actual, expected = _matches_expect(output, check.expect)
    status = PASS if matched and completed.returncode == 0 else FAIL
    if completed.returncode != 0 and not output:
        status = ERROR

    return _base_result(
        check,
        status,
        evidence=_clip(combined or f"Command exited with code {completed.returncode}."),
        expected=expected,
        actual=actual or str(completed.returncode),
        command=display_command,
        error=stderr if status == ERROR else "",
    )


def _evaluate_file_exists(check: Check, runner: Runner) -> CheckResult:
    path = str(check.params.get("path") or "")
    if not path:
        return _base_result(check, ERROR, evidence="Missing file path.", expected=_expect_text(check.expect))
    exists = runner.file_exists(path)
    expect = check.expect or {"operator": "is_true", "value": True}
    matched, actual, expected = _matches_expect(exists, expect)
    return _base_result(
        check,
        PASS if matched else FAIL,
        evidence=f"{path} exists: {exists}",
        expected=expected,
        actual=actual,
        command=f'Test-Path "{path}"',
    )


def _evaluate_file_contains(check: Check, runner: Runner) -> CheckResult:
    path = str(check.params.get("path") or "")
    if not path:
        return _base_result(check, ERROR, evidence="Missing file path.", expected=_expect_text(check.expect))
    if not runner.file_exists(path):
        return _base_result(check, FAIL, evidence=f"{path} does not exist.", expected=_expect_text(check.expect))

    try:
        content = runner.read_text_file(path, encoding=str(check.params.get("encoding") or "utf-8"))
    except Exception as exc:  # noqa: BLE001
        return _base_result(check, ERROR, evidence=f"Could not read {path}.", error=str(exc))

    expect = dict(check.expect or {})
    fallback = check.params.get("pattern") or check.params.get("contains") or ""
    if "operator" not in expect:
        expect["operator"] = "regex" if check.params.get("pattern") else "contains"
    if "value" not in expect:
        expect["value"] = fallback

    matched, actual, expected = _matches_expect(content, expect)
    pattern_val = fallback or expect.get("value", "")
    return _base_result(
        check,
        PASS if matched else FAIL,
        evidence=_clip(_matching_line(content, str(expect.get("value", ""))) or f"Read {len(content)} characters from {path}."),
        expected=expected,
        actual=actual,
        command=f'Select-String -Path "{path}" -Pattern "{pattern_val}"',
    )


def _evaluate_registry(check: Check, runner: Runner) -> CheckResult:
    registry_path = str(check.params.get("registry_path") or check.params.get("path") or "")
    hive_text = str(check.params.get("hive") or "")
    key_text = str(check.params.get("key") or "")
    value_name = str(check.params.get("value_name") or check.params.get("name") or "")

    if not value_name:
        return _base_result(check, ERROR, evidence="Missing registry value name.")

    hive, key = _split_registry_path(registry_path, hive_text, key_text)
    pretty_path = registry_path or f"{hive}\\{key}"
    probe_cmd = f'reg query "{pretty_path}" /v "{value_name}"'
    try:
        value, value_type = runner.query_registry(hive, key, value_name)
    except RuntimeError as exc:
        if "only supported on windows" in str(exc).lower():
            return _base_result(check, WARN, evidence=str(exc), command=probe_cmd)
        return _base_result(check, FAIL, evidence=str(exc), command=probe_cmd)

    matched, actual, expected = _matches_expect(value, check.expect)
    return _base_result(
        check,
        PASS if matched else FAIL,
        evidence=f"Registry value {pretty_path}\\{value_name} = {value!r} ({value_type}).",
        expected=expected,
        actual=actual,
        command=probe_cmd,
    )


def _evaluate_service(check: Check, runner: Runner) -> CheckResult:
    service_name = str(check.params.get("service") or check.params.get("service_name") or "")
    if not service_name:
        return _base_result(check, ERROR, evidence="Missing service name.", expected=_expect_text(check.expect))

    probe_cmd = f'Get-Service -Name "{service_name}"'
    state = runner.query_service(service_name)
    field_name = str(check.expect.get("field") or "status") if check.expect else "status"
    actual_value = state.get(field_name, state.get("status", "unknown"))
    matched, actual, expected = _matches_expect(actual_value, check.expect)
    return _base_result(
        check,
        PASS if matched else FAIL,
        evidence=", ".join(f"{key}: {value}" for key, value in state.items()),
        expected=expected,
        actual=actual,
        command=probe_cmd,
    )


def _manual_result(check: Check) -> CheckResult:
    return _base_result(
        check,
        MANUAL,
        evidence=check.audit or check.description or "Manual review required.",
        expected=_expect_text(check.expect),
        command="Manual administrative review (no automated probe)",
    )


def _matches_expect(actual: Any, expect: dict[str, Any]) -> tuple[bool, str, str]:
    operator = str(expect.get("operator") or "equals").strip().lower()
    expected = expect.get("value")
    if "values" in expect and expected is None:
        expected = expect.get("values")

    actual_text = _stringify(actual)
    expected_text = _stringify(expected)

    if operator == "exists":
        return bool(actual), actual_text, "exists"
    if operator in {"is_true", "true"}:
        return _to_bool(actual) is True, actual_text, "true"
    if operator in {"is_false", "false"}:
        return _to_bool(actual) is False, actual_text, "false"
    if operator in {"equals", "eq", "=="}:
        return _coerce_scalar(actual) == _coerce_scalar(expected), actual_text, expected_text
    if operator in {"not_equals", "neq", "!="}:
        return _coerce_scalar(actual) != _coerce_scalar(expected), actual_text, expected_text
    if operator == "contains":
        return expected_text.lower() in actual_text.lower(), actual_text, f"contains {expected_text}"
    if operator == "not_contains":
        return expected_text.lower() not in actual_text.lower(), actual_text, f"does not contain {expected_text}"
    if operator == "regex":
        return re.search(str(expected), actual_text, flags=re.IGNORECASE | re.MULTILINE) is not None, actual_text, f"matches /{expected}/"
    if operator == "not_regex":
        return re.search(str(expected), actual_text, flags=re.IGNORECASE | re.MULTILINE) is None, actual_text, f"does not match /{expected}/"
    if operator in {"gt", "gte", "lt", "lte"}:
        return _compare_number(actual, expected, operator), actual_text, f"{operator} {expected_text}"
    if operator == "in":
        values = expected if isinstance(expected, list) else [expected]
        normalized = [_stringify(value).lower() for value in values]
        return actual_text.lower() in normalized, actual_text, f"in {normalized}"
    if operator == "not_in":
        values = expected if isinstance(expected, list) else [expected]
        normalized = [_stringify(value).lower() for value in values]
        return actual_text.lower() not in normalized, actual_text, f"not in {normalized}"
    if operator == "review":
        return False, actual_text, expected_text or "manual review"

    return False, actual_text, f"unsupported operator {operator}"


def _compare_number(actual: Any, expected: Any, operator: str) -> bool:
    try:
        left = float(str(actual).strip())
        right = float(str(expected).strip())
    except ValueError:
        return False
    if operator == "gt":
        return left > right
    if operator == "gte":
        return left >= right
    if operator == "lt":
        return left < right
    return left <= right


def _split_registry_path(registry_path: str, hive_text: str, key_text: str) -> tuple[str, str]:
    if registry_path:
        cleaned = registry_path.replace("/", "\\")
        parts = cleaned.split("\\", 1)
        return parts[0], parts[1] if len(parts) > 1 else ""
    return hive_text, key_text


def _base_result(
    check: Check,
    status: str,
    evidence: str = "",
    expected: str = "",
    actual: str = "",
    error: str = "",
    command: str = "",
) -> CheckResult:
    resolved_cmd = command or _display_command(check.params.get("command") or "")
    return CheckResult(
        check_id=check.id,
        title=check.title,
        status=status,
        severity=check.severity,
        profile=check.profile,
        category=check.category,
        type=check.type,
        evidence=evidence,
        expected=expected,
        actual=actual,
        remediation=check.remediation,
        rationale=check.rationale,
        error=error,
        command=resolved_cmd,
        metadata=check.metadata,
    )


def _expect_text(expect: dict[str, Any]) -> str:
    if not expect:
        return ""
    operator = expect.get("operator", "equals")
    value = expect.get("value", expect.get("values", ""))
    return f"{operator} {_stringify(value)}"


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    return str(value).strip()


def _coerce_scalar(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    text = _stringify(value)
    if text.lower() in {"true", "false"}:
        return text.lower() == "true"
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return text.lower()


def _to_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    text = _stringify(value).lower()
    if text in {"1", "true", "yes", "enabled", "running", "active"}:
        return True
    if text in {"0", "false", "no", "disabled", "stopped", "inactive"}:
        return False
    return None


def _matching_line(content: str, pattern: str) -> str:
    if not pattern:
        return ""
    for line in content.splitlines():
        try:
            if re.search(pattern, line, flags=re.IGNORECASE):
                return line.strip()
        except re.error:
            if pattern.lower() in line.lower():
                return line.strip()
    return ""


def _safe_timeout(value: Any, fallback: int) -> int:
    try:
        out = int(value)
        return out if out > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def _display_command(command: Any) -> str:
    if isinstance(command, str):
        return command
    if isinstance(command, list):
        return " ".join(map(str, command))
    return str(command)


def _clip(text: str, limit: int = 3000) -> str:
    text = text.replace(os.linesep, "\n").strip()
    if len(text) <= limit:
        return text
    return f"{text[:limit]}..."
