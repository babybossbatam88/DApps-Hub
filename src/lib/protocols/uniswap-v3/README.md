# Uniswap V3 adapter

Modules, and the phase that fills each one in:

| Module | Phase | Status |
|---|---|---|
| `contracts.ts` | 1 | ✅ addresses + startup verification |
| `abis.ts` | 1 | ✅ view-only ABIs |
| `types.ts` | 1 | ✅ raw structs + normalised `PositionState` |
| `client.ts` | 3 | ⬜ batched multicall reader |
| `positions.ts` | 3 | ⬜ NFT enumeration → `positions()` |
| `pools.ts` | 4 | ⬜ factory lookup + `slot0` |
| `ticks.ts` | 5 | ⬜ `ticks()` reads for both bounds |
| `math.ts` | 3–4 | ⬜ TickMath / LiquidityAmounts port |
| `pricing.ts` | 4 | ⬜ sqrtPriceX96 → human price |
| `fees.ts` | 5 | ⬜ feeGrowthInside with uint256 wrap masking |

Two constraints hold across all of them:

1. **Read-only by omission.** No ABI entry exists for `mint`, `burn`, `collect`,
   `swap`, `increaseLiquidity`, or `decreaseLiquidity`. The adapter cannot send
   a transaction it has no ABI for.
2. **No UI scraping.** `app.uniswap.org` and the Uniswap subgraph are not data
   sources. Every value comes from a contract read at a recorded block number.
