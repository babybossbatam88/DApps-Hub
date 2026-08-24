import { describe, expect, it, vi } from 'vitest'
import { probeChain, withTimeout, TimeoutError, type ChainProbeClient } from '@/lib/rpc/health'

function fakeClient(overrides: Partial<ChainProbeClient> = {}): ChainProbeClient {
  return {
    getBlockNumber: async () => 20_000_000n,
    getChainId: async () => 8453,
    ...overrides,
  }
}

describe('probeChain', () => {
  it('reports a reachable chain with its block number', async () => {
    let t = 1_000
    const status = await probeChain(fakeClient(), 8453, { now: () => (t += 25) })

    expect(status.reachable).toBe(true)
    expect(status.blockNumber).toBe('20000000')
    expect(status.reportedChainId).toBe(8453)
    expect(status.error).toBeNull()
    expect(status.latencyMs).toBeGreaterThan(0)
  })

  it('returns the block number as a string, never as a JS number', async () => {
    const huge = 9_007_199_254_740_995n // beyond Number.MAX_SAFE_INTEGER
    const status = await probeChain(fakeClient({ getBlockNumber: async () => huge }), 8453)
    expect(status.blockNumber).toBe('9007199254740995')
  })

  it('treats a chain id mismatch as unreachable', async () => {
    // Reading position data from the wrong chain would produce confidently
    // wrong numbers, which is worse than reporting an outage.
    const status = await probeChain(fakeClient({ getChainId: async () => 1 }), 8453)

    expect(status.reachable).toBe(false)
    expect(status.error?.code).toBe('RPC_CHAIN_ID_MISMATCH')
    expect(status.error?.message).toContain('1')
    expect(status.error?.message).toContain('8453')
  })

  it('classifies a rate-limited provider', async () => {
    const status = await probeChain(
      fakeClient({
        getBlockNumber: async () => {
          throw new Error('429 Too Many Requests')
        },
      }),
      8453,
    )
    expect(status.reachable).toBe(false)
    expect(status.error?.code).toBe('RPC_RATE_LIMITED')
    expect(status.blockNumber).toBeNull()
  })

  it('classifies every provider being down', async () => {
    const status = await probeChain(
      fakeClient({
        getBlockNumber: async () => {
          throw new Error('fetch failed')
        },
      }),
      8453,
    )
    expect(status.error?.code).toBe('RPC_ALL_PROVIDERS_FAILED')
  })

  it('times out a hanging provider instead of hanging the request', async () => {
    vi.useFakeTimers()
    try {
      const promise = probeChain(
        fakeClient({ getBlockNumber: () => new Promise<bigint>(() => {}) }),
        8453,
        { timeoutMs: 500 },
      )
      await vi.advanceTimersByTimeAsync(600)
      const status = await promise
      expect(status.reachable).toBe(false)
      expect(status.error?.code).toBe('RPC_TIMEOUT')
    } finally {
      vi.useRealTimers()
    }
  })

  it('never throws — failures are returned as data so the UI can name them', async () => {
    await expect(
      probeChain(
        fakeClient({
          getChainId: async () => {
            throw new Error('boom')
          },
        }),
        8453,
      ),
    ).resolves.toMatchObject({ reachable: false })
  })
})

describe('withTimeout', () => {
  it('resolves when the promise wins', async () => {
    await expect(withTimeout(Promise.resolve(42), 1000)).resolves.toBe(42)
  })

  it('rejects with TimeoutError when the clock wins', async () => {
    vi.useFakeTimers()
    try {
      const promise = withTimeout(new Promise(() => {}), 100)
      const assertion = expect(promise).rejects.toBeInstanceOf(TimeoutError)
      await vi.advanceTimersByTimeAsync(150)
      await assertion
    } finally {
      vi.useRealTimers()
    }
  })
})
