# Deployment

Target topology: Next.js on Vercel, managed PostgreSQL, and a scheduled worker
for snapshots. Nothing here requires a self-hosted node, though a dedicated RPC
provider is strongly recommended.

## 1. Prerequisites

- Node.js 20+ (the build is verified on 22)
- A PostgreSQL 14+ database (Neon, Supabase, RDS, or self-hosted)
- A Base Mainnet RPC endpoint. The public `https://mainnet.base.org` works for a
  smoke test but rate-limits under position discovery; use Alchemy, QuickNode,
  Ankr, or Infura for anything real.

## 2. Local development

```bash
npm install
cp .env.example .env.local
# edit .env.local: DATABASE_URL, DIRECT_URL, BASE_RPC_URLS
npx prisma generate
npx prisma migrate dev --name init      # or: npx prisma db push
npm run dev
```

Then check the wiring honestly rather than by eye:

```bash
curl -s localhost:3000/api/health | jq            # config + database + RPC
curl -s localhost:3000/api/chain/status | jq      # live Base probe
curl -s localhost:3000/api/chain/verify-contracts | jq   # address assertions
```

`/api/health` returns 503 with a per-component breakdown when anything is down.
A component failure names the component — "the app is broken" is not actionable.

## 3. Verification gate

Every phase must pass all four before the next one starts:

```bash
npm run verify   # lint && typecheck && test && build
```

## 4. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes (production) | Pooled connection used by the app |
| `DIRECT_URL` | yes for Migrate | Unpooled. Poolers lack the advisory locks migrations need |
| `BASE_RPC_URLS` | yes (production) | Comma-separated, ordered by preference |
| `NEXT_PUBLIC_APP_MODE` | no | `demo` (default) or `live` |
| `CRON_SECRET` | yes if using cron | Bearer token for `/api/jobs/*` and the verify endpoint |
| `BINANCE_API_BASE_URL` | no | Defaults to `https://api.binance.com` |
| `BINANCE_ENABLE_ACCOUNT_READ` | no | Default false |
| `BINANCE_ENCRYPTION_KEY` | only with account read | base64, exactly 32 bytes |
| `FEATURE_BINANCE_TRADING` | — | **Must be false.** The server refuses to boot otherwise |
| `AUTH_SECRET` | Phase 13 | `openssl rand -base64 32` |

The environment is validated by Zod at first server use and reports **every**
problem at once. A misconfiguration is surfaced as `CONFIGURATION_ERROR`, kept
distinct from an RPC outage so nobody debugs the wrong system.

## 5. Vercel

1. Import the repository; the framework preset is detected automatically.
2. Add the environment variables above to Production and Preview.
3. Build command `npm run build`, install command `npm install`.
   `prisma generate` runs from `postinstall` — add one if your platform prunes
   dev dependencies before build:
   ```json
   "postinstall": "prisma generate"
   ```
4. Set `NEXT_PUBLIC_APP_MODE=live` in Production. Demo mode is fine in Preview.

### Migrations

Run migrations from CI or locally against the production `DIRECT_URL`:

```bash
DIRECT_URL="postgresql://…" npx prisma migrate deploy
```

Never run `migrate dev` against production — it can reset the database.

## 6. Background worker (Phase 8)

Snapshots run every 15 minutes. On Vercel, `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/jobs/snapshot", "schedule": "*/15 * * * *" },
    { "path": "/api/jobs/sync-positions", "schedule": "*/30 * * * *" }
  ]
}
```

Job routes require `Authorization: Bearer $CRON_SECRET`. Without it they return
401 — an unauthenticated sync endpoint is an open invitation to burn your RPC
quota. Outside Vercel, any scheduler that can send that header works.

Every run writes a `SyncJob` row, so a silently failing cron is visible on the
Data Sources page rather than being inferred from stale numbers.

## 7. Network egress

The deployment must be able to reach:

- the configured Base RPC hosts
- `api.binance.com` (only if Binance features are enabled)
- `fonts.googleapis.com` / `fonts.gstatic.com` at build time, for the webfonts

If your platform enforces an egress allowlist, add those hosts. A blocked RPC
host surfaces as `RPC_ALL_PROVIDERS_FAILED` on the Data Sources page with the
underlying message intact, so this is diagnosable rather than mysterious.

## 8. Security checklist before going live

- [ ] `FEATURE_BINANCE_TRADING=false`
- [ ] Any Binance API key has **withdrawals disabled** and is IP-restricted
- [ ] `BINANCE_ENCRYPTION_KEY` is a real 32-byte random key, not a placeholder
- [ ] `NEXT_PUBLIC_APP_MODE=live` in production
- [ ] `CRON_SECRET` set and job routes rejecting unauthenticated requests
- [ ] `DATABASE_URL` uses TLS (`sslmode=require` on most managed providers)
- [ ] No `.env` file is committed — `.gitignore` covers `.env` and `.env*.local`

There is deliberately nothing on this list about key custody: the application
has no code path that could hold a private key.
