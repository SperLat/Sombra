const form = document.getElementById("check-form");
const statusBox = document.getElementById("status");
const scenarioList = document.getElementById("scenario-list");
const recentChecks = document.getElementById("recent-checks");
const auditBox = document.getElementById("server-audit");
const refreshAuditBtn = document.getElementById("refresh-audit");
const clearAuditBtn = document.getElementById("clear-audit");
const exportAuditJsonBtn = document.getElementById("export-audit-json");
const exportAuditCsvBtn = document.getElementById("export-audit-csv");
const submitBtn = document.getElementById("submit-btn");
const enrichBtn = document.getElementById("enrich-btn");
const autoEnrichInput = document.getElementById("auto-enrich");
const demoList = document.getElementById("demo-script");
const demoRunBtn = document.getElementById("run-demo");
const demoStatus = document.getElementById("demo-status");
const flowChecklist = document.getElementById("flow-checklist");
const demoToggle = document.getElementById("demo-toggle");
const modeStatus = document.getElementById("mode-status");
const topNavMode = document.getElementById("top-nav-mode");
const streamHealthEl = document.getElementById("stream-health");
const consoleModeEl = document.getElementById("console-mode");
const normalModeSection = document.getElementById("normal-mode");
const demoModeSection = document.getElementById("demo-mode");
const explorerScope = document.getElementById("explorer-scope");
const explorerQuery = document.getElementById("explorer-query");
const explorerSearchBtn = document.getElementById("explorer-search");
const explorerRefreshBtn = document.getElementById("explorer-refresh");
const explorerStreamRefreshBtn = document.getElementById("explorer-stream-refresh");
const explorerStats = document.getElementById("explorer-stats");
const explorerShortcuts = document.getElementById("explorer-shortcuts");
const explorerResult = document.getElementById("explorer-result");
const explorerStream = document.getElementById("explorer-stream");
const explorerDataModeNote = document.getElementById("explorer-data-mode-note");
const explorerSourceNetwork = document.getElementById("explorer-source-network");
const explorerSourceWallets = document.getElementById("explorer-source-wallets");
const explorerSourceMode = document.getElementById("explorer-source-mode");
const explorerRankReasonPanel = document.getElementById("explorer-rank-reason");
const liveTransactionSampleBtn = document.getElementById("live-transaction-sample");
const launchContactForm = document.getElementById("launch-contact-form");
const launchContactStatus = document.getElementById("launch-contact-status");
const metricNetwork = document.getElementById("metric-network");
const metricNetworkSub = document.getElementById("metric-network-sub");
const metricThroughput = document.getElementById("metric-throughput");
const metricThroughputSub = document.getElementById("metric-throughput-sub");
const metricCoverage = document.getElementById("metric-coverage");
const metricCoverageSub = document.getElementById("metric-coverage-sub");
const metricDecision = document.getElementById("metric-decision");
const metricDecisionSub = document.getElementById("metric-decision-sub");

const HISTORY_KEY = "sombra-history";
const CURRENT_DECISION_TOKEN_KEY = "sombra-last-token";
const DEMO_MODE_KEY = "sombra-demo-mode";
const EXPLORER_STREAM_REFRESH_INTERVAL_MS = 16000;
const EXPLORER_STATS_REFRESH_INTERVAL_MS = 30000;
const DEMO_STEP_DELAY_MS = 550;

const classByLevel = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical"
};

const streamRiskClass = {
  low: "risk-low",
  medium: "risk-medium",
  high: "risk-high",
  critical: "risk-critical",
  safe: "risk-safe"
};

let explorerReasonContext = "";
let latestEvidenceResult = null;
let latestExplorerEvidence = null;

function formatMetricValue(value, decimals = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "n/a";
  }
  if (Number.isInteger(numeric)) {
    return String(numeric);
  }
  return numeric.toFixed(decimals);
}

function formatDecisionQuality(values) {
  const numericValues = Array.isArray(values)
    ? values.map((entry) => Number(entry && entry.score)).filter((score) => Number.isFinite(score))
    : [];
  if (!numericValues.length) {
    return "4.0";
  }
  const avg = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length;
  const quality = Math.max(1, Math.min(5, Math.round((1 - avg / 100) * 5 * 10) / 10));
  return quality.toFixed(1);
}

function updateModeLabels(enabled) {
  const liveMode = enabled ? "Demo mode" : "Live screening";
  if (modeStatus) {
    modeStatus.textContent = enabled
      ? "Demo mode: scripted flow is active and uses the curated risk scenarios."
      : "Live mode: production-style checks with editable input and full audit visibility.";
  }
  if (topNavMode) {
    topNavMode.textContent = liveMode;
  }
  if (consoleModeEl) {
    consoleModeEl.textContent = enabled ? "Demo rehearsal mode" : "Live screening";
  }
}

function copyText(value) {
  const text = String(value || "");
  if (!navigator.clipboard || !navigator.clipboard.writeText) {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(textArea);
      return Promise.resolve(Boolean(copied));
    } catch (_error) {
      return Promise.resolve(false);
    }
  }
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false
  );
}

async function handleCopyButtonClick(event) {
  const button = event.target.closest(".copy-inline");
  if (!button) {
    return false;
  }
  const value = button.getAttribute("data-copy-value");
  if (!value) {
    return false;
  }
  const copied = await copyText(value);
  if (copied) {
    const previousText = button.textContent;
    const originalDisabled = button.disabled;
    button.textContent = "Copied";
    button.disabled = true;
    setTimeout(() => {
      button.textContent = previousText;
      button.disabled = originalDisabled;
    }, 1100);
  }
  return true;
}

function buildLaunchLeadMailto() {
  const payload = collectLaunchPayload();
  if (!payload) {
    return null;
  }
  const { name, email, company, plan, objective } = payload;

  const subject = encodeURIComponent(`Sombra feedback from ${name || "community member"} at ${company || "your organization"}`);
  const body = encodeURIComponent(
    [
      `Name: ${name || "n/a"}`,
      `Work email: ${email || "n/a"}`,
      `Company: ${company || "n/a"}`,
      `Path: ${plan}`,
      "Intended use:",
      objective || "n/a"
    ].join("\n")
  );

  return `mailto:hello@sombra.app?subject=${subject}&body=${body}`;
}

function collectLaunchPayload() {
  const name = (document.getElementById("lead-name")?.value || "").trim();
  const email = (document.getElementById("lead-email")?.value || "").trim();
  const company = (document.getElementById("lead-company")?.value || "").trim();
  const plan = (document.getElementById("lead-plan")?.value || "Product feedback").trim();
  const objective = (document.getElementById("lead-objective")?.value || "").trim();
  return {
    name,
    email,
    company,
    plan,
    objective
  };
}

async function submitLaunchLead(payload) {
  const response = await fetch("/api/lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !body.success) {
    throw new Error((body && body.error) || "Lead capture failed");
  }
  return true;
}

function escapeAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function shortText(value, maxLength = 120) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trim()}…`;
}

function splitReasonText(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return [];
  }
  const normalizedByPipe = normalized
    .split("|")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (normalizedByPipe.length > 1) {
    return normalizedByPipe;
  }
  const normalizedByBullet = normalized
    .split("•")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (normalizedByBullet.length > 1) {
    return normalizedByBullet;
  }
  const normalizedByNewline = normalized
    .split("\n")
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (normalizedByNewline.length > 1) {
    return normalizedByNewline;
  }
  return [normalized];
}

function renderCopyButton(label, value, cssClass = "copy-inline") {
  const classes = `${cssClass}`.trim() || "copy-inline";
  return `<button type="button" class="${escapeAttribute(classes)}" data-copy-value="${escapeAttribute(value)}">${label}</button>`;
}

function isSolanaIdentifier(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,100}$/.test(String(value || "").trim());
}

function normalizeSolanaInput(rawValue) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {
      value: "",
      scope: "",
      changed: false,
      note: ""
    };
  }

  const direct = raw.replace(/^solana:/i, "").trim();
  if (isSolanaIdentifier(direct) || /^\d{4,}$/.test(direct)) {
    const directScope = /^\d{4,}$/.test(direct) ? "block" : direct.length > 64 ? "tx" : "";
    return {
      value: direct,
      scope: directScope,
      changed: direct !== raw,
      note: direct !== raw ? "Removed Solana URI prefix." : ""
    };
  }

  const urlCandidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(urlCandidate);
    const host = parsed.hostname.toLowerCase();
    const supportedHosts = [
      "explorer.solana.com",
      "solscan.io",
      "solana.fm",
      "xray.helius.xyz",
      "solana.com"
    ];
    const supported = supportedHosts.some((knownHost) => host === knownHost || host.endsWith(`.${knownHost}`));
    if (!supported) {
      return {
        value: raw,
        scope: "",
        changed: false,
        note: ""
      };
    }

    const segments = parsed.pathname.split("/").map((part) => part.trim()).filter(Boolean);
    const typeAliases = {
      address: "wallet",
      account: "wallet",
      wallet: "wallet",
      token: "wallet",
      tx: "tx",
      transaction: "tx",
      block: "block",
      program: "program"
    };
    let scope = "";
    let value = "";

    for (let index = 0; index < segments.length; index += 1) {
      const key = segments[index].toLowerCase();
      if (typeAliases[key] && segments[index + 1]) {
        scope = typeAliases[key];
        value = decodeURIComponent(segments[index + 1]);
        break;
      }
    }

    if (!value) {
      value = decodeURIComponent(segments[segments.length - 1] || "");
    }
    value = value.replace(/[^1-9A-HJ-NP-Za-km-z0-9]/g, "");

    if (!value) {
      return {
        value: raw,
        scope: "",
        changed: false,
        note: ""
      };
    }
    if (!scope && /^\d{4,}$/.test(value)) {
      scope = "block";
    }
    if (!scope && isSolanaIdentifier(value)) {
      scope = value.length > 64 ? "tx" : "wallet";
    }

    return {
      value,
      scope,
      changed: value !== raw,
      note: `Extracted ${scope || "identifier"} from Solana explorer URL.`
    };
  } catch (_error) {
    return {
      value: raw,
      scope: "",
      changed: false,
      note: ""
    };
  }
}

function getReadableDataSource(source, fromDemo = false) {
  const normalized = String(source || "").trim();
  if (fromDemo || /demo/i.test(normalized)) {
    return "Demo sample";
  }
  if (/live|rpc|getTransaction|getBlock/i.test(normalized)) {
    return "Live Solana RPC + Sombra heuristic";
  }
  if (/synthetic|heuristic|local|deterministic/i.test(normalized)) {
    return "Sombra heuristic";
  }
  return normalized || "Sombra heuristic";
}

function applyAssessmentSource(result, fromDemo = false) {
  if (!result || typeof result !== "object") {
    return result;
  }
  const readableSource = getReadableDataSource(
    result.dataSource || result.contextSource || result.source || result.sourceLabel,
    fromDemo
  );
  return {
    ...result,
    dataSource: readableSource,
    contextSource: readableSource,
    sourceLabel: readableSource
  };
}

function normalizeSignalText(signal) {
  if (!signal) {
    return "";
  }
  if (typeof signal === "string") {
    return signal;
  }
  return signal.reason || signal.name || signal.type || JSON.stringify(signal);
}

function buildEvidenceObject(result) {
  const sourceLabel = getReadableDataSource(result.sourceLabel || result.dataSource || result.contextSource);
  const signals = Array.isArray(result.signals)
    ? result.signals.map(normalizeSignalText).filter(Boolean)
    : [];
  return {
    product: "Sombra",
    evidenceType: "Solana transaction risk assessment",
    generatedAt: new Date().toISOString(),
    dataSource: sourceLabel,
    wallet: result.wallet || "",
    direction: result.direction || "",
    amount: result.amount || "",
    asset: result.asset || "",
    riskLevel: result.level || "",
    riskScore: result.score ?? result.riskScore ?? "",
    guardrail: result.guardrail || result.recommendation || "",
    recommendation: result.recommendation || "",
    decision: result.decision || "Pending user action",
    decisionToken: result.decisionToken || "",
    signals,
    metadata: result.metadata || result.context || null
  };
}

function buildEvidenceText(result) {
  const evidence = buildEvidenceObject(result);
  return [
    "Sombra risk evidence",
    `Generated: ${evidence.generatedAt}`,
    `Data source: ${evidence.dataSource}`,
    `Wallet: ${evidence.wallet}`,
    `Direction: ${String(evidence.direction || "").toUpperCase()}`,
    `Amount: ${evidence.amount} ${evidence.asset}`.trim(),
    `Risk: ${String(evidence.riskLevel || "").toUpperCase()} (${evidence.riskScore})`,
    `Guardrail: ${evidence.guardrail}`,
    `Recommendation: ${evidence.recommendation}`,
    `Decision: ${evidence.decision}`,
    `Signals: ${evidence.signals.length ? evidence.signals.join("; ") : "none"}`,
    evidence.decisionToken ? `Decision token: ${evidence.decisionToken}` : ""
  ].filter(Boolean).join("\n");
}

function downloadEvidence(result) {
  if (!result) {
    return;
  }
  const evidence = buildEvidenceObject(result);
  const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: "application/json" });
  const objectUrl = URL.createObjectURL(blob);
  const fileName = `sombra-evidence-${Date.now()}.json`;
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function buildExplorerEvidence(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const objectType = payload.type || "unknown";
  const objectId = payload.id || payload.signature || payload.address || payload.programId || payload.slot || payload.hash || payload.query || "";
  if (!objectId) {
    return null;
  }
  const sourceLabel = getReadableDataSource(payload.dataSource || payload.source || payload.contextSource);
  const riskLevel = payload.riskLevel || payload.level || "unknown";
  const score = payload.riskScore ?? payload.score ?? null;
  const recommendation = payload.recommendation || payload.guardrail || "Recorded for review";
  const summary = [
    `${String(objectType).toUpperCase()} ${objectId}`,
    sourceLabel,
    recommendation
  ].filter(Boolean).join(" | ");
  return {
    evidenceType: "explorer_investigation",
    objectType,
    objectId: String(objectId),
    riskLevel,
    score,
    dataSource: sourceLabel,
    chainSource: /live|rpc/i.test(sourceLabel) ? "Live Solana RPC" : "Demo sample",
    riskSource: "Sombra heuristic",
    recommendation,
    reason: "Explorer result promoted to audit evidence",
    summary,
    payload
  };
}

function renderPromoteToAuditButton(payload) {
  const evidence = buildExplorerEvidence(payload);
  if (!evidence) {
    return "";
  }
  latestExplorerEvidence = evidence;
  return `
    <div class="investigation-actions">
      <div>
        <strong>Investigation evidence</strong>
        <p>Record this search result in the audit trail for compliance review.</p>
      </div>
      <button type="button" class="btn btn-primary" data-promote-explorer-evidence="true">Record as evidence</button>
    </div>
  `;
}

async function promoteExplorerEvidence() {
  if (!latestExplorerEvidence) {
    return;
  }
  const response = await fetch("/api/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(latestExplorerEvidence)
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body || !body.success) {
    throw new Error((body && body.error) || "Evidence logging failed");
  }
  await loadAudit();
}

function appendEvidenceActions(result) {
  if (!statusBox || !result) {
    return;
  }
  latestEvidenceResult = result;
  const evidenceText = buildEvidenceText(result);
  const evidence = buildEvidenceObject(result);
  const section = document.createElement("section");
  section.className = "evidence-actions";
  section.innerHTML = `
    <div>
      <strong>Evidence packet</strong>
      <p>Copy a concise case note or download a JSON record for compliance review.</p>
    </div>
    <div class="evidence-buttons">
      ${renderCopyButton("Copy evidence", evidenceText)}
      <button type="button" class="btn btn-secondary evidence-download" data-evidence-download="json">Download JSON</button>
    </div>
    <p class="truth-label">${escapeHtml(evidence.dataSource)}</p>
  `;
  statusBox.appendChild(section);
}

function setBadgeState(element, isLive) {
  if (!element) {
    return;
  }
  element.classList.toggle("explorer-badge-ok", Boolean(isLive));
  element.classList.toggle("explorer-badge-warn", !isLive);
}

const FALLBACK_DEMO_SCRIPT = [
  {
    name: "Safe colleague payout",
    expectedLevel: "low",
    expectedGuardrail: "ALLOW",
    expectedAction: "sign",
    expectedNote: "Wallet appears mature and low volume.",
    payload: {
      direction: "send",
      wallet: "B7xC2R9wJ4q5K7g4P2x6M1t9hL3s8vQ5wF9k8V7",
      amount: 275,
      asset: "SOL",
      metadata: {
        walletAgeDays: 420,
        txCount24h: 9,
        uniqueCounterparties: 4,
        failRate: 0.01,
        mixingScore: 0.07
      }
    }
  },
  {
    name: "High-volume OTC transfer",
    expectedLevel: "high",
    expectedGuardrail: "CUE_REVIEW",
    expectedAction: "proceed",
    expectedNote: "Elevated throughput and counterparties indicate manual review needed.",
    payload: {
      direction: "receive",
      wallet: "C1xQ2R9kL4m8tS3vW6p1YhQ9nJ7xF2dM5kV4s8R",
      amount: 14000,
      asset: "SOL",
      metadata: {
        walletAgeDays: 16,
        txCount24h: 150,
        uniqueCounterparties: 150,
        failRate: 0.21,
        mixingScore: 0.68
      }
    }
  },
  {
    name: "Watchlist + mixer profile",
    expectedLevel: "critical",
    expectedGuardrail: "BLOCK",
    expectedAction: "override",
    expectedNote: "Known-risk cluster with sanctions-like pattern is blocked.",
    payload: {
      direction: "send",
      wallet: "G3r6PqJqJ2m8bV6zFJ3Yh2h7M4QkQ8Jk9Lq4k9",
      amount: 24000,
      asset: "USDC",
      metadata: {
        walletAgeDays: 2,
        txCount24h: 820,
        uniqueCounterparties: 188,
        failRate: 0.34,
        mixingScore: 0.93,
        sanctionsHit: true,
        exchangeFlow: false
      }
    }
  }
];

let demoSteps = [];
let demoRunning = false;

function parseMetadata(input) {
  const raw = String(input || "").trim();
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    throw new Error('Invalid metadata JSON. Example: {"walletAgeDays": 20}');
  }
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function renderSignals(signalList) {
  if (!signalList.length) {
    return "<li>No abnormal signals detected.</li>";
  }
  return signalList
    .map((signal) => {
      const level = signal.level || "medium";
      return `<li class="signal ${level}"><strong>${signal.reason}</strong> <span>(+${signal.weight})</span></li>`;
    })
    .join("");
}

function getDecisionAction(result) {
  if (result.guardrail === "BLOCK") {
    return "override";
  }
  if (result.guardrail === "CUE_REVIEW") {
    return "proceed";
  }
  return "sign";
}

function getDecisionLabel(action) {
  if (action === "override") {
    return "Request override";
  }
  if (action === "proceed") {
    return "Proceed with caution";
  }
  return "Continue to sign";
}

async function fetchWalletContext(wallet) {
  const response = await fetch(`/api/enrich?wallet=${encodeURIComponent(wallet)}`);
  const body = await response.json();
  if (!body.success) {
    throw new Error(body.error || "Unable to enrich metadata");
  }
  return body.metadata;
}

function fillMetadata(metadata) {
  document.getElementById("metadata").value = JSON.stringify(metadata, null, 2);
}

function fillForm(payload) {
  document.getElementById("direction").value = payload.direction || "send";
  document.getElementById("wallet").value = payload.wallet || "";
  document.getElementById("amount").value = payload.amount || "";
  document.getElementById("asset").value = payload.asset || "SOL";
  document.getElementById("metadata").value = payload.metadata
    ? JSON.stringify(payload.metadata, null, 2)
    : "";
}

function pushHistory(item) {
  const history = loadHistory();
  history.unshift({
    at: new Date().toLocaleString(),
    ...item
  });
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 6)));
  renderHistory();
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) {
      return [];
    }
    return JSON.parse(raw);
  } catch (_error) {
    return [];
  }
}

function getStoredMode() {
  const query = new URLSearchParams(window.location.search);
  const modeParam = String(query.get("mode") || "").toLowerCase();
  if (["demo", "1", "true", "on"].includes(modeParam)) {
    return true;
  }
  if (["normal", "0", "false", "off", "live"].includes(modeParam)) {
    return false;
  }
  const stored = localStorage.getItem(DEMO_MODE_KEY);
  if (stored === "true") {
    return true;
  }
  if (stored === "false") {
    return false;
  }
  return false;
}

function applyDemoMode(isDemoMode, persistPreference = true) {
  const enabled = Boolean(isDemoMode);
  if (normalModeSection) {
    normalModeSection.classList.toggle("hidden", enabled);
    normalModeSection.setAttribute("aria-hidden", enabled ? "true" : "false");
  }
  if (demoModeSection) {
    demoModeSection.classList.toggle("hidden", !enabled);
    demoModeSection.setAttribute("aria-hidden", enabled ? "false" : "true");
  }
  if (demoToggle) {
    demoToggle.checked = enabled;
    demoToggle.setAttribute("aria-checked", enabled ? "true" : "false");
  }
  updateModeLabels(enabled);
  document.body.dataset.mode = enabled ? "demo" : "live";
  if (document.body) {
    document.body.classList.toggle("mode-demo", enabled);
    document.body.classList.toggle("mode-live", !enabled);
  }
  if (persistPreference) {
    localStorage.setItem(DEMO_MODE_KEY, enabled ? "true" : "false");
    syncDemoModeInUrl(enabled);
  }
}

function initDemoMode() {
  const isDemoMode = getStoredMode();
  applyDemoMode(isDemoMode, false);
}

function renderHistory() {
  const history = loadHistory();
  if (!history.length) {
    recentChecks.innerHTML = '<p class="muted">No checks yet.</p>';
    return;
  }
  recentChecks.innerHTML = "";
  history.forEach((item, index) => {
    const entry = document.createElement("article");
    entry.className = "history-entry history-entry-action";
    entry.tabIndex = 0;
    entry.setAttribute("role", "button");
    entry.setAttribute("aria-label", `Restore ${item.level || "risk"} check for ${compactAddress(item.wallet || "", 6)}`);
    const sourceLabel = getReadableDataSource(item.sourceLabel || item.dataSource || item.contextSource);
    entry.innerHTML = `
      <p><strong>${escapeHtml(item.level).toUpperCase()}</strong> (${escapeHtml(item.score)}) - ${escapeHtml(item.at)}</p>
      <p>${escapeHtml(item.wallet)} - ${escapeHtml(item.direction).toUpperCase()} - ${escapeHtml(item.amount)} ${escapeHtml(item.asset)}</p>
      <p><span class="truth-label">${escapeHtml(sourceLabel)}</span></p>
      <p>${escapeHtml(item.recommendation)}</p>
      <p class="history-entry-actions">
        <span>Click to restore this check</span>
        <button type="button" class="copy-inline history-rerun-btn" data-history-rerun="${index}">Re-run</button>
      </p>
    `;
    entry.addEventListener("click", (event) => {
      if (event.target.closest("[data-history-rerun]")) {
        return;
      }
      restoreHistoryCheck(item, false);
    });
    entry.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      restoreHistoryCheck(item, false);
    });
    const rerunButton = entry.querySelector("[data-history-rerun]");
    if (rerunButton) {
      rerunButton.addEventListener("click", (event) => {
        event.stopPropagation();
        restoreHistoryCheck(item, true);
      });
    }
    recentChecks.appendChild(entry);
  });
}

function restoreHistoryCheck(item, shouldRun = false) {
  if (!item) {
    return;
  }
  fillForm({
    direction: item.direction || "send",
    wallet: item.wallet || "",
    amount: item.amount || "",
    asset: item.asset || "SOL",
    metadata: item.metadata || item.context || null
  });
  setWorkflowPanel("risk");
  const walletInput = document.getElementById("wallet");
  if (walletInput) {
    walletInput.focus();
  }
  if (shouldRun && form) {
    form.requestSubmit();
    return;
  }
  setStatusPanel("<p>Recent check restored. Review the values, then run a fresh check when ready.</p>", false, false);
}

function formatAuditEvent(event) {
  if (event.type === "evidence") {
    const objectType = event.objectType ? String(event.objectType).toUpperCase() : "EVIDENCE";
    const objectId = event.objectId || "Unknown object";
    const source = getReadableDataSource(event.dataSource || event.chainSource);
    const detail = event.recommendation || event.reason || "Recorded for review";
    const created = event.createdAt ? new Date(event.createdAt).toLocaleString() : "Pending";
    return `
      <article class="history-entry">
        <p><strong>Evidence ${objectType}</strong> - ${compactAddress(objectId, 10)} ${renderCopyButton("Copy", objectId, "copy-inline copy-inline-mini")}</p>
        <p><span class="truth-label">${escapeHtml(source)}</span></p>
        <p>${escapeHtml(detail)} - recorded as investigation evidence - ${created}</p>
      </article>
    `;
  }
  const title = event.type === "decision"
    ? `Decision ${event.action}`
    : `${event.level ? event.level.toUpperCase() : "ASSESS"}`;
  const wallet = event.wallet || "Unknown wallet";
  const where = event.direction ? ` - ${event.direction.toUpperCase()}` : "";
  const amount = event.amount ? ` - ${event.amount} ${event.asset || ""}` : "";
  const detail = event.recommendation || event.reason || "";
  const created = event.createdAt ? new Date(event.createdAt).toLocaleString() : "Pending";

  return `
    <article class="history-entry">
      <p><strong>${title}</strong> - ${wallet}${where}${amount}</p>
      <p>${detail} - ${created}</p>
    </article>
  `;
}

function compactAddress(address, keep = 6) {
  if (!address) {
    return "-";
  }
  if (address.length <= keep * 2 + 4) {
    return address;
  }
  return `${address.slice(0, keep)}...${address.slice(-keep)}`;
}

function renderExplorerShortcut(item) {
  if (!item || !item.address) {
    return "";
  }
  const reason = Array.isArray(item.riskReasons) && item.riskReasons.length
    ? item.riskReasons[0]
    : `Score ${item.riskScore || "n/a"}`;
  const shortReason = shortText(reason, 110);
  return `
    <button
      type="button"
      class="explorer-shortcut"
      data-shortcut="${item.address}"
      title="${escapeAttribute(reason)}"
    >
      <strong>${(item.riskLevel || "low").toUpperCase()}:</strong> ${compactAddress(item.address)}
      <span class="explorer-shortcut-reason">${escapeHtml(shortReason)}</span>
      <span class="explorer-shortcut-action">Inspect profile →</span>
    </button>
  `;
}

function syncDemoModeInUrl(enabled) {
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set("mode", "demo");
  } else {
    url.searchParams.delete("mode");
  }
  window.history.replaceState({}, "", url);
}

function reasonToMarkup(reasonText) {
  const reasonLines = splitReasonText(reasonText);
  if (!reasonLines.length) {
    return '<p class="muted">No explicit rationale available.</p>';
  }
  if (reasonLines.length === 1) {
    return `<p class="muted">${escapeHtml(reasonLines[0])}</p>`;
  }
  return `<ul class="reason-list">${reasonLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function showExplorerRankReason({
  query = "Selected profile",
  level = "",
  score = "",
  source = "",
  reasonText = ""
}) {
  if (!explorerRankReasonPanel) {
    return;
  }
  const reasonMarkup = reasonToMarkup(reasonText);
  const metaItems = [];
  if (level) {
    metaItems.push(`Risk ${String(level).toUpperCase()}`);
  }
  if (score) {
    metaItems.push(`Score ${score}`);
  }
  if (source) {
    metaItems.push(`Source ${escapeHtml(String(source))}`);
  }
  const metas = metaItems.length ? `<p class="muted">${metaItems.join(" • ")}</p>` : "";
  explorerRankReasonPanel.className = "explorer-rank-reason";
  explorerRankReasonPanel.innerHTML = `
    <h4>${escapeHtml(shortText(query, 54))}</h4>
    ${metas}
    ${reasonMarkup}
  `;
}

function renderExplorerStats(stats) {
  if (!explorerStats) {
    return;
  }
  if (!stats || typeof stats !== "object") {
    explorerStats.innerHTML = '<p class="muted">Explorer metrics unavailable.</p>';
    if (explorerShortcuts) {
      explorerShortcuts.innerHTML = "";
    }
    return;
  }
  const topRows = Array.isArray(stats.topWallets) ? stats.topWallets : [];
  const networkSource = stats.dataSources && stats.dataSources.network
    ? String(stats.dataSources.network)
    : "Synthetic sample metrics";
  const walletSource = stats.dataSources && stats.dataSources.walletRisk
    ? String(stats.dataSources.walletRisk)
    : "Local deterministic wallet risk heuristics";
  const isLiveNetwork = /live/i.test(networkSource);
  const isLiveWallet = /live|rpc/i.test(walletSource);
  const latestSlot = formatMetricValue(stats.latestSlot, 0);
  const tps = formatMetricValue(stats.tps, 0);
  const topWalletTitle = topRows.length ? "Searchable risk profiles" : "Live wallet search";
  const topWalletFooter = topRows.length
    ? "Click a profile to open and inspect each wallet ranking reason."
    : "Enter a Solana wallet above to fetch live balance, recent signatures, and Sombra heuristic context.";
  if (explorerDataModeNote) {
    explorerDataModeNote.textContent = isLiveNetwork
      ? (stats.dataSource || "Live Solana RPC is available. Risk labels are Sombra heuristics.")
      : "Live RPC unavailable or disabled. Showing demo sample chain data; risk labels remain Sombra heuristics.";
  }
  if (explorerSourceNetwork) {
    explorerSourceNetwork.textContent = `Network metrics: ${networkSource}`;
    setBadgeState(explorerSourceNetwork, isLiveNetwork);
  }
  if (explorerSourceWallets) {
    explorerSourceWallets.textContent = `Wallet risk labels: ${walletSource}`;
    setBadgeState(explorerSourceWallets, isLiveWallet);
  }
  if (explorerSourceMode) {
    const modeSource = stats.dataSources && stats.dataSources.mode
      ? stats.dataSources.mode
      : "Live RPC unavailable. Demo sample data active.";
    const isLiveModeSource = /on|enabled|live/i.test(String(modeSource));
    explorerSourceMode.textContent = String(modeSource);
    setBadgeState(explorerSourceMode, isLiveModeSource);
    if (streamHealthEl) {
      streamHealthEl.textContent = isLiveModeSource ? "Stream: live" : "Stream: fallback";
      streamHealthEl.classList.toggle("pill-ok", isLiveModeSource);
    }
  }
  explorerStats.innerHTML = `
    <article class="explorer-stat-card">
      <p class="explorer-stat-label">Network</p>
      <p><strong>${stats.chain || "Solana"}</strong> | ${stats.cluster || "mainnet-beta"}</p>
      <p class="muted">Latest slot: ${latestSlot} | TPS est: ${tps}</p>
    </article>
    <article class="explorer-stat-card">
      <p class="explorer-stat-label">Health</p>
      <p><strong>${stats.state || "Healthy"}</strong></p>
      <p class="muted">Finalized ${stats.finalizedBlocks || "n/a"} blocks | Risk alerts: ${stats.highRiskAlerts || 0}</p>
    </article>
    <article class="explorer-stat-card">
      <p class="explorer-stat-label">${topWalletTitle}</p>
      <div class="top-risk-list">
        ${topRows.slice(0, 3).map((item, index) => {
          const displayAddress = item.address ? compactAddress(item.address, 8) : "Unknown";
          const reason = Array.isArray(item.riskReasons) && item.riskReasons.length
            ? String(item.riskReasons[0] || "No explicit reason available.")
            : "No explicit reason available.";
          const reasonList = Array.isArray(item.riskReasons) && item.riskReasons.length
            ? item.riskReasons
            : [reason];
          const reasonPreview = reasonList.map((entry) => escapeHtml(String(entry || ""))).slice(0, 3);
          const copyControl = item.address ? renderCopyButton("Copy", item.address, "copy-inline copy-inline-mini") : "";
          const shortReason = shortText(reason || `Risk level ${item.riskLevel || "unknown"}`, 108);
          return `
              <button
                type="button"
                class="explorer-shortcut explorer-shortcut-wallet"
                data-explorer-rank="${escapeAttribute(item.address || "")}"
                data-explorer-rank-reason="${escapeAttribute(reasonList.join(" | "))}"
                data-explorer-rank-level="${escapeAttribute(item.riskLevel || "unknown")}"
                data-explorer-rank-score="${escapeAttribute(item.riskScore || "n/a")}"
                data-explorer-rank-source="${escapeAttribute(walletSource)}"
                title="${escapeAttribute(reason)}"
              >
                <strong>${index + 1}. ${(item.label || "Wallet")}:</strong> ${displayAddress} ${copyControl}
                <span>Risk ${(item.riskLevel || "unknown").toUpperCase()} - Score ${item.riskScore || "n/a"}</span>
                <span class="explorer-shortcut-reason">${escapeHtml(shortReason)}</span>
                <span class="explorer-shortcut-reason">Why flagged: ${reasonPreview.join(" • ") || "No explicit reason available."}</span>
                <span class="explorer-shortcut-action">Inspect why flagged →</span>
             </button>
           `;
        }).join("") || '<p class="muted">No pre-ranked wallets in live RPC mode.</p>'}
      </div>
      <p class="muted">${topWalletFooter}</p>
    </article>
  `;
  if (explorerShortcuts) {
    explorerShortcuts.innerHTML = topRows
      .slice(0, 4)
      .map((wallet) => renderExplorerShortcut(wallet))
      .join("");
  }
  updateDashboardMetrics(stats);
}

function updateDashboardMetrics(stats) {
  const isLive = Boolean(stats && stats.dataSources && /live|rpc/i.test(stats.dataSources.network || ""));
  const metricNetworkSource = stats && stats.dataSources && stats.dataSources.network
    ? String(stats.dataSources.network)
    : "Synthetic sample metrics";
  const metricWalletSource = stats && stats.dataSources && stats.dataSources.walletRisk
    ? String(stats.dataSources.walletRisk)
    : "Local deterministic wallet risk heuristics";

  if (metricNetwork) {
    metricNetwork.textContent = `${stats?.chain || "Solana"} (${stats?.cluster || "mainnet-beta"})`;
  }
  if (metricNetworkSub) {
    const slot = formatMetricValue(stats && stats.latestSlot, 0);
    const tps = formatMetricValue(stats && stats.tps, 0);
    const networkHealth = stats?.state || "Healthy";
    metricNetworkSub.textContent = `Slot ${slot} • TPS ${tps} • ${networkHealth}`;
  }
  if (metricThroughput) {
    metricThroughput.textContent = `${formatMetricValue(stats?.tps, 0)} TPS`;
  }
  if (metricThroughputSub) {
    metricThroughputSub.textContent = isLive
      ? "On-chain timing from explorer stream and RPC latency estimate."
      : "Fallback metric cadence with synthetic timing.";
  }
  if (metricCoverage) {
    const sourceBits = [];
    sourceBits.push(metricNetworkSource);
    if (metricWalletSource) {
      sourceBits.push(metricWalletSource);
    }
    const liveMix = isLive ? "Live RPC + heuristics" : "heuristic fallback";
    metricCoverage.textContent = isLive
      ? "Wallet + tx + block + program"
      : "Wallet + synthetic stream";
    if (metricCoverageSub) {
      metricCoverageSub.textContent = `Data source: ${sourceBits.join(" | ")} (${liveMix})`;
    }
  }
  if (metricDecision && metricDecisionSub) {
    const history = loadHistory();
    const score = formatDecisionQuality(history);
    metricDecision.textContent = `${score}/5`;
    metricDecisionSub.textContent = history.length
      ? `Based on last ${Math.min(history.length, 6)} assessed wallets`
      : "No assessments yet. Start with Live mode checks.";
  }
}

function renderExplorerTransaction(tx) {
  if (!tx) {
    return "<p class=\"muted\">No transaction data.</p>";
  }
  const risks = tx.riskTags && tx.riskTags.length ? tx.riskTags.join(", ") : "No explicit risk tags";
  const decision = tx.recommendation || "No action recommendation";
  const source = tx.dataSource || "local heuristic";
  const from = tx.from || "";
  const to = tx.to || "";
  const signature = tx.signature || "n/a";
  const amount = tx.amount === undefined || tx.amount === null || tx.amount === "" ? "n/a" : String(tx.amount);
  const block = tx.block || "pending";
  const slot = tx.slot || "n/a";
  const status = tx.status || "unknown";
  const asset = tx.asset || "";
  const amountLine = tx.explicitTransfer
    ? `<p><strong>Transfer:</strong> ${amount} ${asset}</p>`
    : `<p><strong>Transfer:</strong> No parsed token/SOL transfer instruction detected. Largest SOL balance delta: ${tx.largestSolDelta || "n/a"} SOL</p>`;
  const feeLine = tx.fee !== undefined ? `<p><strong>Fee:</strong> ${tx.fee} SOL</p>` : "";
  const instructionLine = tx.instructionCount !== undefined
    ? `<p><strong>Instructions:</strong> ${tx.instructionCount} | <strong>Accounts:</strong> ${tx.accountCount || "n/a"}</p>`
    : "";
  const blockTimeLine = tx.blockTime ? `<p><strong>Block time:</strong> ${new Date(tx.blockTime * 1000).toLocaleString()}</p>` : "";
  const computeLine = tx.computeUnitsConsumed
    ? `<p><strong>Compute units:</strong> ${tx.computeUnitsConsumed} | <strong>Cost units:</strong> ${tx.costUnits || "n/a"}</p>`
    : "";
  const blockhashLine = tx.recentBlockhash
    ? `<p><strong>Recent blockhash:</strong> ${tx.recentBlockhash} ${renderCopyButton("Copy", tx.recentBlockhash, "copy-inline copy-inline-mini")}</p>`
    : "";
  const versionLine = tx.version ? `<p><strong>Version:</strong> ${tx.version}</p>` : "";
  const accountRows = Array.isArray(tx.accountInputs) && tx.accountInputs.length
    ? tx.accountInputs.map((account) => `
      <tr>
        <td>${account.index}</td>
        <td>${compactAddress(account.address, 8)} ${renderCopyButton("Copy", account.address, "copy-inline copy-inline-mini")}</td>
        <td>${account.change} SOL</td>
        <td>${account.postBalance} SOL</td>
        <td>${account.signer ? "Signer " : ""}${account.writable ? "Writable" : "Readonly"}</td>
      </tr>
    `).join("")
    : "";
  const instructionRows = Array.isArray(tx.instructions) && tx.instructions.length
    ? tx.instructions.map((instruction) => `
      <article class="tx-instruction">
        <p><strong>#${instruction.index} ${escapeHtml(instruction.programName || "Program")}</strong></p>
        <p><strong>Program:</strong> ${escapeHtml(instruction.programId || "unknown")} ${instruction.programId ? renderCopyButton("Copy", instruction.programId, "copy-inline copy-inline-mini") : ""}</p>
        <p><strong>Accounts:</strong> ${instruction.accountCount || 0}</p>
        ${instruction.data ? `<p><strong>Data:</strong> <code>${escapeHtml(shortText(instruction.data, 96))}</code></p>` : ""}
      </article>
    `).join("")
    : "<p class=\"muted\">No instruction data returned.</p>";
  const innerRows = Array.isArray(tx.innerInstructions) && tx.innerInstructions.length
    ? tx.innerInstructions.map((group) => `
      <p><strong>Instruction #${Number(group.index) + 1}:</strong> ${Array.isArray(group.instructions) ? group.instructions.length : 0} inner call(s)</p>
    `).join("")
    : "<p class=\"muted\">No inner instructions.</p>";
  const logRows = Array.isArray(tx.logMessages) && tx.logMessages.length
    ? tx.logMessages.slice(0, 12).map((line) => `<li>${escapeHtml(line)}</li>`).join("")
    : "<li>No logs returned.</li>";
  return `
    <article class="explorer-card">
      <div class="explorer-card-head">
        <h3>Transaction</h3>
        <span class="hero-chip">Signature</span>
      </div>
      <p><strong>ID:</strong> ${signature} ${renderCopyButton("Copy", signature)}</p>
      <p><strong>Source:</strong> ${source}</p>
      <p><strong>Status:</strong> ${status} | <strong>Confirmation:</strong> ${tx.confirmationStatus || "finalized"} | <strong>Confirmations:</strong> ${tx.confirmations || "max"}</p>
      <p><strong>Block:</strong> ${block} | <strong>Slot:</strong> ${slot}</p>
      <p><strong>From:</strong> ${compactAddress(from)} ${from ? renderCopyButton("Copy", from, "copy-inline copy-inline-mini") : ""} <strong>-></strong> ${compactAddress(to)} ${to ? renderCopyButton("Copy", to, "copy-inline copy-inline-mini") : ""}</p>
      ${amountLine}
      ${feeLine}
      ${computeLine}
      ${instructionLine}
      ${blockTimeLine}
      ${blockhashLine}
      ${versionLine}
      <p><strong>Risk score:</strong> ${tx.riskScore}</p>
      <p><strong>Recommendation:</strong> ${decision}</p>
      <p class="muted">Signals: ${risks}</p>
      <details open>
        <summary>Account Inputs (${Array.isArray(tx.accountInputs) ? tx.accountInputs.length : 0})</summary>
        <div class="tx-table-wrap">
          <table class="tx-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Address</th>
                <th>Change</th>
                <th>Post balance</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>${accountRows || "<tr><td colspan=\"5\">No account inputs returned.</td></tr>"}</tbody>
          </table>
        </div>
      </details>
      <details open>
        <summary>Instructions</summary>
        <div class="tx-instruction-list">${instructionRows}</div>
      </details>
      <details>
        <summary>Inner Instructions</summary>
        ${innerRows}
      </details>
      <details>
        <summary>Program Logs</summary>
        <ul class="tx-log-list">${logRows}</ul>
      </details>
    </article>
  `;
}

function renderExplorerWallet(wallet) {
  if (!wallet) {
    return "<p class=\"muted\">No wallet data.</p>";
  }
  const source = wallet.dataSource || "local heuristic";
  const flags = wallet.flags && wallet.flags.length ? wallet.flags.join(", ") : "No watch flags";
  const reasons = Array.isArray(wallet.riskReasons) && wallet.riskReasons.length
    ? wallet.riskReasons
    : ["No risk explanation available for this profile."];
  const recentTransfers = Array.isArray(wallet.recentTransactions) ? wallet.recentTransactions : [];
  return `
    <article class="explorer-card">
      <div class="explorer-card-head">
        <h3>Wallet profile</h3>
        <span class="hero-chip hero-chip-${wallet.riskLevel || "low"}">Risk: ${(wallet.riskLevel || "low").toUpperCase()}</span>
      </div>
      <p><strong>Address:</strong> ${wallet.address} ${renderCopyButton("Copy", wallet.address)}</p>
      <p><strong>Source:</strong> ${source}</p>
      <p><strong>Balance:</strong> ${wallet.balance} ${wallet.primaryAsset || "SOL"}</p>
      <p><strong>Recent signature sample:</strong> ${wallet.txCount24h}</p>
      <p><strong>Signal score:</strong> ${wallet.riskScore}</p>
      <p><strong>Flags:</strong> ${flags}</p>
      <div class="risk-explainer">
        <details open>
          <summary>Why flagged</summary>
          <p><strong>Data source:</strong> ${source}</p>
          <ul>
            ${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}
          </ul>
        </details>
      </div>
      <div class="history-entry">
        <p class="muted">Recent transfers</p>
        ${recentTransfers.map((item) => {
          const transferType = String(item.type || "TX").toUpperCase();
          const signature = item.signature || item.id || "n/a";
          const counterparty = item.counterparty || "Unknown counterparty";
          const amount = item.amount === undefined || item.amount === null || item.amount === "" ? "n/a" : String(item.amount);
          const asset = item.asset || "SOL";
          const slotText = item.slot ? ` | slot ${item.slot}` : "";
          return `
            <p>${transferType} ${amount} ${asset} | ${compactAddress(signature, 8)} ${renderCopyButton("Copy", signature, "copy-inline copy-inline-mini")} | ${counterparty} ${renderCopyButton("Copy", counterparty, "copy-inline copy-inline-mini")}${slotText}</p>
          `;
        }).join("")}
        ${recentTransfers.length ? "" : "<p class=\"muted\">No recent transfer activity in sample window.</p>"}
      </div>
    </article>
  `;
}

function renderExplorerProgram(program) {
  if (!program) {
    return "<p class=\"muted\">No program data.</p>";
  }
  const source = program.dataSource || "local heuristic";
  const ownerLine = program.owner ? `<p><strong>Owner:</strong> ${program.owner} ${renderCopyButton("Copy", program.owner, "copy-inline copy-inline-mini")}</p>` : "";
  const executableLine = program.executable !== undefined ? `<p><strong>Executable:</strong> ${program.executable ? "yes" : "no"}</p>` : "";
  const lamportsLine = program.lamports !== undefined ? `<p><strong>Lamports:</strong> ${program.lamports}</p>` : "";
  const dataSizeLine = program.dataSize !== undefined ? `<p><strong>Data size:</strong> ${program.dataSize} bytes</p>` : "";
  return `
    <article class="explorer-card">
      <div class="explorer-card-head">
        <h3>Program</h3>
        <span class="hero-chip">on-chain actor</span>
      </div>
      <p><strong>Name:</strong> ${program.name}</p>
      <p><strong>Program ID:</strong> ${program.programId} ${renderCopyButton("Copy", program.programId, "copy-inline copy-inline-mini")}</p>
      <p><strong>Source:</strong> ${source}</p>
      <p><strong>Category:</strong> ${program.category}</p>
      ${ownerLine}
      ${executableLine}
      ${lamportsLine}
      ${dataSizeLine}
      <p><strong>Instruction count:</strong> ${program.instructions || "n/a"}</p>
      <p class="muted">${program.description}</p>
    </article>
  `;
}

function renderExplorerBlock(block) {
  if (!block) {
    return "<p class=\"muted\">No block data.</p>";
  }
  const source = block.dataSource || "local heuristic";
  const parentSlotLine = block.parentSlot ? `<p><strong>Parent slot:</strong> ${block.parentSlot}</p>` : "";
  const previousHashLine = block.previousBlockhash ? `<p><strong>Previous hash:</strong> ${block.previousBlockhash} ${renderCopyButton("Copy", block.previousBlockhash, "copy-inline copy-inline-mini")}</p>` : "";
  const blockTimeLine = block.blockTime ? `<p><strong>Block time:</strong> ${new Date(block.blockTime * 1000).toLocaleString()}</p>` : "";
  return `
    <article class="explorer-card">
      <div class="explorer-card-head">
        <h3>Block</h3>
        <span class="hero-chip">${block.status || "Finalized"}</span>
      </div>
      <p><strong>Slot:</strong> ${block.slot}</p>
      <p><strong>Source:</strong> ${source}</p>
      <p><strong>Leader:</strong> ${compactAddress(block.leader, 8)} ${renderCopyButton("Copy", block.leader, "copy-inline copy-inline-mini")}</p>
      <p><strong>Txs:</strong> ${block.txCount}</p>
      <p><strong>Hash:</strong> ${block.hash} ${renderCopyButton("Copy", block.hash, "copy-inline copy-inline-mini")}</p>
      ${parentSlotLine}
      ${previousHashLine}
      ${blockTimeLine}
      <p class="muted">Age: ${block.age}</p>
    </article>
  `;
}

function renderExplorerMiss(result) {
  const suggestions = (result && result.suggestions) || [];
  const suggestionScope = result && result.scope ? result.scope : "auto";
  const errorText = result && result.error ? escapeHtml(result.error) : "Could not resolve this query from the current explorer source.";
  const suggestionList = suggestions
    .slice(0, 6)
    .map((item, index) => {
      const itemText = String(item || "").trim();
      if (!itemText) {
        return "";
      }
      const copyControl = renderCopyButton("Copy", itemText, "copy-inline copy-inline-mini");
      return `
        <button
          type="button"
          class="explorer-shortcut"
          data-shortcut="${escapeAttribute(itemText)}"
          data-scope="${escapeAttribute(suggestionScope)}"
          title="Open ${escapeAttribute(itemText)}"
        >
          <span>${index + 1}. ${escapeHtml(compactAddress(itemText, 10))}</span>
          <span>${copyControl}</span>
        </button>
      `;
    })
    .join("");
  return `
    <article class="explorer-card">
      <div class="explorer-card-head">
        <h3>Search result</h3>
        <span class="hero-chip">No match</span>
      </div>
      <p>${errorText}</p>
      <p class="muted">Try one of the ${suggestionScope === "tx" ? "recent transaction" : "sample"} candidates below:</p>
      ${suggestionList || `<p class="muted">sample wallets, tx IDs, blocks, or known programs.</p>`}
    </article>
  `;
}

function renderExplorerResult(payload) {
  if (!explorerResult) {
    return;
  }
  const type = payload?.type;
  latestExplorerEvidence = buildExplorerEvidence(payload);
  if (type === "wallet") {
    explorerResult.innerHTML = `${renderPromoteToAuditButton(payload)}${renderExplorerWallet(payload)}`;
    return;
  }
  if (type === "tx") {
    explorerResult.innerHTML = `${renderPromoteToAuditButton(payload)}${renderExplorerTransaction(payload)}`;
    return;
  }
  if (type === "program") {
    explorerResult.innerHTML = `${renderPromoteToAuditButton(payload)}${renderExplorerProgram(payload)}`;
    return;
  }
  if (type === "block") {
    explorerResult.innerHTML = `${renderPromoteToAuditButton(payload)}${renderExplorerBlock(payload)}`;
    return;
  }
  latestExplorerEvidence = null;
  explorerResult.innerHTML = renderExplorerMiss(payload || {});
}

function setStatusPanel(content, isError = false, loading = false) {
  statusBox.className = `status panel${loading ? " loading" : ""} ${isError ? "error" : ""}`.trim();
  statusBox.classList.remove("hidden");
  statusBox.innerHTML = content;
}

function renderResult(result) {
  const levelClass = classByLevel[result.level] || "low";
  const action = getDecisionAction(result);

  setStatusPanel(`
    <div class="result-topline">
      <h2>Risk level: ${result.level.toUpperCase()}</h2>
      <div class="score">Score: ${result.score}</div>
    </div>
    <p class="muted">
      Wallet ${result.wallet} ${renderCopyButton("Copy", result.wallet)} - ${result.direction.toUpperCase()} - ${result.amount} ${result.asset}
    </p>
    <p><strong>Guardrail:</strong> ${result.guardrail}</p>
    <p><strong>Context source:</strong> ${result.metadataSource || "manual"}</p>
    <p><strong>Recommendation:</strong> ${result.recommendation}</p>
    <p><strong>Summary:</strong> ${result.summary}</p>
    <p><strong>Decision:</strong> <span id="decision-state">Pending user action</span></p>
    <div class="decision-panel">
      <button type="button" id="decision-button" data-action="${action}">${getDecisionLabel(action)}</button>
    </div>
    <details>
      <summary>Metadata used</summary>
      <pre>${result.metadata ? JSON.stringify(result.metadata, null, 2) : "{}"}</pre>
    </details>
    <ul class="signals">
      ${renderSignals(result.topSignals)}
    </ul>
  `, false, false);

  statusBox.className = `status panel level-${levelClass}`;

  const decisionButton = document.getElementById("decision-button");
  if (!decisionButton) {
    return;
  }

  decisionButton.addEventListener("click", async (event) => {
    const clicked = event.currentTarget;
    const actionValue = clicked.getAttribute("data-action");
    const response = await postDecision({
      decisionToken: result.decisionToken,
      action: actionValue,
      wallet: result.wallet,
      level: result.level,
      score: result.score,
      direction: result.direction,
      reason: `${result.metadataSource || "manual"} context`
    });

    const decisionState = document.getElementById("decision-state");
    if (!response.success) {
      decisionState.textContent = `Action failed: ${response.error || "Try again"}`;
      decisionState.className = "error";
      return;
    }

    localStorage.setItem(CURRENT_DECISION_TOKEN_KEY, result.decisionToken || "");
    const finalVerb = actionValue === "sign" ? "continued" : "recorded";
    decisionState.textContent = `Decision ${finalVerb}: ${actionValue}`;
    decisionState.className = "muted";
    if (actionValue === "sign") {
      const signPreview = `sombra://sign?to=${encodeURIComponent(result.wallet)}&amount=${encodeURIComponent(result.amount)}&asset=${encodeURIComponent(result.asset)}&memo=${encodeURIComponent("SOMBRA_" + result.decisionToken)}`;
      const signParagraph = document.createElement("p");
      signParagraph.innerHTML = `Simulated deep link: <code>${signPreview}</code>`;
      statusBox.appendChild(signParagraph);
    }
    clicked.disabled = true;
    await loadAudit();
  });
}

async function loadExplorerStats() {
  if (streamHealthEl) {
    streamHealthEl.textContent = "Stream: syncing";
    streamHealthEl.classList.add("pill-ok");
  }
  try {
    const response = await fetch(`/api/explorer/stats?t=${Date.now()}`, { cache: "no-store" });
    const body = await response.json();
    if (!body.success) {
      if (streamHealthEl) {
        streamHealthEl.textContent = "Stream: unavailable";
        streamHealthEl.classList.remove("pill-ok");
      }
      if (explorerStats) {
        explorerStats.innerHTML = '<p class="muted">Unable to load explorer stats.</p>';
      }
      return;
    }
    renderExplorerStats(body.stats);
  } catch (_error) {
    if (streamHealthEl) {
      streamHealthEl.textContent = "Stream: unavailable";
      streamHealthEl.classList.remove("pill-ok");
    }
    if (explorerStats) {
      explorerStats.innerHTML = '<p class="muted">Unable to load explorer stats.</p>';
    }
  }
}

function prependExplorerReason(reasonText) {
  if (!explorerResult || !reasonText) {
    if (explorerRankReasonPanel) {
      explorerRankReasonPanel.className = "explorer-rank-reason muted";
      explorerRankReasonPanel.innerHTML = "Select a ranked wallet and open it to see the exact risk rationale.";
    }
    return;
  }
  const reasonLines = splitReasonText(reasonText);
  const reasonList = reasonLines.length > 1
    ? `<ul class="reason-list">${reasonLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
    : `<p class="muted">${escapeHtml(reasonText)}</p>`;
  const reasonElement = document.createElement("article");
  reasonElement.className = "history-entry explorer-reason-callout";
  reasonElement.innerHTML = `
    <p><strong>Why flagged:</strong></p>
    ${reasonList}
  `;
  explorerResult.prepend(reasonElement);
  showExplorerRankReason({
    query: explorerQuery?.value || "Explorer query",
    level: "Top risk profile",
    reasonText
  });
}

function formatStreamRows(items) {
  if (!Array.isArray(items) || !items.length) {
    return '<p class="muted">No live sample stream entries.</p>';
  }
  return items
    .map((entry) => {
      const reasonText = entry.reason || "No reason provided";
      const sourceText = entry.dataSource || "local heuristic";
      const chainSource = /live|rpc|getBlock|getSlot|getTransaction/i.test(sourceText)
        ? "Live Solana RPC"
        : "Demo sample";
      const riskSource = "Sombra heuristic";
      const rowCopy = renderCopyButton("Copy", entry.id, "copy-inline copy-inline-mini stream-copy");
      return `
      <article
        class="explorer-stream-row"
        role="button"
        tabindex="0"
        data-query="${escapeAttribute(entry.id)}"
        data-scope="${escapeAttribute(entry.scope || entry.type)}"
        title="${escapeAttribute(reasonText)}"
      >
        <span class="explorer-stream-type">${entry.type.toUpperCase()}</span>
        <span>${compactAddress(entry.id, 10)} ${rowCopy}</span>
        <span class="explorer-stream-risk ${streamRiskClass[entry.riskLevel] || "risk-low"}">${entry.riskLevel}</span>
        <span>${entry.value}</span>
        <span class="stream-source-stack">
          <span>Chain: ${escapeHtml(chainSource)}</span>
          <span>Risk: ${escapeHtml(riskSource)}</span>
        </span>
        <span class="explorer-stream-reason">${escapeHtml(reasonText)}</span>
        <span>${entry.when}</span>
      </article>
    `; }).join("");
}

function openExplorerQuery(query, scope = "auto", reason = "") {
  if (!query || !explorerQuery) {
    return;
  }
  explorerQuery.value = query;
  if (explorerScope) {
    explorerScope.value = ["wallet", "tx", "block", "program", "auto"].includes(scope) ? scope : "auto";
  }
  explorerReasonContext = reason || "";
  runExplorerSearch();
}

async function loadExplorerStream() {
  if (!explorerStream) {
    return;
  }
  explorerStream.innerHTML = "<p class=\"muted\">Loading stream...</p>";
  try {
    const response = await fetch(`/api/explorer/stream?t=${Date.now()}`, { cache: "no-store" });
    const body = await response.json();
    if (!body.success) {
      explorerStream.innerHTML = "<p class=\"muted\">Stream not available.</p>";
      return;
    }
    explorerStream.innerHTML = formatStreamRows(body.stream || []);
  } catch (_error) {
    explorerStream.innerHTML = "<p class=\"muted\">Unable to load stream.</p>";
  }
}

async function runExplorerSearch() {
  if (!explorerQuery || !explorerSearchBtn || !explorerResult) {
    return;
  }
  const normalizedQuery = normalizeSolanaInput(explorerQuery.value);
  const query = normalizedQuery.value;
  if (normalizedQuery.changed) {
    explorerQuery.value = normalizedQuery.value;
  }
  if (!query) {
    explorerResult.innerHTML = "<p class=\"error\">Type a wallet, signature, block, or program id.</p>";
    return;
  }
  let scope = explorerScope ? explorerScope.value : "auto";
  if (scope === "auto" && normalizedQuery.scope) {
    scope = normalizedQuery.scope;
  }
  explorerSearchBtn.disabled = true;
  explorerSearchBtn.textContent = "Searching...";
  explorerResult.innerHTML = normalizedQuery.note
    ? `<p class="muted">${escapeHtml(normalizedQuery.note)} Querying chain lens...</p>`
    : "<p class=\"muted\">Querying chain lens...</p>";
  try {
    const encoded = new URLSearchParams({ q: query, scope });
    encoded.set("t", String(Date.now()));
    const response = await fetch(`/api/explorer/search?${encoded}`, { cache: "no-store" });
    const body = await response.json();
    if (!body.success) {
      explorerResult.innerHTML = renderExplorerMiss({
        error: body.error || "No matching explorer object",
        scope: body.scope || scope,
        suggestions: body.suggestions || []
      });
      if (explorerReasonContext) {
        prependExplorerReason(explorerReasonContext);
        explorerReasonContext = "";
      }
      return;
    }
    renderExplorerResult(body.result || {});
    if (explorerReasonContext) {
      prependExplorerReason(explorerReasonContext);
      explorerReasonContext = "";
    }
    await loadAudit();
  } catch (_error) {
    explorerReasonContext = "";
    explorerResult.innerHTML = "<p class=\"error\">Search request failed.</p>";
  } finally {
    explorerSearchBtn.disabled = false;
    explorerSearchBtn.textContent = "Search chain";
  }
}

function renderScenarioButton(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "scenario-btn";
  button.textContent = item.name;
  button.addEventListener("click", () => {
    fillForm(item.payload);
    form.requestSubmit();
  });
  return button;
}

function setDemoItemStatus(index, state, detailsText) {
  if (!demoList) {
    return;
  }
  const item = demoList.querySelector(`[data-demo-step="${index}"]`);
  if (!item) {
    return;
  }
  const badge = item.querySelector(".demo-status");
  const detail = item.querySelector(".demo-result");
  item.classList.remove("running", "pass", "fail");
  if (state === "running") {
    item.classList.add("running");
  } else if (state === "pass") {
    item.classList.add("pass");
  } else if (state === "fail") {
    item.classList.add("fail");
  }
  if (badge) {
    badge.textContent = state === "running" ? "Running" : state === "pass" ? "Expected outcome matched" : "Mismatch";
  }
  if (detail && detailsText) {
    detail.textContent = detailsText;
    detail.classList.remove("muted");
  }
  if (!flowChecklist) {
    return;
  }
  const checkLine = flowChecklist.querySelector(`[data-check-step="${index}"]`);
  if (checkLine) {
    checkLine.classList.remove("ok", "bad", "running");
    if (state === "pass") {
      checkLine.classList.add("ok");
    } else if (state === "fail") {
      checkLine.classList.add("bad");
    } else if (state === "running") {
      checkLine.classList.add("running");
    }
    const checkState = checkLine.querySelector(".check-state");
    if (checkState) {
      checkState.textContent = state === "running" ? "Running" : state === "pass" ? "Pass" : "Mismatch";
      checkState.className = state === "pass" ? "check-state ok" : state === "fail" ? "check-state bad" : "check-state muted";
    }
  }
}

function renderDemoScript(script) {
  if (!demoList) {
    return;
  }
  demoList.innerHTML = "";
  if (flowChecklist) {
    flowChecklist.innerHTML = "";
  }
  if (flowChecklist) {
    script.forEach((step, index) => {
      const entry = document.createElement("li");
      entry.dataset.checkStep = String(index);
      entry.innerHTML = `
        <span>${index + 1}. ${step.name}</span>
        <span class="check-state muted">Pending</span>
      `;
      flowChecklist.appendChild(entry);
    });
  }
  script.forEach((step, index) => {
    const item = document.createElement("li");
    item.className = "demo-step";
    item.dataset.demoStep = String(index);
    item.innerHTML = `
      <div class="demo-step-head">
        <div>
          <strong>${step.name}</strong>
          <div class="muted">${step.expectedNote || "Expected risk behavior"}</div>
        </div>
        <span class="demo-status muted">${step.expectedGuardrail || "EXPECTED"}</span>
      </div>
      <p class="demo-expected">
        Expected: <strong>${(step.expectedLevel || "unknown").toUpperCase()}</strong>
        ${step.expectedGuardrail ? `(${step.expectedGuardrail})` : ""}
      </p>
      <p class="demo-result muted">${step.expectedAction ? `Suggested operator action: ${step.expectedAction}` : ""}</p>
      <div class="demo-step-actions">
        <button type="button" class="scenario-btn" data-step-run="${index}">Run this step</button>
      </div>
    `;
    demoList.appendChild(item);
  });

  demoList.querySelectorAll("button[data-step-run]").forEach((button) => {
    const index = Number(button.getAttribute("data-step-run"));
    button.addEventListener("click", () => runSingleDemoStep(index));
  });
}

function setDemoRunning(isRunning) {
  demoRunning = isRunning;
  if (!demoRunBtn) {
    return;
  }
  demoRunBtn.disabled = isRunning;
  demoRunBtn.textContent = isRunning ? "Running demo..." : "Run full script";
}

function disableDemoStepButtons(isDisabled) {
  demoList.querySelectorAll("button[data-step-run]").forEach((button) => {
    button.disabled = isDisabled;
  });
}

function evaluateDemoMatch(step, result) {
  if (!step || !result) {
    return false;
  }
  const expected = String(step.expectedGuardrail || "").toUpperCase();
  const observed = String(result.guardrail || "").toUpperCase();
  return expected === observed;
}

async function runSingleDemoStep(index, fromRunAll = false) {
  if (demoRunning && !fromRunAll) {
    return;
  }
  const step = demoSteps[index];
  if (!step) {
    return;
  }

  setDemoItemStatus(index, "running", "Running this scenario...");
  const item = demoList.querySelector(`[data-demo-step="${index}"]`);
  const button = item && item.querySelector("[data-step-run]");
  if (button) {
    button.disabled = true;
  }

  try {
    fillForm(step.payload);
    const result = await runAssessment(step.payload, true);
    const match = evaluateDemoMatch(step, result);
    let decisionPosted = false;

    if (step.expectedAction && result?.decisionToken) {
      const actionPayload = {
        decisionToken: result.decisionToken,
        action: step.expectedAction,
        wallet: result.wallet,
        level: result.level,
        score: result.score,
        direction: result.direction,
        reason: `Demo step auto-action: ${step.expectedAction}`
      };
      const actionResult = await postDecision(actionPayload);
      if (actionResult && actionResult.success) {
        decisionPosted = true;
      }
    }

    setDemoItemStatus(
      index,
      match ? "pass" : "fail",
      `Observed: ${result.level.toUpperCase()} - ${result.guardrail} - score ${result.score} - action ${decisionPosted ? "recorded" : "not recorded"}`
    );
    if (!fromRunAll && demoStatus) {
      demoStatus.textContent = `Step ${index + 1} complete: ${result.guardrail}`;
      demoStatus.className = "muted";
    }
  } catch (_error) {
    setDemoItemStatus(index, "fail", "Scenario failed to execute");
  } finally {
    if (button) {
      button.disabled = demoRunning;
    }
    if (!fromRunAll) {
      if (button) {
        button.disabled = false;
      }
    }
  }
}

async function runDemoScript() {
  if (!demoSteps.length || demoRunning) {
    return;
  }
  setDemoRunning(true);
  disableDemoStepButtons(true);
  if (demoStatus) {
    demoStatus.textContent = "Running scripted demo flow...";
    demoStatus.className = "muted";
  }

  for (let i = 0; i < demoSteps.length; i += 1) {
    const item = demoSteps[i];
    if (!item) {
      continue;
    }
    await runSingleDemoStep(i, true);
    if (i < demoSteps.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, DEMO_STEP_DELAY_MS));
    }
  }

  if (demoStatus) {
    demoStatus.textContent = "Full script completed. Audit trail updated.";
  }
  disableDemoStepButtons(false);
  setDemoRunning(false);
}

async function collectPayloadFromForm() {
  const walletInput = document.getElementById("wallet");
  const normalizedWallet = normalizeSolanaInput(walletInput.value);
  if (normalizedWallet.changed) {
    walletInput.value = normalizedWallet.value;
  }
  if (normalizedWallet.scope && !["wallet", "program"].includes(normalizedWallet.scope)) {
    throw new Error("Risk Check expects a wallet or address URL. Use Explorer for transaction signatures and blocks.");
  }

  const payload = {
    direction: document.getElementById("direction").value,
    wallet: normalizedWallet.value,
    amount: toNumber(document.getElementById("amount").value, 0),
    asset: document.getElementById("asset").value.trim() || "SOL"
  };

  const metadata = parseMetadata(document.getElementById("metadata").value);
  if (metadata) {
    payload.metadata = metadata;
  } else if (autoEnrichInput.checked) {
    try {
      payload.metadata = await fetchWalletContext(payload.wallet);
    } catch (_error) {
      // keep payload without metadata if enrichment fails
    }
  }

  payload.dataSource = payload.metadata ? "Sombra heuristic" : "Sombra heuristic";
  return payload;
}

async function runAssessment(payload, fromDemo = false) {
  if (!fromDemo) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Checking...";
    setStatusPanel("<p>Running heuristics and explainability checks...</p>", false, true);
  } else {
    setStatusPanel("<p>Running scripted scenario...</p>", false, true);
  }

  try {
    const response = await fetch("/api/assess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const body = await response.json();
    if (!body.success) {
      setStatusPanel(`<p class="error">${body.error}: ${body.details || ""}</p>`, true, false);
      throw new Error(body.error || "Risk check failed");
    }
    const sourcedResult = applyAssessmentSource(body.result, fromDemo);
    renderResult(sourcedResult);
    appendEvidenceActions(sourcedResult);
    pushHistory(sourcedResult);
    await loadAudit();
    return body.result;
  } catch (error) {
    if (!fromDemo) {
      statusBox.innerHTML = `<p class="error">${error.message}</p>`;
    }
    throw error;
  } finally {
    if (!fromDemo) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Run risk check";
    }
  }
}

async function checkTransaction(event) {
  event.preventDefault();
  try {
    const payload = await collectPayloadFromForm();
    await runAssessment(payload);
  } catch (error) {
    setStatusPanel(`<p class="error">Check failed: ${error.message || "Invalid input"}</p>`, true);
  }
}

async function handleLaunchContactSubmit(event) {
  event.preventDefault();
  if (!launchContactStatus) {
    return;
  }
  if (launchContactForm && typeof launchContactForm.checkValidity === "function" && !launchContactForm.checkValidity()) {
    launchContactForm.reportValidity();
    launchContactStatus.textContent = "Please fill the required fields.";
    return;
  }
  const payload = collectLaunchPayload();
  if (!payload || !payload.name || !payload.email || !payload.company || !payload.objective) {
    launchContactStatus.textContent = "Please complete all required fields to send your feedback.";
    return;
  }
  const fallback = buildLaunchLeadMailto();
  launchContactStatus.textContent = "Submitting your request...";
  try {
    await submitLaunchLead(payload);
    launchContactStatus.textContent = "Thanks - your feedback was recorded.";
    if (launchContactForm) {
      launchContactForm.reset();
    }
    return;
  } catch (_error) {
    if (fallback) {
      window.location.href = fallback;
      launchContactStatus.textContent = "Opening your email client with a prefilled request.";
      if (launchContactForm) {
        launchContactForm.reset();
      }
      return;
    }
    launchContactStatus.textContent = "Request submission failed. Please try again in a moment.";
  }
}

async function loadPresets() {
  try {
    const response = await fetch("/api/presets");
    const body = await response.json();
    if (!body.success) {
      return;
    }
    scenarioList.innerHTML = "";
    body.presets.forEach((preset) => {
      scenarioList.appendChild(renderScenarioButton(preset));
    });
  } catch (_error) {
    scenarioList.innerHTML = "<p class=\"muted\">Unable to load presets right now.</p>";
  }
}

async function loadDemoScript() {
  try {
    const response = await fetch("/api/demo-script");
    const body = await response.json();
    if (body && body.success && Array.isArray(body.script) && body.script.length) {
      demoSteps = body.script;
      renderDemoScript(demoSteps);
      return;
    }
    throw new Error("No script found");
  } catch (_error) {
    demoSteps = FALLBACK_DEMO_SCRIPT;
    renderDemoScript(demoSteps);
  }
}

async function enrichCurrentWallet() {
  const walletInput = document.getElementById("wallet");
  const normalizedWallet = normalizeSolanaInput(walletInput.value);
  if (normalizedWallet.changed) {
    walletInput.value = normalizedWallet.value;
  }
  if (normalizedWallet.scope && !["wallet", "program"].includes(normalizedWallet.scope)) {
    setStatusPanel("<p class=\"error\">Fetch Context expects a wallet or address URL. Use Explorer for transaction signatures and blocks.</p>", true, false);
    return;
  }
  const wallet = normalizedWallet.value;
  if (!wallet) {
    setStatusPanel("<p class=\"error\">Enter a wallet first to fetch context.</p>", true, false);
    return;
  }

  enrichBtn.disabled = true;
  const originalText = enrichBtn.textContent;
  enrichBtn.textContent = "Fetching...";
  try {
    const metadata = await fetchWalletContext(wallet);
    fillMetadata(metadata);
    setStatusPanel("<p>Wallet context loaded.</p>");
  } catch (error) {
    setStatusPanel(`<p class="error">Enrichment failed: ${error.message}</p>`, true);
  } finally {
    enrichBtn.disabled = false;
    enrichBtn.textContent = originalText;
  }
}

async function loadAudit() {
  try {
    const response = await fetch("/api/audit");
    const body = await response.json();
    if (!body.success) {
      auditBox.innerHTML = '<p class="muted">Unable to read audit events.</p>';
      return;
    }
    if (!body.events.length) {
      auditBox.innerHTML = '<p class="muted">No audit events yet.</p>';
      return;
    }
    auditBox.innerHTML = body.events.map(formatAuditEvent).join("");
  } catch (_error) {
    auditBox.innerHTML = '<p class="muted">Unable to read audit events.</p>';
  }
}

async function clearAudit() {
  try {
    const response = await fetch("/api/audit?confirm=true", {
      method: "DELETE"
    });
    const body = await response.json();
    if (!body.success) {
      auditBox.innerHTML = `<p class="error">Clear failed: ${body.error || "unknown"}</p>`;
      return;
    }
    auditBox.innerHTML = "<p class=\"muted\">Audit cleared.</p>";
  } catch (_error) {
    auditBox.innerHTML = "<p class=\"error\">Unable to clear audit.</p>";
  }
}

async function exportAudit(format) {
  try {
    const response = await fetch(`/api/audit/export?format=${encodeURIComponent(format)}`);
    if (!response.ok) {
      throw new Error("Unable to export audit");
    }
    const blob = await response.blob();
    const fileName = format === "csv"
      ? `sombra-audit-${Date.now()}.csv`
      : `sombra-audit-${Date.now()}.json`;
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl);
  } catch (_error) {
    auditBox.innerHTML = "<p class=\"error\">Export failed. Retry in a moment.</p>";
  }
}

async function postDecision(payload) {
  try {
    const response = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return await response.json();
  } catch (_error) {
    return { success: false, error: "Network issue" };
  }
}

form.addEventListener("submit", checkTransaction);
enrichBtn.addEventListener("click", enrichCurrentWallet);
refreshAuditBtn.addEventListener("click", loadAudit);
clearAuditBtn.addEventListener("click", clearAudit);
exportAuditJsonBtn.addEventListener("click", () => exportAudit("json"));
exportAuditCsvBtn.addEventListener("click", () => exportAudit("csv"));
if (explorerSearchBtn) {
  explorerSearchBtn.addEventListener("click", runExplorerSearch);
}
if (explorerQuery) {
  explorerQuery.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      runExplorerSearch();
    }
  });
}
if (explorerResult) {
  explorerResult.addEventListener("click", async (event) => {
    if (await handleCopyButtonClick(event)) {
      return;
    }
    const promoteButton = event.target.closest("[data-promote-explorer-evidence]");
    if (promoteButton) {
      const originalText = promoteButton.textContent;
      promoteButton.disabled = true;
      promoteButton.textContent = "Recording...";
      try {
        await promoteExplorerEvidence();
        promoteButton.textContent = "Recorded as evidence";
      } catch (error) {
        promoteButton.textContent = "Failed";
        explorerResult.insertAdjacentHTML("afterbegin", `<p class="error">Audit write failed: ${escapeHtml(error.message)}</p>`);
      } finally {
        setTimeout(() => {
          promoteButton.disabled = false;
          promoteButton.textContent = originalText;
        }, 1400);
      }
      return;
    }
    const shortcut = event.target.closest(".explorer-shortcut");
    if (!shortcut) {
      return;
    }
    const query = shortcut.getAttribute("data-shortcut");
    if (!query) {
      return;
    }
    openExplorerQuery(query, shortcut.getAttribute("data-scope") || "auto");
  });
}
if (explorerShortcuts) {
  explorerShortcuts.addEventListener("click", async (event) => {
    if (await handleCopyButtonClick(event)) {
      return;
    }
    const target = event.target;
    const shortcut = target.closest(".explorer-shortcut");
    if (!shortcut) {
      return;
    }
    const query = shortcut.getAttribute("data-shortcut");
    if (!query) {
      return;
    }
    openExplorerQuery(query, "wallet");
  });
}
if (explorerStream) {
  explorerStream.addEventListener("click", async (event) => {
    if (await handleCopyButtonClick(event)) {
      return;
    }
    const row = event.target.closest(".explorer-stream-row");
    if (!row) {
      return;
    }
    openExplorerQuery(row.getAttribute("data-query"), row.getAttribute("data-scope"));
  });
  explorerStream.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    const row = event.target.closest(".explorer-stream-row");
    if (!row) {
      return;
    }
    event.preventDefault();
    openExplorerQuery(row.getAttribute("data-query"), row.getAttribute("data-scope"));
  });
}
if (explorerRefreshBtn) {
  explorerRefreshBtn.addEventListener("click", () => {
    loadExplorerStats();
    loadExplorerStream();
  });
}
if (liveTransactionSampleBtn) {
  liveTransactionSampleBtn.addEventListener("click", async () => {
    if (!explorerResult) {
      return;
    }
    const originalText = liveTransactionSampleBtn.textContent;
    liveTransactionSampleBtn.disabled = true;
    liveTransactionSampleBtn.textContent = "Finding live sample...";
    explorerResult.innerHTML = '<p class="muted">Fetching a recent finalized transaction from live Solana RPC...</p>';
    try {
      const response = await fetch(`/api/explorer/live-transaction-sample?t=${Date.now()}`, { cache: "no-store" });
      const body = await response.json();
      if (!body.success) {
        explorerResult.innerHTML = renderExplorerMiss({
          error: body.error || "No recent live transaction found.",
          scope: body.scope || "tx",
          suggestions: body.suggestions || []
        });
        return;
      }
      const signature = body.result?.signature || body.result?.id || "";
      if (explorerQuery && signature) {
        explorerQuery.value = signature;
      }
      if (explorerScope) {
        explorerScope.value = "tx";
      }
      renderExplorerResult(body.result || {});
      await loadAudit();
    } catch (_error) {
      const fallbackSignature = liveTransactionSampleBtn.getAttribute("data-live-tx");
      explorerResult.innerHTML = renderExplorerMiss({
        error: "Live sample request failed. Falling back to the bundled sample signature.",
        scope: "tx",
        suggestions: fallbackSignature ? [fallbackSignature] : []
      });
    } finally {
      liveTransactionSampleBtn.disabled = false;
      liveTransactionSampleBtn.textContent = originalText;
    }
  });
}
if (explorerStreamRefreshBtn) {
  explorerStreamRefreshBtn.addEventListener("click", loadExplorerStream);
}
demoRunBtn.addEventListener("click", runDemoScript);
if (demoToggle) {
  demoToggle.addEventListener("change", (event) => {
    applyDemoMode(event.currentTarget.checked, true);
  });
}
if (launchContactForm) {
  launchContactForm.addEventListener("submit", handleLaunchContactSubmit);
}

if (statusBox) {
  statusBox.addEventListener("click", async (event) => {
    if (await handleCopyButtonClick(event)) {
      return;
    }
    if (event.target.closest("[data-evidence-download]")) {
      downloadEvidence(latestEvidenceResult);
    }
  });
}

if (explorerStats) {
  explorerStats.addEventListener("click", async (event) => {
    if (await handleCopyButtonClick(event)) {
      return;
    }
    const row = event.target.closest("[data-explorer-rank]");
    if (!row) {
      return;
    }
    const query = row.getAttribute("data-explorer-rank");
    if (!query) {
      return;
    }
    const reason = row.getAttribute("data-explorer-rank-reason") || "";
    const level = row.getAttribute("data-explorer-rank-level") || "";
    const score = row.getAttribute("data-explorer-rank-score") || "";
    const source = row.getAttribute("data-explorer-rank-source") || "";
    showExplorerRankReason({
      query,
      level,
      score,
      source,
      reasonText: reason
    });
    openExplorerQuery(query, "wallet", reason);
  });
}

initDemoMode();

loadPresets();
loadDemoScript();
renderHistory();
loadExplorerStats();
loadExplorerStream();
loadAudit();

setInterval(() => {
  loadExplorerStream();
}, EXPLORER_STREAM_REFRESH_INTERVAL_MS);
setInterval(() => {
  loadExplorerStats();
}, EXPLORER_STATS_REFRESH_INTERVAL_MS);

function setWorkflowPanel(panelName) {
  const selected = String(panelName || "risk");
  document.querySelectorAll("[data-workflow-tab]").forEach((tab) => {
    const active = tab.getAttribute("data-workflow-tab") === selected;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  document.querySelectorAll("[data-workflow-panel]").forEach((panel) => {
    panel.classList.toggle("is-active", panel.getAttribute("data-workflow-panel") === selected);
  });
}

document.querySelectorAll("[data-workflow-tab]").forEach((tab) => {
  tab.addEventListener("click", () => {
    setWorkflowPanel(tab.getAttribute("data-workflow-tab"));
  });
});

if (explorerSearchBtn) {
  explorerSearchBtn.addEventListener("click", () => {
    const output = document.getElementById("investigation-output");
    if (output) {
      output.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

if (explorerStream) {
  explorerStream.addEventListener("click", () => {
    const output = document.getElementById("investigation-output");
    if (output) {
      output.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function explorerValue(value, fallback = "n/a") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  return value;
}

function explorerTimestamp(value) {
  if (value === undefined || value === null || value === "") {
    return "n/a";
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return value;
  }
  const ms = numeric > 1000000000000 ? numeric : numeric * 1000;
  return new Date(ms).toLocaleString();
}

function explorerRiskLevel(tx) {
  const direct = String(tx.riskLevel || tx.level || "").toLowerCase();
  if (["low", "medium", "high", "critical", "safe"].includes(direct)) {
    return direct;
  }
  const score = Number(tx.riskScore ?? tx.score);
  if (!Number.isFinite(score)) {
    return "unknown";
  }
  if (score >= 90) return "critical";
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function explorerRecommendation(tx) {
  const direct = tx.recommendation || tx.guardrail;
  if (direct) {
    return direct;
  }
  const level = explorerRiskLevel(tx);
  if (level === "critical") return "BLOCK";
  if (level === "high") return "CUE_REVIEW";
  if (level === "medium") return "ALLOW_WITH_MONITORING";
  if (level === "low" || level === "safe") return "ALLOW";
  return "REVIEW";
}

function explorerRiskSignals(tx) {
  if (Array.isArray(tx.riskReasons) && tx.riskReasons.length) {
    return tx.riskReasons;
  }
  if (Array.isArray(tx.riskTags) && tx.riskTags.length) {
    return tx.riskTags;
  }
  if (Array.isArray(tx.signals) && tx.signals.length) {
    return tx.signals.map(normalizeSignalText).filter(Boolean);
  }
  return [];
}

function renderExplorerFact(label, value, copyValue = "") {
  const safeValue = explorerValue(value);
  return `
    <div class="explorer-fact">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(safeValue)}</strong>
      ${copyValue ? renderCopyButton("Copy", copyValue) : ""}
    </div>
  `;
}

function renderExplorerTxOverview(tx) {
  const sourceLabel = getReadableDataSource(tx.dataSource || tx.source || tx.contextSource);
  const transferText = tx.explicitTransfer
    ? `${explorerValue(tx.amount)} ${explorerValue(tx.asset, "")}`.trim()
    : `No parsed token/SOL transfer. Largest SOL delta: ${explorerValue(tx.largestSolDelta)} SOL`;
  return `
    <section class="explorer-card explorer-overview-card">
      <div class="explorer-card-head">
        <div>
          <p class="eyebrow">Overview</p>
          <h4>${escapeHtml(compactAddress(tx.id || tx.signature || tx.query || "", 10))}</h4>
        </div>
        <span class="truth-label">${escapeHtml(sourceLabel)}</span>
      </div>
      <div class="explorer-fact-grid">
        ${renderExplorerFact("Signature", tx.id || tx.signature, tx.id || tx.signature)}
        ${renderExplorerFact("Status", tx.status || tx.confirmationStatus)}
        ${renderExplorerFact("Slot", tx.slot)}
        ${renderExplorerFact("Block", tx.block)}
        ${renderExplorerFact("Timestamp", explorerTimestamp(tx.blockTime))}
        ${renderExplorerFact("Version", tx.version)}
        ${renderExplorerFact("Fee", tx.fee !== undefined ? `${tx.fee} SOL` : "")}
        ${renderExplorerFact("Compute units", tx.computeUnitsConsumed)}
        ${renderExplorerFact("Cost units", tx.costUnits)}
        ${renderExplorerFact("Recent blockhash", tx.recentBlockhash, tx.recentBlockhash)}
        ${renderExplorerFact("Transfer", transferText)}
      </div>
    </section>
  `;
}

function renderExplorerTxRiskNotes(tx) {
  const riskLevel = explorerRiskLevel(tx);
  const recommendation = explorerRecommendation(tx);
  const signals = explorerRiskSignals(tx);
  return `
    <section class="explorer-card explorer-risk-card">
      <div class="explorer-card-head">
        <div>
          <p class="eyebrow">Risk notes</p>
          <h4>${escapeHtml(String(riskLevel).toUpperCase())}</h4>
        </div>
        <span class="risk-chip ${streamRiskClass[riskLevel] || "risk-medium"}">Score ${escapeHtml(tx.riskScore ?? tx.score ?? "n/a")}</span>
      </div>
      <div class="explorer-fact-grid compact">
        ${renderExplorerFact("Recommendation", recommendation)}
        ${renderExplorerFact("Heuristic basis", signals.length ? `${signals.length} signal(s)` : "No high-risk signals")}
      </div>
      ${
        signals.length
          ? `<ul class="reason-list">${signals.map((signal) => `<li>${escapeHtml(signal)}</li>`).join("")}</ul>`
          : '<p class="muted">No abnormal risk signals returned for this transaction.</p>'
      }
    </section>
  `;
}

function renderExplorerTxAccounts(tx) {
  const accounts = Array.isArray(tx.accountInputs) ? tx.accountInputs : [];
  const rows = accounts.length
    ? accounts.map((account) => `
      <tr>
        <td>${escapeHtml(account.index)}</td>
        <td><code>${escapeHtml(compactAddress(account.address, 8))}</code> ${renderCopyButton("Copy", account.address)}</td>
        <td>${escapeHtml(explorerValue(account.change))} SOL</td>
        <td>${escapeHtml(explorerValue(account.postBalance))} SOL</td>
        <td>${account.signer ? "Signer " : ""}${account.writable ? "Writable" : "Readonly"}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">No account inputs returned.</td></tr>';
  return `
    <section class="explorer-card">
      <div class="explorer-card-head">
        <div>
          <p class="eyebrow">Account inputs</p>
          <h4>${accounts.length} account${accounts.length === 1 ? "" : "s"}</h4>
        </div>
      </div>
      <div class="tx-table-wrap">
        <table class="tx-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Address</th>
              <th>Change</th>
              <th>Post balance</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderExplorerTxInstructions(tx) {
  const instructions = Array.isArray(tx.instructions) ? tx.instructions : [];
  const innerGroups = Array.isArray(tx.innerInstructions) ? tx.innerInstructions : [];
  const rendered = instructions.length
    ? instructions.map((instruction) => `
      <article class="tx-instruction">
        <div class="tx-instruction-head">
          <strong>#${escapeHtml(instruction.index)} ${escapeHtml(instruction.programName || "Unknown program")}</strong>
          <span class="tx-instruction-meta">${escapeHtml(explorerValue(instruction.parsedType || "raw instruction"))}</span>
        </div>
        <p><strong>Program:</strong> <code>${escapeHtml(instruction.programId || "")}</code> ${instruction.programId ? renderCopyButton("Copy", instruction.programId) : ""}</p>
        <p><strong>Accounts:</strong> ${escapeHtml(explorerValue(instruction.accountCount, 0))}</p>
        ${instruction.data ? `<p><strong>Data:</strong> <code>${escapeHtml(shortText(instruction.data, 180))}</code></p>` : ""}
      </article>
    `).join("")
    : '<p class="muted">No instruction data returned.</p>';
  return `
    <section class="explorer-card">
      <div class="explorer-card-head">
        <div>
          <p class="eyebrow">Instructions</p>
          <h4>${instructions.length} outer / ${innerGroups.length} inner group${innerGroups.length === 1 ? "" : "s"}</h4>
        </div>
      </div>
      <div class="tx-instruction-list">${rendered}</div>
    </section>
  `;
}

function renderExplorerTxLogs(tx) {
  const logs = Array.isArray(tx.logMessages) ? tx.logMessages : [];
  const logItems = logs.length
    ? logs.slice(0, 16).map((log) => `<li><code>${escapeHtml(log)}</code></li>`).join("")
    : '<li><code>No program logs returned.</code></li>';
  return `
    <section class="explorer-card">
      <div class="explorer-card-head">
        <div>
          <p class="eyebrow">Program logs</p>
          <h4>${logs.length} log line${logs.length === 1 ? "" : "s"}</h4>
        </div>
      </div>
      <ul class="tx-log-list">${logItems}</ul>
    </section>
  `;
}

function renderExplorerTransaction(tx) {
  return `
    <div class="explorer-transaction-view">
      <div class="explorer-title-row">
        <div>
          <p class="eyebrow">Transaction</p>
          <h3>${escapeHtml(compactAddress(tx.id || tx.signature || tx.query || "Unknown transaction", 12))}</h3>
        </div>
        ${renderCopyButton("Copy signature", tx.id || tx.signature || "")}
      </div>
      <div class="explorer-section-stack">
        ${renderExplorerTxOverview(tx)}
        ${renderExplorerTxRiskNotes(tx)}
        ${renderExplorerTxAccounts(tx)}
        ${renderExplorerTxInstructions(tx)}
        ${renderExplorerTxLogs(tx)}
      </div>
    </div>
  `;
}



