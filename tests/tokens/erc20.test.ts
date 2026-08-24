import { describe, expect, it, vi } from 'vitest'
import type { Address, PublicClient } from 'viem'
import { readNativeBalance, readTokenBalances, readTokenMetadata } from '@/lib/tokens/erc20'

const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as Address
const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as Address
const OWNER = '0x1111111111111111111111111111111111111111' as Address

type MulticallResult =
  | { status: 'success'; result: unknown }
  | { status: 'failure'; error: Error }

function success(result: unknown): MulticallResult {
  return { status: 'success', result }
}
function failure(message: string): MulticallResult {
  return { status: 'failure', error: new Error(message) }
}

function fakeClient(results: MulticallResult[], balance = 0n) {
  const multicall = vi.fn().mockResolvedValue(results)
  const getBalance = vi.fn().mockResolvedValue(balance)
  return { client: { multicall, getBalance } as unknown as PublicClient, multicall, getBalance }
}

describe('readTokenMetadata', () => {
  it('reads symbol, name, and decimals in one batch', async () => {
    const { client, multicall } = fakeClient([
      success('USDC'),
      success('USD Coin'),
      success(6),
      success('cbBTC'),
      success('Coinbase Wrapped BTC'),
      success(8),
    ])

    const result = await readTokenMetadata(client, [USDC, CBBTC])

    // One batch, not six round trips — this is what makes wallet sync affordable.
    expect(multicall).toHaveBeenCalledTimes(1)
    expect(multicall.mock.calls[0]?.[0].contracts).toHaveLength(6)
    expect(multicall.mock.calls[0]?.[0].allowFailure).toBe(true)

    const usdc = result.get(USDC.toLowerCase())
    expect(usdc?.ok).toBe(true)
    if (usdc?.ok) {
      expect(usdc.metadata.symbol).toBe('USDC')
      expect(usdc.metadata.decimals).toBe(6)
    }
    const cbbtc = result.get(CBBTC.toLowerCase())
    if (cbbtc?.ok) expect(cbbtc.metadata.decimals).toBe(8)
  })

  it('fails a token whose decimals() reverts instead of defaulting to 18', async () => {
    // Defaulting would silently scale every amount for this token by 10^10.
    const { client } = fakeClient([success('WEIRD'), success('Weird Token'), failure('reverted')])

    const result = await readTokenMetadata(client, [USDC])
    const entry = result.get(USDC.toLowerCase())

    expect(entry?.ok).toBe(false)
    if (entry && !entry.ok) expect(entry.message).toMatch(/decimals/)
  })

  it('keeps a token whose symbol fails to decode, showing its address instead', async () => {
    // Older tokens return bytes32 rather than string. That is cosmetic and must
    // not cost the user a real balance.
    const { client } = fakeClient([failure('bytes32 symbol'), failure('bytes32 name'), success(18)])

    const result = await readTokenMetadata(client, [USDC])
    const entry = result.get(USDC.toLowerCase())

    expect(entry?.ok).toBe(true)
    if (entry?.ok) {
      expect(entry.metadata.decimals).toBe(18)
      expect(entry.metadata.symbol).toContain('0x8335')
    }
  })

  it('isolates one bad token from the rest of the batch', async () => {
    const { client } = fakeClient([
      success('USDC'),
      success('USD Coin'),
      success(6),
      success('BAD'),
      success('Bad Token'),
      failure('reverted'),
    ])

    const result = await readTokenMetadata(client, [USDC, CBBTC])

    expect(result.get(USDC.toLowerCase())?.ok).toBe(true)
    expect(result.get(CBBTC.toLowerCase())?.ok).toBe(false)
  })

  it('makes no request for an empty token list', async () => {
    const { client, multicall } = fakeClient([])
    expect((await readTokenMetadata(client, [])).size).toBe(0)
    expect(multicall).not.toHaveBeenCalled()
  })

  it('pins the batch to a block when one is given', async () => {
    const { client, multicall } = fakeClient([success('USDC'), success('USD Coin'), success(6)])
    await readTokenMetadata(client, [USDC], { blockNumber: 20_000_000n })
    expect(multicall.mock.calls[0]?.[0].blockNumber).toBe(20_000_000n)
  })
})

describe('readTokenBalances', () => {
  it('returns raw base units as bigint, never a number', async () => {
    const { client } = fakeClient([success(95_060_000n)])
    const result = await readTokenBalances(client, OWNER, [USDC])
    const entry = result.get(USDC.toLowerCase())

    expect(entry?.ok).toBe(true)
    if (entry?.ok) {
      expect(entry.balance.rawAmount).toBe(95_060_000n)
      expect(typeof entry.balance.rawAmount).toBe('bigint')
    }
  })

  it('handles a balance beyond Number.MAX_SAFE_INTEGER without precision loss', async () => {
    const huge = 123456789012345678901234567890n
    const { client } = fakeClient([success(huge)])
    const entry = (await readTokenBalances(client, OWNER, [USDC])).get(USDC.toLowerCase())
    if (entry?.ok) expect(entry.balance.rawAmount).toBe(huge)
  })

  it('reports a reverted balanceOf as a failure, not as zero', async () => {
    // Zero is a real answer meaning "holds none". A failed read is not that.
    const { client } = fakeClient([failure('execution reverted')])
    const entry = (await readTokenBalances(client, OWNER, [USDC])).get(USDC.toLowerCase())

    expect(entry?.ok).toBe(false)
    if (entry && !entry.ok) expect(entry.message).toMatch(/reverted/)
  })

  it('preserves a genuine zero balance as a success', async () => {
    const { client } = fakeClient([success(0n)])
    const entry = (await readTokenBalances(client, OWNER, [USDC])).get(USDC.toLowerCase())
    expect(entry?.ok).toBe(true)
    if (entry?.ok) expect(entry.balance.rawAmount).toBe(0n)
  })

  it('queries the owner address', async () => {
    const { client, multicall } = fakeClient([success(1n)])
    await readTokenBalances(client, OWNER, [USDC])
    expect(multicall.mock.calls[0]?.[0].contracts[0].args).toEqual([OWNER])
  })
})

describe('readNativeBalance', () => {
  it('reads the native balance at the pinned block', async () => {
    const { client, getBalance } = fakeClient([], 1_500_000_000_000_000_000n)
    const result = await readNativeBalance(client, OWNER, 'ETH', 18, { blockNumber: 123n })

    expect(result.rawAmount).toBe(1_500_000_000_000_000_000n)
    expect(result.symbol).toBe('ETH')
    expect(result.decimals).toBe(18)
    expect(getBalance).toHaveBeenCalledWith({ address: OWNER, blockNumber: 123n })
  })

  it('omits blockNumber when none is given, rather than sending undefined', async () => {
    const { client, getBalance } = fakeClient([], 0n)
    await readNativeBalance(client, OWNER, 'ETH', 18)
    expect(getBalance).toHaveBeenCalledWith({ address: OWNER })
  })
})
