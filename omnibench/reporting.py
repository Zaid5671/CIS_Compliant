from __future__ import annotations

import csv
import io
from html import escape
from typing import Any

from .security import sanitize_csv_cell, sanitize_url


CSV_COLUMNS = [
    "check_id",
    "title",
    "status",
    "severity",
    "profile",
    "category",
    "type",
    "expected",
    "actual",
    "evidence",
    "assessment_status",
    "source_url",
    "mappings",
    "remediation",
]


def results_to_csv(report: dict[str, Any]) -> str:
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS, extrasaction="ignore")
    writer.writeheader()
    for result in report.get("results", []):
        writer.writerow(_csv_row(result))
    return output.getvalue()


def results_to_html_report(report: dict[str, Any]) -> str:
    benchmark = report.get("benchmark", {})
    summary = report.get("summary", {})
    results = report.get("results", [])
    target = report.get("target", {}) if isinstance(report.get("target"), dict) else {}
    host_context = report.get("host_context", {}) if isinstance(report.get("host_context"), dict) else {}

    title = _text(benchmark.get("title") or "CISGuard Report")
    generated = _text(report.get("finished_at") or benchmark.get("loaded_at") or "")
    score = _text(summary.get("score", 0))
    total = int(summary.get("total") or 0)
    failed = int(summary.get("failed") or 0)
    errored = int(summary.get("errored") or 0)
    passed = int(summary.get("passed") or 0)
    manual = int(summary.get("manual") or 0)

    return f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{title} - CISGuard Report</title>
    <style>
      :root {{
        --purple-50:  #faf5ff;
        --purple-100: #f3e8ff;
        --purple-200: #e9d5ff;
        --purple-500: #a855f7;
        --purple-600: #9333ea;
        --purple-700: #7e22ce;
        --purple-800: #6b21a8;
        --ink:    #1a1625;
        --muted:  #6b6080;
        --line:   #e8e3f0;
        --bg:     #f5f0fb;
        --surface:#ffffff;
        --pass:   #16a34a; --pass-bg: #dcfce7;
        --fail:   #dc2626; --fail-bg: #fee2e2;
        --warn:   #d97706; --warn-bg: #fef3c7;
        --info:   #2563eb;
      }}
      * {{ box-sizing: border-box; }}
      body {{
        margin: 0;
        color: var(--ink);
        background: var(--bg);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
        line-height: 1.5;
        -webkit-font-smoothing: antialiased;
      }}
      main {{
        width: min(1200px, calc(100% - 48px));
        margin: 0 auto;
        padding: 36px 0 64px;
      }}
      .brand-row {{ display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }}
      .brand-mark {{
        display: grid;
        width: 48px;
        height: 48px;
        place-items: center;
        border-radius: 12px;
        color: #ffffff;
        background: linear-gradient(135deg, var(--purple-500) 0%, var(--purple-700) 100%);
        font-weight: 800;
        font-size: 13px;
        letter-spacing: 1.5px;
      }}
      .brand-text {{ display: grid; gap: 2px; }}
      .brand-name {{ font-size: 14px; font-weight: 800; }}
      .brand-sub {{ font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.08em; }}

      header.hero {{
        padding: 30px;
        border-radius: 18px;
        background: linear-gradient(135deg, var(--purple-700) 0%, var(--purple-800) 100%);
        color: #ffffff;
        box-shadow: 0 18px 40px rgba(124, 58, 237, 0.28);
      }}
      header.hero h1 {{ margin: 0 0 8px; font-size: 30px; line-height: 1.18; letter-spacing: -0.01em; }}
      header.hero p {{ margin: 0; color: rgba(255, 255, 255, 0.86); font-size: 14px; }}

      .grid {{
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        margin: 22px 0;
      }}
      .card {{
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
        box-shadow: 0 1px 2px rgba(91, 33, 182, 0.04);
      }}
      .label {{
        color: var(--muted);
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }}
      .metric {{
        display: block;
        margin-top: 8px;
        font-size: 32px;
        font-weight: 800;
        color: var(--ink);
        letter-spacing: -0.02em;
      }}
      .card.accent {{
        color: #ffffff;
        background: linear-gradient(135deg, var(--purple-600), var(--purple-800));
        border-color: transparent;
      }}
      .card.accent .label, .card.accent .metric {{ color: #ffffff; }}

      section {{
        margin-top: 18px;
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 14px;
        background: var(--surface);
      }}
      h2 {{ margin: 0 0 14px; font-size: 17px; font-weight: 700; }}
      p {{ margin: 0 0 8px; }}
      .muted {{ color: var(--muted); }}

      .context {{ display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }}
      .context div {{ padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: #faf8fd; }}

      table {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
      th, td {{ padding: 11px 12px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }}
      th {{
        color: var(--muted);
        background: #faf8fd;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }}
      tbody tr:nth-child(odd) {{ background: #fbfaff; }}

      .badge {{
        display: inline-block;
        border-radius: 999px;
        padding: 3px 9px;
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }}
      .PASS  {{ color: #166534; background: var(--pass-bg); }}
      .FAIL, .ERROR {{ color: #991b1b; background: var(--fail-bg); }}
      .WARN  {{ color: #92400e; background: var(--warn-bg); }}
      .MANUAL {{ color: var(--purple-800); background: var(--purple-100); }}

      .bar-row {{
        display: grid;
        grid-template-columns: 220px 1fr 60px;
        align-items: center;
        gap: 12px;
        margin: 10px 0;
      }}
      .track {{ height: 10px; border-radius: 999px; background: #f1edf8; overflow: hidden; }}
      .bar {{ height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--purple-400, #c084fc), var(--purple-700)); }}

      .evidence {{
        max-width: 360px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 12px;
        color: #2d2438;
      }}
      a {{ color: var(--purple-700); }}
      a:hover {{ color: var(--purple-800); }}

      footer {{
        margin-top: 30px;
        text-align: center;
        color: var(--muted);
        font-size: 12px;
      }}

      @media print {{
        body {{ background: #fff; }}
        main {{ width: 100%; padding: 0; }}
        header.hero, .card, section {{ break-inside: avoid; box-shadow: none; }}
      }}
      @media (max-width: 820px) {{
        main {{ width: calc(100% - 24px); }}
        .grid {{ grid-template-columns: repeat(2, minmax(0, 1fr)); }}
        .bar-row {{ grid-template-columns: 1fr; }}
        .context {{ grid-template-columns: 1fr; }}
        table {{ font-size: 12.5px; }}
      }}
    </style>
  </head>
  <body>
    <main>
      <div class="brand-row">
        <div class="brand-mark">CG</div>
        <div class="brand-text">
          <div class="brand-name">CISGuard</div>
          <div class="brand-sub">CIS Compliance &amp; Hardening Report</div>
        </div>
      </div>

      <header class="hero">
        <h1>{title}</h1>
        <p>Platform: {_text(benchmark.get("platform"))} | Version: {_text(benchmark.get("version"))} | Generated: {generated}</p>
      </header>

      <section>
        <h2>Scan Context</h2>
        <div class="context">
          <div><span class="label">Target</span><br><strong>{_text(target.get("display") or "Local device")}</strong></div>
          <div><span class="label">Host</span><br><strong>{_text(host_context.get("host") or host_context.get("hostname") or "-")}</strong></div>
          <div><span class="label">System</span><br><strong>{_text(host_context.get("system") or host_context.get("uname") or "-")}</strong></div>
        </div>
      </section>

      <div class="grid">
        {_metric_card("Compliance Score", f"{score}%", accent=True)}
        {_metric_card("Total Controls", str(total))}
        {_metric_card("Failed Controls", str(failed))}
        {_metric_card("Errored", str(errored))}
      </div>

      <section>
        <h2>Executive Summary</h2>
        <p>{passed} controls passed, {failed} failed, {errored} errored, and {manual} require manual analyst review.</p>
      </section>

      <section>
        <h2>Status Distribution</h2>
        {_bar_block(summary.get("status_counts", {}))}
      </section>

      <section>
        <h2>Risk By Category</h2>
        {_bar_block(summary.get("category_risk", {}))}
      </section>

      <section>
        <h2>Findings</h2>
        <table>
          <thead>
            <tr>
              <th>Control</th>
              <th>Status</th>
              <th>Severity</th>
              <th>Category</th>
              <th>Expected</th>
              <th>Actual / Evidence</th>
              <th>Mappings</th>
              <th>Remediation</th>
            </tr>
          </thead>
          <tbody>
            {_finding_rows(results)}
          </tbody>
        </table>
      </section>

      <footer>Generated by OmniBench - keep this report confidential.</footer>
    </main>
  </body>
</html>
"""


def _metric_card(label: str, value: str, accent: bool = False) -> str:
    extra = ' accent' if accent else ''
    return f"""<article class="card{extra}">
      <span class="label">{escape(label)}</span>
      <strong class="metric">{escape(value)}</strong>
    </article>"""


def _bar_block(values: dict[str, Any]) -> str:
    if not values:
        return '<p class="muted">No data available.</p>'
    numeric_values = {str(key): int(value or 0) for key, value in values.items()}
    max_value = max(numeric_values.values()) or 1
    rows = []
    for label, value in numeric_values.items():
        width = max(2, round((value / max_value) * 100)) if value else 0
        rows.append(
            f"""<div class="bar-row">
              <strong>{escape(label)}</strong>
              <div class="track"><div class="bar" style="width: {width}%"></div></div>
              <span>{value}</span>
            </div>"""
        )
    return "\n".join(rows)


def _finding_rows(results: list[dict[str, Any]]) -> str:
    if not results:
        return '<tr><td colspan="8">No findings available.</td></tr>'

    rows = []
    for result in results:
        status = _text(result.get("status"))
        metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
        evidence = _text(result.get("actual") or result.get("evidence") or result.get("error"))
        rows.append(
            f"""<tr>
              <td><strong>{_text(result.get("title"))}</strong><br><span class="muted">{_text(result.get("check_id"))} | {_text(result.get("profile"))}</span>{_source_link(metadata)}</td>
              <td><span class="badge {status}">{status}</span></td>
              <td>{_text(result.get("severity"))}</td>
              <td>{_text(result.get("category"))}</td>
              <td>{_text(result.get("expected"))}</td>
              <td class="evidence">{evidence}</td>
              <td>{_mapping_html(metadata)}</td>
              <td>{_text(result.get("remediation"))}</td>
            </tr>"""
        )
    return "\n".join(rows)


def _csv_row(result: dict[str, Any]) -> dict[str, Any]:
    row: dict[str, Any] = {}
    metadata = result.get("metadata") if isinstance(result.get("metadata"), dict) else {}
    for column in CSV_COLUMNS:
        if column == "assessment_status":
            value = metadata.get("assessment_status", "")
        elif column == "source_url":
            value = metadata.get("source_url") or metadata.get("url", "")
        elif column == "mappings":
            value = _mapping_text(metadata)
        else:
            value = result.get(column, "")
        row[column] = sanitize_csv_cell(value)
    return row


def _source_link(metadata: dict[str, Any]) -> str:
    raw_url = metadata.get("source_url") or metadata.get("url")
    safe = sanitize_url(raw_url)
    if not safe:
        return ""
    return f'<br><a href="{_text(safe)}" rel="noopener noreferrer">Source</a>'


def _mapping_html(metadata: dict[str, Any]) -> str:
    text = _mapping_text(metadata)
    return _text(text).replace("\n", "<br>")


def _mapping_text(metadata: dict[str, Any]) -> str:
    parts: list[str] = []
    assessment = metadata.get("assessment_status")
    if assessment:
        parts.append(f"Assessment: {assessment}")
    nist_controls = metadata.get("nist_controls")
    if isinstance(nist_controls, list) and nist_controls:
        parts.append(f"NIST: {', '.join(str(item) for item in nist_controls)}")
    cis_controls = metadata.get("cis_controls")
    if isinstance(cis_controls, list) and cis_controls:
        parts.append(f"CIS Controls: {', '.join(str(item) for item in cis_controls[:4])}")
    mitre = metadata.get("mitre_mapping")
    if isinstance(mitre, dict):
        techniques = mitre.get("techniques") or []
        if techniques:
            parts.append(f"MITRE: {', '.join(str(item) for item in techniques)}")
    artifact_count = metadata.get("artifact_count")
    if artifact_count:
        parts.append(f"Artifacts: {artifact_count}")
    return "\n".join(parts)


def _text(value: Any) -> str:
    return escape("" if value is None else str(value))
