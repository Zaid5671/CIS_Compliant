from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from .security import is_valid_hostname

LOCAL = "local"
REMOTE = "remote"
PROTOCOL_SSH = "ssh"

AUTH_KEY = "key"
AUTH_PASSWORD = "password"


@dataclass(slots=True)
class Auth:
    method: str = AUTH_KEY
    key_path: str = ""
    key_passphrase: str = ""
    password: str = ""

    def safe_summary(self) -> dict[str, str]:
        if self.method == AUTH_KEY:
            return {"method": AUTH_KEY, "key_path": self.key_path}
        return {"method": self.method}


@dataclass(slots=True)
class Target:
    type: str = LOCAL
    host: str = ""
    port: int = 22
    protocol: str = PROTOCOL_SSH
    username: str = ""
    auth: Auth = field(default_factory=Auth)

    @classmethod
    def local(cls) -> "Target":
        return cls(type=LOCAL)

    @classmethod
    def from_dict(cls, payload: Any) -> "Target":
        if not isinstance(payload, dict):
            return cls.local()
        kind = str(payload.get("type") or LOCAL).strip().lower()
        if kind != REMOTE:
            return cls.local()
        auth_payload = payload.get("auth") if isinstance(payload.get("auth"), dict) else {}
        return cls(
            type=REMOTE,
            host=str(payload.get("host") or "").strip(),
            port=_safe_port(payload.get("port")),
            protocol=str(payload.get("protocol") or PROTOCOL_SSH).strip().lower(),
            username=str(payload.get("username") or "").strip(),
            auth=Auth(
                method=str(auth_payload.get("method") or AUTH_KEY).strip().lower(),
                key_path=str(auth_payload.get("key_path") or "").strip(),
                key_passphrase=str(auth_payload.get("key_passphrase") or ""),
                password=str(auth_payload.get("password") or ""),
            ),
        )

    def display(self) -> str:
        if self.type == LOCAL:
            return "Local device"
        user = f"{self.username}@" if self.username else ""
        return f"{user}{self.host}:{self.port}"

    def validate(self) -> str:
        if self.type == LOCAL:
            return ""
        if self.protocol != PROTOCOL_SSH:
            return f"Unsupported protocol: {self.protocol}"
        if not self.host:
            return "Remote target requires a host."
        if not is_valid_hostname(self.host):
            return "Remote target host is not a valid IP or hostname."
        if not (1 <= self.port <= 65535):
            return "Remote target port must be between 1 and 65535."
        if not self.username:
            return "Remote target requires a username."
        if self.auth.method == AUTH_KEY and not self.auth.key_path:
            return "SSH key authentication requires a key path."
        if self.auth.method == AUTH_PASSWORD and not self.auth.password:
            return "Password authentication requires a password."
        if self.auth.method not in {AUTH_KEY, AUTH_PASSWORD}:
            return f"Unsupported authentication method: {self.auth.method}"
        return ""

    def safe_summary(self) -> dict[str, Any]:
        if self.type == LOCAL:
            return {"type": LOCAL, "display": self.display()}
        return {
            "type": REMOTE,
            "host": self.host,
            "port": self.port,
            "protocol": self.protocol,
            "username": self.username,
            "auth": self.auth.safe_summary(),
            "display": self.display(),
        }


def _safe_port(value: Any) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return 22
