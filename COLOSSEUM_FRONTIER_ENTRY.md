# Sombra - Colosseum Frontier Hackathon Entry

## One-line statement

Sombra is a Solana-native risk operations console that screens wallets and transactions before funds move, then produces audit-ready evidence for treasury, compliance, exchange, and payment teams.

## Frontier alignment

Colosseum Frontier is not a bounty-driven hackathon. The entry should read as a focused Solana product with a working demo, a clear user, and a reason the team can build it beyond the hackathon.

Sombra fits Frontier because it targets an operational gap in Solana payments and DeFi: teams can move funds quickly, but pre-transaction risk controls, evidence capture, and compliance workflows are still fragmented across explorers, spreadsheets, and enterprise forensic tools.

## Product category

Data & Analytics, Compliance, Wallet/Transaction Infrastructure.

## What we are building

Sombra is a browser-based Solana risk platform for teams that need to decide whether to send, receive, hold, or review funds. The app combines:

- Live Solana RPC explorer search for wallets, transactions, blocks, and programs.
- Risk checks for send/receive flows before funds move.
- Transparent risk rationale and guardrail recommendations.
- Copyable addresses, signatures, blockhashes, and program IDs.
- Audit trail and evidence exports for compliance review.
- Demo mode for judges and live mode for real user workflows.

## Who it is for

Sombra is for Solana treasury teams, payment operators, OTC desks, exchanges, wallet teams, and compliance/legal teams that need practical AML-style controls in an open-source workflow.

## Why now

Solana has high-throughput payments, token activity, DeFi execution, and program interactions. That speed creates operational risk: teams need pre-transaction checks and evidence capture at the same pace funds move. Existing explorers show chain data, but operational review and evidence capture remain fragmented. Sombra provides usable risk operations for Solana-native teams.

## Why Solana

Sombra is Solana-specific because the product depends on fast wallet, transaction, block, and program lookups through Solana RPC. The product is designed around Solana concepts such as signatures, slots, blockhashes, compute units, program logs, account inputs, and high-frequency transaction flows.

## Working demo path

1. Open Sombra in live mode.
2. Run a risk check on a wallet or Solana Explorer address URL.
3. Review the guardrail recommendation and source label.
4. Copy or download the evidence packet.
5. Search a live Solana transaction signature in Explorer.
6. Inspect overview, account inputs, instructions, compute units, logs, and risk notes.
7. Toggle demo mode only when a scripted judge walkthrough is needed.

## Open-source alignment`r`n`r`nSombra is released under AGPL-3.0-only so Solana builders can inspect, run, modify, and extend the core workflow while preserving source availability for networked versions.`r`n`r`n## Differentiation

- Solana-first UX, not a generic multi-chain dashboard.
- Pre-transaction decisioning, not only post-hoc investigation.
- Evidence capture built into the operator workflow.
- Live explorer and risk console in one surface.
- Clear source labeling so live RPC data, heuristic analysis, and demo samples are never confused.

## Current limitations

Sombra's risk scoring is currently heuristic and should not be represented as equivalent to Chainalysis, Elliptic, TRM, or a regulated AML provider. The live explorer reads real Solana RPC data for searched objects, while wallet and transaction risk labels are Sombra-generated heuristics.

## Submission positioning

Do not submit Sombra as "Project Shadow" or as a vague AI forensics idea. Submit it as:

> Sombra is a Solana-native pre-transaction risk and evidence console for teams that need to screen wallets, signatures, and program interactions before funds move.

## Three-minute pitch structure

1. Problem: Solana teams move funds quickly, but risk review and evidence capture are fragmented.
2. User: treasury, compliance, exchange ops, OTC, payment, and wallet teams.
3. Demo: live risk check, evidence packet, live transaction explorer, audit export.
4. Why Solana: signatures, slots, compute units, account inputs, program logs, and high-throughput flows require chain-specific UX.
5. Open source: AGPL-licensed core that Solana builders can inspect and extend.
6. Next: add API/webhooks, policy profiles, team roles, and stronger data integrations.
