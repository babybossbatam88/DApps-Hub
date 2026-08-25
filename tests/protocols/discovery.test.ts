import { describe, expect, it, vi } from 'vitest'
import type { Address, PublicClient } from 'viem'
import {
  enumeratePositionIds,
  isClosed,
  ownerOfPosition,
  readPositionEntry,
  readPositions,
} from '@/lib/protocols/uniswap-v3/positions'
import { poolKeyId, readPoolStates, resolvePools } from '@/lib/protocols/uniswap-v3/pools'

const OWNER = '0x4f3a120E72C76c22ae802D129F599BFDbc31cb81' as Address
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as Address
const POOL = '0xfBb6Eed8e7aa03B138556eeDaF5D271A5E1e43ef' as Address
const ZERO = '0x0000000000000000000000000000000000000000' as Address

type Result = { status: 'success'; result: unknown } | { status: 'failure'; error: Error }
const ok = (result: unknown): Result => ({ status: 'success', result })
const bad = (message: string): Result => ({ status: 'failure', error: new Error(message) })

function fake(overrides: {
  readContract?: unknown
  multicall?: Result[] | Result[][]
  getLogs?: unknown
} = {}) {
  const multicallQueue = Array.isArray(overrides.multicall?.[0])
    ? [...(overrides.multicall as Result[][])]
    : overrides.multicall
      ? [overrides.multicall as Result[]]
      : []

  const multicall = vi.fn().mockImplementation(async () => multicallQueue.shift() ?? [])
  const readContract = vi.fn().mockResolvedValue(overrides.readContract)
  const getLogs = vi.fn().mockResolvedValue(overrides.getLogs ?? [])

  return {
    client: { multicall, readContract, getLogs } as unknown as PublicClient,
    multicall,
    readContract,
    getLogs,
  }
}

/** The 12-field tuple `positions(tokenId)` returns. */
function positionStruct(over: Partial<Record<string, unknown>> = {}): unknown[] {
  return [
    0n,
    ZERO,
    over.token0 ?? USDC,
    over.token1 ?? CBBTC,
    over.fee ?? 3000,
    over.tickLower ?? -67680,
    over.tickUpper ?? -65400,
    over.liquidity ?? 61800000n,
    over.fg0 ?? 10n ** 30n,
    over.fg1 ?? 10n ** 30n,
    over.owed0 ?? 0n,
    over.owed1 ?? 0n,
  ]
}

describe('enumeratePositionIds', () => {
  it('returns an empty array for a wallet with no positions, without further calls', () => {
    // Zero positions is a real answer, not a failure — and it must not cost a
    // multicall round trip.
    const { client, multicall } = fake({ readContract: 0n })
    return enumeratePositionIds(client, 8453, OWNER).then((ids) => {
      expect(ids).toEqual([])
      expect(multicall).not.toHaveBeenCalled()
    })
  })

  it('enumerates every index', async () => {
    const { client, multicall } = fake({
      readContract: 3n,
      multicall: [ok(1348792n), ok(1352001n), ok(1400000n)],
    })
    const ids = await enumeratePositionIds(client, 8453, OWNER)

    expect(ids).toEqual([1348792n, 1352001n, 1400000n])
    expect(multicall.mock.calls[0]?.[0].contracts).toHaveLength(3)
    expect(multicall.mock.calls[0]?.[0].allowFailure).toBe(true)
  })

  it('skips a failed index rather than inventing a token id', async () => {
    // Enumeration can race with a transfer. A guessed id would produce a
    // phantom position that never existed.
    const { client } = fake({
      readContract: 3n,
      multicall: [ok(1348792n), bad('index out of bounds'), ok(1400000n)],
    })
    expect(await enumeratePositionIds(client, 8453, OWNER)).toEqual([1348792n, 1400000n])
  })

  it('keeps token ids as bigint', async () => {
    const huge = 2n ** 200n
    const { client } = fake({ readContract: 1n, multicall: [ok(huge)] })
    const ids = await enumeratePositionIds(client, 8453, OWNER)
    expect(ids[0]).toBe(huge)
    expect(typeof ids[0]).toBe('bigint')
  })
})

describe('readPositions', () => {
  it('decodes the position struct into named fields', async () => {
    const { client } = fake({ multicall: [ok(positionStruct())] })
    const { positions, failures } = await readPositions(client, 8453, [1348792n])

    expect(failures).toEqual([])
    expect(positions).toHaveLength(1)
    const position = positions[0]!
    expect(position.tokenId).toBe(1348792n)
    expect(position.token0).toBe(USDC)
    expect(position.token1).toBe(CBBTC)
    expect(position.fee).toBe(3000)
    expect(position.tickLower).toBe(-67680)
    expect(position.tickUpper).toBe(-65400)
    expect(position.liquidity).toBe(61800000n)
  })

  it('preserves negative ticks', async () => {
    // int24 values arrive signed; coercing through an unsigned path would turn
    // -67680 into 16709536 and put the range in an entirely wrong place.
    const { client } = fake({ multicall: [ok(positionStruct({ tickLower: -887220 }))] })
    const { positions } = await readPositions(client, 8453, [1n])
    expect(positions[0]?.tickLower).toBe(-887220)
  })

  it('collects a failure without aborting the rest of the wallet', async () => {
    const { client } = fake({
      multicall: [ok(positionStruct()), bad('Invalid token ID'), ok(positionStruct({ fee: 500 }))],
    })
    const { positions, failures } = await readPositions(client, 8453, [1n, 2n, 3n])

    expect(positions).toHaveLength(2)
    expect(failures).toHaveLength(1)
    expect(failures[0]?.tokenId).toBe(2n)
    expect(failures[0]?.reason).toMatch(/Invalid token ID/)
  })

  it('reports a malformed struct rather than decoding garbage', async () => {
    const { client } = fake({ multicall: [ok([1n, 2n, 3n])] })
    const { positions, failures } = await readPositions(client, 8453, [1n])
    expect(positions).toEqual([])
    expect(failures[0]?.reason).toMatch(/unexpected shape/)
  })

  it('makes no request for an empty id list', async () => {
    const { client, multicall } = fake()
    expect(await readPositions(client, 8453, [])).toEqual({ positions: [], failures: [] })
    expect(multicall).not.toHaveBeenCalled()
  })
})

describe('isClosed', () => {
  it('treats zero liquidity as closed', () => {
    expect(isClosed({ liquidity: 0n })).toBe(true)
    expect(isClosed({ liquidity: 1n })).toBe(false)
  })
})

describe('ownerOfPosition', () => {
  it('returns the owner', async () => {
    const { client } = fake({ readContract: OWNER })
    expect(await ownerOfPosition(client, 8453, 1n)).toBe(OWNER)
  })

  it('returns null for a burnt id instead of throwing', async () => {
    const client = {
      readContract: vi.fn().mockRejectedValue(new Error('ERC721: invalid token ID')),
    } as unknown as PublicClient
    expect(await ownerOfPosition(client, 8453, 1n)).toBeNull()
  })
})

describe('resolvePools', () => {
  it('resolves a pool address from the factory', async () => {
    const { client } = fake({ multicall: [ok(POOL)] })
    const pools = await resolvePools(client, 8453, [
      { token0: USDC, token1: CBBTC, feeTier: 3000 },
    ])
    expect(pools.get(poolKeyId({ token0: USDC, token1: CBBTC, feeTier: 3000 }))).toBe(POOL)
  })

  it('returns null for the zero address rather than reading state from 0x0', async () => {
    // Reading slot0 from the zero address returns zeros that look exactly like
    // a real, empty pool.
    const { client } = fake({ multicall: [ok(ZERO)] })
    const pools = await resolvePools(client, 8453, [
      { token0: USDC, token1: CBBTC, feeTier: 3000 },
    ])
    expect(pools.get(poolKeyId({ token0: USDC, token1: CBBTC, feeTier: 3000 }))).toBeNull()
  })

  it('de-duplicates keys, since positions commonly share a pool', async () => {
    const { client, multicall } = fake({ multicall: [ok(POOL)] })
    await resolvePools(client, 8453, [
      { token0: USDC, token1: CBBTC, feeTier: 3000 },
      { token0: USDC, token1: CBBTC, feeTier: 3000 },
      // Reversed order is the same pool: Uniswap sorts the pair.
      { token0: CBBTC, token1: USDC, feeTier: 3000 },
    ])
    expect(multicall.mock.calls[0]?.[0].contracts).toHaveLength(1)
  })

  it('treats the key as order-independent', () => {
    expect(poolKeyId({ token0: USDC, token1: CBBTC, feeTier: 3000 })).toBe(
      poolKeyId({ token0: CBBTC, token1: USDC, feeTier: 3000 }),
    )
  })

  it('distinguishes fee tiers on the same pair', () => {
    expect(poolKeyId({ token0: USDC, token1: CBBTC, feeTier: 3000 })).not.toBe(
      poolKeyId({ token0: USDC, token1: CBBTC, feeTier: 500 }),
    )
  })
})

describe('readPoolStates', () => {
  const slot0 = [2853362181680133356376706431n, -66480, 0, 1, 1, 0, true]

  it('reads slot0, liquidity and both accumulators, pinned to one block', async () => {
    const { client, multicall } = fake({
      multicall: [ok(slot0), ok(900000000n), ok(111n), ok(222n)],
    })
    const { states, failures } = await readPoolStates(client, [POOL], 34_000_123n)

    expect(failures).toEqual([])
    const state = states.get(POOL.toLowerCase())!
    expect(state.sqrtPriceX96).toBe(2853362181680133356376706431n)
    expect(state.tick).toBe(-66480)
    expect(state.liquidity).toBe(900000000n)
    expect(state.feeGrowthGlobal0X128).toBe(111n)
    expect(state.blockNumber).toBe(34_000_123n)
    // The block pin is what stops a price from one block being combined with a
    // fee accumulator from the next.
    expect(multicall.mock.calls[0]?.[0].blockNumber).toBe(34_000_123n)
  })

  it('fails the pool when slot0 reverts', async () => {
    const { client } = fake({ multicall: [bad('not a pool'), ok(0n), ok(0n), ok(0n)] })
    const { states, failures } = await readPoolStates(client, [POOL], 1n)
    expect(states.size).toBe(0)
    expect(failures[0]?.reason).toMatch(/not a pool/)
  })

  it('keeps the pool when only fee growth is unavailable', async () => {
    // Losing fee growth costs fee figures, not the whole position.
    const { client } = fake({ multicall: [ok(slot0), ok(1n), bad('reverted'), bad('reverted')] })
    const { states, failures } = await readPoolStates(client, [POOL], 1n)
    expect(failures).toEqual([])
    expect(states.get(POOL.toLowerCase())?.tick).toBe(-66480)
  })

  it('makes no request for an empty pool list', async () => {
    const { client, multicall } = fake()
    await readPoolStates(client, [], 1n)
    expect(multicall).not.toHaveBeenCalled()
  })
})

describe('readPositionEntry', () => {
  it('sums every deposit into the entry basis', async () => {
    // A position topped up twice has a basis of both deposits, not just the first.
    const { client } = fake({
      getLogs: [
        {
          blockNumber: 33_000_000n,
          transactionHash: '0xaaa',
          args: { amount0: 95_060_000n, amount1: 137_000n },
        },
        {
          blockNumber: 33_500_000n,
          transactionHash: '0xbbb',
          args: { amount0: 10_000_000n, amount1: 14_000n },
        },
      ],
    })
    const entry = await readPositionEntry(client, 8453, 1348792n)

    expect(entry?.amount0).toBe(105_060_000n)
    expect(entry?.amount1).toBe(151_000n)
    expect(entry?.depositCount).toBe(2)
    // The block and tx of the FIRST deposit — when the position was opened.
    expect(entry?.blockNumber).toBe(33_000_000n)
    expect(entry?.txHash).toBe('0xaaa')
  })

  it('returns null when there is no history, not a zero basis', async () => {
    // A zero basis would make LP-vs-HODL read as pure profit.
    const { client } = fake({ getLogs: [] })
    expect(await readPositionEntry(client, 8453, 1n)).toBeNull()
  })

  it('returns null when the endpoint rejects the log query', async () => {
    // Public endpoints commonly cap eth_getLogs. A partial window would
    // understate the basis and flatter every derived figure, so no basis is
    // recorded at all.
    const client = {
      getLogs: vi.fn().mockRejectedValue(new Error('query exceeds max block range')),
    } as unknown as PublicClient
    expect(await readPositionEntry(client, 8453, 1n)).toBeNull()
  })

  it('filters by token id', async () => {
    const { client, getLogs } = fake({ getLogs: [] })
    await readPositionEntry(client, 8453, 1348792n)
    expect(getLogs.mock.calls[0]?.[0].args).toEqual({ tokenId: 1348792n })
  })
})
