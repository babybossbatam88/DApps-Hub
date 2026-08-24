# LP Command Center — External Integrations

Exact endpoints, contracts, ABIs, and failure handling for every external
system. Nothing in this product scrapes a web UI, and `app.uniswap.org` is not
called.

---

## 1. Base Mainnet (chain id 8453)

### 1.1 RPC

| Property | Value |
|---|---|
| Chain id | `8453` |
| Native asset | ETH (18 decimals) |
| Explorer | https://basescan.org |
| Public endpoint | `https://mainnet.base.org` |

Configured via `BASE_RPC_URLS` — a comma-separated list. The client builds a
viem `fallback()` transport over the list with retry and a rank-by-latency
policy. A dedicated provider (Alchemy / QuickNode / Ankr / Infura) is required
in practice: discovering positions across a wallet is dozens of `eth_call`s and
the public endpoint rate-limits aggressively.

**Batching.** All position reads go through `Multicall3` at
`0xcA11bde05977b3631167028862bE2a173976CA11` (same address on every major EVM
chain). viem's `batch: { multicall: true }` is enabled on the public client, so
reading 40 position structs is 1–2 HTTP round trips rather than 40.

**Reorg handling.** Every read that is persisted records its `blockNumber`.
Snapshots older than the finalised head are trusted; anything within the
unfinalised window is marked `pending` and re-read on the next sync. Base has
~2s blocks, so the snapshot cadence (15 min) is far outside the reorg window in
normal operation.

### 1.2 Uniswap V3 contracts on Base

| Contract | Address | Used for |
|---|---|---|
| `UniswapV3Factory` | `0x33128a8fC17869897dcE68Ed026d694621f6FDfD` | `getPool(token0, token1, fee)` |
| `NonfungiblePositionManager` | `0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1` | position NFTs, `positions()`, enumeration |
| `SwapRouter02` | `0x2626664c2603336E57B271c5C0b26F421741e481` | reference only (V1 never swaps) |
| `QuoterV2` | `0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a` | rebalance cost estimation (Phase 9) |
| `TickLens` | `0x0CdeE061c75D43c82520eD998C23ac2991c9ac6d` | liquidity distribution charts (Phase 8) |
| `Multicall3` | `0xcA11bde05977b3631167028862bE2a173976CA11` | read batching |

> **Verification requirement.** These addresses are checked at runtime by
> `src/lib/protocols/uniswap-v3/contracts.ts`, which asserts each address is a
> deployed contract (`eth_getCode` non-empty) and that the factory returns a
> non-zero pool for a known pair before any sync runs. A wrong address fails
> loudly rather than producing wrong numbers. Run it with
> `GET /api/chain/verify-contracts` (gated by `CRON_SECRET` when that is set).
> In the sandbox that produced this code, RPC egress is blocked, so this
> assertion has **not** been executed against mainnet — run the endpoint on a
> normal network before trusting a sync.

### 1.3 Contract reads per position

**`NonfungiblePositionManager`**
- `balanceOf(address owner) → uint256`
- `tokenOfOwnerByIndex(address owner, uint256 index) → uint256` (enumerable)
- `positions(uint256 tokenId) → (uint96 nonce, address operator, address token0,
  address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity,
  uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128,
  uint128 tokensOwed0, uint128 tokensOwed1)`

**`UniswapV3Pool`** (address from the factory)
- `slot0() → (uint160 sqrtPriceX96, int24 tick, ...)`
- `liquidity() → uint128`
- `feeGrowthGlobal0X128() → uint256`
- `feeGrowthGlobal1X128() → uint256`
- `ticks(int24 tick) → (uint128 liquidityGross, int128 liquidityNet,
  uint256 feeGrowthOutside0X128, uint256 feeGrowthOutside1X128, ...)`
  — read for both `tickLower` and `tickUpper`
- `token0()`, `token1()`, `fee()`, `tickSpacing()`

**`ERC20`** (per token, cached permanently — these never change)
- `symbol()`, `name()`, `decimals()`

Discovery cost per wallet: `1 + n` calls for enumeration, `n` for `positions()`,
then `~5` per distinct pool. All batched through Multicall3.

**Positions with zero liquidity** are still enumerable (a burnt-but-not-deleted
NFT). They are imported with `status = CLOSED` and excluded from active KPIs but
retained for lifetime fee accounting.

### 1.4 Base token registry

| Symbol | Address | Decimals | Notes |
|---|---|---|---|
| WETH | `0x4200000000000000000000000000000000000006` | 18 | canonical Base predeploy |
| USDC | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | 6 | native Circle USDC |
| USDbC | `0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA` | 6 | **bridged** USDC — distinct asset |
| cbBTC | `0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf` | 8 | Coinbase wrapped BTC |
| cbETH | `0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22` | 18 | Coinbase wrapped staked ETH |
| USDT | `0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2` | 6 | |
| WBTC | *unverified on Base* | 8 | see below |

Two rules the registry enforces:

1. **Every entry is marked `verified: false` until confirmed on-chain.** The
   registry is a *hint* for labelling and Binance mapping; `symbol` and
   `decimals` used in arithmetic are always read from the token contract during
   sync. A hard-coded wrong `decimals` would corrupt every amount, so the code
   never trusts this table for maths.
2. **USDbC ≠ USDC** and **cbBTC ≠ WBTC ≠ BTC**. They are separate registry
   entries with separate price mappings.

WBTC is listed in the product spec but does not have a single unambiguous
canonical deployment on Base of the kind the other entries have. Rather than
guess an address, the registry resolves unknown tokens dynamically: any token
found in a discovered position is read on-chain and inserted into the `Token`
table with `verified: true, source: 'onchain'`. WBTC/USDC positions are
therefore tracked automatically if they exist, without a hard-coded address.

---

## 2. Price data

### 2.1 Provider interface

```ts
interface PriceProvider {
  readonly key: string
  readonly rank: number                        // lower wins
  getSpotPrice(asset: AssetRef): Promise<Sourced<Decimal>>
  getHistoricalPrice(asset: AssetRef, at: Date): Promise<Sourced<Decimal>>
  getOHLC(asset: AssetRef, interval: Interval, range: Range): Promise<Sourced<Candle[]>>
}
```

Resolution order:

1. **On-chain pool price** (rank 0) — the pool the position actually lives in.
   Authoritative for the position's own valuation: it is the price at which the
   position's inventory is actually composed.
2. **Binance market data** (rank 1) — used for USD marks of assets with an
   explicit mapping, and for historical candles the chain cannot cheaply provide.
3. Additional providers can be registered later at higher ranks.

### 2.2 Asset mapping — explicit, never inferred

```
cbBTC (Base) → BTCUSDT   proxy, flagged `proxy: true`
WBTC         → BTCUSDT   proxy, flagged `proxy: true`
BTC          → BTCUSDT   direct
WETH (Base)  → ETHUSDT   proxy (wrapper, 1:1)
ETH          → ETHUSDT   direct
USDC         → USDCUSDT  direct  (NOT hard-coded to 1.00)
USDT         → 1.0 quote unit, marked `quote-unit`
```

**cbBTC is not BTC.** It is a Coinbase-issued wrapper that trades at a spread and
carries issuer risk. When a cbBTC valuation is derived from `BTCUSDT`, the value
is returned with `proxy: true` and the UI renders a `proxy price` marker next to
it. The system never silently substitutes one for the other — that is a stated
product requirement and it is enforced in the type: a proxy price cannot be
assigned to a `DirectPrice` field.

Stablecoins are priced, not assumed. `USDC = 1.00` is a claim about the world
that stops being true during a depeg, and the product refuses to make it.

---

## 3. Binance

Official REST + WebSocket only. Base URL `https://api.binance.com`
(configurable — `api-gcp.binance.com` and the `api1..4` hosts are valid
failovers).

### 3.1 Public market data (no credentials) — Phase 10

| Endpoint | Weight | Use |
|---|---|---|
| `GET /api/v3/ticker/price?symbol=BTCUSDT` | 2 | spot mark |
| `GET /api/v3/ticker/24hr?symbol=…` | 2 | 24h change for the market strip |
| `GET /api/v3/klines?symbol=…&interval=…&limit=…` | 2 | historical candles for HODL curves |
| `GET /api/v3/depth?symbol=…&limit=20` | 5 | order-book reference / slippage estimate |
| `GET /api/v3/exchangeInfo` | 20 | symbol validity, filters, live rate limits |
| WS `wss://stream.binance.com:9443/ws/btcusdt@trade` | — | live ticker |

Rate limits are **read from `exchangeInfo.rateLimits` at startup** rather than
hard-coded, and enforced by a server-side token-bucket shared across requests.
`429` is honoured with the `Retry-After` header; a `418` (IP ban) disables the
provider and surfaces on the Data Sources page. All calls are server-side, so the
limit is per-deployment, not per-user-browser.

### 3.2 Authenticated read-only — Phase 11, opt-in, off by default

Signature: HMAC-SHA256 over the query string using the API secret, sent as
`signature`, with `X-MBX-APIKEY` header. `timestamp` + `recvWindow=5000`.
Clock skew is corrected against `GET /api/v3/time`.

| Endpoint | Purpose |
|---|---|
| `GET /sapi/v1/account/apiRestrictions` | **permission health — the important one** |
| `GET /api/v3/account` | spot balances |
| `GET /api/v3/myTrades?symbol=…` | trade history |
| `GET /sapi/v1/capital/deposit/hisrec` | deposit history |
| `GET /sapi/v1/capital/withdraw/history` | withdrawal history (read only) |
| `GET /sapi/v1/convert/tradeFlow` | Convert history |

**Permission-health screen.** `apiRestrictions` returns
`enableReading`, `enableSpotAndMarginTrading`, `enableWithdrawals`,
`ipRestrict`, and more. The Binance Integration page renders:

- `Read` — required, green when true
- `Spot trading` — amber when true (unnecessary for V1)
- `Withdrawals` — **red and blocking when true.** The connection is marked
  `UNSAFE` and account sync is refused until the user disables it in Binance.
  The product will not read from a key that can move money.
- `IP restriction` — amber when absent, with the deployment's egress IP shown
  so the user can whitelist it.

**Hard constraints in V1:** no withdrawal endpoint is implemented; no order
endpoint is implemented; `FEATURE_BINANCE_TRADING` is validated to be `false`
and the build refuses to start otherwise. Credentials are AES-256-GCM encrypted
at rest, decrypted only inside the request handler, and never serialised into a
server-component payload.

---

## 4. Error taxonomy

Every adapter returns a discriminated result rather than throwing into the UI.

| Code | Cause | UI behaviour |
|---|---|---|
| `RPC_TIMEOUT` | provider slow | `Stale data` + retry, last-good value kept with its timestamp |
| `RPC_RATE_LIMITED` | 429 from provider | backoff, failover to next URL, badge `Delayed` |
| `RPC_ALL_PROVIDERS_FAILED` | every URL down | `Data unavailable`, sync job marked `FAILED` |
| `INVALID_ADDRESS` | bad checksum / not an address | inline form error, nothing persisted |
| `UNSUPPORTED_NETWORK` | chain id not in registry | explicit message naming supported chains |
| `POSITION_NOT_FOUND` | NFT id missing or burnt | position marked `CLOSED`, kept for history |
| `TOKEN_METADATA_FAILED` | `symbol()`/`decimals()` revert | token shown as `0xabc…` with `N/A` amounts — **never a guessed decimals value** |
| `PRICE_SOURCE_UNAVAILABLE` | all providers failed for an asset | USD columns render `N/A`, token amounts still render |
| `BINANCE_AUTH_FAILED` | bad key / skew / IP block | connection marked `ERROR` with the Binance message verbatim |
| `BINANCE_UNSAFE_PERMISSIONS` | withdrawals enabled | sync refused, red banner |
| `PARTIAL_SYNC` | some positions failed | per-position error badges; portfolio KPIs labelled `partial` |
| `CHAIN_REORG` | block hash changed under a snapshot | affected snapshots invalidated and re-read |

The rule that binds all of these: **a failed read never becomes a zero.**
`0` means "we read it and it is zero". Absence renders as `N/A`, `Syncing`,
`Stale data`, or `Data unavailable`.
