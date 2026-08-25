import type { Address, PublicClient } from 'viem'
import { UNISWAP_V3_POOL_ABI } from './abis'
import type { TickState } from './types'

/**
 * Per-tick reads.
 *
 * `feeGrowthOutside` at both bounds is what turns the pool's global fee
 * accumulator into the growth *inside* a position's range. Without both,
 * uncollected fees cannot be computed — and are reported as unavailable rather
 * than approximated.
 */

export interface TickRequest {
  pool: Address
  tickLower: number
  tickUpper: number
}

export interface TickPair {
  lower: TickState | null
  upper: TickState | null
}

function tickKey(pool: string, tick: number): string {
  return `${pool.toLowerCase()}:${tick}`
}

/**
 * Read both boundary ticks for each request, batched and block-pinned.
 *
 * An uninitialised tick is a real state (nobody has ever provided liquidity at
 * that exact tick through this pool's history), and the contract returns zeros
 * for it. That is distinguished from a failed read via `initialized`.
 */
export async function readTickPairs(
  client: PublicClient,
  requests: readonly TickRequest[],
  blockNumber: bigint,
): Promise<Map<string, TickPair>> {
  const out = new Map<string, TickPair>()
  if (requests.length === 0) return out

  // De-duplicate: several positions often share the same bounds.
  const wanted = new Map<string, { pool: Address; tick: number }>()
  for (const request of requests) {
    wanted.set(tickKey(request.pool, request.tickLower), {
      pool: request.pool,
      tick: request.tickLower,
    })
    wanted.set(tickKey(request.pool, request.tickUpper), {
      pool: request.pool,
      tick: request.tickUpper,
    })
  }

  const entries = [...wanted.entries()]
  const results = await client.multicall({
    contracts: entries.map(([, { pool, tick }]) => ({
      address: pool,
      abi: UNISWAP_V3_POOL_ABI,
      functionName: 'ticks' as const,
      args: [tick] as const,
    })),
    allowFailure: true,
    blockNumber,
  })

  const byKey = new Map<string, TickState | null>()
  entries.forEach(([key, { tick }], index) => {
    const result = results[index]
    if (!result || result.status !== 'success' || !Array.isArray(result.result)) {
      byKey.set(key, null)
      return
    }
    const [
      liquidityGross,
      liquidityNet,
      feeGrowthOutside0X128,
      feeGrowthOutside1X128,
      ,
      ,
      ,
      initialized,
    ] = result.result as [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]

    byKey.set(key, {
      tick,
      initialized: Boolean(initialized),
      liquidityGross,
      liquidityNet,
      feeGrowthOutside0X128,
      feeGrowthOutside1X128,
    })
  })

  for (const request of requests) {
    out.set(tickKey(request.pool, request.tickLower) + `|${request.tickUpper}`, {
      lower: byKey.get(tickKey(request.pool, request.tickLower)) ?? null,
      upper: byKey.get(tickKey(request.pool, request.tickUpper)) ?? null,
    })
  }

  return out
}

/** Key used to look a pair back out of the map returned by `readTickPairs`. */
export function tickPairKey(pool: string, tickLower: number, tickUpper: number): string {
  return `${pool.toLowerCase()}:${tickLower}|${tickUpper}`
}
