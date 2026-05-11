const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {
  assessTransactionRisk,
  listPresets,
  listDemoScript,
  enrichWalletForDemo
} = require("./riskEngine");

const cliPortArg = process.argv.find((arg) => arg.startsWith("--port="));
const PORT = Number(process.env.PORT) || (cliPortArg ? Number(cliPortArg.split("=")[1]) : 4000);
const PUBLIC_DIR = path.join(__dirname, "..", "public");
const AUDIT_LOG = path.join(__dirname, "audit-log.jsonl");
const LEADS_LOG = path.join(__dirname, "leads.jsonl");
const SUPABASE_URL = normalizeEnvValue(process.env.SUPABASE_SERVER_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
const SUPABASE_SERVICE_ROLE_KEY = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
const SUPABASE_AUDIT_TABLE = normalizeEnvValue(process.env.SUPABASE_AUDIT_TABLE) || "sombra_audit_events";
const SUPABASE_FEEDBACK_TABLE = normalizeEnvValue(process.env.SUPABASE_FEEDBACK_TABLE) || "sombra_feedback";
const VALID_ACTIONS = new Set(["sign", "proceed", "override"]);
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const SOLANA_LIVE_EXPLORER = String(process.env.SOLANA_LIVE_EXPLORER || "true").toLowerCase() !== "false";
const SOLANA_RPC_TIMEOUT_MS = Number(process.env.SOLANA_RPC_TIMEOUT_MS || "8000");

const SOLANA_EXPLORER_WALLETS = [
  {
    address: "B7xC2R9wJ4q5K7g4P2x6M1t9hL3s8vQ5wF9k8V7",
    label: "Payroll / payroll treasury",
    riskLevel: "low",
    riskScore: 21,
    txCount24h: 18,
    balance: 4127.32,
    primaryAsset: "SOL",
    flags: ["Stable tx cadence", "Established age"],
    activeDays: 420
  },
  {
    address: "C1xQ2R9kL4m8tS3vW6p1YhQ9nJ7xF2dM5kV4s8R",
    label: "OTC / high churn counterparty",
    riskLevel: "high",
    riskScore: 77,
    txCount24h: 150,
    balance: 240.91,
    primaryAsset: "SOL",
    flags: ["Inconsistent counterparties", "Flow concentration"],
    activeDays: 16
  },
  {
    address: "G3r6PqJqJ2m8bV6zFJ3Yh2h7M4QkQ8Jk9Lq4k9",
    label: "Watchlist cluster",
    riskLevel: "critical",
    riskScore: 96,
    txCount24h: 820,
    balance: 1.02,
    primaryAsset: "USDC",
    flags: ["Sanction-style metadata", "Mixer-like churn"],
    activeDays: 2
  },
  {
    address: "5rY8P2mV2dQj3kzA5qYd4tN2Vt8K8c2N5gD7vL9M",
    label: "Liquidity relay",
    riskLevel: "medium",
    riskScore: 55,
    txCount24h: 62,
    balance: 910.18,
    primaryAsset: "SOL",
    flags: ["Exchange-style bursts", "Counterparty mix"],
    activeDays: 110
  }
];

const SOLANA_PROGRAMS = [
  {
    programId: "11111111111111111111111111111111",
    name: "System Program",
    category: "Core runtime",
    instructions: 12,
    description: "Native account creation and transfers for Solana transactions."
  },
  {
    programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    name: "Token Program",
    category: "Assets",
    instructions: 29,
    description: "Token mint, transfer, and authority operations."
  },
  {
    programId: "ATokenGPvbdGVxr1b2KhKMq2JwYq5y5jL6fR5Q3w",
    name: "Associated Token Program",
    category: "Assets",
    instructions: 16,
    description: "Associated token account creation and validation."
  }
];

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getContentType(filePath) {
  if (filePath.endsWith(".html")) {
    return "text/html; charset=utf-8";
  }
  if (filePath.endsWith(".css")) {
    return "text/css; charset=utf-8";
  }
  if (filePath.endsWith(".js")) {
    return "application/javascript; charset=utf-8";
  }
  if (filePath.endsWith(".svg")) {
    return "image/svg+xml; charset=utf-8";
  }
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".png")) {
    return "image/png";
  }
  return "text/plain; charset=utf-8";
}

function sendJson(res, statusCode, body) {
  res.statusCode = statusCode;
  setCorsHeaders(res);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.end(JSON.stringify(body));
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8", fileName = "") {
  res.statusCode = statusCode;
  setCorsHeaders(res);
  res.setHeader("Content-Type", contentType);
  if (fileName) {
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  }
  res.end(body);
}

function send404(res, message = "Not Found") {
  res.statusCode = 404;
  setCorsHeaders(res);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

function sendFileOr404(res, filePath) {
  try {
    const body = fs.readFileSync(filePath);
    res.statusCode = 200;
    setCorsHeaders(res);
    res.setHeader("Content-Type", getContentType(filePath));
    if (filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
    res.end(body);
  } catch (_error) {
    send404(res, "Not Found");
  }
}

function safeNumber(value, fallback) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function csvEscape(value) {
  const raw = value === undefined || value === null ? "" : String(value);
  return `"${raw.replace(/"/g, "\"\"")}"`;
}

function isLikelyWallet(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
}

function isLikelyTx(value) {
  return /^[1-9A-HJ-NP-Za-km-z]{30,100}$/.test(value);
}

function isNumeric(value) {
  return /^\d+$/.test(value);
}

async function callSolanaRpc(method, params = []) {
  if (!SOLANA_RPC_URL) {
    return { success: false, error: "SOLANA_RPC_URL not configured" };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, Number.isFinite(SOLANA_RPC_TIMEOUT_MS) ? SOLANA_RPC_TIMEOUT_MS : 8000);
  try {
    const response = await fetch(SOLANA_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `sombra-${Date.now()}`,
        method,
        params
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      return { success: false, error: `RPC HTTP ${response.status}` };
    }
    const body = await response.json();
    if (body.error) {
      return {
        success: false,
        error: body.error.message || "RPC error"
      };
    }
    return { success: true, result: body.result };
  } catch (error) {
    return { success: false, error: error.message || "RPC request failed" };
  } finally {
    clearTimeout(timeout);
  }
}

function lamportsToSol(lamports, decimals = 6) {
  const value = Number(lamports);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number((value / 1_000_000_000).toFixed(decimals));
}

function accountKeyToString(accountKey) {
  if (!accountKey) {
    return "";
  }
  if (typeof accountKey === "string") {
    return accountKey;
  }
  if (typeof accountKey.pubkey === "string") {
    return accountKey.pubkey;
  }
  if (accountKey.pubkey && typeof accountKey.pubkey.toString === "function") {
    return accountKey.pubkey.toString();
  }
  return String(accountKey);
}

function getTransactionAccountKeys(tx) {
  const accountKeys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(accountKeys)) {
    return [];
  }
  return accountKeys.map(accountKeyToString).filter(Boolean);
}

function getTransactionAccountInputs(tx) {
  const accountKeys = tx?.transaction?.message?.accountKeys;
  if (!Array.isArray(accountKeys)) {
    return [];
  }
  const preBalances = Array.isArray(tx?.meta?.preBalances) ? tx.meta.preBalances : [];
  const postBalances = Array.isArray(tx?.meta?.postBalances) ? tx.meta.postBalances : [];
  return accountKeys.map((accountKey, index) => {
    const address = accountKeyToString(accountKey);
    const preLamports = Number(preBalances[index] || 0);
    const postLamports = Number(postBalances[index] || 0);
    return {
      index: index + 1,
      address,
      signer: Boolean(accountKey && typeof accountKey === "object" && accountKey.signer),
      writable: Boolean(accountKey && typeof accountKey === "object" && accountKey.writable),
      source: accountKey && typeof accountKey === "object" ? accountKey.source || "transaction" : "transaction",
      preBalance: lamportsToSol(preLamports, 9),
      postBalance: lamportsToSol(postLamports, 9),
      change: lamportsToSol(postLamports - preLamports, 9)
    };
  });
}

function getTransactionInstructions(tx) {
  const instructions = tx?.transaction?.message?.instructions;
  return Array.isArray(instructions) ? instructions : [];
}

function knownProgramName(programId) {
  if (programId === "11111111111111111111111111111111") {
    return "System Program";
  }
  if (programId === "ComputeBudget111111111111111111111111111111") {
    return "Compute Budget Program";
  }
  const known = SOLANA_PROGRAMS.find((entry) => entry.programId === programId);
  return known ? known.name : compactAddress(programId, 6);
}

function serializeInstruction(instruction, index) {
  const programId = accountKeyToString(instruction?.programId) || "unknown";
  const accounts = Array.isArray(instruction?.accounts)
    ? instruction.accounts.map(accountKeyToString).filter(Boolean)
    : [];
  return {
    index: index + 1,
    programId,
    programName: knownProgramName(programId),
    parsedType: instruction?.parsed?.type || "",
    accounts,
    accountCount: accounts.length,
    data: instruction?.data || "",
    stackHeight: instruction?.stackHeight || null
  };
}

function serializeInnerInstructions(tx) {
  const groups = Array.isArray(tx?.meta?.innerInstructions) ? tx.meta.innerInstructions : [];
  return groups.map((group) => ({
    index: Number(group.index),
    instructions: Array.isArray(group.instructions)
      ? group.instructions.map((instruction, index) => serializeInstruction(instruction, index))
      : []
  }));
}

function getParsedTransfer(tx) {
  const instructions = getTransactionInstructions(tx);
  for (const instruction of instructions) {
    const parsed = instruction && instruction.parsed;
    const info = parsed && parsed.info;
    if (!info || !parsed.type) {
      continue;
    }
    if (parsed.type === "transfer" && info.lamports !== undefined) {
      return {
        source: info.source || "",
        destination: info.destination || "",
        amount: lamportsToSol(info.lamports),
        asset: "SOL"
      };
    }
    if ((parsed.type === "transfer" || parsed.type === "transferChecked") && info.tokenAmount) {
      return {
        source: info.source || info.authority || "",
        destination: info.destination || "",
        amount: info.tokenAmount.uiAmountString || info.tokenAmount.uiAmount || info.amount || "n/a",
        asset: info.mint ? compactAddress(info.mint, 5) : "token"
      };
    }
  }
  return null;
}

function summarizeSolDelta(tx) {
  const preBalances = Array.isArray(tx?.meta?.preBalances) ? tx.meta.preBalances : [];
  const postBalances = Array.isArray(tx?.meta?.postBalances) ? tx.meta.postBalances : [];
  if (!preBalances.length || !postBalances.length) {
    return null;
  }
  let maxDelta = 0;
  for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i += 1) {
    const delta = Math.abs(Number(postBalances[i] || 0) - Number(preBalances[i] || 0));
    if (delta > maxDelta) {
      maxDelta = delta;
    }
  }
  if (!maxDelta) {
    return null;
  }
  return {
    amount: lamportsToSol(maxDelta),
    asset: "SOL"
  };
}

function getTransferDisplay(tx) {
  const parsedTransfer = getParsedTransfer(tx);
  if (parsedTransfer) {
    return {
      ...parsedTransfer,
      isExplicitTransfer: true
    };
  }
  const delta = summarizeSolDelta(tx);
  return {
    source: "",
    destination: "",
    amount: "n/a",
    asset: "",
    isExplicitTransfer: false,
    largestSolDelta: delta ? delta.amount : 0
  };
}

async function exploreWalletFromRpc(address) {
  const balanceRes = await callSolanaRpc("getBalance", [address, { commitment: "finalized" }]);
  if (!balanceRes.success) {
    return null;
  }

  const signaturesRes = await callSolanaRpc("getSignaturesForAddress", [address, { limit: 8 }]);
  const signatureList = Array.isArray(signaturesRes?.result) ? signaturesRes.result : [];
  const failCount = signatureList.filter((entry) => entry.err).length;
  const latestBlock = signatureList.length ? Number(signatureList[0].slot) : null;
  const oldestBlock = signatureList.length ? Number(signatureList[signatureList.length - 1].slot) : latestBlock;
  const ageDays = latestBlock && oldestBlock ? Math.max(1, Math.floor((latestBlock - oldestBlock) / 720)) : 14;
  const baseRisk = Math.min(100, Math.floor((ageDays < 30 ? 45 : 10) + failCount * 12 + signatureList.length * 4));

  const recentSamples = [];
  for (const entry of signatureList.slice(0, 3)) {
    const txRes = await callSolanaRpc("getTransaction", [entry.signature, {
      encoding: "jsonParsed",
      maxSupportedTransactionVersion: 0,
      commitment: "finalized"
    }]);
    if (!txRes.success || !txRes.result) {
      continue;
    }
    const tx = txRes.result;
    const accountKeys = getTransactionAccountKeys(tx);
    const transfer = getTransferDisplay(tx);
    const from = transfer.source || accountKeys[0] || "unknown";
    const to = transfer.destination || accountKeys[1] || "unknown";
    recentSamples.push({
      type: tx.meta?.err ? "failed" : "tx",
      amount: transfer.amount !== undefined ? transfer.amount : "n/a",
      asset: transfer.asset || "SOL",
      explicitTransfer: Boolean(transfer.isExplicitTransfer),
      signature: entry.signature,
      counterparty: compactAddress(to),
      slot: entry.slot,
      blockTime: entry.blockTime || null
    });
  }

  const wallet = {
    type: "wallet",
    address,
    label: "RPC wallet profile",
    riskLevel: baseRisk >= 80 ? "critical" : baseRisk >= 62 ? "high" : baseRisk >= 35 ? "medium" : "low",
    riskScore: baseRisk,
    txCount24h: signatureList.length,
    balance: lamportsToSol(balanceRes.result.value),
    primaryAsset: "SOL",
    flags: failCount ? ["Recent failed transactions"] : ["Live on Solana"],
    activeDays: ageDays,
    metadata: {
      ageDays,
      txCount24h: signatureList.length,
      uniqueCounterparties: Math.max(1, Math.round(signatureList.length * 0.75)),
      failRate: signatureList.length ? Number((failCount / signatureList.length).toFixed(2)) : 0,
      mixingScore: failCount ? 0.58 : 0.2,
      sanctionsHit: false,
      exchangeFlow: signatureList.length >= 7
    },
    recommendation: baseRisk >= 80 ? "BLOCK" : baseRisk >= 62 ? "CUE_REVIEW" : "ALLOW",
    recentTransactions: recentSamples
  };
  wallet.riskReasons = explainWalletRisk(wallet);
  wallet.dataSource = "Live Solana RPC (getBalance, getSignaturesForAddress, getTransaction) + Sombra heuristic";
  return wallet;
}

async function exploreTransactionFromRpc(signature) {
  const txRes = await callSolanaRpc("getTransaction", [signature, {
    encoding: "jsonParsed",
    maxSupportedTransactionVersion: 0,
    commitment: "finalized"
  }]);
  if (!txRes.success || !txRes.result) {
    return null;
  }
  const tx = txRes.result;
  const accountKeys = getTransactionAccountKeys(tx);
  const accountInputs = getTransactionAccountInputs(tx);
  const instructions = getTransactionInstructions(tx);
  const transfer = getTransferDisplay(tx);
  const fee = lamportsToSol(tx.meta?.fee || 0, 9);
  const logCount = Array.isArray(tx.meta?.logMessages) ? tx.meta.logMessages.length : 0;
  const riskScore = Math.min(100, Math.floor((fee * 100) + (logCount * 4) + (tx.meta?.err ? 35 : 5)));
  const riskLevel = riskScore >= 90 ? "critical" : riskScore >= 70 ? "high" : riskScore >= 35 ? "medium" : "low";
  const recommendation = riskScore >= 90 ? "BLOCK" : riskScore >= 70 ? "CUE_REVIEW" : "ALLOW";
  const riskReasons = riskScore >= 90
    ? ["failed transaction or unusually heavy execution profile", "manual compliance review required before relying on this counterparty"]
    : riskScore >= 70
      ? ["elevated log volume or compute profile relative to a simple transfer", "record evidence and review program activity before funds move"]
      : ["no abnormal fee, failure, or execution signal exceeded the current heuristic threshold"];
  return {
    type: "tx",
    signature,
    status: tx.meta?.err ? "failed" : "finalized",
    confirmationStatus: "finalized",
    confirmations: "max",
    slot: Number(tx.slot || 0),
    block: Number(tx.slot || 0),
    blockTime: tx.blockTime || null,
    from: transfer.source || accountKeys[0] || "unknown",
    to: transfer.destination || accountKeys[1] || "unknown",
    amount: transfer.amount !== undefined ? transfer.amount : "n/a",
    asset: transfer.asset || "",
    explicitTransfer: Boolean(transfer.isExplicitTransfer),
    largestSolDelta: transfer.largestSolDelta || 0,
    fee,
    computeUnitsConsumed: tx.meta?.computeUnitsConsumed || null,
    costUnits: tx.meta?.costUnits || null,
    recentBlockhash: tx.transaction?.message?.recentBlockhash || "",
    version: tx.version === undefined ? "legacy" : String(tx.version),
    instructionCount: instructions.length,
    accountCount: accountKeys.length,
    accountInputs,
    instructions: instructions.map((instruction, index) => serializeInstruction(instruction, index)),
    innerInstructions: serializeInnerInstructions(tx),
    logMessages: Array.isArray(tx.meta?.logMessages) ? tx.meta.logMessages : [],
    riskScore,
    riskLevel,
    dataSource: "Live Solana RPC (getTransaction) + Sombra fee/log heuristic",
    recommendation,
    riskReasons,
    riskTags: riskReasons
  };
}

async function exploreBlockFromRpc(slot) {
  const blockRes = await callSolanaRpc("getBlock", [Number(slot), { encoding: "json", transactionDetails: "signatures", rewards: false }]);
  if (!blockRes.success || !blockRes.result) {
    return null;
  }
  const block = blockRes.result;
  const leaderRes = await callSolanaRpc("getSlotLeaders", [Number(slot), 1]);
  const leader = Array.isArray(leaderRes.result) && leaderRes.result.length ? leaderRes.result[0] : "n/a";
  const now = Date.now();
  const blockAgeSec = block.blockTime ? Math.max(0, Math.floor((now / 1000) - block.blockTime)) : null;
  const txCount = Array.isArray(block.transactions)
    ? block.transactions.length
    : Array.isArray(block.signatures)
      ? block.signatures.length
      : 0;
  return {
    type: "block",
    slot: Number(slot),
    status: "Finalized",
    dataSource: "Live Solana RPC (getBlock, getSlotLeaders)",
    leader,
    txCount,
    hash: block.blockhash || "n/a",
    parentSlot: block.parentSlot,
    previousBlockhash: block.previousBlockhash || "n/a",
    blockTime: block.blockTime || null,
    age: blockAgeSec === null ? "n/a" : `${blockAgeSec}s ago`,
    totalFees: "n/a"
  };
}

async function exploreProgramFromRpc(programId) {
  const accountRes = await callSolanaRpc("getAccountInfo", [programId, { encoding: "base64" }]);
  if (!accountRes.success || !accountRes.result || !accountRes.result.value) {
    return null;
  }
  const value = accountRes.result.value;
  const known = SOLANA_PROGRAMS.find((entry) => entry.programId === programId);
  const dataSize = Array.isArray(value.data) && value.data[0]
    ? Buffer.byteLength(value.data[0], "base64")
    : 0;
  return {
    type: "program",
    programId,
    name: known?.name || (value.executable ? "Executable program account" : "On-chain account"),
    dataSource: "Live Solana RPC (getAccountInfo)",
    category: known?.category || (value.executable ? "On-chain execution" : "Account data"),
    instructions: "n/a",
    owner: value.owner || "n/a",
    executable: Boolean(value.executable),
    lamports: value.lamports || 0,
    rentEpoch: value.rentEpoch,
    dataSize,
    description: known?.description || "Account info exists and is queryable from Solana RPC."
  };
}

function hashWallet(address) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < address.length; i += 1) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededRandom(seed) {
  let state = Math.abs(seed);
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function toBase58(seed, length = 44) {
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let state = Math.abs(seed) + 11;
  let out = "";
  for (let i = 0; i < length; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    out += alphabet[state % alphabet.length];
  }
  return out;
}

function buildAddress(seed) {
  return `${toBase58(hashWallet(seed), 44)}`;
}

function buildSignature(seed) {
  return toBase58(hashWallet(seed + "tx"), 44);
}

function explorerBuildTransactions(seed, directionHint = "send") {
  const random = seededRandom(hashWallet(seed));
  return Array.from({ length: 3 }).map((_, index) => {
    const amount = Number((random() * 9000 + 20).toFixed(2));
    const asset = random() > 0.7 ? "USDC" : "SOL";
    const direction = directionHint === "receive" ? "receive" : "send";
    return {
      signature: buildSignature(`${seed}-${index}`),
      type: direction,
      amount: `${amount.toFixed(2)} ${asset}`,
      counterparty: compactAddress(buildAddress(`${seed}-cp-${index}`)),
      riskScore: Math.round(random() * 100)
    };
  });
}

function compactAddress(address, start = 6) {
  if (!address) {
    return "";
  }
  if (address.length <= start * 2 + 2) {
    return address;
  }
  return `${address.slice(0, start)}...${address.slice(-start)}`;
}

function explainWalletRisk(profile) {
  const metadata = profile.metadata || {};
  const reasons = [];
  if (profile.riskLevel === "critical") {
    reasons.push("Critical profile because sanctions-style metadata or mixer-like churn is present.");
  }
  if (profile.riskLevel === "high") {
    reasons.push("High profile because short wallet age, high transaction velocity, or counterparty concentration is elevated.");
  }
  if (profile.riskLevel === "medium") {
    reasons.push("Medium profile because exchange-like bursts or mixed counterparties need review.");
  }
  if (metadata.txCount24h >= 100) {
    reasons.push(`High 24h transaction count: ${metadata.txCount24h}.`);
  }
  if (metadata.uniqueCounterparties >= 100) {
    reasons.push(`Large unique counterparty set: ${metadata.uniqueCounterparties}.`);
  }
  if (metadata.failRate >= 0.2) {
    reasons.push(`Failure rate is elevated at ${Math.round(metadata.failRate * 100)}%.`);
  }
  if (metadata.mixingScore >= 0.6) {
    reasons.push(`Mixer-style routing score is ${metadata.mixingScore}.`);
  }
  if (metadata.sanctionsHit) {
    reasons.push("Watchlist/sanctions-style signal is present in the demo profile.");
  }
  if (!reasons.length) {
    reasons.push("No high-risk signals exceeded the current heuristic thresholds.");
  }
  return reasons;
}

function summarizeRiskWallet(wallet) {
  const profile = explorerWalletForSynthetic(wallet.address);
  return {
    address: wallet.address,
    label: wallet.label,
    riskLevel: wallet.riskLevel,
    riskScore: wallet.riskScore,
    flags: wallet.flags,
    riskReasons: profile.riskReasons,
    dataSource: "demo heuristic profile"
  };
}

function syntheticCounterpartyCount(riskLevel, txCount24h) {
  if (riskLevel === "critical") {
    return 188;
  }
  if (riskLevel === "high") {
    return 150;
  }
  if (riskLevel === "medium") {
    return 62;
  }
  return Math.max(2, Math.round((txCount24h || 18) * 0.45));
}

function syntheticFailRate(riskLevel, random) {
  if (riskLevel === "critical") {
    return 0.34;
  }
  if (riskLevel === "high") {
    return 0.21;
  }
  if (riskLevel === "medium") {
    return 0.08;
  }
  return Number((random() * 0.03).toFixed(2));
}

function syntheticMixingScore(riskLevel, random) {
  if (riskLevel === "critical") {
    return 0.93;
  }
  if (riskLevel === "high") {
    return 0.68;
  }
  if (riskLevel === "medium") {
    return 0.38;
  }
  return Number((random() * 0.1).toFixed(2));
}

function explorerWalletForSynthetic(address) {
  const profile = SOLANA_EXPLORER_WALLETS.find((entry) => entry.address === address);
  const seed = hashWallet(address);
  const random = seededRandom(seed);
  const base = profile || {};
  const riskLevel = base.riskLevel || (seed % 100 >= 75 ? "high" : seed % 100 >= 45 ? "medium" : "low");
  const riskScore = base.riskScore || (seed % 100);
  const metadata = {
    ageDays: base.activeDays || Math.max(1, Math.floor(random() * 380)),
    txCount24h: base.txCount24h || Math.round(random() * 240),
    uniqueCounterparties: syntheticCounterpartyCount(riskLevel, base.txCount24h),
    failRate: syntheticFailRate(riskLevel, random),
    mixingScore: syntheticMixingScore(riskLevel, random),
    sanctionsHit: riskLevel === "critical",
    exchangeFlow: random() > 0.7
  };
  const wallet = {
    type: "wallet",
    address,
    label: base.label || "Observed wallet",
    riskLevel,
    riskScore,
    balance: Number(((random() * 12000) + 0.01).toFixed(2)),
    primaryAsset: base.primaryAsset || "SOL",
    txCount24h: base.txCount24h || Math.round(random() * 200),
    flags: base.flags || ["Unknown profile"],
    firstSeen: "2024-01-09T00:00:00Z",
    metadata,
    recommendation: riskLevel === "critical" ? "BLOCK" : riskLevel === "high" ? "CUE_REVIEW" : "ALLOW",
    recentTransactions: explorerBuildTransactions(address, base?.riskLevel === "low" ? "receive" : "send")
  };
  wallet.riskReasons = explainWalletRisk(wallet);
  wallet.dataSource = profile ? "demo heuristic profile" : "deterministic local heuristic";
  return wallet;
}

function explorerProgramFor(programId) {
  const program = SOLANA_PROGRAMS.find((entry) => entry.programId === programId);
  if (!program) {
    return null;
  }
  return {
    type: "program",
    programId,
    dataSource: "Deterministic local program directory",
    name: program.name,
    category: program.category,
    instructions: program.instructions,
    description: program.description
  };
}

function explorerTransactionFor(txid) {
  const seed = hashWallet(txid);
  const random = seededRandom(seed);
  const from = buildAddress(`${txid}-from`);
  const to = buildAddress(`${txid}-to`);
  const riskScore = Math.round(random() * 100);
  return {
    type: "tx",
    signature: txid,
    status: random() > 0.2 ? "finalized" : "pending",
    slot: Math.floor(182_000_000 + random() * 18000),
    block: `block-${Math.floor(182_000_000 + random() * 18000)}`,
    from,
    to,
    amount: `${Number((random() * 1500 + 1).toFixed(2))} ${random() > 0.6 ? "USDC" : "SOL"}`,
    dataSource: "Deterministic local synthetic stream",
    riskScore,
    recommendation: riskScore >= 90 ? "BLOCK" : riskScore >= 70 ? "CUE_REVIEW" : "ALLOW",
    riskTags: riskScore >= 90
      ? ["watchlist-like behavior", "rapid counterparties"]
      : riskScore >= 70
        ? ["velocity anomaly", "counterparty concentration"]
        : ["none"]
  };
}

function explorerBlockFor(height) {
  const seed = hashWallet(String(height));
  const random = seededRandom(seed);
  return {
    type: "block",
    slot: height,
    dataSource: "Deterministic local synthetic stream",
    status: "Finalized",
    leader: buildAddress(`${height}-leader`),
    txCount: Math.floor(700 + random() * 4500),
    hash: toBase58(hashWallet(`${height}-${Math.floor(random() * 10000)}`), 64),
    age: `${Math.floor(random() * 28)}s ago`,
    totalFees: `${Number((random() * 2.4).toFixed(3))} SOL`
  };
}

async function explorerWalletFor(address) {
  if (SOLANA_LIVE_EXPLORER) {
    const liveWallet = await exploreWalletFromRpc(address);
    if (liveWallet) {
      return liveWallet;
    }
  }
  return explorerWalletForSynthetic(address);
}

async function explorerProgramForAny(programId) {
  if (SOLANA_LIVE_EXPLORER) {
    const liveProgram = await exploreProgramFromRpc(programId);
    if (liveProgram) {
      return liveProgram;
    }
  }
  return explorerProgramFor(programId);
}

async function explorerTransactionForAny(txid) {
  if (SOLANA_LIVE_EXPLORER) {
    const liveTx = await exploreTransactionFromRpc(txid);
    if (liveTx) {
      return liveTx;
    }
    return null;
  }
  return explorerTransactionFor(txid);
}

async function explorerBlockForAny(height) {
  if (SOLANA_LIVE_EXPLORER) {
    const liveBlock = await exploreBlockFromRpc(height);
    if (liveBlock) {
      return liveBlock;
    }
    return null;
  }
  return explorerBlockFor(height);
}

function buildExplorerSuggestions() {
  return SOLANA_EXPLORER_WALLETS.map((entry) => entry.address);
}

function buildTransactionSuggestions() {
  return SOLANA_EXPLORER_WALLETS
    .slice(0, 6)
    .map((entry) => buildSignature(entry.address));
}

async function buildExplorerSuggestionsForScope(scope) {
  if (scope === "tx" && SOLANA_LIVE_EXPLORER) {
    const liveSignatures = await getRecentLiveSignatures(6);
    if (liveSignatures.length) {
      return liveSignatures;
    }
  }
  if (scope === "tx") {
    return buildTransactionSuggestions();
  }
  return buildExplorerSuggestions();
}

async function getRecentLiveSignatures(limit = 8) {
  try {
    const slotResponse = await callSolanaRpc("getSlot", [{ commitment: "finalized" }]);
    const slot = slotResponse.success ? Number(slotResponse.result) : null;
    if (!slot) {
      return [];
    }

    const signatures = [];
    for (let offset = 0; offset < 10 && signatures.length < limit; offset += 1) {
      const blockRes = await callSolanaRpc("getBlock", [slot - offset, {
        encoding: "json",
        transactionDetails: "signatures",
        rewards: false,
        maxSupportedTransactionVersion: 0
      }]);
      const blockSignatures = Array.isArray(blockRes.result?.transactions)
        ? blockRes.result.transactions
          .map((entry) => Array.isArray(entry?.transaction?.signatures) ? entry.transaction.signatures[0] : null)
          .filter(Boolean)
        : Array.isArray(blockRes.result?.signatures)
          ? blockRes.result.signatures
          : [];
      signatures.push(...blockSignatures.filter((signature) => !signatures.includes(signature)));
    }
    return signatures.slice(0, limit);
  } catch (_error) {
    return [];
  }
}

async function findLiveTransactionSample() {
  const signatures = await getRecentLiveSignatures(12);
  for (const signature of signatures) {
    const transaction = await exploreTransactionFromRpc(signature);
    if (transaction) {
      return transaction;
    }
  }
  return null;
}

function buildSampleStream() {
  const seedWallets = SOLANA_EXPLORER_WALLETS.slice(0, 3).map((entry) => entry.address);
  const seedTxs = seedWallets.map((entry) => buildSignature(entry));
  const blocks = [182_003_114, 182_003_118, 182_003_121].map((slot) => explorerBlockFor(slot));
  const walletProfiles = seedWallets.map((address) => explorerWalletForSynthetic(address));
  return [
    ...walletProfiles.map((wallet) => ({
      type: "wallet",
      id: wallet.address,
      scope: "wallet",
      riskLevel: wallet.riskLevel,
      value: `${wallet.balance} SOL`,
      dataSource: wallet.dataSource || "Deterministic local synthetic stream",
      when: "2m ago",
      reason: Array.isArray(wallet.riskReasons) && wallet.riskReasons.length
        ? wallet.riskReasons[0]
        : `Risk score ${wallet.riskScore}`
    })),
    ...seedTxs.map((sig, index) => {
      const tx = explorerTransactionFor(sig);
      return {
        type: "tx",
        id: sig,
        scope: "tx",
        riskLevel: tx.riskScore >= 90 ? "critical" : tx.riskScore >= 70 ? "high" : "low",
        value: tx.amount,
        dataSource: tx.dataSource || "Deterministic local synthetic stream",
        when: `${index + 1}m ago`,
        reason: tx.riskTags.join(", ")
      };
    }),
    ...blocks.map((block) => ({
      type: "block",
      id: `${block.slot}`,
      scope: "block",
      riskLevel: "safe",
      value: `${block.txCount} tx`,
      when: "live",
      dataSource: block.dataSource || "Deterministic local synthetic stream",
      reason: "Synthetic block row used when live RPC is unavailable."
    }))
  ];
}

async function buildLiveExplorerStats() {
  try {
    const slotResponse = await callSolanaRpc("getSlot", [{ commitment: "finalized" }]);
    if (!slotResponse.success) {
      throw new Error(slotResponse.error || "Unable to fetch finalized slot");
    }
    const healthResponse = await callSolanaRpc("getHealth");
    const perfResponse = await callSolanaRpc("getRecentPerformanceSamples", [1]);
    const latestSlot = Number(slotResponse.result);
    const stateRaw = healthResponse.success ? String(healthResponse.result || "healthy").toLowerCase() : "healthy";
    const sample = (Array.isArray(perfResponse.result) && perfResponse.result[0]) || null;
    const tps = sample && typeof sample.numTransactions === "number" && typeof sample.samplePeriodSecs === "number" && sample.samplePeriodSecs > 0
      ? Math.round(sample.numTransactions / Math.max(1, sample.samplePeriodSecs))
      : 2450;

    return {
      chain: "Solana",
      cluster: "mainnet-beta",
      latestSlot,
      tps,
      state: stateRaw || "healthy",
      finalizedBlocks: latestSlot,
      highRiskAlerts: 0,
      dataSource: "Live Solana RPC for network metrics. Wallet and transaction risk scores are computed only after a user searches an address or signature.",
      dataSources: {
        network: "Live Solana RPC",
        walletRisk: "Live RPC on searched objects + Sombra heuristic",
        mode: "Live RPC default is on"
      },
      topWallets: []
    };
  } catch (_error) {
    return {
      chain: "Solana",
      cluster: "mainnet-beta",
      latestSlot: 182_013_122,
      tps: 2450,
      state: "healthy",
      finalizedBlocks: 182,
      highRiskAlerts: 8,
      dataSource: "Live RPC unavailable. Showing demo sample chain data; risk labels use Sombra heuristics.",
      dataSources: {
        network: "Demo sample chain data",
        walletRisk: "Sombra heuristic",
        mode: "Live RPC unavailable. Demo sample data active."
      },
      topWallets: SOLANA_EXPLORER_WALLETS
        .filter((wallet) => wallet.riskLevel !== "low")
        .map(summarizeRiskWallet)
    };
  }
}

async function buildLiveExplorerStream() {
  try {
    const slotResponse = await callSolanaRpc("getSlot", [{ commitment: "finalized" }]);
    const slot = slotResponse.success ? Number(slotResponse.result) : null;
    if (!slot) {
      return buildSampleStream();
    }

    const slotRows = [slot, slot - 1, slot - 2].filter((item) => item > 0);
    const rows = [];
    for (const rowSlot of slotRows) {
      const block = await explorerBlockForAny(rowSlot);
      if (block) {
        rows.push({
          type: "block",
          id: `${block.slot}`,
          scope: "block",
          riskLevel: "safe",
          value: `${block.txCount} tx`,
          dataSource: block.dataSource || "Live Solana RPC",
          when: "live",
          reason: "Finalized slot from live Solana RPC. Blocks are shown for freshness, not AML suspicion."
        });
      }
    }

    const signatures = await getRecentLiveSignatures(4);
    rows.push(...signatures.slice(0, 4).map((signature) => ({
      type: "tx",
      id: signature,
      scope: "tx",
      riskLevel: "safe",
      value: "signature",
      dataSource: "Live Solana RPC (latest finalized block)",
      when: "live",
      reason: "Recent finalized transaction signature from live Solana RPC."
    })));

    if (!rows.length) {
      return buildSampleStream();
    }
    return rows;
  } catch (_error) {
    return buildSampleStream();
  }
}

function normalizeEnvValue(value) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized === "undefined" || normalized === "null") {
    return "";
  }
  return normalized.replace(/^["']|["']$/g, "");
}

function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

async function supabaseRequest(table, query = "", options = {}) {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const baseUrl = SUPABASE_URL.replace(/\/+$/, "");
  const pathSuffix = query ? `?${query}` : "";
  const response = await fetch(`${baseUrl}/rest/v1/${encodeURIComponent(table)}${pathSuffix}`, {
    method: options.method || "GET",
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal",
      ...(options.headers || {})
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase ${table} request failed: ${response.status} ${text}`);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json().catch(() => null);
}

async function writeSupabaseAuditEvent(entry) {
  const objectId = entry.objectId || entry.wallet || entry.decisionToken || null;
  await supabaseRequest(SUPABASE_AUDIT_TABLE, "", {
    method: "POST",
    body: {
      created_at: entry.createdAt,
      event_type: entry.type || "event",
      object_type: entry.objectType || null,
      object_id: objectId,
      event: entry
    }
  });
}

async function readSupabaseAuditEvents(limit = 20) {
  const safeLimit = Math.max(1, Math.min(250, Number(limit) || 20));
  const query = [
    "select=created_at,event",
    "order=created_at.desc",
    `limit=${safeLimit}`
  ].join("&");
  const rows = await supabaseRequest(SUPABASE_AUDIT_TABLE, query, {
    method: "GET",
    prefer: ""
  });
  return Array.isArray(rows)
    ? rows.map((row) => ({
        createdAt: row?.event?.createdAt || row?.created_at,
        ...(row.event || {})
      }))
    : [];
}

async function clearSupabaseAuditEvents() {
  await supabaseRequest(SUPABASE_AUDIT_TABLE, "id=not.is.null", {
    method: "DELETE"
  });
}

async function writeSupabaseFeedback(lead) {
  await supabaseRequest(SUPABASE_FEEDBACK_TABLE, "", {
    method: "POST",
    body: {
      created_at: lead.createdAt,
      name: lead.name || null,
      email: lead.email || null,
      organization: lead.company || null,
      interest_area: lead.plan || null,
      objective: lead.objective || null,
      payload: lead
    }
  });
}

async function logAuditEvent(event) {
  try {
    const now = new Date().toISOString();
    const entry = {
      createdAt: now,
      ...event
    };
    if (isSupabaseConfigured()) {
      await writeSupabaseAuditEvent(entry);
      return true;
    }
    fs.appendFileSync(AUDIT_LOG, `${JSON.stringify(entry)}\n`, "utf8");
    return true;
  } catch (_error) {
    return false;
  }
}

async function readAuditLog(limit = 20) {
  if (isSupabaseConfigured()) {
    try {
      return await readSupabaseAuditEvents(limit);
    } catch (_error) {
      return [];
    }
  }
  try {
    const raw = fs.readFileSync(AUDIT_LOG, "utf8");
    const events = [];
    const lines = raw.split(/\r?\n/).filter(Boolean);
    for (let i = lines.length - 1; i >= 0 && events.length < limit; i -= 1) {
      const parsed = (() => {
        try {
          return JSON.parse(lines[i]);
        } catch (_error) {
          return null;
        }
      })();
      if (parsed) {
        events.push(parsed);
      }
    }
    return events;
  } catch (_error) {
    return [];
  }
}

async function writeAuditDecision(decision) {
  return logAuditEvent({
    type: "decision",
    ...decision
  });
}

async function writeAuditAssessment(result) {
  if (!result || !result.wallet) {
    return;
  }
  return logAuditEvent({
    type: "assessment",
    decisionToken: result.decisionToken || null,
    wallet: result.wallet,
    direction: result.direction,
    amount: result.amount,
    asset: result.asset,
    score: result.score,
    level: result.level,
    guardrail: result.guardrail,
    recommendation: result.recommendation,
    metadataSource: result.metadataSource || "manual",
    metadata: result.metadata || {}
  });
}

async function writeAuditEvidence(evidence) {
  if (!evidence || !evidence.objectId) {
    return false;
  }
  return logAuditEvent({
    type: "evidence",
    evidenceType: evidence.evidenceType || "explorer_investigation",
    objectType: evidence.objectType || "unknown",
    objectId: evidence.objectId,
    riskLevel: evidence.riskLevel || "unknown",
    level: evidence.riskLevel || "unknown",
    score: safeNumber(evidence.score, null),
    dataSource: evidence.dataSource || "unknown",
    chainSource: evidence.chainSource || evidence.dataSource || "unknown",
    riskSource: evidence.riskSource || "Sombra heuristic",
    recommendation: evidence.recommendation || "Recorded for review",
    reason: evidence.reason || "Explorer object promoted to audit evidence",
    summary: evidence.summary || "",
    payload: evidence.payload || {}
  });
}

async function clearAuditLog() {
  if (isSupabaseConfigured()) {
    try {
      await clearSupabaseAuditEvents();
      return true;
    } catch (_error) {
      return false;
    }
  }
  try {
    fs.writeFileSync(AUDIT_LOG, "", "utf8");
    return true;
  } catch (_error) {
    return false;
  }
}

async function writeLead(payload) {
  try {
    const lead = {
      createdAt: new Date().toISOString(),
      ...payload
    };
    if (isSupabaseConfigured()) {
      await writeSupabaseFeedback(lead);
      return true;
    }
    fs.appendFileSync(LEADS_LOG, `${JSON.stringify(lead)}\n`, "utf8");
    return true;
  } catch (_error) {
    return false;
  }
}

function buildAuditExportRows(events) {
  const headers = [
    "createdAt",
    "type",
    "decisionToken",
    "wallet",
    "direction",
    "asset",
    "amount",
    "level",
    "score",
    "action",
    "reason",
    "initiatedBy",
    "objectType",
    "objectId",
    "dataSource",
    "chainSource",
    "riskSource",
    "summary"
  ];

  const rows = events.map((event) => {
    const level = event.level || event.riskLevel || "unknown";
    const score = event.score !== undefined ? event.score : event.resultScore;
    return [
      event.createdAt,
      event.type,
      event.decisionToken,
      event.wallet,
      event.direction,
      event.asset,
      event.amount,
      level,
      score,
      event.action,
      event.reason || event.recommendation,
      event.initiatedBy || "operator",
      event.objectType || "",
      event.objectId || "",
      event.dataSource || "",
      event.chainSource || "",
      event.riskSource || "",
      event.summary || ""
    ];
  });

  return {
    headers,
    rows
  };
}

function sendAuditExport(res, events, format) {
  if (format !== "csv") {
    sendJson(res, 200, {
      success: true,
      exportedAt: new Date().toISOString(),
      events
    });
    return;
  }

  const payload = buildAuditExportRows(events);
  const csvBody = [
    payload.headers.map(csvEscape).join(","),
    ...payload.rows.map((row) => row.map(csvEscape).join(","))
  ].join("\n");
  const fileName = `sombra-audit-${Date.now()}.csv`;
  sendText(res, 200, csvBody, "text/csv; charset=utf-8", fileName);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", (error) => reject(error));
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "";
  const pathname = new URL(req.url || "/", "http://localhost").pathname;

  if (method === "OPTIONS") {
    res.statusCode = 204;
    setCorsHeaders(res);
    res.end();
    return;
  }

  if (pathname === "/api/health") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    sendJson(res, 200, {
      status: "ok",
      project: "Sombra",
      now: new Date().toISOString()
    });
    return;
  }

  if (pathname === "/api/presets") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    sendJson(res, 200, {
      success: true,
      presets: listPresets()
    });
    return;
  }

  if (pathname === "/api/explorer/stats") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    const stats = SOLANA_LIVE_EXPLORER
      ? await buildLiveExplorerStats()
      : {
        chain: "Solana",
        cluster: "mainnet-beta",
        latestSlot: 182_013_122,
        tps: 2450,
        state: "healthy",
        finalizedBlocks: 182,
        highRiskAlerts: 8,
        dataSource: "Live RPC disabled. Showing demo sample chain data; risk labels use Sombra heuristics.",
        dataSources: {
          network: "Demo sample chain data",
          walletRisk: "Sombra heuristic",
          mode: "Live RPC disabled. Demo sample data active."
        },
        topWallets: SOLANA_EXPLORER_WALLETS
          .filter((wallet) => wallet.riskLevel !== "low")
          .map(summarizeRiskWallet)
      };
    sendJson(res, 200, {
      success: true,
      stats
    });
    return;
  }

  if (pathname === "/api/explorer/stream") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    const stream = await (SOLANA_LIVE_EXPLORER ? buildLiveExplorerStream() : Promise.resolve(buildSampleStream()));
    sendJson(res, 200, {
      success: true,
      stream
    });
    return;
  }

  if (pathname === "/api/explorer/live-transaction-sample") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    if (!SOLANA_LIVE_EXPLORER) {
      sendJson(res, 503, {
        success: false,
        error: "Live Solana RPC is disabled for this deployment.",
        scope: "tx",
        suggestions: buildTransactionSuggestions()
      });
      return;
    }
    const transaction = await findLiveTransactionSample();
    if (transaction) {
      sendJson(res, 200, { success: true, result: transaction });
      return;
    }
    sendJson(res, 404, {
      success: false,
      error: "No recent transaction was retrievable from the configured Solana RPC. Try a newer signature or check RPC transaction-history support.",
      scope: "tx",
      suggestions: await buildExplorerSuggestionsForScope("tx")
    });
    return;
  }

  if (pathname === "/api/explorer/search") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    const url = new URL(req.url || "/", "http://localhost");
    const query = String(url.searchParams.get("q") || "").trim();
    const scope = String(url.searchParams.get("scope") || "auto");
    if (!query) {
      sendJson(res, 400, {
        success: false,
        error: "Missing query",
        suggestions: buildExplorerSuggestions()
      });
      return;
    }

    if ((scope === "wallet" || scope === "auto") && isLikelyWallet(query)) {
      sendJson(res, 200, { success: true, result: await explorerWalletFor(query) });
      return;
    }

    if ((scope === "tx" || scope === "auto") && isLikelyTx(query)) {
      const transaction = await explorerTransactionForAny(query);
      if (transaction) {
        sendJson(res, 200, { success: true, result: transaction });
        return;
      }
      sendJson(res, 404, {
        success: false,
        error: "Transaction not found from live Solana RPC",
        scope: "tx",
        suggestions: await buildExplorerSuggestionsForScope("tx")
      });
      return;
    }

    if ((scope === "block" || scope === "auto") && isNumeric(query)) {
      const block = await explorerBlockForAny(Number(query));
      if (block) {
        sendJson(res, 200, { success: true, result: block });
        return;
      }
      sendJson(res, 404, {
        success: false,
        error: "Block not found from live Solana RPC",
        scope: "block",
        suggestions: buildExplorerSuggestions()
      });
      return;
    }

    if (scope === "program" && query) {
      const program = await explorerProgramForAny(query);
      if (program) {
        sendJson(res, 200, { success: true, result: program });
        return;
      }
    }

    if (scope === "auto") {
      const program = await explorerProgramForAny(query);
      if (program) {
        sendJson(res, 200, { success: true, result: program });
        return;
      }
    }

    sendJson(res, 404, {
      success: false,
      error: "No matching explorer object",
      suggestions: buildExplorerSuggestions()
    });
    return;
  }

  if (pathname === "/api/demo-script") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    sendJson(res, 200, {
      success: true,
      script: listDemoScript()
    });
    return;
  }

  if (pathname === "/api/assess") {
    if (method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    try {
      const payload = await readJsonBody(req);
      const result = assessTransactionRisk(payload);
      await writeAuditAssessment(result);
      sendJson(res, 200, {
        success: true,
        result,
        generatedAt: new Date().toISOString()
      });
    } catch (error) {
      sendJson(res, 500, {
        success: false,
        error: "Risk assessment failed",
        details: error.message
      });
    }
    return;
  }

  if (pathname === "/api/enrich" ) {
    if (method !== "GET" && method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    try {
      const url = new URL(req.url || "/", "http://localhost");
      const wallet = method === "GET"
        ? url.searchParams.get("wallet") || ""
        : (await readJsonBody(req)).wallet || "";
      const enriched = enrichWalletForDemo(wallet);
      if (!enriched.success) {
        sendJson(res, 400, {
          success: false,
          error: enriched.error
        });
        return;
      }
      sendJson(res, 200, {
        success: true,
        wallet,
        metadata: enriched.metadata
      });
    } catch (error) {
      sendJson(res, 400, {
        success: false,
        error: "Invalid enrichment request"
      });
    }
    return;
  }

  if (pathname === "/api/action") {
    if (method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    try {
      const body = await readJsonBody(req);
      if (!body || !body.action || !body.decisionToken) {
        sendJson(res, 400, { success: false, error: "Missing action or decisionToken" });
        return;
      }
      const safeAction = String(body.action).toLowerCase();
      if (!VALID_ACTIONS.has(safeAction)) {
        sendJson(res, 400, {
          success: false,
          error: "Invalid action. Allowed: sign | proceed | override"
        });
        return;
      }
      const levelInput = typeof body.level === "string" ? body.level.toLowerCase() : "";
      const validLevel = ["low", "medium", "high", "critical", "unknown"].includes(levelInput)
        ? levelInput
        : "unknown";
      const accepted = await writeAuditDecision({
        decisionToken: body.decisionToken,
        wallet: body.wallet,
        action: safeAction,
        level: validLevel,
        riskLevel: validLevel,
        resultScore: safeNumber(body.score, null),
        reason: body.reason || "User initiated decision",
        initiatedBy: body.initiatedBy || "operator",
        direction: body.direction || "unknown"
      });
      if (!accepted) {
        sendJson(res, 500, { success: false, error: "Could not save action" });
        return;
      }
      sendJson(res, 200, {
        success: true,
        status: "action_logged"
      });
    } catch (_error) {
      sendJson(res, 400, { success: false, error: "Invalid action payload" });
    }
    return;
  }

  if (pathname === "/api/evidence") {
    if (method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const objectId = String(body.objectId || "").trim();
      if (!objectId) {
        sendJson(res, 400, { success: false, error: "Missing objectId" });
        return;
      }
      const accepted = await writeAuditEvidence({
        evidenceType: body.evidenceType,
        objectType: body.objectType,
        objectId,
        riskLevel: body.riskLevel,
        score: body.score,
        dataSource: body.dataSource,
        chainSource: body.chainSource,
        riskSource: body.riskSource,
        recommendation: body.recommendation,
        reason: body.reason,
        summary: body.summary,
        payload: body.payload
      });
      if (!accepted) {
        sendJson(res, 500, { success: false, error: "Could not save evidence" });
        return;
      }
      sendJson(res, 200, {
        success: true,
        status: "evidence_logged"
      });
    } catch (_error) {
      sendJson(res, 400, { success: false, error: "Invalid evidence payload" });
    }
    return;
  }

  if (pathname === "/api/audit") {
    if (method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const limit = safeNumber(url.searchParams.get("limit"), 20);
      sendJson(res, 200, {
        success: true,
        events: await readAuditLog(Number.isFinite(limit) ? limit : 20)
      });
      return;
    }
    if (method === "DELETE") {
      const queryOk = new URL(req.url || "/", "http://localhost").searchParams.get("confirm") === "true";
      if (!queryOk) {
        sendJson(res, 400, { success: false, error: "Append ?confirm=true to clear audit" });
        return;
      }
      const cleared = await clearAuditLog();
      if (!cleared) {
        sendJson(res, 500, { success: false, error: "Could not clear audit log" });
        return;
      }
      sendJson(res, 200, { success: true, status: "audit_cleared" });
      return;
    }
    sendJson(res, 405, { success: false, error: "Method not allowed" });
    return;
  }

  if (pathname === "/api/audit/export") {
    if (method !== "GET") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    const url = new URL(req.url || "/", "http://localhost");
    const limit = safeNumber(url.searchParams.get("limit"), 200);
    const format = (url.searchParams.get("format") || "json").toLowerCase();
    const events = await readAuditLog(Number.isFinite(limit) ? limit : 200);
    sendAuditExport(res, events, format === "csv" ? "csv" : "json");
    return;
  }

  if (pathname === "/api/lead") {
    if (method !== "POST") {
      sendJson(res, 405, { success: false, error: "Method not allowed" });
      return;
    }
    try {
      const body = await readJsonBody(req);
      const name = String(body.name || "").trim();
      const email = String(body.email || "").trim();
      const company = String(body.company || "").trim();
      const plan = String(body.plan || "Pilot").trim();
      const objective = String(body.objective || "").trim();
      if (!name || !email || !company || !objective) {
        sendJson(res, 400, { success: false, error: "Missing required fields" });
        return;
      }
      const saved = await writeLead({
        name,
        email,
        company,
        plan,
        objective,
        source: "website"
      });
      if (!saved) {
        sendJson(res, 500, { success: false, error: "Unable to save lead right now" });
        return;
      }
      sendJson(res, 200, { success: true, status: "lead_received" });
    } catch (_error) {
      sendJson(res, 400, { success: false, error: "Invalid lead request" });
    }
    return;
  }

  if (pathname.startsWith("/api")) {
    sendJson(res, 404, { success: false, error: "Unknown API route" });
    return;
  }

  const normalizedPath = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const filePath = path.join(PUBLIC_DIR, normalizedPath);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(res, 403, { success: false, error: "Forbidden" });
    return;
  }
  sendFileOr404(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Sombra running on http://localhost:${PORT}`);
});
