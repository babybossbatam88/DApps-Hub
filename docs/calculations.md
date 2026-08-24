# LP Command Center — Calculation Engine

Every formula the product displays, with its inputs, its edge cases, and a
worked example. All of these are implemented as **pure functions** in
`src/lib/math` and `src/lib/engines`, and each has unit tests.

> **Precision rule.** Raw chain integers are handled as `bigint`. Anything that
> needs division or fractional exponents goes through `decimal.js` configured to
> 40 significant digits. JavaScript `number` is used only for display and for
> values that are inherently small integers (ticks, counts). Never use
> `parseFloat` on a `uint256`.

---

## 1. Price primitives (Uniswap V3)

### 1.1 `sqrtPriceX96` → price

`sqrtPriceX96` is `sqrt(token1/token0)` in Q64.96 fixed point.

```
rawPrice = (sqrtPriceX96 / 2^96)^2                     // token1 per token0, raw units
price    = rawPrice * 10^(decimals0 - decimals1)       // human units
```

Implemented with Decimal, not floats: `2^96` is 79228162514264337593543950336.

**Worked example — cbBTC/USDC on Base.**
cbBTC has 8 decimals, USDC has 6. If cbBTC is token0:
`price_human = rawPrice * 10^(8-6) = rawPrice * 100` → USDC per cbBTC.

Token ordering is **not** assumed. `token0` is whichever address sorts lower;
the adapter reads it from the pool and the display layer decides orientation.
Displaying "USDC per cbBTC" when cbBTC is token1 requires `1 / price`.

### 1.2 tick → price

```
price_raw = 1.0001^tick
price     = price_raw * 10^(decimals0 - decimals1)
```

`1.0001^tick` for |tick| up to 887272 overflows `Math.pow` precision, so it is
computed as `exp(tick * ln(1.0001))` in Decimal at 40 digits, or via the
exact-integer bit-decomposition method used by the Uniswap `TickMath` library.
The library method is the one implemented, because it is bit-exact with the
on-chain contract and can be tested against known vectors.

### 1.3 price → tick

```
tick = floor( log(price_raw) / log(1.0001) )
```

Then snapped to the pool's `tickSpacing`:
`usableTick = floor(tick / tickSpacing) * tickSpacing`.
Rounding direction matters: the lower bound rounds down, the upper rounds up, so
a requested range is never narrower than asked.

### 1.4 tick → sqrtRatioX96

Bit-decomposition of `sqrt(1.0001)^tick` in Q96, matching `TickMath.getSqrtRatioAtTick`.
Required for amount math below.

---

## 2. Position token amounts

Given `liquidity L`, current `sqrtP`, and range `[sqrtPa, sqrtPb]`:

**Case A — price below range** (`sqrtP <= sqrtPa`): position is entirely token0.
```
amount0 = L * (sqrtPb - sqrtPa) / (sqrtPa * sqrtPb)      [scaled by 2^96]
amount1 = 0
```

**Case B — price in range** (`sqrtPa < sqrtP < sqrtPb`):
```
amount0 = L * (sqrtPb - sqrtP) / (sqrtP * sqrtPb)
amount1 = L * (sqrtP - sqrtPa)
```

**Case C — price above range** (`sqrtP >= sqrtPb`): entirely token1.
```
amount0 = 0
amount1 = L * (sqrtPb - sqrtPa)
```

All computed in `bigint` with Q96 scaling, mirroring `LiquidityAmounts.sol`, then
converted to human units by dividing by `10^decimals`.

**Consequence the UI must state:** out-of-range below means you hold 100% of the
*volatile* asset (cbBTC) — the price fell and you were bought into it.
Out-of-range above means 100% stablecoin. This is not a bug and the position
card labels it explicitly.

---

## 3. Uncollected fees

Uniswap V3 tracks fees as a global accumulator minus what is outside the range.

```
feeGrowthInside_X128 =
    feeGrowthGlobal_X128
  - feeGrowthOutsideLower_X128   (if tick >= tickLower, else global - lower is inverted)
  - feeGrowthOutsideUpper_X128
```

Precisely, per token:

```
if (currentTick >= tickLower) below = lower.feeGrowthOutside
else                          below = feeGrowthGlobal - lower.feeGrowthOutside

if (currentTick <  tickUpper) above = upper.feeGrowthOutside
else                          above = feeGrowthGlobal - upper.feeGrowthOutside

feeGrowthInside = feeGrowthGlobal - below - above
```

Then:

```
uncollected = tokensOwed
            + L * (feeGrowthInside - feeGrowthInsideLast) / 2^128
```

**Critical detail: these are `uint256` values that intentionally underflow.**
Solidity wraps on subtraction; JavaScript `bigint` does not. Every subtraction in
this block must be masked back into `uint256`:

```ts
const MASK = (1n << 256n) - 1n
const sub = (a: bigint, b: bigint) => (a - b) & MASK
```

Omitting the mask produces negative fee growth and wildly wrong fee numbers.
This is the single most common bug in third-party LP trackers, and it has a
dedicated test.

`tokensOwed0/1` comes straight from `positions(tokenId)` and represents fees
already checkpointed but not yet transferred.

---

## 4. Fee APR

```
fee_apr = (fees_earned_over_period / average_capital_over_period)
        * (365 / period_days)
        * 100
```

`average_capital_over_period` is the time-weighted mean of `positionValueUsd`
across the `PositionSnapshot` rows in the window — not the current value, and not
the entry value. A position whose value halved mid-window would otherwise report
a nonsense APR.

**Annualisation guard.** Extrapolating 6 hours of fees to a year is close to
meaningless. The engine attaches a confidence label and the UI must render it:

| Observation window | Label |
|---|---|
| < 24 hours | `VERY LOW CONFIDENCE` |
| 1–7 days | `LOW` |
| 7–30 days | `MEDIUM` |
| 30+ days | `HIGHER` |

Below 24 hours the UI shows the raw fees earned prominently and the annualised
figure de-emphasised with the warning attached. It is never shown bare.

---

## 5. HODL benchmark

The counterfactual: what if the user had simply kept the tokens they deposited?

```
HODL_VALUE_NOW = (entry_token0_qty * current_token0_price)
               + (entry_token1_qty * current_token1_price)

LP_VALUE_EX_FEES = (current_token0_amount * current_token0_price)
                 + (current_token1_amount * current_token1_price)

LP_VALUE_WITH_FEES = LP_VALUE_EX_FEES
                   + uncollected_fees_usd
                   + collected_fees_usd_attributable_to_position

LP_VS_HODL         = LP_VALUE_WITH_FEES - HODL_VALUE_NOW
LP_VS_HODL_PERCENT = LP_VS_HODL / HODL_VALUE_NOW * 100
```

Entry quantities come from the immutable `PositionEntrySnapshot` and are never
recomputed. Prices are current marks from the ranked `PriceProvider`.

**Worked example — the cbBTC/USDC test position.**
Entry: 0.00137 cbBTC @ $69,300 = $94.94, plus 95.06 USDC = $95.06.
`initialCapitalUsd = $190.00`.

Later, cbBTC = $77,000. Position now holds 0.00110 cbBTC and 105.30 USDC.
```
HODL_VALUE_NOW     = 0.00137*77000 + 95.06*1.00 = 105.49 + 95.06 = $200.55
LP_VALUE_EX_FEES   = 0.00110*77000 + 105.30     =  84.70 + 105.30 = $190.00
uncollected fees   = $1.42 ; collected fees     = $5.38
LP_VALUE_WITH_FEES = 190.00 + 1.42 + 5.38       = $196.80
LP_VS_HODL         = 196.80 - 200.55            = -$3.75
LP_VS_HODL_PERCENT = -3.75 / 200.55 * 100       = -1.87%
```

Read: fees earned $6.80, but divergence cost more, so HODL was ahead by $3.75.
That is the number the product exists to show, and it is shown even when negative.

**A note on stablecoin marks.** USDC is priced at its actual mark, not hard-coded
to 1.00. During a depeg, pinning it to 1.00 would silently fabricate value.

---

## 6. Divergence / impermanent loss

The classic constant-product IL formula is **wrong for concentrated liquidity**
and is not used as the headline number.

```
IL_classic = 2*sqrt(r)/(1+r) - 1      where r = price_now / price_entry
```

It assumes a full-range `x*y=k` position. A concentrated position that has gone
out of range stops rebalancing entirely and diverges differently. It is retained
only as a labelled reference line in the Simulation Lab.

The headline is **realised divergence from actual inventory**:

```
DIVERGENCE_LOSS_EX_FEES = LP_VALUE_EX_FEES - HODL_VALUE_NOW
LP_VS_HODL_AFTER_FEES   = LP_VALUE_WITH_FEES - HODL_VALUE_NOW
```

The UI presents the decomposition, because the sum is what matters:

```
Divergence before fees   -$4.30
Fees earned              +$6.80
─────────────────────────────────
LP vs HODL               +$2.50
```

This is strictly more useful than "IL: 2.1%" with no context.

---

## 7. Range engine

Working in tick space where possible (ticks are linear in log-price, so
"percentage through the range" is well-defined; doing it in price space distorts
near the edges).

```
range_width_percent      = (upper_price - lower_price) / lower_price * 100
distance_to_lower_pct    = (current_price - lower_price) / current_price * 100
distance_to_upper_pct    = (upper_price - current_price) / current_price * 100
position_progress_pct    = (current_tick - tickLower) / (tickUpper - tickLower) * 100
time_in_range_percent    = in_range_snapshots / total_snapshots * 100
```

`position_progress_pct` is clamped to [0,100] for display but the raw value is
kept so "12% below the range" is expressible.

`time_in_range_percent` is computed from `PositionSnapshot` rows over the
selected window. With fewer than 2 snapshots it returns `null`, not `100`.

### Risk states

Thresholds are configurable (`src/lib/config/thresholds.ts`); defaults:

| State | Condition |
|---|---|
| `IN_RANGE_SAFE` | in range and nearest edge > 20% of remaining range distance |
| `NEAR_LOWER` | in range, within 15% of the lower edge |
| `NEAR_UPPER` | in range, within 15% of the upper edge |
| `OUT_BELOW` | `currentTick < tickLower` |
| `OUT_ABOVE` | `currentTick >= tickUpper` |

"Within 15% of the edge" means 15% of the *remaining distance across the range*,
measured in ticks — not 15% of the price.

---

## 8. Rebalance engine

Never automatic. It produces a recommendation, a confidence, the metrics behind
it, and an estimated cost.

Base signal from edge distance:

| Condition | Signal |
|---|---|
| in range, > 20% from nearest edge | `HOLD` |
| within 15% of edge | `WATCH` |
| within 5% of edge | `REBALANCE_SOON` |
| out of range | `REBALANCE_REVIEW` |

That signal is then adjusted by:

- **Fee income vs cost.** Estimated rebalance cost = gas (withdraw + swap + mint)
  + expected swap slippage. If `cost > fees_earned_last_30d`, the recommendation
  is downgraded and the reasoning says so. Rebalancing a $190 position to chase
  yield is usually value-destroying, and the tool must say that out loud.
- **Fee APR trend.** An out-of-range position earns zero fees; that strengthens
  the case. A high-APR in-range position weakens it.
- **Time in range.** A position that spends 40% of its time out of range has a
  range-width problem, not a re-centring problem.
- **Position size.** Below a configurable floor (default $500), gas dominates
  and the engine recommends `EXIT_REVIEW` rather than `REBALANCE`.
- **LP vs HODL.** Deeply negative LP-vs-HODL plus out-of-range triggers
  `EXIT_REVIEW` — it asks whether this pair should be LP'd at all.

Output shape:

```ts
{
  recommendation: 'HOLD' | 'WATCH' | 'REBALANCE_SOON' | 'REBALANCE_REVIEW' | 'EXIT_REVIEW',
  confidence: 'low' | 'medium' | 'high',
  reasons: Array<{ metric: string; value: string; effect: 'supports' | 'opposes' }>,
  estimatedCostUsd: number | null,
  estimatedBreakevenDays: number | null,
}
```

`estimatedBreakevenDays = estimatedCostUsd / (projected_daily_fees_after_rebalance)`.
If that exceeds the user's typical holding period, the UI flags it.

---

## 9. Period performance (30 / 90 / 365)

For each window, from `PositionSnapshot` and `FeeEvent`:

```
lp_return_pct   = (lp_value_end - lp_value_start) / lp_value_start * 100
hodl_return_pct = (hodl_value_end - hodl_value_start) / hodl_value_start * 100
lp_vs_hodl_pct  = lp_return_pct - hodl_return_pct
net_result_usd  = fees_earned - divergence_loss - gas_costs
```

If the position is younger than the window, the card reports the actual age and
labels the figure `partial period`, rather than annualising a stub.

---

## 10. Simulation Lab

Estimates, always labelled as such.

Given capital `C`, range `[Pa, Pb]`, current price `P0`, assumed pool volume `V`,
fee tier `f`, and the position's share of in-range liquidity `s`:

```
daily_fees ≈ V * f * s * P(in range)
```

`s` is estimated from the pool's active liquidity and the simulated position's
liquidity at the chosen range — narrower range, larger `s`, but lower
`P(in range)`. That tension is the whole point of the simulator, so both terms
are shown separately rather than collapsed into one yield number.

Terminal inventory under a price scenario uses the same §2 amount math with the
scenario's `sqrtP`. HODL value uses §5. Divergence uses §6.

The simulator does **not** claim to predict volume. Volume is an explicit user
input with a default sourced from the pool's trailing 30-day average, and the
output header reads `Estimate — not a forecast`.
