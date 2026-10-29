#!/usr/bin/env bash
# OmniBench one-line installer (Linux / macOS).
#
# Usage:
#   ./install.sh                    # user install to /opt/omnibench
#   PREFIX=$HOME/.local/omnibench ./install.sh
#   WITH_SERVICE=1 ./install.sh     # also install + start systemd unit
#
set -euo pipefail

PYTHON="${PYTHON:-python3}"
PREFIX="${PREFIX:-/opt/omnibench}"
LINK="${LINK:-/usr/local/bin/omnibench}"
WITH_SERVICE="${WITH_SERVICE:-0}"

# ---- Preflight -------------------------------------------------------------
if ! command -v "$PYTHON" >/dev/null 2>&1; then
    echo "error: $PYTHON not found. Install Python 3.10+ and retry." >&2
    exit 1
fi

py_version=$("$PYTHON" -c 'import sys; print("%d.%d" % sys.version_info[:2])')
case "$py_version" in
    3.10|3.11|3.12|3.13)
        ;;
    *)
        echo "error: Python 3.10+ required, found $py_version" >&2
        exit 1
        ;;
esac

SOURCE_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ ! -f "$SOURCE_DIR/pyproject.toml" ]; then
    echo "error: install.sh must run from the OmniBench source directory (pyproject.toml not found)." >&2
    exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
    SUDO="${SUDO:-sudo}"
else
    SUDO=""
fi

run() {
    if [ -n "$SUDO" ]; then
        $SUDO "$@"
    else
        "$@"
    fi
}

# ---- Install ---------------------------------------------------------------
echo "==> Installing OmniBench to $PREFIX"
run mkdir -p "$PREFIX"
run "$PYTHON" -m venv "$PREFIX/.venv"
run "$PREFIX/.venv/bin/pip" install --quiet --upgrade pip
run "$PREFIX/.venv/bin/pip" install --quiet "$SOURCE_DIR"

echo "==> Creating launcher at $LINK"
launcher_tmp=$(mktemp)
cat >"$launcher_tmp" <<EOF
#!/usr/bin/env bash
exec "$PREFIX/.venv/bin/omnibench" "\$@"
EOF
run install -m 0755 "$launcher_tmp" "$LINK"
rm -f "$launcher_tmp"

# ---- Optional systemd service ---------------------------------------------
if [ "$WITH_SERVICE" = "1" ] || [ "$WITH_SERVICE" = "yes" ]; then
    if ! command -v systemctl >/dev/null 2>&1; then
        echo "error: systemctl not found; cannot install service." >&2
        exit 1
    fi

    echo "==> Installing systemd service"
    if ! id omnibench >/dev/null 2>&1; then
        run useradd --system --home "$PREFIX" --shell /usr/sbin/nologin omnibench
    fi
    run mkdir -p /etc/omnibench /var/lib/omnibench/reports
    run chown -R omnibench:omnibench /var/lib/omnibench

    if [ ! -f /etc/omnibench/config.ini ]; then
        config_tmp=$(mktemp)
        cat >"$config_tmp" <<'EOF'
[server]
host = 127.0.0.1
port = 8507
allow_remote = false

[security]
token_file = /var/lib/omnibench/session.token

[paths]
reports = /var/lib/omnibench/reports
EOF
        run install -m 0644 "$config_tmp" /etc/omnibench/config.ini
        rm -f "$config_tmp"
    fi

    run install -m 0644 "$SOURCE_DIR/deploy/omnibench.service" /etc/systemd/system/omnibench.service
    run systemctl daemon-reload
    run systemctl enable --now omnibench

    echo "    Service installed. Check: systemctl status omnibench"
fi

echo ""
echo "Installed. Try:"
echo "    omnibench"
echo "    open http://127.0.0.1:8507"
