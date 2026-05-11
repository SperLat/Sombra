const BASE_SCORE = 12;

const WATCHLIST = new Set([
  "G3r6PqJqJ2m8bV6zFJ3Yh2h7M4QkQ8Jk9Lq4k9",
  "H2n7CqLkF4m5wW6xP7s8D9aQ2hV9K2fZ3vR8yT",
  "3m9xLk9A6tY2Qw3Fz4k8V6d1nR8mJ2qY7xC7p1"
]);

const KNOWN_PROFILES = {
  "G3r6PqJqJ2m8bV6zFJ3Yh2h7M4QkQ8Jk9Lq4k9": {
    label: "mixer cluster",
    riskSignals: 9,
    walletAgeDays: 2,
    txCount24h: 820,
    uniqueCounterparties: 188,
    failRate: 0.34,
    mixingScore: 0.93
  },
  "H2n7CqLkF4m5wW6xP7s8D9aQ2hV9K2fZ3vR8yT": {
    label: "high churn address",
    riskSignals: 6,
    walletAgeDays: 7,
    txCount24h: 290,
    uniqueCounterparties: 92,
    failRate: 0.27,
    mixingScore: 0.8
  },
  "3m9xLk9A6tY2Qw3Fz4k8V6d1nR8mJ2qY7xC7p1": {
    label: "sanction exposure hit",
    riskSignals: 5,
    walletAgeDays: 110,
    txCount24h: 45,
    uniqueCounterparties: 14,
    failRate: 0.14,
    mixingScore: 0.41
  }
};

function normalizeWallet(address) {
  if (!address || typeof address !== "string") {
    return "";
  }
  return address.trim();
}

function hashWallet(address) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < address.length; i += 1) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function decisionTokenFor(address, amount, now) {
  const seed = `${now || Date.now()}-${address}-${amount || 0}`;
  const base = hashWallet(seed);
  const suffix = Math.abs(hashWallet(`${seed}-salt`));
  return `SO-${base.toString(36)}-${suffix.toString(36)}`;
}

function syntheticMetadata(address) {
  const hash = hashWallet(address);
  const walletAgeDays = (hash % 900) + 1;
  const txCount24h = (hash % 420) + 3;
  const uniqueCounterparties = Math.floor((hash % 210) * 0.85) + 2;
  const failRate = Number(((hash % 45) / 100).toFixed(2));
  const mixingScore = Number(((hash % 100) / 100).toFixed(2));
  const exchangeFlow = (hash % 5) === 0;
  const sanctionsHit = (hash % 71) === 0 || address.toLowerCase().includes("scam");

  return {
    walletAgeDays,
    txCount24h,
    uniqueCounterparties,
    failRate,
    mixingScore,
    exchangeFlow,
    sanctionsHit,
    source: "synthetic",
    confidence: 0.42
  };
}

const DEMO_SCRIPT = [
  {
    id: "safe-transfer",
    name: "Safe colleague payout",
    expectedLevel: "low",
    expectedGuardrail: "ALLOW",
    expectedAction: "sign",
    expectedNote: "Wallet looks clean and old, small amount with low churn.",
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
    id: "review-transfer",
    name: "High-volume OTC transfer",
    expectedLevel: "high",
    expectedGuardrail: "CUE_REVIEW",
    expectedAction: "proceed",
    expectedNote: "Elevated volume and counterparties need manual approval before continuing.",
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
    id: "block-transfer",
    name: "Watchlist + mixer profile",
    expectedLevel: "critical",
    expectedGuardrail: "BLOCK",
    expectedAction: "override",
    expectedNote: "Known risk cluster with sanctions-adjacent and mixer behavior.",
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
  },
];

function sanitizeMetadata(metadata) {
  const normalized = {};
  if (!metadata || typeof metadata !== "object") {
    return normalized;
  }
  const keys = [
    "walletAgeDays",
    "txCount24h",
    "uniqueCounterparties",
    "failRate",
    "mixingScore",
    "sanctionsHit",
    "exchangeFlow"
  ];
  keys.forEach((key) => {
    if (metadata[key] === undefined || metadata[key] === null) {
      return;
    }
    normalized[key] = metadata[key];
  });
  return normalized;
}

function isLikelyWallet(address) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function scoreSignal(score, amount, add, reason, level) {
  if (add === 0) {
    return score;
  }
  score.signals.push({
    reason,
    weight: add,
    level
  });
  score.score += add;
  return score;
}

function evaluateAmount(score, amount, direction) {
  if (Number.isNaN(amount) || amount <= 0) {
    return scoreSignal(score, amount, 18, "Missing or invalid amount field", "critical");
  }

  if (amount >= 50000) {
    scoreSignal(score, amount, 30, "Single transfer above 50k may signal laundering or compounding risk", "critical");
  } else if (amount >= 10000) {
    scoreSignal(score, amount, 18, "Transfer above 10k is unusual for normal personal activity", "high");
  } else if (amount >= 2500) {
    scoreSignal(score, amount, 8, "Large transfer compared with common wallet activity", "moderate");
  }

  if (direction === "send" && amount > 15000 && amount < 50000) {
    scoreSignal(score, amount, 8, "Outbound transfer in high range while user controls destination", "moderate");
  }

  if (direction === "receive" && amount > 20000) {
    scoreSignal(score, amount, 10, "Large inbound transfer can indicate account hygiene bypass attempts", "elevated");
  }
}

function evaluateMetadata(score, metadata, direction) {
  if (!metadata) {
    metadata = {};
  }

  const {
    walletAgeDays = null,
    txCount24h = null,
    uniqueCounterparties = null,
    failRate = null,
    mixingScore = null,
    sanctionsHit = false,
    exchangeFlow = false
  } = metadata;

  if (walletAgeDays !== null && walletAgeDays >= 0 && walletAgeDays < 5) {
    scoreSignal(score, walletAgeDays, 25, "Wallet is younger than 5 days", "high");
  } else if (walletAgeDays !== null && walletAgeDays < 14) {
    scoreSignal(score, walletAgeDays, 14, "Recent wallet age creates provenance uncertainty", "moderate");
  } else if (walletAgeDays !== null && walletAgeDays >= 365 * 5) {
    scoreSignal(score, walletAgeDays, -4, "Long-established wallet age lowers immediate suspiciousness", "neutral");
  }

  if (txCount24h !== null && txCount24h >= 400) {
    scoreSignal(score, txCount24h, 18, "Very high transaction volume in the last 24h", "high");
  } else if (txCount24h !== null && txCount24h >= 120) {
    scoreSignal(score, txCount24h, 10, "Elevated throughput in short windows", "elevated");
  }

  if (uniqueCounterparties !== null && uniqueCounterparties >= 120) {
    scoreSignal(score, uniqueCounterparties, 14, "High number of counterparties suggests routing-like behavior", "high");
  } else if (uniqueCounterparties !== null && uniqueCounterparties >= 40) {
    scoreSignal(score, uniqueCounterparties, 6, "Unusually diverse recent interactions", "moderate");
  }

  if (failRate !== null && failRate > 0.35) {
    scoreSignal(score, failRate, 15, "High failed transaction ratio in recent activity", "high");
  } else if (failRate !== null && failRate > 0.15) {
    scoreSignal(score, failRate, 7, "Some failed transactions indicate attempted policy violations", "elevated");
  }

  if (mixingScore !== null && mixingScore >= 0.9) {
    scoreSignal(score, mixingScore, 20, "Mixing score suggests anonymization routing", "critical");
  } else if (mixingScore !== null && mixingScore >= 0.65) {
    scoreSignal(score, mixingScore, 10, "Moderate mixing indicators detected", "high");
  }

  if (direction === "receive" && exchangeFlow) {
    scoreSignal(score, 0, 6, "Inbound transfer appears linked to high-throughput exchange flow", "elevated");
  }

  if (sanctionsHit) {
    scoreSignal(score, 0, 45, "Address or peer appears in sanction-related reference data", "critical");
  }
}

function applyProfile(score, wallet, direction) {
  const profile = KNOWN_PROFILES[wallet];
  if (!profile) {
    return;
  }

  scoreSignal(score, wallet, 12, `Known address profile: ${profile.label}`, "high");

  if (direction === "send") {
    scoreSignal(score, wallet, 6, "Higher risk when sending to known suspicious profile", "high");
  }

  if (profile.riskSignals >= 7) {
    scoreSignal(score, wallet, 18, "Multiple adverse forensic signals in historic cluster", "critical");
  } else if (profile.riskSignals >= 4) {
    scoreSignal(score, wallet, 10, "Recurring suspicious activity pattern in profile history", "high");
  }

  if (profile.mixingScore >= 0.8) {
    scoreSignal(score, wallet, 12, "Profile already exhibits routing/mixer-style behavior", "high");
  }

  evaluateMetadata(score, profile, direction);
}

function buildRecommendation(level, score) {
  if (level === "critical") {
    return "Block this action. Escalate immediately to wallet owner and support.";
  }
  if (level === "high") {
    return "Caution: ask for verification, memo, and counterparty identity before continuing.";
  }
  if (level === "medium") {
    return "Monitor closely. Proceed only if you recognize the counterparty.";
  }
  return "Likely safe. Keep normal controls enabled.";
}

function classifyScore(score) {
  if (score >= 85) {
    return "critical";
  }
  if (score >= 62) {
    return "high";
  }
  if (score >= 38) {
    return "medium";
  }
  return "low";
}

function buildRiskResponse(wallet, direction, amount, asset, signals) {
  const level = classifyScore(signals.score);
  const now = new Date().toISOString();
  return {
    wallet,
    direction,
    amount,
    asset: asset || "SOL",
    evaluatedAt: now,
    score: clamp(signals.score, 0, 100),
    level,
    decisionToken: decisionTokenFor(wallet, amount, now),
    guardrail: level === "critical" ? "BLOCK" : level === "high" ? "CUE_REVIEW" : "ALLOW",
    recommendation: buildRecommendation(level, signals.score),
    topSignals: signals.signals
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 6),
    allSignals: signals.signals,
    summary:
      signals.signals.length === 0
        ? "No suspicious pattern was observed from provided inputs."
        : `${signals.signals.length} heuristic signal(s) found.`
  };
}

function assessTransactionRisk(payload = {}) {
  const wallet = normalizeWallet(payload.wallet);
  const direction = payload.direction === "receive" ? "receive" : "send";
  const amount = Number(payload.amount);
  const asset = payload.asset || "SOL";
  const providedMetadata = sanitizeMetadata(payload.metadata || {});
  const metadata = Object.keys(providedMetadata).length > 0 ? providedMetadata : syntheticMetadata(wallet);
  const enrichedFrom = Object.keys(providedMetadata).length > 0 ? "manual" : "synthetic";

  const score = {
    score: BASE_SCORE,
    signals: []
  };

  if (!wallet || !isLikelyWallet(wallet)) {
    scoreSignal(score, wallet, 18, "Invalid Solana-like wallet address format", "critical");
  }

  if (WATCHLIST.has(wallet)) {
    scoreSignal(score, wallet, 48, "Address is on a high-severity watchlist", "critical");
  }

  evaluateAmount(score, amount, direction);
  evaluateMetadata(score, metadata, direction);
  applyProfile(score, wallet, direction);

  const payloadScore = buildRiskResponse(wallet, direction, amount, asset, score);
  payloadScore.metadata = metadata;
  payloadScore.metadataSource = enrichedFrom;
  payloadScore.score = clamp(payloadScore.score, 0, 100);
  return payloadScore;
}

function enrichWalletForDemo(address) {
  const wallet = normalizeWallet(address);
  if (!wallet) {
    return { success: false, error: "Missing or invalid wallet address input." };
  }
  if (!isLikelyWallet(wallet)) {
    return { success: false, error: "Wallet does not look like a valid Solana base58 address." };
  }
  return {
    success: true,
    metadata: syntheticMetadata(wallet)
  };
}

function listPresets() {
  return DEMO_SCRIPT.map(({ payload, name }) => ({ name, payload }));
}

function listDemoScript() {
  return DEMO_SCRIPT;
}

module.exports = {
  assessTransactionRisk,
  enrichWalletForDemo,
  listPresets,
  listDemoScript
};
