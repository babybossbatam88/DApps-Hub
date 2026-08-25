import { describe, expect, it } from 'vitest'
import { analyseRange, outOfRangeExplanation } from '@/lib/engines/range'
import { DEFAULT_THRESHOLDS } from '@/lib/config/thresholds'

const T = DEFAULT_THRESHOLDS.range // safe 20%, near 15%, critical 5%

// The cbBTC/USDC test position: USDC is token0, so the readable price is
// inverted and a rising tick means a falling price.
const INVERTED = { tickLower: -67680, tickUpper: -65400, quoteIsToken0: true }
// A hypothetical pool where the volatile asset sorts first: no inversion.
const UPRIGHT = { tickLower: -67680, tickUpper: -65400, quoteIsToken0: false }

describe('analyseRange — orientation', () => {
  it('mirrors progress when the quote is token0', () => {
    // The current tick sits 52.6% up the tick range, which in USDC-per-cbBTC
    // terms is 47.4% up the PRICE range. Reporting the tick figure would put
    // the marker on the wrong side of centre.
    const inverted = analyseRange({ ...INVERTED, currentTick: -66480 }, T)
    const upright = analyseRange({ ...UPRIGHT, currentTick: -66480 }, T)

    expect(inverted.progressPercent).toBeCloseTo(47.4, 1)
    expect(upright.progressPercent).toBeCloseTo(52.6, 1)
    expect(inverted.progressPercent + upright.progressPercent).toBeCloseTo(100, 6)
  })

  it('swaps out-below and out-above when the quote is token0', () => {
    // Below the lower TICK means above the upper PRICE. Reporting the tick
    // direction would tell the user the price rose when it fell.
    const belowTick = analyseRange({ ...INVERTED, currentTick: -67681 }, T)
    expect(belowTick.state).toBe('OUT_ABOVE')
    expect(belowTick.inRange).toBe(false)

    const aboveTick = analyseRange({ ...INVERTED, currentTick: -65400 }, T)
    expect(aboveTick.state).toBe('OUT_BELOW')
  })

  it('reports tick direction directly when there is no inversion', () => {
    expect(analyseRange({ ...UPRIGHT, currentTick: -67681 }, T).state).toBe('OUT_BELOW')
    expect(analyseRange({ ...UPRIGHT, currentTick: -65400 }, T).state).toBe('OUT_ABOVE')
  })

  it('swaps which edge is "near" under inversion', () => {
    // Near the lower tick is near the UPPER price.
    const nearLowerTick = analyseRange({ ...INVERTED, currentTick: -67600 }, T)
    expect(nearLowerTick.state).toBe('NEAR_UPPER')

    const nearUpperTick = analyseRange({ ...INVERTED, currentTick: -65500 }, T)
    expect(nearUpperTick.state).toBe('NEAR_LOWER')
  })
})

describe('analyseRange — states', () => {
  it('is safe in the middle of the range', () => {
    const result = analyseRange({ ...INVERTED, currentTick: -66540 }, T)
    expect(result.state).toBe('IN_RANGE_SAFE')
    expect(result.inRange).toBe(true)
    expect(result.nearestEdgePercent).toBeGreaterThan(T.safeEdgePercent)
  })

  it('warns inside the near-edge band', () => {
    // 18% from an edge: past the safe threshold, not yet critical.
    const span = INVERTED.tickUpper - INVERTED.tickLower
    const tick = INVERTED.tickLower + Math.round(span * 0.18)
    const result = analyseRange({ ...INVERTED, currentTick: tick }, T)
    expect(result.inRange).toBe(true)
    expect(result.state).toBe('NEAR_UPPER')
    expect(result.nearestEdgePercent).toBeLessThanOrEqual(T.safeEdgePercent)
  })

  it('treats the upper tick as already out, matching the contract', () => {
    // Uniswap's range is [tickLower, tickUpper) — at tickUpper the position
    // holds only token1 and earns nothing, so "in range" would be wrong.
    expect(analyseRange({ ...INVERTED, currentTick: -65400 }, T).inRange).toBe(false)
    expect(analyseRange({ ...INVERTED, currentTick: -65401 }, T).inRange).toBe(true)
  })

  it('includes the lower tick', () => {
    expect(analyseRange({ ...INVERTED, currentTick: -67680 }, T).inRange).toBe(true)
  })

  it('reports distances that sum to the whole range', () => {
    const result = analyseRange({ ...INVERTED, currentTick: -66480 }, T)
    expect(result.distanceToLowerPercent + result.distanceToUpperPercent).toBeCloseTo(100, 6)
    expect(result.nearestEdgePercent).toBe(
      Math.min(result.distanceToLowerPercent, result.distanceToUpperPercent),
    )
  })

  it('reports a signed distance past the bound when out of range', () => {
    // Not clamped to zero: "14% below the range" is a more useful readout than
    // "at the edge", and the caller can clamp for a progress bar.
    const result = analyseRange({ ...INVERTED, currentTick: -65100 }, T)
    expect(result.progressPercent).toBeLessThan(0)
  })

  it('honours custom thresholds', () => {
    // 8% from the nearest edge: "near" under the default 20% safe band, but
    // comfortably safe for someone who runs tighter ranges deliberately.
    const span = INVERTED.tickUpper - INVERTED.tickLower
    const tick = INVERTED.tickLower + Math.round(span * 0.08)
    const tight = { safeEdgePercent: 5, nearEdgePercent: 3, criticalEdgePercent: 1 }

    const withDefaults = analyseRange({ ...INVERTED, currentTick: tick }, T)
    const withTight = analyseRange({ ...INVERTED, currentTick: tick }, tight)

    expect(withDefaults.nearestEdgePercent).toBeCloseTo(8, 0)
    expect(withDefaults.state).toBe('NEAR_UPPER')
    expect(withTight.state).toBe('IN_RANGE_SAFE')
  })

  it('does not divide by zero on a degenerate range', () => {
    const result = analyseRange(
      { tickLower: 100, tickUpper: 100, currentTick: 100, quoteIsToken0: false },
      T,
    )
    expect(Number.isFinite(result.progressPercent)).toBe(true)
    expect(result.inRange).toBe(false)
  })
})

describe('outOfRangeExplanation', () => {
  it('says which asset you are left holding', () => {
    expect(outOfRangeExplanation('OUT_BELOW', 'cbBTC', 'USDC')).toContain('entirely cbBTC')
    expect(outOfRangeExplanation('OUT_BELOW', 'cbBTC', 'USDC')).toContain('asset that fell')
    expect(outOfRangeExplanation('OUT_ABOVE', 'cbBTC', 'USDC')).toContain('entirely USDC')
    expect(outOfRangeExplanation('OUT_ABOVE', 'cbBTC', 'USDC')).toContain('asset that rose')
  })

  it('says nothing while in range', () => {
    expect(outOfRangeExplanation('IN_RANGE_SAFE', 'cbBTC', 'USDC')).toBeNull()
    expect(outOfRangeExplanation('NEAR_LOWER', 'cbBTC', 'USDC')).toBeNull()
  })
})
