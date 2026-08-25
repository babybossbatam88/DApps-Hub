# Uniswap V3 adapter

Modules, and the phase that fills each one in:

| Module | Phase | Status |
|---|---|---|
| `contracts.ts` | 1 | ✅ addresses + startup verification |
| `abis.ts` | 1 | ✅ view-only ABIs |
| `types.ts` | 1 | ✅ raw structs + normalised `PositionState` |
| `math.ts` | 3 | ✅ TickMath + LiquidityAmounts + feeGrowthInside, bit-exact |
| `positions.ts` | 3 | ✅ NFT enumeration → `positions()` → entry basis from events |
| `pools.ts` | 3–4 | ✅ factory lookup, pool metadata, `slot0` + accumulators |
| `ticks.ts` | 5 | ✅ `ticks()` reads for both bounds (wired up in Phase 5) |
| `pricing.ts` | 4 | ⬜ price provider ranking; raw conversion lives in `math.ts` |
| `fees.ts` | 5 | ⬜ orchestration; the arithmetic is already in `math.ts` |

Two constraints hold across all of them:

1. **Read-only by omission.** No ABI entry exists for `mint`, `burn`, `collect`,
   `swap`, `increaseLiquidity`, or `decreaseLiquidity`. The adapter cannot send
   a transaction it has no ABI for.
2. **No UI scraping.** `app.uniswap.org` and the Uniswap subgraph are not data
   sources. Every value comes from a contract read at a recorded block number.
