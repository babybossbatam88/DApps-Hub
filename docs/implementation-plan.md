# LP Command Center — Implementation Plan

Thirteen phases, built in order. Each phase has an explicit **exit criterion**;
the next phase does not start until `npm run verify` (lint + typecheck + test +
build) passes and the exit criterion is met.

Legend: ✅ done · 🔜 next · ⬜ not started

---

## Phase 1 — Foundation ✅

Project architecture, UI shell, database, real Base RPC connection.

- Next.js 16 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`)
- Tailwind v4 design tokens, dark-first institutional terminal theme
- shadcn-style UI primitives (hand-rolled: card, badge, button, skeleton, table)
- App shell: desktop sidebar + topbar, mobile bottom nav (5 items)
- All 14 routes exist and render with honest empty/awaiting-data states
- Prisma schema: 16 models, exact-decimal money columns
- Zod-validated environment with V1 security invariants enforced at boot
- viem public client for Base with multi-endpoint failover + Multicall3 batching
- `/api/health` and `/api/chain/status` — real probes, truthful failure reporting
- `<DataFreshness />`, `<Metric />`, demo/live mode indicator
- Vitest suite covering config, chain registry, freshness, formatting, RPC failover

**Exit criterion:** `npm run verify` green; every route reachable; `/api/chain/status`
returns a real block number on an unrestricted network, or a structured error.

## Phase 2 — Public wallet tracking ✅

- `normalizeEvmAddress`: EIP-55 validation that rejects a bad checksum rather
  than lowercasing it away, names ENS specifically, and rejects the zero address
- `POST/GET/DELETE /api/wallets` and `POST /api/wallets/:id/sync`
- Native + ERC-20 balances read through Multicall3, every read pinned to one
  block so a balance set is internally consistent
- `decimals()` always read from the contract; a token whose `decimals()` reverts
  is reported as a failure, never defaulted to 18
- A genuine zero balance deletes its row rather than persisting a stale "0.00"
- `SyncJob` written for every attempt, including failures
- `Wallet.lastSyncStatus` separates PARTIAL (fresh but incomplete) from FAILED
- Wallets page: inline validation, per-wallet freshness, block number, and
  per-token failure reasons

**Exit:** ✅ a public address can be added and its balances shown with sources
and a block number. Verified end to end against real PostgreSQL. The chain reads
were verified against a local JSON-RPC test double (`scripts/mock-base-rpc.mjs`)
because this build sandbox blocks RPC egress; the same path against Base mainnet
needs one run on an unrestricted network.

## Phase 3 — Uniswap V3 position discovery 🔜

- `NonfungiblePositionManager` enumeration → `positions()` → factory → pool
- Token metadata resolution and `Token` upsert (on-chain `decimals`, always)
- `LPPosition` + write-once `PositionEntrySnapshot`
- Tick/sqrtPrice math library with bit-exact `TickMath` vectors

**Exit:** the cbBTC/USDC test position is discovered from its wallet address with
correct ticks, fee tier, and liquidity; tick math matches on-chain vectors.

## Phase 4 — Live position valuation ⬜

- `slot0` → current price; liquidity → `amount0`/`amount1` (all three range cases)
- `PriceProvider` abstraction with on-chain pool price at rank 0
- Position card and detail page render real inventory and USD value

**Exit:** position value matches an independent calculation to <0.1%.

## Phase 5 — Fee calculation ⬜

- `feeGrowthInside` with **uint256 wrap-around masking**
- Uncollected fees, collected fees from `Collect` events, lifetime totals
- Fee APR over 24h/7d/30d/90d with confidence labels

**Exit:** uncollected fees match the on-chain `collect` static-call simulation.

## Phase 6 — HODL benchmark ⬜

- Immutable entry basis; `HODL_VALUE_NOW`, `LP_VALUE_EX_FEES`, `LP_VALUE_WITH_FEES`
- HODL Benchmark page

**Exit:** worked example in `calculations.md` §5 reproduced by the engine in tests.

## Phase 7 — LP vs HODL / divergence ⬜

- `DIVERGENCE_LOSS_EX_FEES`, `LP_VS_HODL_AFTER_FEES`, the three-line decomposition
- Classic `x*y=k` IL retained only as a labelled reference

**Exit:** decomposition sums exactly; negative results display correctly.

## Phase 8 — Snapshots and historical charts ⬜

- 15-minute `PositionSnapshot` worker via cron route with `CRON_SECRET`
- Portfolio chart: LP value vs HODL benchmark vs initial capital
- 24h/7d/30d/90d/1y/all-time windows; 30/90/365 performance cards
- Downsampling job

**Exit:** three-line chart renders from real snapshots; windows agree with raw data.

## Phase 9 — Rebalance engine ⬜

- Range engine states + rebalance recommendation with reasons and confidence
- Gas + slippage cost estimate via `QuoterV2`; breakeven days
- Rebalance Center + lifecycle log (manual entry; no execution)

**Exit:** recommendations reproduce the rule table; cost estimate is non-null on
a live network.

## Phase 10 — Binance market data ⬜

- Public REST + WS, server-side rate limiting from `exchangeInfo`
- Binance as rank-1 `PriceProvider` with explicit proxy flags

**Exit:** BTCUSDT/ETHUSDT marks render with source and freshness; cbBTC shows
`proxy price`.

## Phase 11 — Binance read-only account ⬜

- AES-256-GCM credential storage, permission-health screen
- Balances, trades, deposits, withdrawals, convert history — read only
- Refuse to sync a key with withdrawals enabled

**Exit:** permission health renders true scopes; withdrawal-enabled key is blocked.

## Phase 12 — Alerts ⬜

- Alert rules, evaluation in the snapshot worker, in-app inbox
- Channel abstraction ready for email/Telegram/WhatsApp

**Exit:** near-edge and out-of-range alerts fire from real snapshot transitions.

## Phase 13 — Production hardening ⬜

- Auth (email/password or magic link), rate limiting, CSP, audit logging
- Error boundaries, retries, structured logs, uptime probes
- Live-mode enforcement: fixtures throw; demo banner impossible to miss
- Deployment: Vercel + managed Postgres + cron, runbook in `docs/deployment.md`

**Exit:** live mode with real data, no fixture reachable, `npm run verify` green.

---

## Working agreement

- After every phase: `npm run lint`, `npm run typecheck`, `npm run test`,
  `npm run build`. All must pass before moving on.
- No phase may fabricate a number to make a later phase's UI look finished.
  Unbuilt features render `Not yet implemented`, not fake data.
- Every formula gets a unit test in the same phase that introduces it.
