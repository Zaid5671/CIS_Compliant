FROM python:3.11-slim

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# openssh-client enables remote SSH-key authenticated scans.
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssh-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml README.md ./
COPY omnibench ./omnibench

RUN pip install --no-cache-dir .

RUN useradd --system --create-home --home-dir /home/omnibench --shell /usr/sbin/nologin omnibench \
    && mkdir -p /data/reports /etc/omnibench \
    && chown -R omnibench:omnibench /data /home/omnibench

USER omnibench
WORKDIR /home/omnibench

ENV OMNIBENCH_CONFIG=/etc/omnibench/config.ini \
    OMNIBENCH_REPORTS_DIR=/data/reports

EXPOSE 8507

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8507/api/health', timeout=3).status==200 else 1)"]

# The container binds to all interfaces, so it runs with --allow-remote. The
# session token is therefore REQUIRED on every request and is printed to the
# container logs at startup (`docker compose logs cisguard`). Keep the host
# port mapped to loopback (compose maps 127.0.0.1:8507:8507) and/or put TLS and
# an access control in front of it.
CMD ["cisguard", "serve", "--host", "0.0.0.0", "--port", "8507", "--allow-remote"]
