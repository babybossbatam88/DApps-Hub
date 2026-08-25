import type { Decimal } from '@/lib/utils/format'
import { Decimal as D } from '@/lib/utils/format'
import { priceAtTick, priceFromSqrtRatio } from '@/lib/protocols/uniswap-v3/math'
import type { AssetRef, PriceQuote } from './types'
import { ok, type Sourced } from '@/types/sourced'

/**
 * The on-chain pool price — rank 0, and the only provider Phase 4 needs.
 *
 * Derived directly from `slot0.sqrtPriceX96`, so it is the exact price at which
 * the position's inventory is composed at the observed block. No external
 * service, no staleness beyond the block itself, and no proxy.
 */

export interface PoolPriceInput {
  sqrtPriceX96: bigint
  token0: AssetRef
  token1: AssetRef
  /** True when token0 is the quote asset, which inverts the readable price. */
  quoteIsToken0: boolean
  blockNumber: bigint
  observedAt: string
}

export function poolSpotPrice(input: PoolPriceInput): Sourced<PriceQuote> {
  // Raw price is always token1 per token0; orientation is a display decision.
  const raw = priceFromSqrtRatio(input.sqrtPriceX96, input.token0.decimals, input.token1.decimals)
  const price = input.quoteIsToken0 ? new D(1).div(raw) : raw

  const base = input.quoteIsToken0 ? input.token1 : input.token0
  const quote = input.quoteIsToken0 ? input.token0 : input.token1

  return ok<PriceQuote>(
    {
      base,
      quote,
      price,
      isProxy: false,
      blockNumber: input.blockNumber.toString(),
    },
    'onchain',
    { observedAt: input.observedAt, confidence: 'higher' },
  )
}

/**
 * Which side of the pair reads as the quote.
 *
 * A stablecoin is the quote when exactly one side is a stablecoin, so a price
 * reads as "USDC per cbBTC" rather than its reciprocal. With no stablecoin, or
 * two, the protocol's own token0/token1 ordering stands — inventing an
 * orientation would be arbitrary and would differ between screens.
 */
export function resolveOrientation(params: {
  token0IsStablecoin: boolean
  token1IsStablecoin: boolean
}): { quoteIsToken0: boolean } {
  return { quoteIsToken0: params.token0IsStablecoin && !params.token1IsStablecoin }
}

/**
 * Price at a tick, in the same orientation as `poolSpotPrice`.
 *
 * Used for the range bounds, which are defined by ticks alone and need no pool
 * state — the bounds of a position do not move when the price does.
 */
export function priceAtTickOriented(
  tick: number,
  decimals0: number,
  decimals1: number,
  quoteIsToken0: boolean,
): Decimal {
  const raw = priceAtTick(tick, decimals0, decimals1)
  return quoteIsToken0 ? new D(1).div(raw) : raw
}
