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

export interface RangeView {
  state: string
  label: string
  progressPercent: number
  distanceToLowerPercent: number
  distanceToUpperPercent: number
  nearestEdgePercent: number
  inRange: boolean
}

/**
 * Live valuation. Read through on every request rather than persisted: a
 * stored price is stale the moment the next block lands, and a stale price
 * shown without a timestamp is exactly what this product refuses to do.
 *
 * Values are in QUOTE UNITS, not dollars. The pool prices one token in the
 * other and says nothing about what either is worth in USD; calling a USDC
 * figure "dollars" would assume a peg the system has not checked.
 */
export interface PositionValuationView {
  currentPrice: string
  currentTick: number
  blockNumber: string
  observedAt: string
  priceSource: string
  priceIsProxy: boolean

  amount0: string
  amount1: string
  value0: string
  value1: string
  totalValue: string
  valueUnit: string
  allocation0Percent: string | null
  allocation1Percent: string | null

  range: RangeView
  outOfRangeNote: string | null
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

  /** Non-null only when pool state could be read this request. */
  valuation: PositionValuationView | null
  valuationError: { code: string; message: string } | null

  entry: PositionEntryView | null
  entryTimestamp: string
  lastSyncedAt: string | null
  lastSyncError: string | null
  createdAt: string
}
