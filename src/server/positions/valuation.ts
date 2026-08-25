import 'server-only'
import type { Address } from 'viem'
import { Decimal } from '@/lib/utils/format'
import { getPublicClient } from '@/lib/rpc/client'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { readPoolStates } from '@/lib/protocols/uniswap-v3/pools'
import { getAmountsForLiquidityAtTicks } from '@/lib/protocols/uniswap-v3/math'
import { poolSpotPrice } from '@/lib/prices/pool-price'
import { valuePosition } from '@/lib/engines/valuation'
import { analyseRange, outOfRangeExplanation, RANGE_STATE_LABELS } from '@/lib/engines/range'
import { DEFAULT_THRESHOLDS } from '@/lib/config/thresholds'
import type { PositionValuationView, PositionView } from './types'

/**
 * Phase 4 — live position valuation.
 *
 * Reads `slot0` for every pool the given positions live in, all pinned to one
 * block, then derives inventory, value, and range state.
 *
 * Nothing here is persisted. A price is only meaningful with the block it came
 * from, and storing one would create a figure that looks current long after it
 * stopped being true. Phase 8 stores SNAPSHOTS, which are timestamped series
 * rather than a pretend-current value.
 */
export async function attachValuations(positions: PositionView[]): Promise<PositionView[]> {
  if (positions.length === 0) return positions

  // Group by chain: each needs its own client and its own block pin.
  const byChain = new Map<number, PositionView[]>()
  for (const position of positions) {
    const bucket = byChain.get(position.chainId) ?? []
    bucket.push(position)
    byChain.set(position.chainId, bucket)
  }

  const valued = new Map<string, PositionView>()

  for (const [chainId, chainPositions] of byChain) {
    try {
      const client = getPublicClient(chainId)
      const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
      const pools = [...new Set(chainPositions.map((p) => p.poolAddress))] as Address[]
      const { states, failures } = await readPoolStates(client, pools, blockNumber)

      const failureByPool = new Map(failures.map((f) => [f.pool.toLowerCase(), f.reason]))

      for (const position of chainPositions) {
        const state = states.get(position.poolAddress.toLowerCase())
        if (!state) {
          valued.set(position.id, {
            ...position,
            valuationError: {
              code: 'POOL_STATE_UNAVAILABLE',
              message:
                failureByPool.get(position.poolAddress.toLowerCase()) ??
                'Pool state could not be read.',
            },
          })
          continue
        }
        valued.set(position.id, { ...position, valuation: valueOne(position, state) })
      }
    } catch (error) {
      // A chain-wide failure leaves the persisted facts intact and marks the
      // live half unavailable. The range and entry basis are still true.
      const code = classifyRpcError(error)
      const message = extractMessage(error)
      for (const position of chainPositions) {
        valued.set(position.id, { ...position, valuationError: { code, message } })
      }
    }
  }

  return positions.map((position) => valued.get(position.id) ?? position)
}

function valueOne(
  position: PositionView,
  state: {
    sqrtPriceX96: bigint
    tick: number
    blockNumber: bigint
    observedAt: string
  },
): PositionValuationView {
  const { amount0, amount1 } = getAmountsForLiquidityAtTicks(
    state.tick,
    position.tickLower,
    position.tickUpper,
    BigInt(position.liquidity),
  )

  const priceQuote = poolSpotPrice({
    sqrtPriceX96: state.sqrtPriceX96,
    token0: {
      chainId: position.chainId,
      address: position.token0.address,
      symbol: position.token0.symbol,
      decimals: position.token0.decimals,
    },
    token1: {
      chainId: position.chainId,
      address: position.token1.address,
      symbol: position.token1.symbol,
      decimals: position.token1.decimals,
    },
    quoteIsToken0: position.quoteIsToken0,
    blockNumber: state.blockNumber,
    observedAt: state.observedAt,
  })

  const price = priceQuote.value?.price ?? new Decimal(0)

  const valuation = valuePosition({
    amount0,
    amount1,
    decimals0: position.token0.decimals,
    decimals1: position.token1.decimals,
    priceQuotePerBase: price,
    quoteIsToken0: position.quoteIsToken0,
  })

  const range = analyseRange(
    {
      currentTick: state.tick,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      quoteIsToken0: position.quoteIsToken0,
    },
    DEFAULT_THRESHOLDS.range,
  )

  return {
    currentPrice: price.toSignificantDigits(12).toString(),
    currentTick: state.tick,
    blockNumber: state.blockNumber.toString(),
    observedAt: state.observedAt,
    priceSource: 'onchain-pool',
    priceIsProxy: false,

    amount0: valuation.amount0.toString(),
    amount1: valuation.amount1.toString(),
    value0: valuation.value0.toSignificantDigits(18).toString(),
    value1: valuation.value1.toSignificantDigits(18).toString(),
    totalValue: valuation.totalValue.toSignificantDigits(18).toString(),
    valueUnit: position.quoteSymbol,
    allocation0Percent: valuation.allocation0Percent?.toFixed(2) ?? null,
    allocation1Percent: valuation.allocation1Percent?.toFixed(2) ?? null,

    range: {
      state: range.state,
      label: RANGE_STATE_LABELS[range.state],
      progressPercent: range.progressPercent,
      distanceToLowerPercent: range.distanceToLowerPercent,
      distanceToUpperPercent: range.distanceToUpperPercent,
      nearestEdgePercent: range.nearestEdgePercent,
      inRange: range.inRange,
    },
    outOfRangeNote: outOfRangeExplanation(
      range.state,
      position.baseSymbol,
      position.quoteSymbol,
    ),
  }
}
