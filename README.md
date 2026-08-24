# LP Command Center

Analytics and decision-support for concentrated-liquidity providers.

The product answers five questions on every screen:

1. How much is my LP worth right now?
2. How much have I earned in fees?
3. Would I have been better off simply HODLing the original tokens?
4. How much divergence / impermanent loss do I currently have?
5. Do I need to rebalance?

Read-only by construction. It never requests a seed phrase or a private key,
never constructs a signer, and never sends a transaction.

**Initial target:** Uniswap V3 on Base Mainnet (chain id 8453), tracking pairs
such as cbBTC/USDC, WETH/USDC, WBTC/USDC, and stablecoin pairs. The architecture
is built so Uniswap V4 and further chains are additions, not rewrites.

---

## Current status — Phase 2 of 13 complete

| Phase | Scope | Status |
|---|---|---|
| 1 | Architecture, UI shell, database, real Base RPC connection | ✅ |
| 2 | Public wallet tracking — add, validate, sync balances | ✅ |
| 3 | Uniswap V3 position discovery | next |
| 4–7 | Valuation, fees, HODL benchmark, divergence | planned |
| 8–13 | Snapshots, rebalance engine, Binance, alerts, hardening | planned |

Full breakdown with exit criteria: [`docs/implementation-plan.md`](docs/implementation-plan.md).

**Screens beyond Phase 1 render no figures.** They state which phase fills them
in. That is deliberate — a placeholder number that looks real is
indistinguishable from a bug, and this is a tool for making money decisions.

## Quick start

```bash
npm install
cp .env.example .env.local     # set DATABASE_URL, DIRECT_URL, BASE_RPC_URLS
npx prisma generate
npx prisma migrate deploy    # migrations are committed under prisma/migrations
npm run dev
```

### Working without a Base RPC endpoint

`scripts/mock-base-rpc.mjs` is a local JSON-RPC **test double** for development
on a machine that cannot reach a node. It is a fixture, never a data source, and
nothing in `src/` can reach it — pointing at it is an explicit act:

```bash
node scripts/mock-base-rpc.mjs 8545
# then set BASE_RPC_URLS=http://127.0.0.1:8545 in .env.local
```

Verify the wiring rather than trusting it:

```bash
curl -s localhost:3000/api/health | jq                   # config + db + RPC
curl -s localhost:3000/api/chain/status | jq             # live Base probe
curl -s localhost:3000/api/chain/verify-contracts | jq   # address assertions
```

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `start` | Production build and serve |
| `npm run lint` | ESLint (flat config, `eslint-config-next`) |
| `npm run typecheck` | `tsc --noEmit`, strict + `noUncheckedIndexedAccess` |
| `npm test` | Vitest |
| `npm run verify` | All four, in order — the gate between phases |
| `npm run db:generate` / `db:migrate` / `db:studio` | Prisma |

## Documentation

| Document | Contents |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Layering, data flow, freshness contract, security model |
| [`docs/schema.md`](docs/schema.md) | 16 Prisma models and the reasoning behind each |
| [`docs/calculations.md`](docs/calculations.md) | Every formula with worked examples and edge cases |
| [`docs/integrations.md`](docs/integrations.md) | Contracts, endpoints, rate limits, error taxonomy |
| [`docs/implementation-plan.md`](docs/implementation-plan.md) | 13 phases with exit criteria |
| [`docs/deployment.md`](docs/deployment.md) | Vercel, PostgreSQL, cron, security checklist |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 ·
TanStack Query · Zod · Prisma 7 + PostgreSQL · viem · decimal.js · Vitest

## Principles the code actually enforces

- **A failed read never becomes a zero.** Every value crossing an adapter
  boundary is a `Sourced<T>`: value, source, observation time, confidence. A
  failure is `null` plus an error code and renders as `N/A`, `Stale data`, or
  `Data unavailable` — never as a number.
- **Read-only by omission, not just by policy.** No signer is constructed
  anywhere, and the Uniswap adapter has no ABI entry for `mint`, `burn`,
  `collect`, or `swap`. It cannot send a transaction it has no ABI for.
- **cbBTC is not BTC.** Proxy price mappings are explicit and the flag follows
  the value to the screen. There is no "strip the W and append USDT" heuristic.
- **Stablecoins are priced, not assumed.** Pinning USDC to $1.00 fabricates
  value during a depeg — exactly when the number matters most.
- **The entry basis is immutable.** `PositionEntrySnapshot` is written once. A
  mutable HODL basis would silently rewrite history.
- **Never annualise silently.** Fee APR carries a confidence label derived from
  the observation window; under 24 hours it is labelled `VERY LOW CONFIDENCE`.
- **Token decimals come from the contract.** The static registry is a labelling
  hint marked `verified: false`; arithmetic never trusts it.
- **No floats for chain values.** `bigint` for raw integers, `decimal.js` at 40
  digits for anything divided. `uint256` fee-growth subtraction is masked back
  into `uint256`, because Solidity wraps and JavaScript does not.

## Security

- No seed phrases, no private keys — no field, model, or form exists for them
- No server-side signing; only `createPublicClient`
- Wallets are public addresses tracked read-only
- Binance credentials are AES-256-GCM encrypted server-side, never sent to the
  browser, never in localStorage
- Withdrawals must be disabled on any Binance key; a key that can withdraw is
  marked `UNSAFE` and refused
- `FEATURE_BINANCE_TRADING` is validated to be `false` — the server refuses to
  boot otherwise

## Known limitation of this build environment

The sandbox that produced this code enforces an egress allowlist. All Base RPC
hosts and `api.binance.com` return `403` at the proxy, so:

- The RPC layer is exercised by unit tests with injected fakes, and by the live
  probe endpoint — which was run here and **correctly reported the blocked
  host**, failing over between endpoints first.
- No live Base block, position, or price has been read from this environment,
  and no figure in this repository is copied from one.
- Run `npm run dev` on an unrestricted network to complete the Phase 1 exit
  criterion (a real block number from `/api/chain/status`).
