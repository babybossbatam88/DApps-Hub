import type { ErrorCode } from '@/types/sourced'

/**
 * Map a thrown transport error onto the product's error taxonomy.
 *
 * viem wraps provider errors, and providers disagree about how they report
 * rate limiting, so this inspects message text as well as status codes.
 */
export function classifyRpcError(error: unknown): ErrorCode {
  if (error === null || error === undefined) return 'UNKNOWN'

  // A misconfigured deployment is not an outage, and telling the user "the RPC
  // is down" when the real problem is a missing variable sends them debugging
  // the wrong system.
  if (error instanceof Error && error.name === 'EnvironmentError') return 'CONFIGURATION_ERROR'

  const status = extractStatus(error)
  if (status === 429) return 'RPC_RATE_LIMITED'
  if (status === 408 || status === 504) return 'RPC_TIMEOUT'

  const message = extractMessage(error).toLowerCase()

  if (
    message.includes('invalid environment configuration') ||
    message.includes('no rpc endpoints configured')
  ) {
    return 'CONFIGURATION_ERROR'
  }

  if (message.includes('chain id') || message.includes('chainid')) {
    if (message.includes('mismatch') || message.includes('does not match')) {
      return 'RPC_CHAIN_ID_MISMATCH'
    }
  }
  if (
    message.includes('rate limit') ||
    message.includes('too many requests') ||
    message.includes('429')
  ) {
    return 'RPC_RATE_LIMITED'
  }
  if (
    message.includes('timeout') ||
    message.includes('timed out') ||
    message.includes('etimedout') ||
    message.includes('aborted')
  ) {
    return 'RPC_TIMEOUT'
  }
  if (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('fetch failed') ||
    message.includes('network error') ||
    message.includes('all transports') ||
    message.includes('403') ||
    message.includes('forbidden')
  ) {
    return 'RPC_ALL_PROVIDERS_FAILED'
  }
  return 'UNKNOWN'
}

function extractStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null
  const candidate = error as { status?: unknown; statusCode?: unknown; cause?: unknown }
  if (typeof candidate.status === 'number') return candidate.status
  if (typeof candidate.statusCode === 'number') return candidate.statusCode
  if (candidate.cause) return extractStatus(candidate.cause)
  return null
}

export function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause
    const causeMessage = cause instanceof Error ? ` ${cause.message}` : ''
    return `${error.message}${causeMessage}`
  }
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}
