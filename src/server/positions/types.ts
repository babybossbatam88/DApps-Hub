/** View models for the positions API. Serialisable: no bigint, no Decimal. */

export type DiscoveryStatus = 'SUCCEEDED' | 'PARTIAL' | 'FAILED'

export interface DiscoveryFailure {
  tokenId: string
  reason: string
}

export interface DiscoveryResult {
  walletId: string
  syncJobId: string
  status: DiscoveryStatus
  /** How many position NFTs the wallet holds. */
  tokenIdsFound: number
  positionsPersisted: number
  positionsCreated: number
  failures: DiscoveryFailure[]
  error: { code: string; message: string } | null
}

export interface PositionTokenView {
  address: string
  symbol: string
  name: string
  decimals: number
  verified: boolean
}

/**
 * Entry basis. `null` when it could not be derived from chain history — which
 * is a normal outcome on endpoints that cap `eth_getLogs`, and must render as
 * "unknown" rather than zero.
 */
export interface PositionEntryView {
  token0Amount: string
  token1Amount: string
  token0Raw: string
  token1Raw: string
  blockNumber: string | null
  txHash: string | null
  source: 'chain-logs'
}

export interface PositionView {
  id: string
  positionNftId: string
  protocol: string
  protocolVersion: string
  chainId: number
  chainName: string
  poolAddress: string
  explorerUrl: string | null

  token0: PositionTokenView
  token1: PositionTokenView
  /** Display orientation: base priced in quote. */
  baseSymbol: string
  quoteSymbol: string
  pairLabel: string
  /** True when the quote asset is token0, which inverts the readable price. */
  quoteIsToken0: boolean

  feeTier: number
  feeTierLabel: string
  tickLower: number
  tickUpper: number
  tickSpacing: number
  /** Price bounds in quote per base, derived from the ticks alone. */
  priceLower: string
  priceUpper: string
  rangeWidthPercent: string

  liquidity: string
  status: string
  isClosed: boolean

  walletAddress: string
  walletLabel: string | null

  entry: PositionEntryView | null
  entryTimestamp: string
  lastSyncedAt: string | null
  lastSyncError: string | null
  createdAt: string
}
