const META_TOKEN = (document.querySelector('meta[name="omni-token"]') || {}).content || "";
const TOKEN = (function resolveToken() {
  // Loopback: the server embeds the token in the page meta tag.
  // Remote (--allow-remote): the token is supplied once via the ?token=... startup
  // URL, then persisted in sessionStorage for the rest of the tab session.
  if (META_TOKEN) return META_TOKEN;
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get("token");
    if (fromQuery) {
      sessionStorage.setItem("omni-token", fromQuery);
      url.searchParams.delete("token"); // don't leave the token in the address bar / history
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      return fromQuery;
    }
    return sessionStorage.getItem("omni-token") || "";
  } catch (_e) {
    return "";
  }
})();

const state = {
  benchmark: null,
  benchmarkSource: "",
  catalog: [],
  library: [],
  filters: { osFamily: new Set(), category: new Set(), profile: new Set(), query: "" },
  device: null,
  target: { type: "local" },
  report: null,
  filteredResults: [],
  selectedIndex: -1,
  history: [],
  currentPage: "dashboard",
};

const importState = { benchmark: null };

const elementIds = [
  "fileInput","loadButton","localWindowsButton","localScanButton","sampleButton","cisBenchSampleButton",
  "scanButton","saveReportButton","exportReportButton","exportJsonButton","exportCsvButton",
  "benchmarkTitle","benchmarkMeta","scoreValue","scoreCaption","failedValue","passedValue","manualValue",
  "selectedBenchmark","flowStatus","deviceSubtitle","deviceStatus","deviceHost","deviceOs","deviceUser","deviceArch",
  "stepTarget","stepBenchmark","stepScan","stepReview","scanDuration","statusChart","severityChart","categoryRisk",
  "findingsCaption","findingsTable","statusFilter","severityFilter","searchBox","detailStatus","detailTitle",
  "detailId","detailEvidence","detailRemediation","detailRationale","detailMetadata","toast",
  "targetLocalButton","targetRemoteButton","targetStatus","targetSubtitle","remoteTargetForm",
  "remoteHost","remotePort","remoteUsername","remoteAuthMethod","remoteKeyPath","remoteKeyPassphrase",
  "remotePassword","remoteKeyFields","remotePasswordField",
  "testTargetButton","targetTestResult",
  "libraryCaption","libraryGrid","libraryPreview","librarySearch","osFamilyFilters","categoryFilters","profileFilters",
  "historyCaption","historyGrid","historyRefreshButton",
  "importDrop","importFile","importText","importParseButton","importClearButton","importStatus","importPreview",
  "scanOverlay","scanOverlayTitle","scanOverlaySubtitle","versionLabel",
  "heroBenchmarkTitle","heroMeta","heroScore","heroScoreCaption","recentList","recentCaption","quickLocalScanButton",
];
const els = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

const statusColors = {
  PASS: "#22D3A0",
  FAIL: "#FF4D6D",
  ERROR: "#FF884D",
  WARN: "#FFB020",
  MANUAL: "#B98BFF",
};
const severityColors = {
  critical: "#FF4D6D",
  high: "#FF7849",
  medium: "#FFB020",
  low: "#5B9DFF",
  info: "#B98BFF",
};
// Security Console canvas palette (light-on-dark)
const chartInk = "#ECE9F8";
const chartMuted = "#8E85AD";
const chartTrack = "#1A1730";
const chartFontMono = "'JetBrains Mono', ui-monospace, Consolas, monospace";

const KNOWN_PAGES = ["dashboard", "setup", "library", "import", "findings", "analytics", "history"];
const DEFAULT_PAGE = "dashboard";

// ----- Router -----
function parsePage() {
  const hash = (window.location.hash || "").replace(/^#\/?/, "").toLowerCase();
  return KNOWN_PAGES.includes(hash) ? hash : DEFAULT_PAGE;
}

function applyPage(page) {
  state.currentPage = page;
  document.querySelectorAll("[data-page]").forEach((section) => {
    section.classList.toggle("active", section.dataset.page === page);
  });
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.classList.toggle("active", link.dataset.target === page);
  });
  document.body.dataset.currentPage = page;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });

  if (page === "dashboard") {
    renderDashboardLanding();
  }
}

window.addEventListener("hashchange", () => applyPage(parsePage()));

// ----- Wire handlers -----
els.loadButton.addEventListener("click", () => els.fileInput.click());
els.localWindowsButton.addEventListener("click", () => loadSample("windows10-local-cis", "windows10-local-cis.json"));
els.localScanButton.addEventListener("click", runLocalDeviceScan);
els.sampleButton.addEventListener("click", () => loadSample("windows-basic", "windows-basic.json"));
els.cisBenchSampleButton.addEventListener("click", () => loadSample("cis-bench-sample", "cis-bench-sample.json"));
els.scanButton.addEventListener("click", runScan);
els.saveReportButton.addEventListener("click", saveReportFiles);
els.exportReportButton.addEventListener("click", exportReport);
els.exportJsonButton.addEventListener("click", exportJson);
els.exportCsvButton.addEventListener("click", exportCsv);
els.statusFilter.addEventListener("change", renderFindings);
els.severityFilter.addEventListener("change", renderFindings);
els.searchBox.addEventListener("input", renderFindings);
els.targetLocalButton.addEventListener("click", () => selectTargetType("local"));
els.targetRemoteButton.addEventListener("click", () => selectTargetType("remote"));
els.testTargetButton.addEventListener("click", testTarget);
if (els.remoteAuthMethod) els.remoteAuthMethod.addEventListener("change", updateAuthMethodFields);
if (els.librarySearch) {
  els.librarySearch.addEventListener("input", (event) => {
    state.filters.query = event.target.value.trim().toLowerCase();
    renderLibrary();
  });
}
if (els.historyRefreshButton) {
  els.historyRefreshButton.addEventListener("click", loadHistory);
}
if (els.quickLocalScanButton) {
  els.quickLocalScanButton.addEventListener("click", () => {
    window.location.hash = "#/setup";
    runLocalDeviceScan();
  });
}

els.fileInput.addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    const text = await file.text();
    const benchmark = JSON.parse(text);
    setBenchmark(benchmark, file.name);
    showToast(`Loaded ${file.name}`, "success");
  } catch (error) {
    showToast(`Could not load JSON: ${error.message}`, "error");
  } finally {
    els.fileInput.value = "";
  }
});

drawEmptyCharts();
loadVersion();
loadDeviceContext();
loadBenchmarkLibrary();
loadHistory();
wireImport();
applyPage(parsePage());

// ----- API helpers -----
function authHeaders() {
  return { "X-OMNI-Token": TOKEN };
}

function jsonHeaders() {
  return { "Content-Type": "application/json", "X-OMNI-Token": TOKEN };
}

function postJson(url, body) {
  return fetch(url, { method: "POST", headers: jsonHeaders(), body: JSON.stringify(body || {}) });
}

async function loadVersion() {
  try {
    const response = await fetch("/api/version", { headers: authHeaders() });
    const payload = await response.json();
    if (response.ok && payload.version) {
      els.versionLabel.textContent = `OmniBench v${payload.version}`;
    }
  } catch {
    /* keep default label */
  }
}

async function loadDeviceContext() {
  try {
    const response = await fetch("/api/device", { headers: authHeaders() });
    const device = await response.json();
    if (!response.ok) throw new Error(device.error || "Device context failed");
    state.device = device;
    els.deviceHost.textContent = device.hostname || "-";
    els.deviceOs.textContent = [device.system, device.release].filter(Boolean).join(" ") || "-";
    els.deviceUser.textContent = device.user || "-";
    els.deviceArch.textContent = device.machine || "-";
    els.deviceSubtitle.textContent = device.version || "Local scan target";
    els.deviceStatus.textContent = (device.system || "local").toUpperCase();
    setFlowStage("target");
  } catch (error) {
    els.deviceSubtitle.textContent = error.message;
    els.deviceStatus.textContent = "Error";
  }
}

async function loadSample(name, source, options = {}) {
  try {
    const response = await fetch(`/api/sample?name=${encodeURIComponent(name)}`, { headers: authHeaders() });
    const sample = await response.json();
    if (!response.ok) throw new Error(sample.error || "Sample load failed");
    setBenchmark(sample, source);
    showToast("Sample benchmark loaded", "success");
    if (options.autoScan) {
      await runScan();
    }
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function loadBenchmarkLibrary() {
  showLibrarySkeleton();
  try {
    const response = await fetch("/api/library", { headers: authHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Library load failed");
    state.library = payload.benchmarks || [];
    state.catalog = state.library;
    buildLibraryFilters();
    renderLibrary();
  } catch (error) {
    els.libraryCaption.textContent = error.message;
  }
}

function showLibrarySkeleton() {
  if (!els.libraryGrid) return;
  els.libraryGrid.innerHTML = Array.from({ length: 6 })
    .map(() => `<div class="library-card skeleton skeleton-card"></div>`)
    .join("");
}

function buildLibraryFilters() {
  const osFamilies = new Set();
  const categories = new Set();
  const profiles = new Set();
  state.library.forEach((item) => {
    if (item.os_family) osFamilies.add(item.os_family);
    if (item.category) categories.add(item.category);
    if (item.profile) profiles.add(item.profile);
  });
  renderChips(els.osFamilyFilters, [...osFamilies].sort(), state.filters.osFamily);
  renderChips(els.categoryFilters, [...categories].sort(), state.filters.category);
  renderChips(els.profileFilters, [...profiles].sort(), state.filters.profile);
}

function renderChips(container, values, selectedSet) {
  if (!container) return;
  container.innerHTML = values.map((value) => `<button type="button" class="chip" data-value="${escapeHtml(value)}">${escapeHtml(value)}</button>`).join("");
  container.querySelectorAll(".chip").forEach((button) => {
    const value = button.dataset.value;
    if (selectedSet.has(value)) button.classList.add("active");
    button.addEventListener("click", () => {
      if (selectedSet.has(value)) selectedSet.delete(value);
      else selectedSet.add(value);
      button.classList.toggle("active");
      renderLibrary();
    });
  });
}

function renderLibrary() {
  const items = state.library.filter((item) => {
    if (state.filters.osFamily.size && !state.filters.osFamily.has(item.os_family)) return false;
    if (state.filters.category.size && !state.filters.category.has(item.category)) return false;
    if (state.filters.profile.size && !state.filters.profile.has(item.profile)) return false;
    if (state.filters.query) {
      const haystack = [item.title, item.description, item.platform, (item.tags || []).join(" ")].join(" ").toLowerCase();
      if (!haystack.includes(state.filters.query)) return false;
    }
    return true;
  });
  els.libraryCaption.textContent = `${items.length} of ${state.library.length} benchmarks shown`;
  if (!items.length) {
    els.libraryGrid.innerHTML = `<div class="empty-card">No benchmarks match the filters.</div>`;
    return;
  }
  els.libraryGrid.innerHTML = items.map((benchmark) => `
    <article class="library-card ${benchmark.recommended ? "recommended-card" : ""}" data-name="${escapeHtml(benchmark.name)}">
      <div class="library-card-header">
        <span class="pill">${escapeHtml(benchmark.category || "Benchmark")}</span>
        <strong>${escapeHtml(String(benchmark.checks || 0))} checks</strong>
      </div>
      <h3>${escapeHtml(benchmark.title)}</h3>
      <p>${escapeHtml(benchmark.description || "")}</p>
      <div class="library-meta">
        <span>${escapeHtml(benchmark.platform || "local")}</span>
        <span>${escapeHtml(benchmark.profile || "Profile")}</span>
        <span>v${escapeHtml(benchmark.version || "unknown")}</span>
      </div>
      <div class="library-tags">${(benchmark.tags || []).map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
      <div class="library-actions">
        <button type="button" class="icon-button secondary preview-button" data-name="${escapeHtml(benchmark.name)}">
          <span>Preview</span>
        </button>
        <button type="button" class="icon-button primary catalog-scan-button" data-name="${escapeHtml(benchmark.name)}" ${benchmark.available ? "" : "disabled"}>
          <span class="button-icon">&gt;</span><span>Scan</span>
        </button>
      </div>
    </article>
  `).join("");
  els.libraryGrid.querySelectorAll(".catalog-scan-button").forEach((button) => {
    button.addEventListener("click", () => runCatalogBenchmark(button.dataset.name));
  });
  els.libraryGrid.querySelectorAll(".preview-button").forEach((button) => {
    button.addEventListener("click", () => showLibraryPreview(button.dataset.name));
  });
}

async function showLibraryPreview(name) {
  try {
    const response = await fetch(`/api/library/preview?name=${encodeURIComponent(name)}`, { headers: authHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Preview unavailable");
    renderPreview(name, payload);
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderPreview(name, details) {
  const entry = state.library.find((item) => item.name === name) || {};
  els.libraryPreview.innerHTML = `
    <div class="preview-header">
      <h3>${escapeHtml(entry.title || details.title || name)}</h3>
      <p class="muted">${escapeHtml(entry.description || "")}</p>
    </div>
    <dl class="preview-meta">
      <dt>Platform</dt><dd>${escapeHtml(entry.platform || details.platform || "-")}</dd>
      <dt>Profile</dt><dd>${escapeHtml(entry.profile || "-")}</dd>
      <dt>Version</dt><dd>${escapeHtml(details.version || entry.version || "unknown")}</dd>
      <dt>Total Checks</dt><dd>${escapeHtml(String(details.checks ?? entry.checks ?? 0))}</dd>
    </dl>
    <h4>Sample checks</h4>
    <ul class="preview-list">
      ${(details.preview || []).map((check) => `
        <li><strong>${escapeHtml(check.id)}</strong> ${escapeHtml(check.title)} <span class="severity-badge severity-${escapeHtml(check.severity)}">${escapeHtml(check.severity)}</span></li>
      `).join("")}
    </ul>
    <div class="preview-actions">
      <button type="button" class="icon-button secondary" id="previewLoadButton"><span>Load</span></button>
      <button type="button" class="icon-button primary" id="previewScanButton"><span class="button-icon">&gt;</span><span>Load + Scan</span></button>
    </div>
  `;
  const loadBtn = document.getElementById("previewLoadButton");
  const scanBtn = document.getElementById("previewScanButton");
  if (loadBtn) loadBtn.addEventListener("click", () => loadSample(name, `${name}.json`));
  if (scanBtn) scanBtn.addEventListener("click", () => runCatalogBenchmark(name));
}

async function runCatalogBenchmark(name) {
  if (!name) return;
  await loadSample(name, `${name}.json`, { autoScan: true });
}

async function runLocalDeviceScan() {
  if (state.currentPage !== "setup") window.location.hash = "#/setup";
  await loadSample("windows10-local-cis", "windows10-local-cis.json", { autoScan: true });
}

function selectTargetType(type) {
  const isRemote = type === "remote";
  state.target = isRemote ? collectRemoteTarget() : { type: "local" };
  els.targetLocalButton.classList.toggle("active", !isRemote);
  els.targetRemoteButton.classList.toggle("active", isRemote);
  els.remoteTargetForm.classList.toggle("hidden", !isRemote);
  els.targetStatus.textContent = isRemote ? "Remote" : "Local";
  els.targetSubtitle.textContent = isRemote ? "SSH key or password authentication" : "Choose where to run the benchmark";
  if (isRemote) updateAuthMethodFields();
}

function collectRemoteTarget() {
  return {
    type: "remote",
    host: (els.remoteHost.value || "").trim(),
    port: Number(els.remotePort.value || 22),
    protocol: "ssh",
    username: (els.remoteUsername.value || "").trim(),
    auth: {
      method: els.remoteAuthMethod.value || "key",
      key_path: (els.remoteKeyPath.value || "").trim(),
      key_passphrase: els.remoteKeyPassphrase.value || "",
      password: els.remotePassword ? (els.remotePassword.value || "") : "",
    },
  };
}

function updateAuthMethodFields() {
  const method = els.remoteAuthMethod ? els.remoteAuthMethod.value : "key";
  const isPassword = method === "password";
  if (els.remoteKeyFields) els.remoteKeyFields.classList.toggle("hidden", isPassword);
  if (els.remotePasswordField) els.remotePasswordField.classList.toggle("hidden", !isPassword);
}

async function testTarget() {
  const target = els.targetRemoteButton.classList.contains("active") ? collectRemoteTarget() : { type: "local" };
  els.targetTestResult.textContent = "Testing…";
  try {
    const response = await postJson("/api/targets/test", { target });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Connection failed");
    els.targetTestResult.textContent = payload.context && payload.context.uname ? `OK - ${payload.context.uname}` : "Connection OK";
    state.target = target;
  } catch (error) {
    els.targetTestResult.textContent = `Error: ${error.message}`;
  }
}

function setBenchmark(benchmark, source) {
  state.benchmark = benchmark;
  state.benchmarkSource = source;
  state.report = null;
  state.selectedIndex = -1;
  const meta = benchmark.benchmark || benchmark.metadata || benchmark.meta || {};
  const title = meta.title || meta.name || "Untitled Benchmark";
  els.benchmarkTitle.textContent = title;
  els.benchmarkMeta.textContent = `${meta.platform || "local"} - ${meta.version || "unknown"} - ${source}`;
  els.selectedBenchmark.textContent = `${title} - ${source}`;
  els.scanButton.disabled = false;
  els.saveReportButton.disabled = true;
  els.exportReportButton.disabled = true;
  els.exportJsonButton.disabled = true;
  els.exportCsvButton.disabled = true;
  setChoiceState(source);
  setFlowStage("benchmark");
  resetResults();
}

function showScanOverlay(target, benchmarkTitle, total) {
  if (!els.scanOverlay) return;
  const targetLabel = target.type === "remote" ? `${target.username}@${target.host}` : "the local device";
  els.scanOverlayTitle.textContent = `Running ${benchmarkTitle || "benchmark"}`;
  els.scanOverlaySubtitle.textContent = total
    ? `Evaluating ${total} controls on ${targetLabel}`
    : `Evaluating controls on ${targetLabel}`;
  els.scanOverlay.classList.add("visible");
}

function hideScanOverlay() {
  if (els.scanOverlay) els.scanOverlay.classList.remove("visible");
}

async function runScan() {
  if (!state.benchmark) return;
  const target = els.targetRemoteButton.classList.contains("active") ? collectRemoteTarget() : { type: "local" };
  state.target = target;
  els.scanButton.disabled = true;
  els.localScanButton.disabled = true;
  els.scanButton.querySelector("span:last-child").textContent = "Scanning";
  els.localScanButton.querySelector("span:last-child").textContent = "Scanning";
  els.scanDuration.textContent = "Running";
  els.flowStatus.textContent = "Scanning";
  setFlowStage("scan");

  const meta = (state.benchmark && (state.benchmark.benchmark || state.benchmark.metadata || state.benchmark.meta)) || {};
  const total = countChecks(state.benchmark);
  showScanOverlay(target, meta.title, total);

  try {
    const response = await postJson("/api/scan", { benchmark_json: state.benchmark, target, options: { workers: 6 } });
    const report = await response.json();
    if (!response.ok) throw new Error(report.error || "Scan failed");
    state.report = report;
    renderReport();
    setFlowStage("review");
    els.flowStatus.textContent = "Review";
    showToast("Scan complete - jump to Findings", "success");
    loadHistory();
    // After scan, send the user to Findings to view results.
    window.location.hash = "#/findings";
  } catch (error) {
    showToast(error.message, "error");
    els.scanDuration.textContent = "Error";
    els.flowStatus.textContent = "Error";
  } finally {
    hideScanOverlay();
    els.scanButton.disabled = false;
    els.localScanButton.disabled = false;
    els.scanButton.querySelector("span:last-child").textContent = "Run Scan";
    els.localScanButton.querySelector("span:last-child").textContent = "Run Local Scan";
  }
}

function countChecks(benchmark) {
  if (!benchmark) return 0;
  if (Array.isArray(benchmark.checks)) return benchmark.checks.length;
  if (Array.isArray(benchmark.recommendations)) return benchmark.recommendations.length;
  if (Array.isArray(benchmark.groups)) {
    return benchmark.groups.reduce((sum, group) => sum + (Array.isArray(group.checks) ? group.checks.length : 0), 0);
  }
  return 0;
}

function setChoiceState(source) {
  const choices = [
    [els.localWindowsButton, "windows10-local-cis.json"],
    [els.sampleButton, "windows-basic.json"],
    [els.cisBenchSampleButton, "cis-bench-sample.json"],
  ];
  choices.forEach(([button, expected]) => {
    if (button) button.classList.toggle("selected", source === expected);
  });
}

function setFlowStage(stage) {
  const order = ["target", "benchmark", "scan", "review"];
  const map = { target: els.stepTarget, benchmark: els.stepBenchmark, scan: els.stepScan, review: els.stepReview };
  const activeIndex = order.indexOf(stage);
  order.forEach((name, index) => {
    const element = map[name];
    if (!element) return;
    element.classList.toggle("active", index === activeIndex);
    element.classList.toggle("done", activeIndex > index);
  });
  if (stage === "target") els.flowStatus.textContent = "Ready";
  if (stage === "benchmark") els.flowStatus.textContent = "Benchmark";
}

function resetResults() {
  els.scoreValue.textContent = "0%";
  els.scoreCaption.textContent = "Waiting for scan";
  els.failedValue.textContent = "0";
  els.passedValue.textContent = "0";
  els.manualValue.textContent = "0";
  els.scanDuration.textContent = "Idle";
  els.findingsCaption.textContent = "No scan results yet.";
  els.findingsTable.innerHTML = `<tr class="empty-row"><td colspan="6">Run a scan to populate findings.</td></tr>`;
  els.categoryRisk.innerHTML = "";
  setDetails(null);
  drawEmptyCharts();
}

function formatScore(summary) {
  if (!summary) return "0%";
  return summary.scored === false ? "N/A" : `${summary.score}%`;
}

function renderReport() {
  const { summary, benchmark, duration_ms: durationMs } = state.report;
  els.benchmarkTitle.textContent = benchmark.title;
  els.benchmarkMeta.textContent = `${benchmark.platform} - ${benchmark.version} - ${state.report.results.length} controls`;
  els.scoreValue.textContent = formatScore(summary);
  els.scoreCaption.textContent = summary.scored === false ? `${summary.total} manual / not scored` : `${summary.total} controls evaluated`;
  els.failedValue.textContent = summary.failed;
  els.passedValue.textContent = summary.passed;
  els.manualValue.textContent = String((summary.manual || 0) + (summary.errored || 0));
  els.scanDuration.textContent = `${durationMs} ms`;
  els.saveReportButton.disabled = false;
  els.exportReportButton.disabled = false;
  els.exportJsonButton.disabled = false;
  els.exportCsvButton.disabled = false;

  drawStatusChart(summary.status_counts);
  drawSeverityChart(summary.severity_counts);
  renderCategoryRisk(summary.category_risk);
  renderFindings();
  renderDashboardLanding();
}

function renderFindings() {
  const results = (state.report && state.report.results) || [];
  const status = els.statusFilter.value;
  const severity = els.severityFilter.value;
  const query = els.searchBox.value.trim().toLowerCase();

  state.filteredResults = results.filter((result) => {
    const matchesStatus = status === "all" || result.status === status;
    const matchesSeverity = severity === "all" || result.severity === severity;
    const haystack = [result.check_id, result.title, result.category, result.profile, result.evidence, result.actual, result.expected, metadataText(result.metadata)].join(" ").toLowerCase();
    return matchesStatus && matchesSeverity && (!query || haystack.includes(query));
  });

  els.findingsCaption.textContent = `${state.filteredResults.length} of ${results.length} findings shown`;

  if (!state.filteredResults.length) {
    els.findingsTable.innerHTML = `<tr class="empty-row"><td colspan="6">No findings match the current filters.</td></tr>`;
    setDetails(null);
    return;
  }

  els.findingsTable.innerHTML = state.filteredResults.map((result, index) => `
    <tr data-index="${index}">
      <td class="control-cell">
        <span class="control-title">${escapeHtml(result.title)}</span>
        <span class="control-id">${escapeHtml(result.check_id)} - ${escapeHtml(result.profile)}</span>
      </td>
      <td><span class="status-badge status-${escapeHtml(result.status)}">${escapeHtml(result.status)}</span></td>
      <td><span class="severity-badge severity-${escapeHtml(result.severity)}">${escapeHtml(result.severity)}</span></td>
      <td>${escapeHtml(result.category)}</td>
      <td>${escapeHtml(trimCell(result.expected))}</td>
      <td>${escapeHtml(trimCell(result.actual || result.error || "-"))}</td>
    </tr>
  `).join("");

  [...els.findingsTable.querySelectorAll("tr[data-index]")].forEach((row) => {
    row.addEventListener("click", () => {
      els.findingsTable.querySelectorAll("tr").forEach((item) => item.classList.remove("selected"));
      row.classList.add("selected");
      setDetails(state.filteredResults[Number(row.dataset.index)]);
    });
  });

  setDetails(state.filteredResults[0]);
  const first = els.findingsTable.querySelector("tr[data-index]");
  if (first) first.classList.add("selected");
}

function setDetails(result) {
  if (!result) {
    els.detailStatus.textContent = "Idle";
    els.detailStatus.className = "pill";
    els.detailTitle.textContent = "Finding Details";
    els.detailId.textContent = "-";
    els.detailEvidence.textContent = "Select a finding after a scan.";
    els.detailRemediation.textContent = "-";
    els.detailRationale.textContent = "-";
    els.detailMetadata.textContent = "-";
    return;
  }
  els.detailStatus.textContent = result.status;
  els.detailStatus.className = `pill status-badge status-${result.status}`;
  els.detailTitle.textContent = result.title;
  els.detailId.textContent = `${result.check_id} - ${result.severity} - ${result.type}`;
  els.detailEvidence.textContent = result.evidence || result.error || "-";
  els.detailRemediation.textContent = result.remediation || "-";
  els.detailRationale.textContent = result.rationale || "-";
  els.detailMetadata.textContent = metadataText(result.metadata) || "-";
}

function renderCategoryRisk(categoryRisk) {
  const entries = Object.entries(categoryRisk || {});
  if (!entries.length) {
    els.categoryRisk.innerHTML = `<div class="empty-row">No category risk available.</div>`;
    return;
  }
  const max = Math.max(...entries.map(([, value]) => value), 1);
  els.categoryRisk.innerHTML = entries.slice(0, 8).map(([category, value]) => {
    const width = Math.max(4, Math.round((value / max) * 100));
    return `
      <div class="risk-row">
        <div class="risk-label" title="${escapeHtml(category)}">${escapeHtml(category)}</div>
        <div class="risk-track"><div class="risk-bar" style="width: ${width}%"></div></div>
        <strong>${value}</strong>
      </div>
    `;
  }).join("");
}

function drawEmptyCharts() {
  drawStatusChart({ PASS: 0, FAIL: 0, ERROR: 0, WARN: 0, MANUAL: 0 });
  drawSeverityChart({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });
}

function drawStatusChart(counts) {
  const labels = ["PASS", "FAIL", "ERROR", "WARN", "MANUAL"];
  const values = labels.map((label) => counts[label] || 0);
  drawDonut(els.statusChart, labels, values, labels.map((label) => statusColors[label]));
}

function drawSeverityChart(counts) {
  const labels = ["critical", "high", "medium", "low", "info"];
  const values = labels.map((label) => counts[label] || 0);
  drawBars(els.severityChart, labels, values, labels.map((label) => severityColors[label]));
}

function drawDonut(canvas, labels, values, colors) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const total = values.reduce((sum, value) => sum + value, 0);
  ctx.clearRect(0, 0, width, height);

  const centerX = 118;
  const centerY = height / 2;
  const radius = 78;
  let start = -Math.PI / 2;

  if (!total) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = chartTrack;
    ctx.lineWidth = 28;
    ctx.stroke();
  } else {
    values.forEach((value, index) => {
      if (!value) return;
      const angle = (value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, start, start + angle);
      ctx.strokeStyle = colors[index];
      ctx.lineWidth = 28;
      ctx.lineCap = "butt";
      ctx.stroke();
      start += angle;
    });
  }

  ctx.fillStyle = chartInk;
  ctx.font = `700 28px ${chartFontMono}`;
  ctx.textAlign = "center";
  ctx.fillText(String(total), centerX, centerY + 9);
  ctx.font = `500 10px ${chartFontMono}`;
  ctx.fillStyle = chartMuted;
  ctx.fillText("CONTROLS", centerX, centerY + 28);

  ctx.textAlign = "left";
  labels.forEach((label, index) => {
    const y = 50 + index * 28;
    ctx.fillStyle = colors[index];
    ctx.beginPath();
    ctx.arc(252, y - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = chartInk;
    ctx.font = `500 12px ${chartFontMono}`;
    ctx.fillText(label, 266, y);
    ctx.fillStyle = chartMuted;
    ctx.fillText(String(values[index]), 370, y);
  });
}

function drawBars(canvas, labels, values, colors) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const max = Math.max(...values, 1);
  ctx.clearRect(0, 0, width, height);

  const left = 102;
  const right = width - 32;
  const barHeight = 18;
  const gap = 22;

  labels.forEach((label, index) => {
    const y = 34 + index * (barHeight + gap);
    const barWidth = Math.round(((right - left) * values[index]) / max);
    ctx.fillStyle = chartMuted;
    ctx.font = `500 11px ${chartFontMono}`;
    ctx.textAlign = "right";
    ctx.fillText(label.toUpperCase(), left - 14, y + 13);
    ctx.fillStyle = chartTrack;
    roundRect(ctx, left, y, right - left, barHeight, 9);
    ctx.fill();
    ctx.fillStyle = colors[index];
    roundRect(ctx, left, y, Math.max(barWidth, values[index] ? 6 : 0), barHeight, 9);
    ctx.fill();
    ctx.fillStyle = chartInk;
    ctx.textAlign = "left";
    ctx.font = `700 12px ${chartFontMono}`;
    ctx.fillText(String(values[index]), right + 8, y + 13);
  });
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

async function exportCsv() {
  if (!state.report) return;
  const response = await postJson("/api/export/csv", state.report);
  const text = await response.text();
  downloadBlob(text, "omni-scan-results.csv", "text/csv");
}

async function saveReportFiles() {
  if (!state.report) return;
  const response = await postJson("/api/reports/save", { report: state.report, name: reportStem() });
  const payload = await response.json();
  if (!response.ok) {
    showToast(payload.error || "Save failed", "error");
    return;
  }
  els.flowStatus.textContent = "Saved";
  showToast(`Saved report files to ${payload.files.html}`, "success");
}

async function exportReport() {
  if (!state.report) return;
  const response = await postJson("/api/export/html", state.report);
  const text = await response.text();
  if (!response.ok) {
    showToast("Report export failed", "error");
    return;
  }
  downloadBlob(text, "omni-benchmark-report.html", "text/html");
}

function exportJson() {
  if (!state.report) return;
  downloadBlob(JSON.stringify(state.report, null, 2), "omni-scan-report.json", "application/json");
}

function reportStem() {
  const title = (state.report && state.report.benchmark && state.report.benchmark.title) || "omni-benchmark-report";
  return title.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "omni-benchmark-report";
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

async function loadHistory() {
  if (els.historyGrid) els.historyCaption.textContent = "Loading recent scans";
  try {
    const response = await fetch("/api/history", { headers: authHeaders() });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "History load failed");
    state.history = payload.entries || [];
    renderHistory();
    renderDashboardLanding();
  } catch (error) {
    if (els.historyCaption) els.historyCaption.textContent = error.message;
  }
}

function renderHistory() {
  if (!els.historyGrid) return;
  if (!state.history.length) {
    els.historyCaption.textContent = "No scans yet";
    els.historyGrid.innerHTML = `<div class="empty-card">Run a scan from <a href="#/setup">Setup</a> to start building scan history.</div>`;
    return;
  }
  els.historyCaption.textContent = `${state.history.length} recent scan${state.history.length === 1 ? "" : "s"}`;
  els.historyGrid.innerHTML = state.history.map((entry) => `
    <article class="history-card">
      <div class="history-card-header">
        <div>
          <h3>${escapeHtml(entry.benchmark_title || "Untitled")}</h3>
          <div class="history-meta">
            <span>${escapeHtml(entry.target_display || "local")}</span>
            <span>${escapeHtml(formatTimestamp(entry.finished_at))}</span>
            <span>${escapeHtml(String(entry.total_checks || 0))} controls</span>
          </div>
        </div>
        <div class="history-score">${escapeHtml(String(entry.score ?? 0))}%</div>
      </div>
      <div class="history-meta">
        <span class="status-badge status-PASS">${escapeHtml(String(entry.passed || 0))} pass</span>
        <span class="status-badge status-FAIL">${escapeHtml(String(entry.failed || 0))} fail</span>
        <span class="status-badge status-MANUAL">${escapeHtml(String(entry.manual || 0))} manual</span>
      </div>
    </article>
  `).join("");
}

function renderDashboardLanding() {
  // Hero: show latest run (from state.report if present, else from history[0], else placeholder)
  const latestReport = state.report;
  if (latestReport && latestReport.summary) {
    const s = latestReport.summary;
    const meta = latestReport.benchmark || {};
    els.heroBenchmarkTitle.textContent = meta.title || "Latest scan";
    const target = latestReport.target && latestReport.target.display ? latestReport.target.display : "local";
    els.heroMeta.textContent = `${target} - ${s.total || 0} controls - ${formatTimestamp(latestReport.finished_at)}`;
    els.heroScore.textContent = formatScore(s);
    els.heroScoreCaption.textContent = `${s.passed} pass / ${s.failed} fail`;
  } else if (state.history && state.history.length) {
    const h = state.history[0];
    els.heroBenchmarkTitle.textContent = h.benchmark_title || "Latest scan";
    els.heroMeta.textContent = `${h.target_display || "local"} - ${h.total_checks || 0} controls - ${formatTimestamp(h.finished_at)}`;
    els.heroScore.textContent = `${h.score ?? 0}%`;
    els.heroScoreCaption.textContent = `${h.passed} pass / ${h.failed} fail`;
  } else {
    els.heroBenchmarkTitle.textContent = "No scans yet";
    els.heroMeta.textContent = "Run your first benchmark to populate the dashboard.";
    els.heroScore.textContent = "0%";
    els.heroScoreCaption.textContent = "Awaiting first scan";
  }

  // Recent activity list (top 4)
  if (els.recentList) {
    if (!state.history || !state.history.length) {
      els.recentList.innerHTML = `<div class="empty-card">No scans yet. Run one from the <a href="#/setup">Setup</a> page.</div>`;
      els.recentCaption.textContent = "Latest scan runs";
    } else {
      els.recentCaption.textContent = `${state.history.length} run${state.history.length === 1 ? "" : "s"} logged`;
      els.recentList.innerHTML = state.history.slice(0, 4).map((entry) => `
        <div class="recent-item">
          <div>
            <h4>${escapeHtml(entry.benchmark_title || "Untitled")}</h4>
            <div class="meta">${escapeHtml(entry.target_display || "local")} - ${escapeHtml(formatTimestamp(entry.finished_at))}</div>
          </div>
          <div class="score">${escapeHtml(String(entry.score ?? 0))}%</div>
        </div>
      `).join("");
    }
  }
}

function formatTimestamp(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function showToast(message, variant) {
  els.toast.textContent = message;
  els.toast.classList.remove("success", "error");
  if (variant) els.toast.classList.add(variant);
  els.toast.classList.add("visible");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => els.toast.classList.remove("visible"), 2800);
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function trimCell(value) {
  const text = String(value == null ? "-" : value).replace(/\s+/g, " ").trim();
  return text.length > 92 ? `${text.slice(0, 92)}…` : text;
}

function metadataText(metadata) {
  if (!metadata || typeof metadata !== "object") return "";
  const lines = [];
  if (metadata.assessment_status) lines.push(`Assessment: ${metadata.assessment_status}`);
  if (metadata.source) lines.push(`Source: ${metadata.source}`);
  if (metadata.source_url) lines.push(`URL: ${metadata.source_url}`);
  if (Array.isArray(metadata.nist_controls) && metadata.nist_controls.length) {
    lines.push(`NIST: ${metadata.nist_controls.join(", ")}`);
  }
  if (Array.isArray(metadata.cis_controls) && metadata.cis_controls.length) {
    lines.push(`CIS Controls: ${metadata.cis_controls.slice(0, 6).join(", ")}`);
  }
  if (metadata.mitre_mapping && Array.isArray(metadata.mitre_mapping.techniques) && metadata.mitre_mapping.techniques.length) {
    lines.push(`MITRE: ${metadata.mitre_mapping.techniques.join(", ")}`);
  }
  if (Array.isArray(metadata.artifacts) && metadata.artifacts.length) {
    lines.push(`Artifacts: ${metadata.artifacts.slice(0, 6).join("; ")}`);
  }
  return lines.join("\n");
}

// ----- Import page -----
function wireImport() {
  if (els.importParseButton) els.importParseButton.addEventListener("click", parseImport);
  if (els.importClearButton) {
    els.importClearButton.addEventListener("click", () => {
      els.importText.value = "";
      importState.benchmark = null;
      els.importStatus.textContent = "";
      els.importPreview.innerHTML = `<div class="preview-empty">Drop or paste a benchmark, then <strong>Detect &amp; Preview</strong>.</div>`;
    });
  }
  if (els.importDrop) {
    els.importDrop.addEventListener("click", () => els.importFile && els.importFile.click());
    els.importDrop.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); els.importFile && els.importFile.click(); }
    });
    ["dragover", "dragenter"].forEach((ev) => els.importDrop.addEventListener(ev, (event) => {
      event.preventDefault(); els.importDrop.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach((ev) => els.importDrop.addEventListener(ev, () => els.importDrop.classList.remove("dragging")));
    els.importDrop.addEventListener("drop", async (event) => {
      event.preventDefault();
      const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
      if (file) await loadImportFile(file);
    });
  }
  if (els.importFile) {
    els.importFile.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) await loadImportFile(file);
      els.importFile.value = "";
    });
  }
}

async function loadImportFile(file) {
  try {
    els.importText.value = await file.text();
    await parseImport();
  } catch (error) {
    showToast(`Could not read file: ${error.message}`, "error");
  }
}

async function parseImport() {
  const raw = (els.importText.value || "").trim();
  if (!raw) { els.importStatus.textContent = "Paste or drop a benchmark first."; return; }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    els.importStatus.textContent = `Invalid JSON: ${error.message}`;
    els.importPreview.innerHTML = `<div class="preview-empty">The text is not valid JSON.</div>`;
    return;
  }
  els.importStatus.textContent = "Detecting…";
  try {
    const response = await postJson("/api/import", { benchmark_json: parsed });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Import failed");
    importState.benchmark = parsed;
    els.importStatus.textContent = `Detected ${payload.format} · ${payload.total} checks`;
    renderImportPreview(payload);
  } catch (error) {
    els.importStatus.textContent = error.message;
    els.importPreview.innerHTML = `<div class="preview-empty">${escapeHtml(error.message)}</div>`;
  }
}

function renderImportPreview(payload) {
  const b = payload.benchmark || {};
  els.importPreview.innerHTML = `
    <div class="preview-header">
      <h3>${escapeHtml(b.title || "Untitled benchmark")}</h3>
      <p class="muted small">${escapeHtml(payload.format || "unknown")} format</p>
    </div>
    <dl class="preview-meta">
      <dt>Platform</dt><dd>${escapeHtml(b.platform || "-")}</dd>
      <dt>Version</dt><dd>${escapeHtml(b.version || "unknown")}</dd>
      <dt>Total checks</dt><dd>${escapeHtml(String(payload.total ?? 0))}</dd>
    </dl>
    <h4>Sample checks</h4>
    <ul class="preview-list">
      ${(payload.preview || []).map((check) => `
        <li><strong>${escapeHtml(check.id)}</strong> ${escapeHtml(check.title)} <span class="severity-badge severity-${escapeHtml(check.severity)}">${escapeHtml(check.severity)}</span></li>
      `).join("")}
    </ul>
    <div class="preview-actions">
      <button type="button" class="icon-button secondary" id="importLoadButton"><span>Load</span></button>
      <button type="button" class="icon-button primary" id="importScanButton"><span class="button-icon">&gt;</span><span>Load + Scan</span></button>
    </div>
    <div class="preview-actions">
      <button type="button" class="icon-button ghost" id="importSaveButton"><span class="button-icon">+</span><span>Save to Library</span></button>
    </div>
  `;
  const title = (payload.benchmark && payload.benchmark.title) || "imported-benchmark";
  const loadBtn = document.getElementById("importLoadButton");
  const scanBtn = document.getElementById("importScanButton");
  const saveBtn = document.getElementById("importSaveButton");
  if (loadBtn) loadBtn.addEventListener("click", () => {
    setBenchmark(importState.benchmark, `${title}.json`);
    window.location.hash = "#/setup";
    showToast("Loaded — review on the Setup page", "success");
  });
  if (scanBtn) scanBtn.addEventListener("click", async () => {
    setBenchmark(importState.benchmark, `${title}.json`);
    await runScan();
  });
  if (saveBtn) saveBtn.addEventListener("click", () => saveImportToLibrary(title));
}

async function saveImportToLibrary(title) {
  if (!importState.benchmark) return;
  try {
    const response = await postJson("/api/library/save", { benchmark_json: importState.benchmark, name: title });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "Save failed");
    showToast(`Saved to Library as "${payload.name}"`, "success");
    loadBenchmarkLibrary();
  } catch (error) {
    showToast(error.message, "error");
  }
}
