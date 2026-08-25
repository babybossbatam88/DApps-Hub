import { Decimal } from '@/lib/utils/format'

/**
 * Uniswap V3 fixed-point maths.
 *
 * Ported from `TickMath.sol` and `LiquidityAmounts.sol`, bit-for-bit. Every
 * value here is a `bigint`: a `uint256` routinely exceeds `Number.MAX_SAFE_INTEGER`,
 * so a single `Number()` anywhere in this file would silently corrupt results.
 *
 * The port is bit-exact rather than approximate on purpose. These numbers are
 * compared against on-chain state and used to derive money figures; an
 * implementation that is merely close produces amounts that disagree with the
 * contract by a few wei, which then shows up as an unexplained drift in
 * LP-vs-HODL that nobody can trace.
 */

export const Q96 = 2n ** 96n
export const Q128 = 2n ** 128n
export const MAX_UINT256 = (1n << 256n) - 1n

export const MIN_TICK = -887272
export const MAX_TICK = 887272

/** sqrtRatio at MIN_TICK / MAX_TICK. Also the bounds `slot0` can report. */
export const MIN_SQRT_RATIO = 4295128739n
export const MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342n

/** Canonical tick spacing per fee tier (hundredths of a bip). */
export const TICK_SPACINGS: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
}

export class TickMathError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TickMathError'
  }
}

/**
 * `uint256` subtraction that wraps exactly as Solidity does.
 *
 * Fee-growth accumulators are `uint256` values that intentionally underflow.
 * JavaScript `bigint` does not wrap, so an unmasked subtraction yields a
 * negative number and, downstream, wildly wrong fees. Every subtraction of two
 * accumulators must go through here.
 */
export function subInUint256(a: bigint, b: bigint): bigint {
  return (a - b) & MAX_UINT256
}

// The magic constants below are the successive square roots of 1.0001 in Q128,
// exactly as they appear in TickMath.sol. Do not "tidy" them.
const TICK_RATIO_FACTORS: ReadonlyArray<readonly [bigint, bigint]> = [
  [0x2n, 0xfff97272373d413259a46990580e213an],
  [0x4n, 0xfff2e50f5f656932ef12357cf3c7fdccn],
  [0x8n, 0xffe5caca7e10e4e61c3624eaa0941cd0n],
  [0x10n, 0xffcb9843d60f6159c9db58835c926644n],
  [0x20n, 0xff973b41fa98c081472e6896dfb254c0n],
  [0x40n, 0xff2ea16466c96a3843ec78b326b52861n],
  [0x80n, 0xfe5dee046a99a2a811c461f1969c3053n],
  [0x100n, 0xfcbe86c7900a88aedcffc83b479aa3a4n],
  [0x200n, 0xf987a7253ac413176f2b074cf7815e54n],
  [0x400n, 0xf3392b0822b70005940c7a398e4b70f3n],
  [0x800n, 0xe7159475a2c29b7443b29c7fa6e889d9n],
  [0x1000n, 0xd097f3bdfd2022b8845ad8f792aa5825n],
  [0x2000n, 0xa9f746462d870fdf8a65dc1f90e061e5n],
  [0x4000n, 0x70d869a156d2a1b890bb3df62baf32f7n],
  [0x8000n, 0x31be135f97d08fd981231505542fcfa6n],
  [0x10000n, 0x9aa508b5b7a84e1c677de54f3e99bc9n],
  [0x20000n, 0x5d6af8dedb81196699c329225ee604n],
  [0x40000n, 0x2216e584f5fa1ea926041bedfe98n],
  [0x80000n, 0x48a170391f7dc42444e8fa2n],
]

/**
 * `TickMath.getSqrtRatioAtTick` — sqrt(1.0001^tick) in Q64.96.
 *
 * Computed by bit-decomposing |tick| and multiplying the precomputed factors,
 * which is exact. Evaluating `1.0001 ** tick` in floating point is not: at
 * |tick| near 887272 the result spans ~38 orders of magnitude and a double has
 * nowhere near the precision to land on the same integer as the contract.
 */
export function getSqrtRatioAtTick(tick: number): bigint {
  if (!Number.isInteger(tick)) throw new TickMathError(`Tick must be an integer, got ${tick}`)
  if (tick < MIN_TICK || tick > MAX_TICK) {
    throw new TickMathError(`Tick ${tick} is outside [${MIN_TICK}, ${MAX_TICK}]`)
  }

  const absTick = BigInt(tick < 0 ? -tick : tick)

  let ratio =
    (absTick & 0x1n) !== 0n
      ? 0xfffcb933bd6fad37aa2d162d1a594001n
      : 0x100000000000000000000000000000000n

  for (const [bit, factor] of TICK_RATIO_FACTORS) {
    if ((absTick & bit) !== 0n) ratio = (ratio * factor) >> 128n
  }

  // A positive tick is the reciprocal of the negative one.
  if (tick > 0) ratio = MAX_UINT256 / ratio

  // Q128.128 -> Q64.96, rounding up so the result never understates the price.
  return (ratio >> 32n) + (ratio % (1n << 32n) === 0n ? 0n : 1n)
}

/**
 * `TickMath.getTickAtSqrtRatio` — the inverse.
 *
 * Returns the greatest tick whose sqrtRatio is <= the input, matching the
 * contract exactly (including its choice between the two candidate ticks).
 */
export function getTickAtSqrtRatio(sqrtPriceX96: bigint): number {
  if (sqrtPriceX96 < MIN_SQRT_RATIO || sqrtPriceX96 >= MAX_SQRT_RATIO) {
    throw new TickMathError(`sqrtPriceX96 ${sqrtPriceX96} is outside the representable range`)
  }

  const ratio = sqrtPriceX96 << 32n
  const msb = BigInt(ratio.toString(2).length - 1)

  let r = msb >= 128n ? ratio >> (msb - 127n) : ratio << (127n - msb)
  let log2 = (msb - 128n) << 64n

  for (let i = 0; i < 14; i++) {
    r = (r * r) >> 127n
    const f = r >> 128n
    log2 = log2 | (f << BigInt(63 - i))
    r = r >> f
  }

  // log_sqrt10001 = log2 * log(2) / log(sqrt(1.0001)), in Q128.128
  const logSqrt10001 = log2 * 255738958999603826347141n

  const tickLow = Number(
    asInt24((logSqrt10001 - 3402992956809132418596140100660247210n) >> 128n),
  )
  const tickHigh = Number(
    asInt24((logSqrt10001 + 291339464771989622907027621153398088495n) >> 128n),
  )

  if (tickLow === tickHigh) return tickLow
  return getSqrtRatioAtTick(tickHigh) <= sqrtPriceX96 ? tickHigh : tickLow
}

function asInt24(value: bigint): bigint {
  const masked = value & 0xffffffn
  return masked >= 0x800000n ? masked - 0x1000000n : masked
}

/**
 * Snap a tick to the pool's spacing.
 *
 * `direction` matters: a requested range must never come back narrower than
 * asked for, so a lower bound rounds down and an upper bound rounds up.
 */
export function nearestUsableTick(
  tick: number,
  tickSpacing: number,
  direction: 'down' | 'up' | 'nearest' = 'nearest',
): number {
  if (tickSpacing <= 0) throw new TickMathError(`Tick spacing must be positive, got ${tickSpacing}`)
  const raw = tick / tickSpacing
  const snapped =
    direction === 'down' ? Math.floor(raw) : direction === 'up' ? Math.ceil(raw) : Math.round(raw)
  const result = snapped * tickSpacing
  // Clamp inside the representable range rather than producing an invalid tick.
  if (result < MIN_TICK) return Math.ceil(MIN_TICK / tickSpacing) * tickSpacing
  if (result > MAX_TICK) return Math.floor(MAX_TICK / tickSpacing) * tickSpacing
  return result
}

export function tickSpacingForFee(feeTier: number): number {
  const spacing = TICK_SPACINGS[feeTier]
  if (spacing === undefined) throw new TickMathError(`Unknown fee tier: ${feeTier}`)
  return spacing
}

// ---------------------------------------------------------------------------
// Price conversion
// ---------------------------------------------------------------------------

/**
 * sqrtPriceX96 -> price of token0 denominated in token1, as a Decimal in human
 * units. `(sqrtP / 2^96)^2` scaled by `10^(decimals0 - decimals1)`.
 *
 * Returned as a Decimal rather than a bigint because a price is inherently
 * fractional; the integer maths above stays in bigint where exactness matters.
 */
export function priceFromSqrtRatio(
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number,
): Decimal {
  const numerator = new Decimal((sqrtPriceX96 * sqrtPriceX96).toString())
  const denominator = new Decimal((Q96 * Q96).toString())
  return numerator.div(denominator).mul(new Decimal(10).pow(decimals0 - decimals1))
}

/** tick -> price of token0 in token1, human units. */
export function priceAtTick(tick: number, decimals0: number, decimals1: number): Decimal {
  return priceFromSqrtRatio(getSqrtRatioAtTick(tick), decimals0, decimals1)
}

/**
 * price (token0 in token1, human units) -> the tick at or below it.
 *
 * Inverts `priceAtTick`. Uses `log` at 40 significant digits and then corrects
 * by one tick if needed, so the result is exact rather than off-by-one near a
 * boundary.
 */
export function tickAtPrice(price: Decimal | string | number, decimals0: number, decimals1: number): number {
  const p = new Decimal(price)
  if (p.lte(0)) throw new TickMathError('Price must be positive')

  const raw = p.div(new Decimal(10).pow(decimals0 - decimals1))
  const approx = raw.ln().div(new Decimal('1.0001').ln())
  let tick = Math.floor(Number(approx.toFixed(10)))
  tick = Math.max(MIN_TICK, Math.min(MAX_TICK, tick))

  // Correct any off-by-one introduced by the logarithm.
  const priceOf = (t: number) => priceAtTick(t, decimals0, decimals1)
  while (tick < MAX_TICK && priceOf(tick + 1).lte(p)) tick += 1
  while (tick > MIN_TICK && priceOf(tick).gt(p)) tick -= 1
  return tick
}

// ---------------------------------------------------------------------------
// LiquidityAmounts
// ---------------------------------------------------------------------------

export interface TokenAmounts {
  amount0: bigint
  amount1: bigint
}

/** `LiquidityAmounts.getAmount0ForLiquidity` */
export function getAmount0ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  if (sqrtA <= 0n) throw new TickMathError('sqrtRatio must be positive')
  return (liquidity * Q96 * (sqrtB - sqrtA)) / sqrtB / sqrtA
}

/** `LiquidityAmounts.getAmount1ForLiquidity` */
export function getAmount1ForLiquidity(sqrtA: bigint, sqrtB: bigint, liquidity: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  return (liquidity * (sqrtB - sqrtA)) / Q96
}

/**
 * Token amounts held by `liquidity` over [sqrtA, sqrtB] at the current price.
 *
 * Three cases, and the two out-of-range ones are the product's whole point:
 *   price at or below the range -> entirely token0. The price fell and the
 *     position was bought into the asset that fell.
 *   price in range              -> both.
 *   price at or above the range -> entirely token1. The position sold the
 *     asset that rose.
 * Neither is a fault; both earn nothing, and the UI must say which it is.
 */
export function getAmountsForLiquidity(
  sqrtPriceX96: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  liquidity: bigint,
): TokenAmounts {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  if (liquidity === 0n) return { amount0: 0n, amount1: 0n }

  if (sqrtPriceX96 <= sqrtA) {
    return { amount0: getAmount0ForLiquidity(sqrtA, sqrtB, liquidity), amount1: 0n }
  }
  if (sqrtPriceX96 < sqrtB) {
    return {
      amount0: getAmount0ForLiquidity(sqrtPriceX96, sqrtB, liquidity),
      amount1: getAmount1ForLiquidity(sqrtA, sqrtPriceX96, liquidity),
    }
  }
  return { amount0: 0n, amount1: getAmount1ForLiquidity(sqrtA, sqrtB, liquidity) }
}

/** Convenience wrapper taking ticks rather than sqrt ratios. */
export function getAmountsForLiquidityAtTicks(
  currentTick: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): TokenAmounts {
  return getAmountsForLiquidity(
    getSqrtRatioAtTick(currentTick),
    getSqrtRatioAtTick(tickLower),
    getSqrtRatioAtTick(tickUpper),
    liquidity,
  )
}

/**
 * `LiquidityAmounts.getLiquidityForAmounts` — the inverse, used by the
 * simulation lab to size a hypothetical position.
 */
export function getLiquidityForAmounts(
  sqrtPriceX96: bigint,
  sqrtA: bigint,
  sqrtB: bigint,
  amount0: bigint,
  amount1: bigint,
): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]

  if (sqrtPriceX96 <= sqrtA) {
    return liquidityForAmount0(sqrtA, sqrtB, amount0)
  }
  if (sqrtPriceX96 < sqrtB) {
    const l0 = liquidityForAmount0(sqrtPriceX96, sqrtB, amount0)
    const l1 = liquidityForAmount1(sqrtA, sqrtPriceX96, amount1)
    return l0 < l1 ? l0 : l1
  }
  return liquidityForAmount1(sqrtA, sqrtB, amount1)
}

function liquidityForAmount0(sqrtA: bigint, sqrtB: bigint, amount0: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  const intermediate = (sqrtA * sqrtB) / Q96
  return sqrtB === sqrtA ? 0n : (amount0 * intermediate) / (sqrtB - sqrtA)
}

function liquidityForAmount1(sqrtA: bigint, sqrtB: bigint, amount1: bigint): bigint {
  if (sqrtA > sqrtB) [sqrtA, sqrtB] = [sqrtB, sqrtA]
  return sqrtB === sqrtA ? 0n : (amount1 * Q96) / (sqrtB - sqrtA)
}

// ---------------------------------------------------------------------------
// Fee growth
// ---------------------------------------------------------------------------

/**
 * `feeGrowthInside` for one token, from the pool's global accumulator and the
 * per-tick `feeGrowthOutside` values at both bounds.
 *
 * Every subtraction wraps in uint256. See `subInUint256`.
 */
export function feeGrowthInside(params: {
  feeGrowthGlobal: bigint
  lowerFeeGrowthOutside: bigint
  upperFeeGrowthOutside: bigint
  currentTick: number
  tickLower: number
  tickUpper: number
}): bigint {
  const { feeGrowthGlobal, lowerFeeGrowthOutside, upperFeeGrowthOutside } = params
  const below =
    params.currentTick >= params.tickLower
      ? lowerFeeGrowthOutside
      : subInUint256(feeGrowthGlobal, lowerFeeGrowthOutside)
  const above =
    params.currentTick < params.tickUpper
      ? upperFeeGrowthOutside
      : subInUint256(feeGrowthGlobal, upperFeeGrowthOutside)
  return subInUint256(subInUint256(feeGrowthGlobal, below), above)
}

/** Fees accrued but not yet collected, in raw base units. */
export function uncollectedFees(params: {
  liquidity: bigint
  feeGrowthInside: bigint
  feeGrowthInsideLast: bigint
  tokensOwed: bigint
}): bigint {
  const delta = subInUint256(params.feeGrowthInside, params.feeGrowthInsideLast)
  return params.tokensOwed + (params.liquidity * delta) / Q128
}
