import type { Address } from 'viem'

/** Uniswap V3 fee tiers, in hundredths of a basis point. */
export const FEE_TIERS = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.30%
  HIGH: 10000, // 1.00%
} as const

export type FeeTier = (typeof FEE_TIERS)[keyof typeof FEE_TIERS]

/** Canonical tick spacing per fee tier. */
export const TICK_SPACING_BY_FEE: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
}

/** Raw struct returned by NonfungiblePositionManager.positions(tokenId). */
export interface RawPosition {
  nonce: bigint
  operator: Address
  token0: Address
  token1: Address
  fee: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  feeGrowthInside0LastX128: bigint
  feeGrowthInside1LastX128: bigint
  tokensOwed0: bigint
  tokensOwed1: bigint
}

/** Raw pool state from slot0() plus the fee accumulators. */
export interface PoolState {
  address: Address
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  feeGrowthGlobal0X128: bigint
  feeGrowthGlobal1X128: bigint
  blockNumber: bigint
  observedAt: string
}

/** Per-tick data needed for the feeGrowthInside computation. */
export interface TickState {
  tick: number
  initialized: boolean
  liquidityGross: bigint
  liquidityNet: bigint
  feeGrowthOutside0X128: bigint
  feeGrowthOutside1X128: bigint
}

export interface TokenMetadata {
  address: Address
  symbol: string
  name: string
  /** Read from the contract. Never taken from the static registry. */
  decimals: number
}

/**
 * The normalised shape every engine consumes. Protocol adapters translate their
 * own structs into this, which is why adding Uniswap V4 later does not touch
 * the HODL, fee, range, or rebalance engines.
 */
export interface PositionState {
  protocolKey: string
  chainId: number
  positionId: string
  poolAddress: Address
  token0: TokenMetadata
  token1: TokenMetadata
  feeTier: number
  tickLower: number
  tickUpper: number
  liquidity: bigint
  /** Raw base units currently held by the position. */
  amount0: bigint
  amount1: bigint
  /** Raw base units of fees accrued but not yet collected. */
  uncollectedFees0: bigint
  uncollectedFees1: bigint
  currentTick: number
  sqrtPriceX96: bigint
  blockNumber: bigint
  observedAt: string
}
