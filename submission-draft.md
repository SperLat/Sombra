# Sombra - Colosseum Submission Draft

## Project name

Sombra

## Category

Data & Analytics

## Brief description

Sombra is a Solana-native pre-transaction risk and evidence console that helps teams screen wallets, signatures, and program interactions before funds move.

## What are you building, and who is it for?

Sombra is a working Solana risk operations console for treasury, compliance, exchange, wallet, OTC, and payment teams.

Teams can run a wallet risk check, inspect live Solana transactions through RPC, record investigation evidence, and export an audit trail for review. The product is designed for teams that need practical open-source controls and evidence capture around Solana activity.

## Why build it now?

Solana makes value movement fast, but operational risk review is still fragmented. Operators often jump between explorers, spreadsheets, internal notes, and expensive compliance tools. Sombra puts the decision workflow in one place: screen before funds move, inspect live Solana data, and capture evidence.

## Technologies used

- Node.js native HTTP server
- Vanilla JavaScript frontend
- Solana JSON-RPC integration
- Local heuristic risk engine
- JSONL audit trail
- Evidence export in JSON and CSV
- AGPL-3.0 open-source license

## Solana integration

Sombra uses Solana RPC to inspect:

- Wallets/accounts
- Transaction signatures
- Blocks/slots
- Programs
- Account inputs
- Compute units
- Fees
- Recent blockhashes
- Program logs

## Demo story

1. Open Sombra in Live mode.
2. Run a wallet risk check.
3. Review ALLOW, CUE_REVIEW, or BLOCK recommendation.
4. Copy/download the evidence packet.
5. Open Explorer and click Try live transaction sample.
6. Inspect the live transaction overview, account inputs, instructions, and logs.
7. Record the investigation as evidence.
8. Export the audit trail.

## Data accuracy note

Live chain facts come from Solana RPC when available. Risk scores and guardrails are Sombra heuristic outputs. Demo sample data appears only in fallback or Demo mode.

## Open-source note

Sombra is licensed under AGPL-3.0-only. The open-source core supports Solana ecosystem composability and source availability for networked modifications.
