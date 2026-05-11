# Netcup / Coolify Deployment

Sombra can run as a standalone Node container behind the existing Netcup Coolify Traefik proxy.

## Runtime shape

- App container: Node.js native HTTP server
- Internal app port: `4000`
- Reverse proxy: existing Coolify / Traefik network named `coolify`
- Persistence: optional shared Supabase project using Sombra-namespaced tables

## Supabase setup

Codex must not run Supabase mutations directly. Run the schema manually:

1. Open the shared Supabase project.
2. Go to SQL Editor.
3. Paste and run `supabase/schema.sql`.
4. Confirm these tables exist:
   - `public.sombra_audit_events`
   - `public.sombra_feedback`

The app uses the service role key server-side only. Do not expose it in browser JavaScript.

## Required environment variables

Set these in Coolify for the Sombra app:

```env
PORT=4000
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_LIVE_EXPLORER=true
SUPABASE_SERVER_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
SUPABASE_AUDIT_TABLE=sombra_audit_events
SUPABASE_FEEDBACK_TABLE=sombra_feedback
SOMBRA_HOST=sombra.your-domain.com
```

If Supabase variables are empty, Sombra falls back to local JSONL files inside the container. That is acceptable for local demos but not ideal for an online demo because container files can be ephemeral.

## Coolify setup path

1. Push the repo to GitHub.
2. In Coolify, create a new application from the repo.
3. Use the root `Dockerfile`, or use `deploy/netcup/docker-compose.yml` if you are deploying through a compose resource.
4. Set the environment variables above.
5. Make sure the app is attached to the external `coolify` network if using compose.
6. Set the domain to the same value as `SOMBRA_HOST`.
7. Deploy.
8. Open `/api/health` on the public domain.
9. Open the app and test:
   - Risk Check
   - Try live transaction sample
   - Record as evidence
   - Audit export JSON/CSV

## Manual VPS compose path

From the repository root on the VPS:

```bash
cd deploy/netcup
SOMBRA_HOST=sombra.your-domain.com \
SUPABASE_SERVER_URL=https://YOUR_PROJECT_REF.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
docker compose up -d --build
```

Use the existing Coolify path if that is how the rest of the VPS is managed.

## Safety notes

- Never commit `.env`.
- Never commit `SUPABASE_SERVICE_ROLE_KEY`.
- Keep Supabase tables namespaced with `sombra_` to avoid collisions with other apps in the same Supabase project.
- Run `supabase/schema.sql` manually only once per Supabase project unless you intentionally change the schema.
