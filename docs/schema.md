# LP Command Center — Database Design

PostgreSQL + Prisma. The canonical definition is `prisma/schema.prisma`; this
document explains *why* it looks the way it does.

## 1. Design principles

1. **Money is never a float.** Token amounts are stored as `Decimal` with
   explicit precision, or as strings for raw `uint256` values (liquidity,
   fee growth) that exceed any decimal type. Never `Float`, never JS `number`.
2. **Entry state is immutable.** `PositionEntrySnapshot` is written once when a
   position is discovered and is never updated. The whole HODL benchmark rests
   on it; a mutable entry basis would silently rewrite history.
3. **Observations are append-only.** `PositionSnapshot`, `FeeEvent`,
   `PriceSnapshot` are time series. Corrections arrive as new rows.
4. **Every stored number knows where it came from.** Snapshot tables carry
   `source` and `blockNumber` so a value can be re-derived and audited.
5. **No secret material.** There is no column anywhere for a private key, seed
   phrase, or plaintext API secret. `BinanceConnection` stores ciphertext only.

## 2. Entity relationships

```
User 1─┬─* Wallet 1──* LPPosition *──1 Pool *──1 Chain
       │                   │            │ └─* PriceSnapshot
       │                   │            ├─1 Token (token0)
       │                   │            └─1 Token (token1)
       │                   ├─1 PositionEntrySnapshot   (immutable, 1:1)
       │                   ├─* PositionSnapshot        (time series)
       │                   ├─* FeeEvent
       │                   ├─* RebalanceEvent
       │                   └─* Transaction
       ├─* BinanceConnection   (encrypted, read-only scope)
       ├─* Alert
       └─* SyncJob
Protocol 1──* Pool
```

## 3. Models and their reason for existing

### `User`
Owner of everything. Email + password hash (argon2id) or magic-link token.
Auth lands in Phase 13; the model exists from Phase 1 so foreign keys are real
rather than retrofitted.

### `Wallet`
A **public** EVM address the user wants tracked. Fields: `address` (checksummed,
unique per user+chain), `label`, `chainId`, `isActive`, `lastSyncedAt`.
No key material. Read-only by construction.

### `Chain` / `Protocol`
Registry tables so a new chain or protocol version is a row, not a migration.
`Chain` holds `chainId`, `name`, `nativeSymbol`, `explorerUrl`.
`Protocol` holds `key` (`uniswap-v3`), `name`, `version`, and per-chain contract
addresses live in `ProtocolDeployment`-style JSON on `Pool`/config.

### `Token`
Canonical asset per chain: `chainId`, `address`, `symbol`, `name`, `decimals`,
`coingeckoId?`, `binanceSymbol?`, `isStablecoin`. Unique on `(chainId, address)`.
`decimals` is authoritative and read on-chain — every amount conversion depends
on it, so a wrong value corrupts every downstream number.

### `Pool`
`chainId`, `protocolId`, `address`, `token0Id`, `token1Id`, `feeTier` (in
hundredths of a bip: 500 / 3000 / 10000), `tickSpacing`.
Unique on `(chainId, address)`.

### `LPPosition`
The centre of the schema.

| Field | Type | Note |
|---|---|---|
| `id` | cuid | internal id |
| `walletId` | FK | owner wallet |
| `protocolId`, `chainId`, `poolId` | FK/int | where it lives |
| `poolAddress` | string | denormalised for fast lookups |
| `positionNftId` | string | `uint256` as string — NFT ids exceed `bigint` safety |
| `token0Id`, `token1Id` | FK | resolved token identities |
| `feeTier` | int | 3000 = 0.30% |
| `tickLower`, `tickUpper` | int | signed, −887272…887272 |
| `entryTimestamp` | DateTime | when the position was opened |
| `initialToken0`, `initialToken1` | Decimal(78,0)-backed string | raw units at entry |
| `initialToken0PriceUsd`, `initialToken1PriceUsd` | Decimal(36,18) | entry marks |
| `initialCapitalUsd` | Decimal(36,18) | derived, stored for audit |
| `currentLiquidity` | String | raw `uint128` |
| `status` | enum | `ACTIVE`, `OUT_OF_RANGE`, `CLOSED`, `BURNED`, `UNKNOWN` |
| `createdAt`, `updatedAt` | DateTime | |

Unique on `(chainId, protocolId, positionNftId)` — the same NFT cannot be
imported twice, even via two wallets.

The `initial*` fields duplicate `PositionEntrySnapshot` deliberately: the spec
requires them on the position row for fast list rendering, while the snapshot
table keeps the full immutable provenance (block number, price sources, tx hash).

### `PositionEntrySnapshot`
1:1 with `LPPosition`, **write-once**. Holds entry block number, tx hash, raw
token amounts, per-token price with `priceSource`, and the resulting USD capital.
Application code must never issue an `UPDATE` here; a correction is a new
position record, not a rewritten basis.

### `PositionSnapshot`
Every 15 minutes per active position. `positionId`, `takenAt`, `blockNumber`,
`sqrtPriceX96`, `tick`, `price` (token1 per token0), `amount0`, `amount1`,
`uncollectedFees0/1`, `positionValueUsd`, `hodlValueUsd`, `lpVsHodlUsd`,
`rangeState`, `source`.
Indexed on `(positionId, takenAt DESC)` — every chart and every period-return
query is a range scan on that index.

### `FeeEvent`
Both *observations* of uncollected fees and *collections*. `kind` =
`ACCRUAL_OBSERVED | COLLECTED`. Holds `amount0`, `amount1`, `usdValue`, `txHash`
(null for observations), `blockNumber`, `observedAt`. Lifetime fees =
collected sum + current uncollected.

### `RebalanceEvent`
Lifecycle log: `CREATE_POSITION`, `ADD_LIQUIDITY`, `REMOVE_LIQUIDITY`,
`COLLECT_FEES`, `REBALANCE`, `CLOSE_POSITION`. Records old/new tick range,
token amounts, USD value, fees collected, gas cost, `reason`, free-text `notes`.

### `Transaction`
Raw on-chain transactions attributable to a wallet or position: `txHash`,
`chainId`, `blockNumber`, `from`, `to`, `gasUsed`, `gasPriceWei`, `gasCostUsd`,
`methodSignature`, `status`. `RebalanceEvent` links to it.

### `PriceSnapshot`
Time series of asset prices: `tokenId`, `priceUsd`, `source`
(`ONCHAIN_POOL | BINANCE | DERIVED`), `observedAt`, `confidence`.
Historical HODL curves are reconstructed from this table, so the source is
stored per point — a chart may not mix a Binance BTC mark with a cbBTC pool mark
without saying so.

### `BinanceConnection`
`userId`, `label`, `apiKeyCiphertext`, `apiSecretCiphertext`, `encryptionIv`,
`encryptionTag`, `keyVersion`, `permissionsJson` (last observed scopes),
`withdrawalsEnabled` (bool, surfaced in red when true), `lastCheckedAt`,
`status`. AES-256-GCM, key from `BINANCE_ENCRYPTION_KEY`, server-only.
There is no read path from this table to a client component.

### `Alert`
`userId`, `positionId?`, `type` (near-lower, near-upper, out-of-range,
fee-threshold, fee-apr-below, lp-vs-hodl-below, price-move, sync-failure),
`threshold` JSON, `channel` (`IN_APP` in V1), `isEnabled`, `lastTriggeredAt`,
plus `AlertDelivery` rows for history.

### `SyncJob`
Observability for background work: `kind`, `targetId`, `status`
(`PENDING|RUNNING|SUCCEEDED|FAILED|PARTIAL`), `startedAt`, `finishedAt`,
`error`, `itemsProcessed`, `itemsFailed`. The Data Sources page reads this table
so "partial sync" is a visible state rather than a silent one.

## 4. Numeric storage decisions

| Value | Storage | Why |
|---|---|---|
| Raw token amounts (`uint256`) | `Decimal(78, 0)` | 2^256 has 78 digits; `BigInt` in JS, exact in PG |
| `liquidity` (`uint128`) | `String` | Never arithmetic'd in SQL; parsed to `bigint` in TS |
| `feeGrowthInside*X128` | `String` | Q128.128 fixed point, wraps by design — must not be coerced |
| `sqrtPriceX96` | `String` | Q64.96 |
| USD values | `Decimal(36, 18)` | Exact to 18dp, no float drift in SUM() |
| Percentages | `Decimal(18, 8)` | |
| Ticks | `Int` | Signed, bounded |

## 5. Indexing plan

- `LPPosition (walletId, status)` — dashboard list
- `LPPosition (chainId, protocolId, positionNftId)` unique — import idempotency
- `PositionSnapshot (positionId, takenAt DESC)` — charts, period returns
- `FeeEvent (positionId, observedAt DESC)`
- `PriceSnapshot (tokenId, observedAt DESC)`
- `SyncJob (status, startedAt DESC)`
- `Alert (userId, isEnabled)`

## 6. Retention

Snapshots at 15-minute granularity are kept raw for 90 days, then downsampled to
hourly for a year and daily beyond. Downsampling is a Phase 8 job; the schema
supports it via a `granularity` enum on `PositionSnapshot`.
