# Sombra

Sombra is a Solana-native pre-transaction risk and evidence console for teams that need to screen wallets, signatures, and program interactions before funds move.

It helps treasury, compliance, exchange, wallet, and payment teams make safer decisions by combining live Solana explorer data, explainable heuristics, guardrail recommendations, audit trails, and evidence exports.

## Colosseum Frontier positioning

Sombra is built for the Colosseum Frontier Hackathon as a working Solana startup product, not a generic analytics demo.

- Solana-native explorer for wallets, signatures, blocks, programs, slots, account inputs, compute units, blockhashes, and program logs.
- Pre-transaction risk checks for send and receive workflows.
- Investigation output that can be recorded as audit evidence.
- Live mode for real Solana RPC lookups and demo mode for guided judge walkthroughs.
- Open-source Solana risk workflow that can be extended by builders and operators.

## What it does

- Accepts a wallet address or Solana Explorer address URL, amount, asset, and optional transaction metadata.
- Searches live Solana RPC for transactions, wallets, blocks, and programs when available.
- Produces a risk score from 0 to 100 using Sombra heuristics.
- Classifies risk as `low`, `medium`, `high`, or `critical`.
- Returns one of three guardrails: `ALLOW`, `CUE_REVIEW`, or `BLOCK`.
- Shows explainable signals, source labels, and recommendations.
- Records decisions and promoted investigation findings into an audit trail.
- Exports audit evidence as JSON or CSV.

## Data source truth labels

Sombra separates chain data from risk interpretation:

- `Live Solana RPC`: chain object data came from Solana RPC.
- `Demo sample`: fallback/sample chain object shown when live RPC is unavailable or demo mode is active.
- `Sombra heuristic`: local risk scoring and guardrail logic.

Sombra is not currently equivalent to Chainalysis, Elliptic, TRM, or a regulated AML provider. The current risk engine is heuristic and intended for transparent demonstration and extension.

## Tech stack

- Node.js native HTTP server
- Vanilla JavaScript frontend
- Live Solana JSON-RPC calls through `fetch`
- Local JSONL audit logs
- Rule-based risk scoring engine

## Architecture

```text
Client (HTML/CSS/JS)
        |
        |  POST /api/assess
        |  GET  /api/explorer/search
        |  POST /api/evidence
        |  POST /api/action
        |  GET  /api/audit
        v
Node.js API server (server/index.js)
        |
        +-- riskEngine.js
        +-- live Solana RPC helpers
        +-- audit-log.jsonl
        +-- leads.jsonl
```

## Run locally

```bash
npm install
npm start
```

By default, the server starts on port `4000`.

Open:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/api/health
```

### Windows / local TLS note

The npm scripts use Node's system certificate store:

```bash
node --use-system-ca server/index.js
```

This helps live Solana RPC requests work on Windows environments where Node's bundled CA store may fail TLS verification.

### Port override

PowerShell:

```powershell
$env:PORT=4001; npm start
```

Node directly:

```bash
node --use-system-ca server/index.js --port=4001
```

## Environment variables

Copy `.env.example` if you want to customize runtime behavior.

```text
PORT=4000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_LIVE_EXPLORER=true
SUPABASE_SERVER_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_AUDIT_TABLE=sombra_audit_events
SUPABASE_FEEDBACK_TABLE=sombra_feedback
```

Supabase is optional. If `SUPABASE_SERVER_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, Sombra stores audit and feedback records in Supabase. If they are missing, Sombra falls back to local JSONL files.

## Site modes

- `Live`: production-style checks with editable input and live Solana RPC where available.
- `Demo`: guided scripted flow with curated judge walkthrough scenarios.

Demo mode can be enabled with:

```text
?mode=demo
```

Live mode is the default.

## Key API endpoints

### POST `/api/assess`

Runs a Sombra risk check.

### GET `/api/explorer/search`

Searches wallets, signatures, blocks, and programs.

```http
GET /api/explorer/search?scope=tx&q=<signature>
```

### POST `/api/evidence`

Records an explorer investigation result as audit evidence.

### POST `/api/action`

Records an operator decision for a risk check.

### GET `/api/audit`

Reads recent audit events.

### GET `/api/audit/export`

Exports audit events in JSON or CSV.

```http
GET /api/audit/export?format=csv
```

### DELETE `/api/audit?confirm=true`

Clears the local audit log for demo reset.

## Supabase setup

Run `supabase/schema.sql` manually in the Supabase SQL editor before enabling Supabase persistence. Codex should not run this SQL for you.

The schema creates namespaced tables:

- `sombra_audit_events`
- `sombra_feedback`

These names avoid collisions when sharing one Supabase project across multiple apps.

## Netcup / Coolify deployment

Deployment files are in `deploy/netcup/`.

Use the root `Dockerfile` for a standard Coolify app, or use `deploy/netcup/docker-compose.yml` if you deploy through a compose resource attached to the existing `coolify` network.

See [deploy/netcup/README.md](./deploy/netcup/README.md).

## Suggested demo flow

1. Open Sombra in live mode.
2. Run a wallet risk check.
3. Copy or download the evidence packet.
4. Search a live Solana transaction signature in Explorer.
5. Inspect overview, account inputs, instructions, compute units, and logs.
6. Record the investigation result as evidence.
7. Export the audit trail as CSV or JSON.
8. Toggle demo mode only for the scripted judge walkthrough.

## License

Sombra is licensed under the GNU Affero General Public License v3.0 only (`AGPL-3.0-only`).

See [LICENSE](./LICENSE).
