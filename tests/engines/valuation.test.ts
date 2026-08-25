import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/utils/format'
import { valuePosition, valueTokenPair } from '@/lib/engines/valuation'
import {
  getAmountsForLiquidityAtTicks,
  getSqrtRatioAtTick,
  Q96,
} from '@/lib/protocols/uniswap-v3/math'
import { poolSpotPrice, priceAtTickOriented, resolveOrientation } from '@/lib/prices/pool-price'

// The cbBTC/USDC test position. USDC is token0 (6dp), cbBTC is token1 (8dp).
const USDC = { chainId: 8453, address: '0x8335', symbol: 'USDC', decimals: 6 }
const CBBTC = { chainId: 8453, address: '0xcbb7', symbol: 'cbBTC', decimals: 8 }
const TICK_LOWER = -67680
const TICK_UPPER = -65400
const TICK_CURRENT = -66480
const LIQUIDITY = 61800000n

function testPosition() {
  const { amount0, amount1 } = getAmountsForLiquidityAtTicks(
    TICK_CURRENT,
    TICK_LOWER,
    TICK_UPPER,
    LIQUIDITY,
  )
  const quote = poolSpotPrice({
    sqrtPriceX96: getSqrtRatioAtTick(TICK_CURRENT),
    token0: USDC,
    token1: CBBTC,
    quoteIsToken0: true,
    blockNumber: 34_000_123n,
    observedAt: '2026-01-01T00:00:00.000Z',
  })
  return { amount0, amount1, price: quote.value!.price }
}

describe('poolSpotPrice', () => {
  it('reads the test position price as ~77,098 USDC per cbBTC', () => {
    const { price } = testPosition()
    expect(Number(price.toFixed(0))).toBeCloseTo(77098, -1)
  })

  it('names the base and quote from the orientation', () => {
    const quote = poolSpotPrice({
      sqrtPriceX96: getSqrtRatioAtTick(TICK_CURRENT),
      token0: USDC,
      token1: CBBTC,
      quoteIsToken0: true,
      blockNumber: 1n,
      observedAt: '2026-01-01T00:00:00.000Z',
    }).value!
    expect(quote.base.symbol).toBe('cbBTC')
    expect(quote.quote.symbol).toBe('USDC')
  })

  it('is not a proxy — it is the pool the position lives in', () => {
    const quote = poolSpotPrice({
      sqrtPriceX96: Q96,
      token0: USDC,
      token1: CBBTC,
      quoteIsToken0: true,
      blockNumber: 1n,
      observedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(quote.value?.isProxy).toBe(false)
    expect(quote.source).toBe('onchain')
    expect(quote.confidence).toBe('higher')
  })

  it('carries the block number, so the price is attributable', () => {
    const quote = poolSpotPrice({
      sqrtPriceX96: Q96,
      token0: USDC,
      token1: CBBTC,
      quoteIsToken0: true,
      blockNumber: 34_000_123n,
      observedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(quote.value?.blockNumber).toBe('34000123')
  })

  it('does not invert when the quote is token1', () => {
    const upright = poolSpotPrice({
      sqrtPriceX96: getSqrtRatioAtTick(TICK_CURRENT),
      token0: CBBTC,
      token1: USDC,
      quoteIsToken0: false,
      blockNumber: 1n,
      observedAt: '2026-01-01T00:00:00.000Z',
    }).value!
    expect(upright.base.symbol).toBe('cbBTC')
    expect(upright.quote.symbol).toBe('USDC')
  })
})

describe('resolveOrientation', () => {
  it('quotes in the stablecoin when exactly one side is stable', () => {
    expect(resolveOrientation({ token0IsStablecoin: true, token1IsStablecoin: false })).toEqual({
      quoteIsToken0: true,
    })
    expect(resolveOrientation({ token0IsStablecoin: false, token1IsStablecoin: true })).toEqual({
      quoteIsToken0: false,
    })
  })

  it('keeps protocol ordering when neither or both sides are stable', () => {
    // Inventing an orientation would be arbitrary and would differ per screen.
    expect(resolveOrientation({ token0IsStablecoin: false, token1IsStablecoin: false })).toEqual({
      quoteIsToken0: false,
    })
    expect(resolveOrientation({ token0IsStablecoin: true, token1IsStablecoin: true })).toEqual({
      quoteIsToken0: false,
    })
  })
})

describe('valuePosition', () => {
  it('values the test position at ~190 USDC', () => {
    const { amount0, amount1, price } = testPosition()
    const valuation = valuePosition({
      amount0,
      amount1,
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: price,
      quoteIsToken0: true,
    })

    expect(Number(valuation.totalValue.toFixed(2))).toBeCloseTo(190.13, 1)
    // ~90.20 USDC held directly, ~99.92 USDC worth of cbBTC.
    expect(Number(valuation.value0.toFixed(2))).toBeCloseTo(90.2, 1)
    expect(Number(valuation.value1.toFixed(2))).toBeCloseTo(99.92, 1)
  })

  /**
   * The Phase 4 exit criterion: the engine's value must match an INDEPENDENT
   * calculation to better than 0.1%. This one derives the price straight from
   * sqrtPriceX96 with a different formula ordering and never touches
   * valuePosition, so agreement is evidence rather than a tautology.
   */
  it('matches an independent calculation to within 0.1%', () => {
    const { amount0, amount1, price } = testPosition()

    const engine = valuePosition({
      amount0,
      amount1,
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: price,
      quoteIsToken0: true,
    }).totalValue

    // Independent path: (2^96 / sqrtP)^2 gives token0 per token1 directly,
    // scaled by the decimal difference the other way round.
    const sqrtP = getSqrtRatioAtTick(TICK_CURRENT)
    const q96 = new Decimal(Q96.toString())
    const sqrt = new Decimal(sqrtP.toString())
    const usdcPerCbbtc = q96
      .div(sqrt)
      .pow(2)
      .mul(new Decimal(10).pow(8 - 6))

    const usdc = new Decimal(amount0.toString()).div(new Decimal(10).pow(6))
    const cbbtc = new Decimal(amount1.toString()).div(new Decimal(10).pow(8))
    const independent = usdc.plus(cbbtc.mul(usdcPerCbbtc))

    const relativeError = engine.minus(independent).abs().div(independent)
    expect(relativeError.lt(0.001)).toBe(true)
  })

  it('splits allocation to 100%', () => {
    const { amount0, amount1, price } = testPosition()
    const v = valuePosition({
      amount0,
      amount1,
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: price,
      quoteIsToken0: true,
    })
    const total = v.allocation0Percent!.plus(v.allocation1Percent!)
    expect(Number(total.toFixed(6))).toBeCloseTo(100, 5)
  })

  it('reports allocation as null for an empty position, not 0%', () => {
    // 0% / 0% would imply the position has an allocation. It has none.
    const v = valuePosition({
      amount0: 0n,
      amount1: 0n,
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: new Decimal(77098),
      quoteIsToken0: true,
    })
    expect(v.totalValue.isZero()).toBe(true)
    expect(v.allocation0Percent).toBeNull()
    expect(v.allocation1Percent).toBeNull()
  })

  it('values an out-of-range position entirely on one side', () => {
    const { amount0, amount1 } = getAmountsForLiquidityAtTicks(
      TICK_UPPER + 1,
      TICK_LOWER,
      TICK_UPPER,
      LIQUIDITY,
    )
    expect(amount0).toBe(0n)

    const v = valuePosition({
      amount0,
      amount1,
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: priceAtTickOriented(TICK_UPPER + 1, 6, 8, true),
      quoteIsToken0: true,
    })
    expect(v.value0.isZero()).toBe(true)
    expect(v.value1.gt(0)).toBe(true)
    expect(Number(v.allocation1Percent!.toFixed(4))).toBeCloseTo(100, 3)
  })

  it('does not lose precision on an 18-decimal side', () => {
    const v = valuePosition({
      amount0: 1_000_000n, // 1 USDC
      amount1: 1_000_000_000_000_000_001n, // 1.000000000000000001 WETH
      decimals0: 6,
      decimals1: 18,
      priceQuotePerBase: new Decimal('3421.55'),
      quoteIsToken0: true,
    })
    expect(v.amount1.toString()).toBe('1.000000000000000001')
    // 1 + 1.000000000000000001 * 3421.55
    expect(v.totalValue.toFixed(10)).toBe('3422.5500000000')
  })

  it('handles the upright orientation', () => {
    const v = valuePosition({
      amount0: 100_000_000n, // 1 cbBTC as token0
      amount1: 5_000_000n, // 5 USDC as token1
      decimals0: 8,
      decimals1: 6,
      priceQuotePerBase: new Decimal(77000),
      quoteIsToken0: false,
    })
    expect(Number(v.totalValue.toFixed(2))).toBe(77005)
  })
})

describe('valueTokenPair', () => {
  it('values fees at the same price as the inventory', () => {
    const value = valueTokenPair(1_420_000n, 750n, {
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: new Decimal(77098),
      quoteIsToken0: true,
    })
    // 1.42 USDC + 0.0000075 cbBTC * 77,098 = 1.42 + 0.578
    expect(Number(value.toFixed(2))).toBeCloseTo(2.0, 1)
  })

  it('returns zero for an empty pair', () => {
    const value = valueTokenPair(0n, 0n, {
      decimals0: 6,
      decimals1: 8,
      priceQuotePerBase: new Decimal(77098),
      quoteIsToken0: true,
    })
    expect(value.isZero()).toBe(true)
  })
})
