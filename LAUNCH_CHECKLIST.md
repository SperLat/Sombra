# Launch Checklist

## Before publishing the repository

- Confirm repository name is `sombra` or clearly branded as Sombra.
- Confirm `LICENSE` exists and is AGPL-3.0.
- Confirm `package.json` has `license: AGPL-3.0-only`.
- Confirm `.env` is not committed.
- Confirm `server/audit-log.jsonl` is not committed.
- Confirm `server/leads.jsonl` is not committed.
- Run `supabase/schema.sql` manually in the shared Supabase project if deploying online.
- Set Supabase env vars only in Netcup/Coolify, not in git.
- Confirm `server/leads.jsonl` is not committed.
- Confirm README uses Sombra, not Project Shadow.
- Confirm old `Project Shadow` copy is removed from public-facing docs unless historical context is needed.

## Before recording the demo

- Start the server on `4000` or the chosen port.
- Open the app in Live mode.
- Hard refresh the browser.
- Clear audit trail if you want a clean run.
- Check that Stream shows either Live Solana RPC or clear demo sample fallback.
- Click Try live transaction sample and confirm it renders transaction details.
- Run one risk check and confirm Evidence packet appears.
- Record the explorer result as evidence.
- Export audit JSON or CSV once.

## Demo script

1. Landing page: explain Sombra in one sentence.
2. Risk Check: run a pre-transaction wallet check.
3. Evidence: copy or download evidence packet.
4. Explorer: click Try live transaction sample.
5. Investigation Output: show transaction overview, accounts, instructions, logs.
6. Record as evidence.
7. Audit Trail: show assessment and evidence events.
8. Export audit trail.
9. Optional: toggle Demo mode for scripted cases.

## What to say if asked about data accuracy

- Live transaction, block, account, and program fields come from Solana RPC when Live RPC is available.
- Risk scores and guardrails are Sombra heuristic outputs.
- Demo sample data appears only as fallback or in Demo mode.
- Sombra is designed to support future stronger data integrations.

## What to say if asked about open source

Sombra is AGPL-3.0-only. The core product is open-source for Solana ecosystem composability and source availability for networked modifications.

## What to say if asked about login

The hackathon demo intentionally has no login to reduce judge friction. Production would add workspace identity, roles, SSO or wallet authentication, and tenant-specific retention.

## Post-launch next steps

- Deploy public demo URL through Netcup/Coolify.
- Add screenshots to README.
- Add a short demo video link.
- Add issue templates.
- Add contributing guidelines.
- Add CI smoke checks.
- Add production deployment notes.
