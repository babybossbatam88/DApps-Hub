import { classifyRpcError, extractMessage } from './errors'
import type { ErrorCode } from '@/types/sourced'

/**
 * The minimum surface a chain probe needs. Declaring it as an interface (rather
 * than taking a viem client) is what makes failover behaviour testable without
 * a network: tests inject a fake.
 */
export interface ChainProbeClient {
  getBlockNumber(): Promise<bigint>
  getChainId(): Promise<number>
}

export interface ChainStatus {
  chainId: number
  reachable: boolean
  blockNumber: string | null
  reportedChainId: number | null
  latencyMs: number | null
  checkedAt: string
  error: { code: ErrorCode; message: string } | null
}

export interface ProbeOptions {
  /** Injected clock — keeps the function pure enough to test. */
  now?: () => number
  timeoutMs?: number
}

/**
 * Probe a chain endpoint for real. This performs actual network I/O when given
 * a real client; it is the only honest way to answer "is the RPC up".
 *
 * A chain-id mismatch is treated as unreachable, not as a warning: reading
 * position data from the wrong chain would silently produce wrong numbers,
 * which is worse than reporting an outage.
 */
export async function probeChain(
  client: ChainProbeClient,
  expectedChainId: number,
  options: ProbeOptions = {},
): Promise<ChainStatus> {
  const now = options.now ?? Date.now
  const timeoutMs = options.timeoutMs ?? 10_000
  const startedAt = now()

  try {
    const [blockNumber, reportedChainId] = await withTimeout(
      Promise.all([client.getBlockNumber(), client.getChainId()]),
      timeoutMs,
    )

    const latencyMs = now() - startedAt

    if (reportedChainId !== expectedChainId) {
      return {
        chainId: expectedChainId,
        reachable: false,
        blockNumber: blockNumber.toString(),
        reportedChainId,
        latencyMs,
        checkedAt: new Date(now()).toISOString(),
        error: {
          code: 'RPC_CHAIN_ID_MISMATCH',
          message: `Endpoint reported chain id ${reportedChainId}, expected ${expectedChainId}.`,
        },
      }
    }

    return {
      chainId: expectedChainId,
      reachable: true,
      blockNumber: blockNumber.toString(),
      reportedChainId,
      latencyMs,
      checkedAt: new Date(now()).toISOString(),
      error: null,
    }
  } catch (error) {
    return {
      chainId: expectedChainId,
      reachable: false,
      blockNumber: null,
      reportedChainId: null,
      latencyMs: now() - startedAt,
      checkedAt: new Date(now()).toISOString(),
      error: { code: classifyRpcError(error), message: extractMessage(error) },
    }
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}
