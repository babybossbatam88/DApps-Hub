import type { RangeThresholds } from '@/lib/config/thresholds'

/**
 * Range engine.
 *
 * The MATHS is done in tick space: ticks are linear in log-price, so "percent
 * through the range" is well defined and behaves correctly at both edges.
 * Doing it in price space distorts near the bounds.
 *
 * The PRESENTATION is in price space, and the two disagree whenever the quote
 * asset is token0. For a USDC/cbBTC pool, USDC sorts first, so the raw price is
 * cbBTC per USDC and a RISING tick means a FALLING price in USDC per cbBTC.
 * Without mirroring, the marker slides the wrong way and "near lower" means
 * near the upper price — a confidently wrong readout on the one screen that
 * exists to answer "do I need to act".
 */

export type RangeState =
  | 'IN_RANGE_SAFE'
  | 'NEAR_LOWER'
  | 'NEAR_UPPER'
  | 'OUT_BELOW'
  | 'OUT_ABOVE'

export interface RangeInput {
  currentTick: number
  tickLower: number
  tickUpper: number
  /** True when the readable price is the reciprocal of the raw token1/token0 price. */
  quoteIsToken0: boolean
}

export interface RangeAnalysis {
  state: RangeState
  /** Position through the range in PRICE terms, 0 at the lower bound. */
  progressPercent: number
  /** Distance from the lower/upper price bound, as a share of the range. */
  distanceToLowerPercent: number
  distanceToUpperPercent: number
  nearestEdgePercent: number
  inRange: boolean
}

export const RANGE_STATE_LABELS: Record<RangeState, string> = {
  IN_RANGE_SAFE: 'In range',
  NEAR_LOWER: 'Near lower',
  NEAR_UPPER: 'Near upper',
  OUT_BELOW: 'Out below',
  OUT_ABOVE: 'Out above',
}

export function analyseRange(input: RangeInput, thresholds: RangeThresholds): RangeAnalysis {
  const span = input.tickUpper - input.tickLower
  const tickProgress = span === 0 ? 0 : ((input.currentTick - input.tickLower) / span) * 100
  const inRange = input.currentTick >= input.tickLower && input.currentTick < input.tickUpper

  const flip = input.quoteIsToken0
  const progressPercent = flip ? 100 - tickProgress : tickProgress
  const distanceToLowerPercent = progressPercent
  const distanceToUpperPercent = 100 - progressPercent
  const nearestEdgePercent = Math.min(distanceToLowerPercent, distanceToUpperPercent)

  let state: RangeState
  if (input.currentTick < input.tickLower) {
    state = flip ? 'OUT_ABOVE' : 'OUT_BELOW'
  } else if (input.currentTick >= input.tickUpper) {
    state = flip ? 'OUT_BELOW' : 'OUT_ABOVE'
  } else if (nearestEdgePercent > thresholds.safeEdgePercent) {
    state = 'IN_RANGE_SAFE'
  } else {
    state = distanceToLowerPercent < distanceToUpperPercent ? 'NEAR_LOWER' : 'NEAR_UPPER'
  }

  return {
    state,
    progressPercent,
    distanceToLowerPercent,
    distanceToUpperPercent,
    nearestEdgePercent,
    inRange,
  }
}

/**
 * What an out-of-range position is actually holding, in plain terms.
 *
 * Out below means the price fell through the lower bound and the position was
 * bought into the asset that fell. Out above means it sold the asset that rose.
 * Neither is a fault — it is how concentrated liquidity works — but both earn
 * nothing, and the screen has to say which one it is.
 */
export function outOfRangeExplanation(
  state: RangeState,
  baseSymbol: string,
  quoteSymbol: string,
): string | null {
  if (state === 'OUT_BELOW') {
    return `Price fell through the lower bound, so the position is entirely ${baseSymbol} — you hold the asset that fell. It earns no fees until price returns to the range.`
  }
  if (state === 'OUT_ABOVE') {
    return `Price rose through the upper bound, so the position is entirely ${quoteSymbol} — you sold the asset that rose. It earns no fees until price returns to the range.`
  }
  return null
}
