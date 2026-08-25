import { Decimal } from '@/lib/utils/format'
import { explorerAddressUrl, getChain } from '@/lib/chains/registry'
import { formatFeeTier, rawToDecimal } from '@/lib/utils/format'
import { priceAtTick } from '@/lib/protocols/uniswap-v3/math'
import type { PositionEntryView, PositionTokenView, PositionView } from './types'

/**
 * Database rows -> serialisable view models.
 *
 * The price bounds here come from the TICKS alone — no pool state is needed to
 * know what range a position covers. Current price and inventory arrive in
 * Phase 4; this deliberately shows only what a single static read can support.
 */

interface TokenRow {
  address: string
  symbol: string
  name: string
  decimals: number
  verified: boolean
}

export interface PositionRow {
  id: string
  positionNftId: string
  chainId: number
  poolAddress: string
  feeTier: number
  tickLower: number
  tickUpper: number
  currentLiquidity: string
  status: string
  entryTimestamp: Date
  lastSyncedAt: Date | null
  lastSyncError: string | null
  createdAt: Date
  token0: TokenRow
  token1: TokenRow
  pool: { tickSpacing: number }
  protocol: { name: string; version: string }
  wallet: { address: string; label: string | null }
  entrySnapshot: {
    token0RawAmount: { toString(): string }
    token1RawAmount: { toString(): string }
    token0Decimals: number
    token1Decimals: number
    blockNumber: bigint | null
    txHash: string | null
  } | null
}

const STABLES = new Set(['USDC', 'USDT', 'USDbC', 'DAI', 'USDS'])

export function toPositionView(row: PositionRow): PositionView {
  const chain = getChain(row.chainId)

  // Orientation: quote in the stablecoin where there is one, so the readable
  // price is "USDC per cbBTC" rather than its reciprocal.
  const token0IsStable = STABLES.has(row.token0.symbol)
  const token1IsStable = STABLES.has(row.token1.symbol)
  const quoteIsToken0 = token0IsStable && !token1IsStable

  const priceAt = (tick: number): Decimal => {
    const raw = priceAtTick(tick, row.token0.decimals, row.token1.decimals)
    return quoteIsToken0 ? new Decimal(1).div(raw) : raw
  }

  // Inverting swaps which tick bound reads as the lower price.
  const lower = quoteIsToken0 ? priceAt(row.tickUpper) : priceAt(row.tickLower)
  const upper = quoteIsToken0 ? priceAt(row.tickLower) : priceAt(row.tickUpper)

  const width = lower.gt(0) ? upper.minus(lower).div(lower).mul(100) : new Decimal(0)

  const base = quoteIsToken0 ? row.token1 : row.token0
  const quote = quoteIsToken0 ? row.token0 : row.token1

  return {
    id: row.id,
    positionNftId: row.positionNftId,
    protocol: row.protocol.name,
    protocolVersion: row.protocol.version,
    chainId: row.chainId,
    chainName: chain?.shortName ?? `chain ${row.chainId}`,
    poolAddress: row.poolAddress,
    explorerUrl: explorerAddressUrl(row.chainId, row.poolAddress),

    token0: toTokenView(row.token0),
    token1: toTokenView(row.token1),
    baseSymbol: base.symbol,
    quoteSymbol: quote.symbol,
    pairLabel: `${base.symbol} / ${quote.symbol}`,
    quoteIsToken0,

    feeTier: row.feeTier,
    feeTierLabel: formatFeeTier(row.feeTier),
    tickLower: row.tickLower,
    tickUpper: row.tickUpper,
    tickSpacing: row.pool.tickSpacing,
    priceLower: lower.toSignificantDigits(12).toString(),
    priceUpper: upper.toSignificantDigits(12).toString(),
    rangeWidthPercent: width.toFixed(2),

    liquidity: row.currentLiquidity,
    status: row.status,
    isClosed: row.currentLiquidity === '0',

    walletAddress: row.wallet.address,
    walletLabel: row.wallet.label,

    entry: toEntryView(row),
    entryTimestamp: row.entryTimestamp.toISOString(),
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    lastSyncError: row.lastSyncError,
    createdAt: row.createdAt.toISOString(),
  }
}

function toTokenView(token: TokenRow): PositionTokenView {
  return {
    address: token.address,
    symbol: token.symbol,
    name: token.name,
    decimals: token.decimals,
    verified: token.verified,
  }
}

function toEntryView(row: PositionRow): PositionEntryView | null {
  const snapshot = row.entrySnapshot
  if (!snapshot) return null

  const raw0 = snapshot.token0RawAmount.toString()
  const raw1 = snapshot.token1RawAmount.toString()

  return {
    token0Raw: raw0,
    token1Raw: raw1,
    token0Amount: rawToDecimal(raw0, snapshot.token0Decimals).toString(),
    token1Amount: rawToDecimal(raw1, snapshot.token1Decimals).toString(),
    blockNumber: snapshot.blockNumber?.toString() ?? null,
    txHash: snapshot.txHash,
    source: 'chain-logs',
  }
}
