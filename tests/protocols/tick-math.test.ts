import { describe, expect, it } from 'vitest'
import { Decimal } from '@/lib/utils/format'
import {
  MAX_SQRT_RATIO,
  MAX_TICK,
  MIN_SQRT_RATIO,
  MIN_TICK,
  Q96,
  TickMathError,
  getSqrtRatioAtTick,
  getTickAtSqrtRatio,
  nearestUsableTick,
  priceAtTick,
  priceFromSqrtRatio,
  tickAtPrice,
  tickSpacingForFee,
} from '@/lib/protocols/uniswap-v3/math'

describe('getSqrtRatioAtTick — canonical vectors', () => {
  // These three are the anchors every TickMath implementation is checked
  // against. If a single magic constant were mistyped, at least one would move.
  it('tick 0 is exactly 2^96', () => {
    expect(getSqrtRatioAtTick(0)).toBe(79228162514264337593543950336n)
    expect(getSqrtRatioAtTick(0)).toBe(Q96)
  })

  it('MIN_TICK matches MIN_SQRT_RATIO', () => {
    expect(getSqrtRatioAtTick(MIN_TICK)).toBe(4295128739n)
    expect(getSqrtRatioAtTick(MIN_TICK)).toBe(MIN_SQRT_RATIO)
  })

  it('MAX_TICK matches MAX_SQRT_RATIO', () => {
    expect(getSqrtRatioAtTick(MAX_TICK)).toBe(
      1461446703485210103287273052203988822378723970342n,
    )
    expect(getSqrtRatioAtTick(MAX_TICK)).toBe(MAX_SQRT_RATIO)
  })

  it('is exact for the ticks bounding the cbBTC/USDC test range', () => {
    // Each of these was cross-checked against 80-digit decimal exponentiation
    // before being pinned here, so a refactor that changes any result fails.
    expect(getSqrtRatioAtTick(-67680)).toBe(2687203365237529671695964392n)
    expect(getSqrtRatioAtTick(-66480)).toBe(2853362181680133356376706431n)
    expect(getSqrtRatioAtTick(-65400)).toBe(3011671716152457323088108482n)
  })

  it('is exact for the ticks bounding the WETH/USDC test range', () => {
    expect(getSqrtRatioAtTick(193890)).toBe(1285100046177319560354020894118969n)
    expect(getSqrtRatioAtTick(196260)).toBe(1446765894353319399313939355477631n)
    expect(getSqrtRatioAtTick(196600)).toBe(1471569911189598926244387583186675n)
  })
})

describe('getSqrtRatioAtTick — independent cross-check', () => {
  /**
   * The bit-decomposition port is checked against a completely different
   * method: sqrt(1.0001^tick) * 2^96 evaluated in 60-digit decimal arithmetic.
   * Agreement between two unrelated algorithms is far stronger evidence than
   * either one matching itself.
   */
  it('agrees with high-precision decimal exponentiation across the range', () => {
    const HighPrecision = Decimal.clone({ precision: 60 })
    const base = new HighPrecision('1.0001')
    const q96 = new HighPrecision(2).pow(96)

    const ticks = [
      -887272, -600000, -300000, -195000, -67680, -66480, -65400, -10000, -1000, -100, -1,
      0, 1, 100, 1000, 10000, 65400, 195000, 300000, 600000, 887272,
    ]

    for (const tick of ticks) {
      const expected = base.pow(tick).sqrt().mul(q96)
      const actual = new HighPrecision(getSqrtRatioAtTick(tick).toString())
      const relativeError = actual.minus(expected).abs().div(expected)
      // Not tighter than 1e-9, and deliberately so. The contract truncates at
      // each of 19 fixed-point multiplications and then rounds up into Q64.96,
      // and at MIN_TICK the ratio is only ~4.3e9, so one integer unit is
      // already 2.3e-10 relative. The contract is the definition, not the
      // ideal — this bound is loose enough to accept its rounding and tight
      // enough that a single mistyped magic constant fails immediately.
      expect(relativeError.lt(1e-9)).toBe(true)
    }
  })

  it('is strictly monotonic', () => {
    let previous = 0n
    for (let tick = MIN_TICK; tick <= MAX_TICK; tick += 4691) {
      const value = getSqrtRatioAtTick(tick)
      expect(value > previous).toBe(true)
      previous = value
    }
  })

  it('is symmetric: ratio(t) * ratio(-t) is 2^192', () => {
    const target = 2n ** 192n
    for (const tick of [1, 60, 1000, 66480, 300000]) {
      const product = getSqrtRatioAtTick(tick) * getSqrtRatioAtTick(-tick)
      const diff = product > target ? product - target : target - product
      expect(Number((diff * 10n ** 12n) / target)).toBeLessThan(10)
    }
  })

  it('rejects ticks outside the representable range', () => {
    expect(() => getSqrtRatioAtTick(MIN_TICK - 1)).toThrow(TickMathError)
    expect(() => getSqrtRatioAtTick(MAX_TICK + 1)).toThrow(TickMathError)
    expect(() => getSqrtRatioAtTick(1.5)).toThrow(/integer/)
  })
})

describe('getTickAtSqrtRatio', () => {
  it('round-trips exactly with getSqrtRatioAtTick', () => {
    // The contract guarantees getTickAtSqrtRatio(getSqrtRatioAtTick(t)) === t.
    for (let tick = MIN_TICK + 1; tick < MAX_TICK; tick += 2711) {
      expect(getTickAtSqrtRatio(getSqrtRatioAtTick(tick))).toBe(tick)
    }
  })

  it('round-trips the test position ticks', () => {
    for (const tick of [-67680, -66480, -65400, 193890, 196260, 196600]) {
      expect(getTickAtSqrtRatio(getSqrtRatioAtTick(tick))).toBe(tick)
    }
  })

  it('returns the tick at or below a ratio between two ticks', () => {
    const lower = getSqrtRatioAtTick(1000)
    const upper = getSqrtRatioAtTick(1001)
    const between = (lower + upper) / 2n
    expect(getTickAtSqrtRatio(between)).toBe(1000)
  })

  it('handles the boundaries', () => {
    expect(getTickAtSqrtRatio(MIN_SQRT_RATIO)).toBe(MIN_TICK)
    expect(getTickAtSqrtRatio(MAX_SQRT_RATIO - 1n)).toBe(MAX_TICK - 1)
  })

  it('rejects ratios outside the representable range', () => {
    expect(() => getTickAtSqrtRatio(MIN_SQRT_RATIO - 1n)).toThrow(TickMathError)
    expect(() => getTickAtSqrtRatio(MAX_SQRT_RATIO)).toThrow(TickMathError)
  })
})

describe('price conversion', () => {
  const USDC = 6
  const CBBTC = 8

  it('converts the test position range to USDC per cbBTC', () => {
    // USDC is token0 on Base (0x8335… sorts below 0xcbB7…), so the raw price is
    // cbBTC per USDC and the readable one is its reciprocal.
    const atLower = priceAtTick(-67680, USDC, CBBTC)
    const atUpper = priceAtTick(-65400, USDC, CBBTC)

    const usdcPerCbbtcAtLowerTick = new Decimal(1).div(atLower)
    const usdcPerCbbtcAtUpperTick = new Decimal(1).div(atUpper)

    expect(Number(usdcPerCbbtcAtLowerTick.toFixed(0))).toBeCloseTo(86928, -1)
    expect(Number(usdcPerCbbtcAtUpperTick.toFixed(0))).toBeCloseTo(69206, -1)
  })

  it('a higher tick means a lower price once inverted', () => {
    // The orientation trap: for USDC/cbBTC, rising tick is a FALLING price in
    // USDC per cbBTC. Anything that presents range progress must account for it.
    const low = new Decimal(1).div(priceAtTick(-67680, USDC, CBBTC))
    const high = new Decimal(1).div(priceAtTick(-65400, USDC, CBBTC))
    expect(low.gt(high)).toBe(true)
  })

  it('handles an 18/6 decimal pair', () => {
    // USDC/WETH: raw price is WETH per USDC, inverted gives USDC per WETH.
    const price = priceAtTick(193890, 6, 18)
    const usdcPerWeth = new Decimal(1).div(price)
    expect(Number(usdcPerWeth.toFixed(0))).toBeCloseTo(3801, -2)
  })

  it('priceFromSqrtRatio agrees with priceAtTick', () => {
    for (const tick of [-66480, 0, 1000, 193890]) {
      const viaSqrt = priceFromSqrtRatio(getSqrtRatioAtTick(tick), 6, 8)
      const viaTick = priceAtTick(tick, 6, 8)
      expect(viaSqrt.toString()).toBe(viaTick.toString())
    }
  })

  it('keeps full precision on a very small price', () => {
    // cbBTC per USDC is ~1.15e-5. A double would round the tail away and the
    // inverted price would drift by whole dollars per BTC.
    const price = priceAtTick(-67680, 6, 8)
    expect(price.gt(0)).toBe(true)
    // Far more significant digits than a double could carry.
    expect(price.toSignificantDigits(30).toString().replace(/^0\.0+/, '').length)
      .toBeGreaterThan(25)
    // And it inverts back to the documented bound.
    expect(Number(new Decimal(1).div(price).toFixed(0))).toBeCloseTo(86928, -1)
  })
})

describe('tickAtPrice', () => {
  it('inverts priceAtTick exactly', () => {
    for (const tick of [-67680, -66480, -65400, 0, 1000, 193890]) {
      const price = priceAtTick(tick, 6, 8)
      expect(tickAtPrice(price, 6, 8)).toBe(tick)
    }
  })

  it('returns the tick at or below a price between ticks', () => {
    const lower = priceAtTick(1000, 6, 8)
    const upper = priceAtTick(1001, 6, 8)
    const between = lower.plus(upper).div(2)
    expect(tickAtPrice(between, 6, 8)).toBe(1000)
  })

  it('rejects a non-positive price', () => {
    expect(() => tickAtPrice(0, 6, 8)).toThrow(/positive/)
    expect(() => tickAtPrice(-1, 6, 8)).toThrow(/positive/)
  })
})

describe('nearestUsableTick', () => {
  it('snaps to the pool spacing', () => {
    expect(nearestUsableTick(-66500, 60)).toBe(-66480)
    expect(nearestUsableTick(0, 60)).toBe(0)
  })

  it('never narrows a requested range', () => {
    // A lower bound rounds down and an upper bound rounds up, so the resulting
    // range always contains the one that was asked for.
    expect(nearestUsableTick(-67650, 60, 'down')).toBe(-67680)
    expect(nearestUsableTick(-65430, 60, 'up')).toBe(-65400)
  })

  it('clamps to the representable range instead of overflowing', () => {
    expect(nearestUsableTick(MIN_TICK - 5000, 60, 'down')).toBeGreaterThanOrEqual(MIN_TICK)
    expect(nearestUsableTick(MAX_TICK + 5000, 60, 'up')).toBeLessThanOrEqual(MAX_TICK)
  })

  it('rejects a non-positive spacing', () => {
    expect(() => nearestUsableTick(0, 0)).toThrow(TickMathError)
  })
})

describe('tickSpacingForFee', () => {
  it('maps the canonical fee tiers', () => {
    expect(tickSpacingForFee(100)).toBe(1)
    expect(tickSpacingForFee(500)).toBe(10)
    expect(tickSpacingForFee(3000)).toBe(60)
    expect(tickSpacingForFee(10000)).toBe(200)
  })

  it('throws on an unknown tier rather than guessing', () => {
    expect(() => tickSpacingForFee(1234)).toThrow(/Unknown fee tier/)
  })
})
