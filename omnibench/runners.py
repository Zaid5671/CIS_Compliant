from __future__ import annotations

import os
import platform
import re
import shlex
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .paths import CHECKS_DIR, DATA_DIR, data_dir_for_env
from .targets import AUTH_PASSWORD, LOCAL, PROTOCOL_SSH, REMOTE, Target


@dataclass(slots=True)
class CommandResult:
    returncode: int
    stdout: str
    stderr: str


class Runner:
    target_type: str = LOCAL

    def describe(self) -> dict[str, str]:
        return {"target": self.target_type}

    def run_command(self, command, timeout: int) -> CommandResult:
        raise NotImplementedError

    def file_exists(self, path: str) -> bool:
        raise NotImplementedError

    def read_text_file(self, path: str, encoding: str = "utf-8") -> str:
        raise NotImplementedError

    def query_service(self, service: str) -> dict[str, str]:
        raise NotImplementedError

    def query_registry(self, hive: str, key: str, value_name: str) -> tuple[Any, str]:
        raise NotImplementedError

    def close(self) -> None:
        return None


def _substitute_placeholders(command):
    """Expand {omni_data} placeholders to the package data directory."""
    token = data_dir_for_env()
    if isinstance(command, str):
        return command.replace("{omni_data}", token)
    if isinstance(command, list):
        return [str(part).replace("{omni_data}", token) for part in command]
    return command


def _runner_env() -> dict[str, str]:
    env = os.environ.copy()
    env["OMNIBENCH_DATA_DIR"] = str(DATA_DIR)
    env["OMNIBENCH_CHECKS_DIR"] = str(CHECKS_DIR)
    return env


class LocalRunner(Runner):
    target_type = LOCAL

    def describe(self) -> dict[str, str]:
        return {
            "target": LOCAL,
            "host": platform.node(),
            "system": platform.system(),
            "release": platform.release(),
        }

    def run_command(self, command, timeout: int) -> CommandResult:
        expanded = _substitute_placeholders(command)
        proc = subprocess.run(
            expanded,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=isinstance(expanded, str),
            env=_runner_env(),
        )
        return CommandResult(proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip())

    def file_exists(self, path: str) -> bool:
        return Path(path).exists()

    def read_text_file(self, path: str, encoding: str = "utf-8") -> str:
        return Path(path).read_text(encoding=encoding, errors="replace")

    def query_service(self, service: str) -> dict[str, str]:
        if platform.system().lower() == "windows":
            return _windows_service_state(service, _local_args_run)
        return _linux_service_state(service, _local_args_run)

    def query_registry(self, hive: str, key: str, value_name: str) -> tuple[Any, str]:
        if platform.system().lower() != "windows":
            raise RuntimeError("Registry checks are only supported on Windows targets.")
        import winreg

        hive_map = {
            "HKEY_LOCAL_MACHINE": winreg.HKEY_LOCAL_MACHINE,
            "HKLM": winreg.HKEY_LOCAL_MACHINE,
            "HKEY_CURRENT_USER": winreg.HKEY_CURRENT_USER,
            "HKCU": winreg.HKEY_CURRENT_USER,
            "HKEY_CLASSES_ROOT": winreg.HKEY_CLASSES_ROOT,
            "HKCR": winreg.HKEY_CLASSES_ROOT,
            "HKEY_USERS": winreg.HKEY_USERS,
            "HKU": winreg.HKEY_USERS,
        }
        hive_key = hive_map.get(hive.upper())
        if hive_key is None:
            raise ValueError(f"Unsupported registry hive: {hive}")
        with winreg.OpenKey(hive_key, key) as opened:
            value, value_type = winreg.QueryValueEx(opened, value_name)
        return value, str(value_type)


def _local_args_run(args: list[str], timeout: int) -> CommandResult:
    proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    return CommandResult(proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip())


def _windows_service_state(service: str, run) -> dict[str, str]:
    query = run(["sc.exe", "query", service], 15)
    config = run(["sc.exe", "qc", service], 15)
    status = "unknown"
    start_type = "unknown"

    state_match = re.search(r"STATE\s+:\s+\d+\s+(\w+)", query.stdout)
    if state_match:
        status = state_match.group(1).lower()
    start_match = re.search(r"START_TYPE\s+:\s+\d+\s+(\w+)", config.stdout)
    if start_match:
        start_type = start_match.group(1).lower()
    if query.returncode != 0:
        status = "not_found"
    return {"service": service, "status": status, "start_type": start_type}


def _linux_service_state(service: str, run) -> dict[str, str]:
    active = run(["systemctl", "is-active", service], 15)
    enabled = run(["systemctl", "is-enabled", service], 15)
    return {
        "service": service,
        "status": (active.stdout or "unknown").strip().lower(),
        "start_type": (enabled.stdout or "unknown").strip().lower(),
    }


class SSHRunner(Runner):
    """Remote runner over the system ``ssh`` binary. Key authentication only."""

    target_type = REMOTE

    def __init__(self, target: Target) -> None:
        self._target = target
        self._cached_uname: str = ""

    def describe(self) -> dict[str, str]:
        return {
            "target": REMOTE,
            "host": self._target.host,
            "port": str(self._target.port),
            "username": self._target.username,
            "uname": self._uname(),
        }

    def _ssh_base_args(self) -> list[str]:
        args = [
            "ssh",
            "-o", "BatchMode=yes",
            "-o", "StrictHostKeyChecking=accept-new",
            "-o", "ConnectTimeout=10",
            "-p", str(self._target.port),
        ]
        if self._target.auth.key_path:
            args += ["-i", self._target.auth.key_path]
        args.append(f"{self._target.username}@{self._target.host}")
        return args

    def run_command(self, command, timeout: int) -> CommandResult:
        if isinstance(command, str):
            remote = command
        elif isinstance(command, list):
            remote = " ".join(shlex.quote(str(part)) for part in command)
        else:
            remote = str(command)
        args = self._ssh_base_args() + [remote]
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
        return CommandResult(proc.returncode, (proc.stdout or "").strip(), (proc.stderr or "").strip())

    def file_exists(self, path: str) -> bool:
        quoted = shlex.quote(path)
        result = self.run_command(f"if [ -e {quoted} ]; then echo yes; else echo no; fi", 15)
        if result.stdout in {"yes", "no"}:
            return result.stdout == "yes"
        win_result = self.run_command(f'cmd /c "if exist {path} (echo yes) else (echo no)"', 15)
        return win_result.stdout.strip().lower().endswith("yes")

    def read_text_file(self, path: str, encoding: str = "utf-8") -> str:
        quoted = shlex.quote(path)
        result = self.run_command(f"cat {quoted}", 30)
        if result.returncode == 0:
            return result.stdout
        win_result = self.run_command(f'cmd /c type "{path}"', 30)
        if win_result.returncode == 0:
            return win_result.stdout
        raise RuntimeError(result.stderr or win_result.stderr or f"Could not read {path}")

    def query_service(self, service: str) -> dict[str, str]:
        uname = self._uname().lower()
        if any(token in uname for token in ("linux", "freebsd", "darwin")):
            return _linux_service_state(service, self._run_args)
        return _windows_service_state(service, self._run_args)

    def query_registry(self, hive: str, key: str, value_name: str) -> tuple[Any, str]:
        hive_alias = hive.upper()
        if hive_alias == "HKEY_LOCAL_MACHINE":
            hive_alias = "HKLM"
        if hive_alias == "HKEY_CURRENT_USER":
            hive_alias = "HKCU"
        path = f"{hive_alias}\\{key}"
        result = self.run_command(f'reg query "{path}" /v "{value_name}"', 15)
        if result.returncode != 0:
            raise RuntimeError(result.stderr or "Registry query failed")
        for line in result.stdout.splitlines():
            stripped = line.strip()
            if stripped.lower().startswith(value_name.lower()):
                parts = stripped.split(None, 2)
                if len(parts) >= 3:
                    return parts[2], parts[1]
        raise RuntimeError(f"Value '{value_name}' not found in {path}")

    def _run_args(self, args: list[str], timeout: int) -> CommandResult:
        command = " ".join(shlex.quote(str(part)) for part in args)
        return self.run_command(command, timeout)

    def _uname(self) -> str:
        if self._cached_uname:
            return self._cached_uname
        result = self.run_command("uname -a 2>/dev/null || ver", 10)
        self._cached_uname = result.stdout
        return self._cached_uname


class ParamikoSSHRunner(SSHRunner):
    """Remote runner backed by ``paramiko`` so password authentication works without a TTY.

    Only used for password auth; key auth stays on the dependency-free system-``ssh``
    path (:class:`SSHRunner`). ``paramiko`` is an optional dependency, imported lazily on
    first connect, so the default install keeps zero runtime dependencies.

    Higher-level helpers (file_exists / read_text_file / query_service / query_registry)
    are inherited from :class:`SSHRunner`; only the command primitive and connection
    lifecycle are overridden.
    """

    def __init__(self, target: Target) -> None:
        super().__init__(target)
        self._client: Any = None
        self._lock = threading.Lock()

    def _connect(self):
        if self._client is not None:
            return self._client
        with self._lock:
            if self._client is not None:
                return self._client
            try:
                import paramiko
            except ImportError as exc:  # optional dependency
                raise RuntimeError(
                    "Password authentication requires the optional 'paramiko' package. "
                    'Install it with:  pip install "omnibench[ssh-password]"'
                ) from exc

            client = paramiko.SSHClient()
            # Trust-on-first-use, matching the system-ssh StrictHostKeyChecking=accept-new.
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            connect_kwargs: dict[str, Any] = dict(
                hostname=self._target.host,
                port=self._target.port,
                username=self._target.username,
                timeout=10,
                banner_timeout=15,
                auth_timeout=15,
                allow_agent=False,
                look_for_keys=False,
            )
            if self._target.auth.method == AUTH_PASSWORD:
                connect_kwargs["password"] = self._target.auth.password
            else:
                if self._target.auth.key_path:
                    connect_kwargs["key_filename"] = self._target.auth.key_path
                if self._target.auth.key_passphrase:
                    connect_kwargs["passphrase"] = self._target.auth.key_passphrase
            target_label = f"{self._target.host}:{self._target.port}"
            try:
                client.connect(**connect_kwargs)
            except paramiko.AuthenticationException as exc:
                raise RuntimeError("SSH authentication failed — check the username and password.") from exc
            except paramiko.SSHException as exc:
                raise RuntimeError(f"SSH error connecting to {target_label}: {exc}") from exc
            except OSError as exc:
                raise RuntimeError(f"Could not connect to {target_label}: {exc}") from exc
            self._client = client
            return client

    def run_command(self, command, timeout: int) -> CommandResult:
        if isinstance(command, str):
            remote = command
        elif isinstance(command, list):
            remote = " ".join(shlex.quote(str(part)) for part in command)
        else:
            remote = str(command)
        try:
            client = self._connect()
            _stdin, stdout, stderr = client.exec_command(remote, timeout=timeout)
            out = stdout.read().decode("utf-8", "replace")
            err = stderr.read().decode("utf-8", "replace")
            returncode = stdout.channel.recv_exit_status()
        except Exception as exc:  # noqa: BLE001 - surface as a per-check error / clean test failure
            return CommandResult(1, "", str(exc))
        return CommandResult(returncode, out.strip(), err.strip())

    def close(self) -> None:
        if self._client is not None:
            try:
                self._client.close()
            finally:
                self._client = None


def make_runner(target: Target) -> Runner:
    if target.type == REMOTE:
        if target.protocol != PROTOCOL_SSH:
            raise ValueError(f"Unsupported protocol: {target.protocol}")
        if target.auth.method == AUTH_PASSWORD:
            return ParamikoSSHRunner(target)
        return SSHRunner(target)
    return LocalRunner()
