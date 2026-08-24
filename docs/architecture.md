# LP Command Center — Architecture

> Status: Phase 1 (foundation) implemented. Later phases are specified here so
> the seams exist from day one, but are explicitly marked as not-yet-built.

## 1. What this system is

A read-only analytics and decision-support terminal for concentrated-liquidity
providers. It answers five questions on every screen:

1. What is my LP worth right now?
2. How much have I earned in fees?
3. Would HODLing the original tokens have been better?
4. How much divergence (impermanent loss) do I carry?
5. Do I need to rebalance?

It never signs, never custodies, and never moves funds. See `docs/security.md`
section in this file (§8) and the hard rules in `src/lib/config/env.ts`.

## 2. Deployment topology

```
                 ┌────────────────────────────────────────────┐
                 │  Browser (desktop terminal / mobile app)   │
                 │  Next.js App Router · React 19 · Tailwind  │
                 │  TanStack Query (cache + freshness state)  │
                 └───────────────┬────────────────────────────┘
                                 │ HTTPS, same-origin only
                 ┌───────────────▼────────────────────────────┐
                 │  Next.js server (Vercel)                    │
                 │  · Route handlers /api/*                    │
                 │  · Server components (initial render)       │
                 │  · Domain engines (pure TS, no I/O)         │
                 │  · Adapters (chain, protocol, price, cex)   │
                 └──────┬───────────────┬──────────────┬───────┘
                        │               │              │
          ┌─────────────▼──┐   ┌────────▼────────┐  ┌──▼─────────────────┐
          │ PostgreSQL     │   │ Base Mainnet    │  │ Binance REST/WS    │
          │ (Prisma)       │   │ JSON-RPC 8453   │  │ (public first)     │
          └────────────────┘   └─────────────────┘  └────────────────────┘
                        ▲
          ┌─────────────┴──────────────┐
          │ Scheduled worker (cron)    │
          │ /api/jobs/sync-positions   │
          │ /api/jobs/snapshot         │
          └────────────────────────────┘
```

Everything secret lives server-side. The browser receives derived numbers and
metadata, never credentials and never raw provider URLs.

## 3. Layering rules

The codebase is split into four rings. Dependencies point inward only.

| Ring | Location | May import | Purpose |
|---|---|---|---|
| 4 · UI | `src/app`, `src/components` | 3, 2, 1 | Rendering, routing, layout |
| 3 · Application | `src/server` (later phases) | 2, 1 | Use-cases, orchestration, caching, persistence |
| 2 · Adapters | `src/lib/chains`, `src/lib/rpc`, `src/lib/protocols`, `src/lib/prices`, `src/lib/integrations` | 1 | All I/O. Every external system hides behind an interface |
| 1 · Domain | `src/lib/engines`, `src/lib/math`, `src/lib/types` | — | Pure functions. No `fetch`, no clock, no randomness |

**The domain ring is pure on purpose.** Every number the user sees is produced
by a function that takes explicit inputs and returns explicit outputs, so it can
be unit-tested against known-good vectors. `Date.now()` is injected, never read.

### Why adapters are interfaces, not concretions

- `ChainClient` — one per chain. Base today; adding Arbitrum is a registry entry.
- `ProtocolAdapter` — one per (protocol, version). Uniswap V3 today; V4 changes
  position accounting (singleton pool manager, hooks) but not the engines above it.
- `PriceProvider` — on-chain pool price first, Binance second. Ranked, with
  explicit asset mapping so cbBTC is never silently priced as BTC.
- `ExchangeAdapter` — Binance today, read-only.

## 4. Directory structure

```
DApps-Hub/
├─ docs/
│  ├─ architecture.md          ← this file
│  ├─ schema.md                database design + rationale
│  ├─ calculations.md          every formula, with worked examples
│  ├─ integrations.md          exact endpoints, contracts, rate limits
│  ├─ implementation-plan.md   13 phases with exit criteria
│  └─ deployment.md            Vercel + managed Postgres + cron
├─ prisma/
│  └─ schema.prisma            16 models
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx            root shell, fonts, providers
│  │  ├─ globals.css           design tokens (dark-first)
│  │  ├─ (dashboard)/          14 pages behind the app shell
│  │  │  ├─ page.tsx                 Overview
│  │  │  ├─ positions/page.tsx       Positions
│  │  │  ├─ positions/[id]/page.tsx  Position Detail
│  │  │  ├─ wallets/page.tsx         Wallets
│  │  │  ├─ rebalance/page.tsx       Rebalance Center
│  │  │  ├─ fees/page.tsx            Fees
│  │  │  ├─ hodl/page.tsx            HODL Benchmark
│  │  │  ├─ performance/page.tsx     Performance
│  │  │  ├─ simulations/page.tsx     Simulation Lab
│  │  │  ├─ log/page.tsx             Transaction / Rebalance Log
│  │  │  ├─ binance/page.tsx         Binance Integration
│  │  │  ├─ data-sources/page.tsx    Data Sources
│  │  │  ├─ alerts/page.tsx          Alerts
│  │  │  └─ settings/page.tsx        Settings
│  │  └─ api/
│  │     ├─ health/route.ts                  process + db + rpc health
│  │     ├─ chain/status/route.ts            live Base RPC probe
│  │     └─ chain/verify-contracts/route.ts  on-chain address assertion
│  ├─ components/
│  │  ├─ layout/               app-shell, sidebar, mobile-nav, topbar
│  │  ├─ ui/                   card, badge, button, skeleton (shadcn-style)
│  │  └─ data/                 data-freshness, stat-card, empty-state
│  ├─ lib/
│  │  ├─ config/               env (zod), app-mode, thresholds
│  │  ├─ chains/               chain registry, Base definition
│  │  ├─ rpc/                  viem client, failover transport, health probe
│  │  ├─ tokens/               canonical asset registry + Binance mapping
│  │  ├─ protocols/uniswap-v3/ adapter (contracts + types in Phase 1)
│  │  ├─ prices/               PriceProvider interface + ranking (Phase 4)
│  │  ├─ integrations/binance/ REST/WS client (Phase 10)
│  │  ├─ engines/              hodl, divergence, fees, range, rebalance (Ph 5-9)
│  │  ├─ math/                 tick/sqrtPriceX96/liquidity math (Phase 3)
│  │  ├─ db/                   Prisma singleton
│  │  └─ utils/                format, cn, time, result
│  └─ types/
└─ tests/                      vitest, mirrors src/lib
```

## 5. Data flow for one position

```
wallet address
   └─► NonfungiblePositionManager.balanceOf / tokenOfOwnerByIndex   [Phase 3]
         └─► positions(tokenId) → token0, token1, fee, ticks, liquidity,
             feeGrowthInside*LastX128, tokensOwed0/1
               └─► UniswapV3Factory.getPool(token0, token1, fee)
                     └─► pool.slot0() → sqrtPriceX96, tick          [Phase 4]
                         pool.feeGrowthGlobal0X128/1X128
                         pool.ticks(tickLower/tickUpper)
                           └─► math: amounts0/1 from liquidity      [Phase 4]
                               math: uncollected fees               [Phase 5]
                                 └─► PriceProvider → USD            [Phase 4]
                                     └─► engines:
                                           hodl benchmark           [Phase 6]
                                           divergence               [Phase 7]
                                           fee APR                  [Phase 5]
                                           range state              [Phase 1 rules / Phase 4 data]
                                           rebalance recommendation [Phase 9]
                                       └─► PositionSnapshot (15 min) [Phase 8]
                                             └─► charts, 30/90/365 cards
```

Nothing in that chain scrapes a web UI. Every input is a contract read.

## 6. Rendering strategy

- **Server components** for shell, static copy, and first paint of persisted data.
- **Client components + TanStack Query** for anything with a freshness state.
  Query keys carry the position id and the data source, so `<DataFreshness />`
  can read `dataUpdatedAt` and render `Live · 12s` / `Delayed` / `Stale`.
- **No client-side RPC calls.** The browser talks to `/api/*`; the server holds
  provider URLs. This keeps keys secret and lets one cache serve many clients.

## 7. Freshness and confidence contract

Every value crossing a boundary is wrapped:

```ts
type Sourced<T> = {
  value: T | null
  source: 'onchain' | 'binance' | 'derived' | 'database' | 'fixture'
  observedAt: string       // ISO-8601, when the value was actually read
  confidence?: 'very-low' | 'low' | 'medium' | 'higher'
  error?: { code: string; message: string }
}
```

`value: null` plus an `error` renders as `Data unavailable`, never as `0`, never
as a stale number without a stale badge. This is enforced by the UI primitives:
`<Metric />` refuses to render a bare number without an `observedAt`.

## 8. Security model (summary; enforced in code)

| Rule | Enforcement |
|---|---|
| Never request or store seed phrases / private keys | No field, no model, no form exists. `prisma/schema.prisma` has no secret-material column |
| Never sign transactions server-side | No signer is constructed anywhere. viem clients are `createPublicClient` only |
| Wallets are read-only | `Wallet` model stores a checksummed public address and nothing else |
| Binance secrets never reach the browser | Credentials live in `BinanceConnection`, encrypted (AES-256-GCM) with a server-only key; no `NEXT_PUBLIC_` binance var exists |
| No secrets in localStorage | Client persists UI preferences only; there is no token store |
| Withdrawals impossible in V1 | No withdrawal endpoint is implemented; permission-health screen surfaces the key's actual scopes and fails loudly if withdrawals are enabled |
| Trading gated | `FEATURE_BINANCE_TRADING` defaults false and is validated to be false in V1 |
| No fabricated numbers in live mode | `NEXT_PUBLIC_APP_MODE=live` makes fixture providers throw at construction |

## 9. Extensibility seams

- **Uniswap V4**: add `src/lib/protocols/uniswap-v4/` implementing the same
  `ProtocolAdapter`. Engines are untouched because they consume normalised
  `PositionState`, not protocol structs.
- **New chain**: add a `ChainDefinition` to the registry with its RPC list,
  contract addresses, and token registry. No engine changes.
- **New price source**: implement `PriceProvider`, register with a rank.
- **New alert channel**: implement `AlertChannel`; the alert engine emits
  channel-agnostic `AlertEvent`s.

## 10. Known environment constraint (this build sandbox)

The sandbox that produced this code has an egress allowlist. `mainnet.base.org`,
`base.llamarpc.com`, `api.binance.com`, and all other RPC/market hosts return
`403` at the proxy. Consequences, stated plainly:

- The RPC layer is written against viem and is exercised by unit tests using an
  injected mock transport, plus a live probe endpoint (`/api/chain/status`).
- The live probe **has not been run against Base mainnet from this sandbox**.
  Running `npm run dev` on a normal network performs the real connection; the
  Data Sources page reports the result truthfully, including failure.
- No number in this repository is copied from a blocked API. Where live data is
  unavailable the UI renders `Data unavailable`, per §7.
