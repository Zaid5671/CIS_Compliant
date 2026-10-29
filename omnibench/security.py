from __future__ import annotations

import hmac
import re
import secrets
from urllib.parse import urlparse

MAX_BODY_BYTES = 32 * 1024 * 1024  # 32 MB cap on POST bodies

ALLOWED_URL_SCHEMES = frozenset({"http", "https", "mailto"})

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "::1"})

CSV_INJECT_PREFIXES = ("=", "+", "-", "@", "\t", "\r")

_HOST_LABEL_RE = re.compile(r"^[A-Za-z0-9_-]+$")
_IPV4_RE = re.compile(r"^\d{1,3}(\.\d{1,3}){3}$")
_IPV6_RE = re.compile(r"^[0-9A-Fa-f:]+$")


def generate_session_token() -> str:
    return secrets.token_urlsafe(32)


def constant_time_compare(left: str, right: str) -> bool:
    return hmac.compare_digest(left or "", right or "")


def is_safe_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        scheme = urlparse(str(url)).scheme.lower()
    except ValueError:
        return False
    return scheme in ALLOWED_URL_SCHEMES


def sanitize_url(url: str | None) -> str:
    return str(url) if is_safe_url(url) else ""


def host_allowed(host_header: str | None, allow_remote: bool) -> bool:
    if allow_remote:
        return True
    if not host_header:
        return False
    host = host_header.strip().lower()
    if host.startswith("["):
        end = host.find("]")
        if end == -1:
            return False
        candidate = host[1:end]
    else:
        candidate = host.split(":", 1)[0]
    return candidate in LOOPBACK_HOSTS


def sanitize_csv_cell(value) -> str:
    text = "" if value is None else str(value)
    if text and text[0] in CSV_INJECT_PREFIXES:
        return "'" + text
    return text


def is_valid_hostname(host: str) -> bool:
    if not host or len(host) > 253:
        return False
    if _IPV4_RE.match(host):
        return all(0 <= int(octet) <= 255 for octet in host.split("."))
    if ":" in host and _IPV6_RE.match(host):
        return True
    return all(_HOST_LABEL_RE.match(label) for label in host.split(".") if label)
