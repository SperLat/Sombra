# Sombra Manual

## Overview

Sombra is a Solana-native risk operations console for screening wallets, transactions, blocks, and programs before funds move.

The demo has two modes:

- Live mode: default mode for real searches and editable risk checks.
- Demo mode: scripted judge walkthrough with curated cases.

No login is required. The current demo uses a local workstation identity model. Audit and feedback records can be stored in Supabase when configured, with local JSONL fallback for local demos.

## Core concepts

### Chain source

The chain source tells you where the object data came from.

- Live Solana RPC: object details came from Solana mainnet RPC.
- Demo sample: fallback/sample data used when live RPC is disabled or unavailable.

### Risk source

The risk source tells you where the risk label came from.

- Sombra heuristic: Sombra's local rule-based risk engine generated the score, risk level, and guardrail.

Sombra is not currently a replacement for Chainalysis, Elliptic, TRM, or another regulated forensic provider. The product demonstrates the operating workflow and can be extended with external forensic APIs.

## Main workflow

### 1. Run a risk check

1. Open the app.
2. Stay in Live mode.
3. Go to the Workflow Deck.
4. Select Risk Check.
5. Enter a recipient or source wallet.
6. Enter amount and asset.
7. Optionally leave Auto-enrich enabled.
8. Click Run Risk Check.

Sombra returns:

- Risk level: low, medium, high, or critical.
- Score: 0 to 100.
- Guardrail: ALLOW, CUE_REVIEW, or BLOCK.
- Recommendation: operator guidance.
- Signals: reason list behind the score.
- Evidence packet: copyable and downloadable JSON record.

### 2. Use quick scenarios

1. Select the Scenarios tab.
2. Click a scenario.
3. Sombra fills the risk check and runs it.

Scenarios are useful for demos because they show low, review, and block behavior without typing data.

### 3. Search the Solana Explorer

1. Select the Explorer tab.
2. Enter a wallet, transaction signature, block number, program ID, or supported Solana explorer URL.
3. Click Search Chain.

You can also click Try live transaction sample to load a real Solana mainnet transaction.

The result renders in Investigation Output.

For transactions, Sombra shows:

- Signature
- Status
- Slot and block
- Fee
- Compute units
- Cost units
- Recent blockhash
- Transfer interpretation
- Account inputs
- Instructions
- Program logs
- Risk notes

### 4. Monitor the stream

1. Select the Stream tab.
2. Click Reload Stream.
3. Click a row to inspect the object.

Each row shows two different layers:

- Chain: Live Solana RPC or Demo sample.
- Risk: Sombra heuristic.

### 5. Record investigation evidence

1. Search or select an object.
2. Review Investigation Output.
3. Click Record as evidence.

This writes an evidence event into the Audit Trail.

### 6. Use the audit trail

The Audit Trail captures:

- Risk assessments
- Operator decisions
- Explorer investigation evidence

Available actions:

- Refresh
- Clear
- Export JSON
- Export CSV

Exports include evidence fields such as object type, object ID, data source, chain source, risk source, and summary.

## Demo mode

Toggle Demo mode only for guided walkthroughs.

Demo mode uses curated scripted checks and should not be presented as live chain data.

Use Live mode for the main product demo.

## Local data

Sombra stores local files during demo use:

- `server/audit-log.jsonl`
- `server/leads.jsonl`

These files are ignored by git.

## Operator identity

There is no login in the demo. This is intentional.

For production, Sombra should add:

- Workspace identity
- Operator identity
- Role-based access
- SSO or wallet authentication
- Tenant-specific audit retention

For the hackathon demo, no-login keeps judge access fast and avoids incomplete authentication risk.

## Recommended judge demo path

1. Open Sombra.
2. Run one risk check.
3. Copy evidence.
4. Open Explorer.
5. Click Try live transaction sample.
6. Inspect transaction details.
7. Record as evidence.
8. Export audit trail.
9. Toggle Demo mode only if a scripted flow is requested.

## Known limitations

- Risk scoring is heuristic.
- Live RPC may rate-limit or fail depending on network conditions.
- Demo sample data is used as fallback when live RPC is unavailable.
- Audit storage is local JSONL, not a production database.
- No authentication or team roles yet.
- No external AML provider integration yet.

## Production roadmap

- Configuration for reliable deployments.
- Persistent database-backed audit storage.
- Team workspaces and operator roles.
- Webhooks for transaction gates.
- Stronger data integrations.
- Custom policy thresholds by deployment.
- Wallet authentication or SSO.
