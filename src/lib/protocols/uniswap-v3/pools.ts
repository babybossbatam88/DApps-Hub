import type { Address, PublicClient } from 'viem'
import { UNISWAP_V3_FACTORY_ABI, UNISWAP_V3_POOL_ABI } from './abis'
import { factoryAddress } from './contracts'
import type { PoolState } from './types'

/**
 * Pool resolution and state.
 *
 * The pool address is derived from the factory rather than computed locally.
 * CREATE2 derivation would work, but it depends on an init-code hash that
 * differs between deployments — asking the factory is authoritative and costs
 * one batched call.
 */

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

export interface PoolKey {
  token0: Address
  token1: Address
  feeTier: number
}

export function poolKeyId(key: PoolKey): string {
  // Uniswap sorts the pair, so the key is order-independent.
  const [a, b] = [key.token0.toLowerCase(), key.token1.toLowerCase()].sort()
  return `${a}:${b}:${key.feeTier}`
}

/**
 * Resolve pool addresses for a set of (token0, token1, fee) keys.
 *
 * A zero address back from the factory means the pool does not exist. That is
 * returned as `null`, never as the zero address — reading state from 0x0 would
 * produce zeros that look like a real, empty pool.
 */
export async function resolvePools(
  client: PublicClient,
  chainId: number,
  keys: readonly PoolKey[],
): Promise<Map<string, Address | null>> {
  const out = new Map<string, Address | null>()
  if (keys.length === 0) return out

  // De-duplicate: many positions commonly share one pool.
  const unique = new Map<string, PoolKey>()
  for (const key of keys) unique.set(poolKeyId(key), key)
  const entries = [...unique.entries()]

  const results = await client.multicall({
    contracts: entries.map(([, key]) => ({
      address: factoryAddress(chainId),
      abi: UNISWAP_V3_FACTORY_ABI,
      functionName: 'getPool' as const,
      args: [key.token0, key.token1, key.feeTier] as const,
    })),
    allowFailure: true,
  })

  entries.forEach(([id], index) => {
    const result = results[index]
    if (!result || result.status !== 'success') {
      out.set(id, null)
      return
    }
    const address = result.result as Address
    out.set(id, address.toLowerCase() === ZERO_ADDRESS ? null : address)
  })

  return out
}

export interface PoolStateReadResult {
  states: Map<string, PoolState>
  failures: Array<{ pool: Address; reason: string }>
}

/**
 * Read `slot0`, in-range liquidity, and both fee-growth accumulators for each
 * pool, all pinned to one block.
 *
 * The block pin matters: a price from one block combined with a fee
 * accumulator from the next produces a figure that was never true at any
 * single moment.
 */
export async function readPoolStates(
  client: PublicClient,
  pools: readonly Address[],
  blockNumber: bigint,
): Promise<PoolStateReadResult> {
  const states = new Map<string, PoolState>()
  const failures: Array<{ pool: Address; reason: string }> = []
  if (pools.length === 0) return { states, failures }

  const unique = [...new Set(pools.map((p) => p.toLowerCase()))] as Address[]

  const contracts = unique.flatMap((address) => [
    { address, abi: UNISWAP_V3_POOL_ABI, functionName: 'slot0' as const },
    { address, abi: UNISWAP_V3_POOL_ABI, functionName: 'liquidity' as const },
    { address, abi: UNISWAP_V3_POOL_ABI, functionName: 'feeGrowthGlobal0X128' as const },
    { address, abi: UNISWAP_V3_POOL_ABI, functionName: 'feeGrowthGlobal1X128' as const },
  ])

  const results = await client.multicall({ contracts, allowFailure: true, blockNumber })
  const observedAt = new Date().toISOString()

  unique.forEach((address, index) => {
    const slot0 = results[index * 4]
    const liquidity = results[index * 4 + 1]
    const growth0 = results[index * 4 + 2]
    const growth1 = results[index * 4 + 3]

    // slot0 is the only mandatory read: without a price there is no valuation.
    if (!slot0 || slot0.status !== 'success' || !Array.isArray(slot0.result)) {
      failures.push({
        pool: address,
        reason:
          slot0 && slot0.status === 'failure' && slot0.error instanceof Error
            ? slot0.error.message
            : 'slot0() reverted; this may not be a Uniswap V3 pool.',
      })
      return
    }

    const [sqrtPriceX96, tick] = slot0.result as unknown as [bigint, number]

    states.set(address.toLowerCase(), {
      address,
      sqrtPriceX96,
      tick: Number(tick),
      liquidity: liquidity?.status === 'success' ? (liquidity.result as bigint) : 0n,
      // Fee growth is optional here: a pool that will not report it costs us
      // fee figures, not the whole position.
      feeGrowthGlobal0X128: growth0?.status === 'success' ? (growth0.result as bigint) : 0n,
      feeGrowthGlobal1X128: growth1?.status === 'success' ? (growth1.result as bigint) : 0n,
      blockNumber,
      observedAt,
    })
  })

  return { states, failures }
}

/** Static pool metadata. Read once and cached — it never changes. */
export async function readPoolMetadata(
  client: PublicClient,
  pool: Address,
): Promise<{ token0: Address; token1: Address; feeTier: number; tickSpacing: number } | null> {
  const results = await client.multicall({
    contracts: [
      { address: pool, abi: UNISWAP_V3_POOL_ABI, functionName: 'token0' as const },
      { address: pool, abi: UNISWAP_V3_POOL_ABI, functionName: 'token1' as const },
      { address: pool, abi: UNISWAP_V3_POOL_ABI, functionName: 'fee' as const },
      { address: pool, abi: UNISWAP_V3_POOL_ABI, functionName: 'tickSpacing' as const },
    ],
    allowFailure: true,
  })

  if (results.some((r) => r.status !== 'success')) return null
  return {
    token0: results[0]!.result as Address,
    token1: results[1]!.result as Address,
    feeTier: Number(results[2]!.result),
    tickSpacing: Number(results[3]!.result),
  }
}
