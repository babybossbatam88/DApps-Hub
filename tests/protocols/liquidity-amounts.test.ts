import { describe, expect, it } from 'vitest'
import {
  MAX_UINT256,
  feeGrowthInside,
  getAmountsForLiquidity,
  getAmountsForLiquidityAtTicks,
  getLiquidityForAmounts,
  getSqrtRatioAtTick,
  subInUint256,
  uncollectedFees,
} from '@/lib/protocols/uniswap-v3/math'

// The cbBTC/USDC test position: 0.30% tier, roughly 69,206–86,928 USDC per cbBTC.
// USDC is token0 (6 decimals), cbBTC is token1 (8 decimals).
const TICK_LOWER = -67680
const TICK_UPPER = -65400
const TICK_CURRENT = -66480
const LIQUIDITY = 61800000n

describe('getAmountsForLiquidity', () => {
  it('splits the test position across both tokens while in range', () => {
    const { amount0, amount1 } = getAmountsForLiquidityAtTicks(
      TICK_CURRENT,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )

    // ~90.20 USDC and ~0.001296 cbBTC, which at ~77,098 USDC/cbBTC is ~$190.
    expect(Number(amount0) / 1e6).toBeCloseTo(90.2, 1)
    expect(Number(amount1) / 1e8).toBeCloseTo(0.001296, 6)
  })

  it('holds only token0 at or below the range', () => {
    // Price fell through the bound: the position was bought into the asset on
    // the token0 side and now earns nothing.
    const below = getAmountsForLiquidityAtTicks(
      TICK_LOWER - 1,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )
    expect(below.amount1).toBe(0n)
    expect(below.amount0).toBeGreaterThan(0n)

    const atLower = getAmountsForLiquidityAtTicks(TICK_LOWER, TICK_LOWER, TICK_UPPER, LIQUIDITY)
    expect(atLower.amount1).toBe(0n)
  })

  it('holds only token1 at or above the range', () => {
    const above = getAmountsForLiquidityAtTicks(
      TICK_UPPER + 1,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )
    expect(above.amount0).toBe(0n)
    expect(above.amount1).toBeGreaterThan(0n)

    const atUpper = getAmountsForLiquidityAtTicks(TICK_UPPER, TICK_LOWER, TICK_UPPER, LIQUIDITY)
    expect(atUpper.amount0).toBe(0n)
  })

  it('is continuous across each boundary', () => {
    // Stepping one tick over a bound must not jump the inventory: the in-range
    // formula and the out-of-range one have to agree at the edge.
    const justInside = getAmountsForLiquidityAtTicks(
      TICK_UPPER - 1,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )
    const atBoundary = getAmountsForLiquidityAtTicks(
      TICK_UPPER,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )
    const drift = Number(atBoundary.amount1 - justInside.amount1) / Number(justInside.amount1)
    expect(Math.abs(drift)).toBeLessThan(1e-3)
  })

  it('returns zero for zero liquidity', () => {
    expect(getAmountsForLiquidityAtTicks(TICK_CURRENT, TICK_LOWER, TICK_UPPER, 0n)).toEqual({
      amount0: 0n,
      amount1: 0n,
    })
  })

  it('accepts the bounds in either order', () => {
    const a = getAmountsForLiquidity(
      getSqrtRatioAtTick(TICK_CURRENT),
      getSqrtRatioAtTick(TICK_LOWER),
      getSqrtRatioAtTick(TICK_UPPER),
      LIQUIDITY,
    )
    const b = getAmountsForLiquidity(
      getSqrtRatioAtTick(TICK_CURRENT),
      getSqrtRatioAtTick(TICK_UPPER),
      getSqrtRatioAtTick(TICK_LOWER),
      LIQUIDITY,
    )
    expect(a).toEqual(b)
  })

  it('handles a uint128 liquidity value without precision loss', () => {
    // Above 2^53 a double silently rounds; the result must stay exact.
    const huge = 2n ** 100n
    const { amount0, amount1 } = getAmountsForLiquidityAtTicks(
      TICK_CURRENT,
      TICK_LOWER,
      TICK_UPPER,
      huge,
    )
    expect(typeof amount0).toBe('bigint')
    expect(amount0 > 2n ** 60n).toBe(true)
    expect(amount1 > 0n).toBe(true)
  })

  it('scales linearly with liquidity', () => {
    const single = getAmountsForLiquidityAtTicks(TICK_CURRENT, TICK_LOWER, TICK_UPPER, LIQUIDITY)
    const double = getAmountsForLiquidityAtTicks(
      TICK_CURRENT,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY * 2n,
    )
    expect(double.amount0 - single.amount0 * 2n).toBeLessThanOrEqual(1n)
    expect(double.amount1 - single.amount1 * 2n).toBeLessThanOrEqual(1n)
  })
})

describe('getLiquidityForAmounts', () => {
  it('inverts getAmountsForLiquidity to within rounding', () => {
    const sqrtP = getSqrtRatioAtTick(TICK_CURRENT)
    const sqrtA = getSqrtRatioAtTick(TICK_LOWER)
    const sqrtB = getSqrtRatioAtTick(TICK_UPPER)

    const { amount0, amount1 } = getAmountsForLiquidity(sqrtP, sqrtA, sqrtB, LIQUIDITY)
    const recovered = getLiquidityForAmounts(sqrtP, sqrtA, sqrtB, amount0, amount1)

    // Truncation on the way out means the recovered value is at most the
    // original, never more — it must never overstate a position's size.
    expect(recovered).toBeLessThanOrEqual(LIQUIDITY)

    // Round-tripping the amounts back through the forward function must also
    // only ever lose, never gain.
    const again = getAmountsForLiquidity(sqrtP, sqrtA, sqrtB, recovered)
    expect(again.amount0).toBeLessThanOrEqual(amount0)
    expect(again.amount1).toBeLessThanOrEqual(amount1)

    // The loss is structural rather than a defect: getLiquidityForAmounts takes
    // the MIN of two independently truncated estimates, so the non-limiting
    // side always comes back slightly short. Bound it relatively — on this
    // position it is ~99 base units of USDC, i.e. about $0.0001 on $190.
    const relative0 = Number(amount0 - again.amount0) / Number(amount0)
    const relative1 = Number(amount1 - again.amount1) / Number(amount1)
    expect(relative0).toBeLessThan(1e-5)
    expect(relative1).toBeLessThan(1e-5)
  })

  it('uses only the relevant side when out of range', () => {
    const sqrtA = getSqrtRatioAtTick(TICK_LOWER)
    const sqrtB = getSqrtRatioAtTick(TICK_UPPER)

    const below = getLiquidityForAmounts(getSqrtRatioAtTick(TICK_LOWER - 100), sqrtA, sqrtB, 1000n, 0n)
    expect(below).toBeGreaterThan(0n)

    const above = getLiquidityForAmounts(getSqrtRatioAtTick(TICK_UPPER + 100), sqrtA, sqrtB, 0n, 1000n)
    expect(above).toBeGreaterThan(0n)
  })
})

describe('subInUint256', () => {
  it('wraps on underflow exactly as Solidity does', () => {
    // This is the crux of the fee maths. Solidity wraps; JavaScript bigint does
    // not, and an unmasked subtraction yields a negative accumulator.
    expect(subInUint256(0n, 1n)).toBe(MAX_UINT256)
    expect(subInUint256(5n, 10n)).toBe(MAX_UINT256 - 4n)
    expect(subInUint256(0n, 1n) > 0n).toBe(true)
  })

  it('behaves normally when there is no underflow', () => {
    expect(subInUint256(10n, 3n)).toBe(7n)
    expect(subInUint256(MAX_UINT256, 0n)).toBe(MAX_UINT256)
  })

  it('round-trips: (a - b) + b === a in uint256', () => {
    const a = 12345n
    const b = 99999n
    expect(subInUint256(subInUint256(a, b) + b, 0n) & MAX_UINT256).toBe(a)
  })
})

describe('feeGrowthInside', () => {
  const GLOBAL = 10n ** 30n

  it('is the global accumulator when both bounds have zero growth outside', () => {
    const inside = feeGrowthInside({
      feeGrowthGlobal: GLOBAL,
      lowerFeeGrowthOutside: 0n,
      upperFeeGrowthOutside: 0n,
      currentTick: TICK_CURRENT,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
    })
    expect(inside).toBe(GLOBAL)
  })

  it('subtracts growth below when the price is above the lower bound', () => {
    const inside = feeGrowthInside({
      feeGrowthGlobal: GLOBAL,
      lowerFeeGrowthOutside: 40n,
      upperFeeGrowthOutside: 0n,
      currentTick: TICK_CURRENT,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
    })
    expect(inside).toBe(GLOBAL - 40n)
  })

  it('inverts the lower term when the price is below the range', () => {
    const inside = feeGrowthInside({
      feeGrowthGlobal: GLOBAL,
      lowerFeeGrowthOutside: 40n,
      upperFeeGrowthOutside: 0n,
      currentTick: TICK_LOWER - 1,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
    })
    // below = global - 40, above = 0, so inside = global - (global - 40) = 40
    expect(inside).toBe(40n)
  })

  it('inverts the upper term when the price is above the range', () => {
    const inside = feeGrowthInside({
      feeGrowthGlobal: GLOBAL,
      lowerFeeGrowthOutside: 0n,
      upperFeeGrowthOutside: 250n,
      currentTick: TICK_UPPER + 1,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
    })
    expect(inside).toBe(250n)
  })

  it('never returns a negative value, even when the terms exceed the global', () => {
    // Real pools produce exactly this: the accumulators wrap, and the
    // difference is only meaningful modulo 2^256.
    const inside = feeGrowthInside({
      feeGrowthGlobal: 100n,
      lowerFeeGrowthOutside: 500n,
      upperFeeGrowthOutside: 700n,
      currentTick: TICK_CURRENT,
      tickLower: TICK_LOWER,
      tickUpper: TICK_UPPER,
    })
    expect(inside >= 0n).toBe(true)
    expect(inside <= MAX_UINT256).toBe(true)
  })
})

describe('uncollectedFees', () => {
  it('computes fees from the growth delta', () => {
    // Choose the delta so the answer is exactly 1.42 USDC.
    const target = 1_420_000n
    const delta = (target * 2n ** 128n) / LIQUIDITY
    const global = delta * 3n + 10n ** 30n

    const fees = uncollectedFees({
      liquidity: LIQUIDITY,
      feeGrowthInside: global,
      feeGrowthInsideLast: global - delta,
      tokensOwed: 0n,
    })

    // Both the delta and the fee division truncate, so the result lands at most
    // one base unit low. Rounding DOWN is the correct direction: overstating
    // uncollected fees would show money that cannot actually be collected.
    expect(fees).toBeLessThanOrEqual(target)
    expect(target - fees).toBeLessThanOrEqual(1n)
  })

  it('adds tokensOwed, which is already checkpointed', () => {
    const fees = uncollectedFees({
      liquidity: LIQUIDITY,
      feeGrowthInside: 1000n,
      feeGrowthInsideLast: 1000n,
      tokensOwed: 777n,
    })
    expect(fees).toBe(777n)
  })

  it('survives a wrapped growth delta without producing a negative fee', () => {
    // The delta is computed with the uint256 mask, so a wrapped accumulator
    // still yields a sane, non-negative fee rather than a negative one.
    const fees = uncollectedFees({
      liquidity: 1n,
      feeGrowthInside: 5n,
      feeGrowthInsideLast: 10n,
      tokensOwed: 0n,
    })
    expect(fees >= 0n).toBe(true)
  })

  it('returns zero when nothing has accrued', () => {
    expect(
      uncollectedFees({
        liquidity: LIQUIDITY,
        feeGrowthInside: 0n,
        feeGrowthInsideLast: 0n,
        tokensOwed: 0n,
      }),
    ).toBe(0n)
  })
})
