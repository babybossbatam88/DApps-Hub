import type { Decimal } from '@/lib/utils/format'
import type { Sourced } from '@/types/sourced'

/**
 * Price provider abstraction.
 *
 * Providers are RANKED, not chained arbitrarily: the pool a position actually
 * lives in is authoritative for that position, because it is the price at which
 * the position's own inventory is composed. External markets can disagree with
 * it, and when they do the pool is right about the position even if the market
 * is right about the world.
 */

export interface AssetRef {
  chainId: number
  address: string
  symbol: string
  decimals: number
}

export interface PriceQuote {
  base: AssetRef
  quote: AssetRef
  /** Units of `quote` per one `base`, human units. */
  price: Decimal
  /**
   * True when the price comes from a DIFFERENT asset's market — cbBTC marked
   * from BTCUSDT, for example. The flag travels with the value to the screen;
   * it is never dropped on the way.
   */
  isProxy: boolean
  blockNumber: string | null
}

export interface PriceProvider {
  readonly key: string
  /** Lower wins. The on-chain pool is 0. */
  readonly rank: number
  getSpotPrice(base: AssetRef, quote: AssetRef): Promise<Sourced<PriceQuote>>
}

/** Registered providers, ordered by rank. Phase 10 adds Binance at rank 1. */
export function rankProviders(providers: readonly PriceProvider[]): PriceProvider[] {
  return [...providers].sort((a, b) => a.rank - b.rank)
}
