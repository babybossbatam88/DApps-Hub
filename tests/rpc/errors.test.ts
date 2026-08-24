import { describe, expect, it } from 'vitest'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'

describe('classifyRpcError', () => {
  it('maps HTTP 429 to rate limiting', () => {
    expect(classifyRpcError({ status: 429 })).toBe('RPC_RATE_LIMITED')
    expect(classifyRpcError(new Error('Too Many Requests'))).toBe('RPC_RATE_LIMITED')
    expect(classifyRpcError(new Error('rate limit exceeded'))).toBe('RPC_RATE_LIMITED')
  })

  it('maps timeouts', () => {
    expect(classifyRpcError({ status: 504 })).toBe('RPC_TIMEOUT')
    expect(classifyRpcError(new Error('The request timed out.'))).toBe('RPC_TIMEOUT')
    expect(classifyRpcError(new Error('connect ETIMEDOUT'))).toBe('RPC_TIMEOUT')
  })

  it('maps connection failures to an all-providers-down code', () => {
    expect(classifyRpcError(new Error('fetch failed'))).toBe('RPC_ALL_PROVIDERS_FAILED')
    expect(classifyRpcError(new Error('connect ECONNREFUSED 127.0.0.1:8545'))).toBe(
      'RPC_ALL_PROVIDERS_FAILED',
    )
    expect(classifyRpcError(new Error('All transports failed'))).toBe('RPC_ALL_PROVIDERS_FAILED')
  })

  it('detects a chain id mismatch, which must never be treated as a soft warning', () => {
    expect(classifyRpcError(new Error('chain id mismatch: got 1'))).toBe('RPC_CHAIN_ID_MISMATCH')
  })

  it('reads a status code from a nested cause', () => {
    expect(classifyRpcError(new Error('wrapped', { cause: { status: 429 } }))).toBe(
      'RPC_RATE_LIMITED',
    )
  })

  it('separates a misconfiguration from an outage', () => {
    // Reporting "the RPC is down" when a variable is missing sends the user to
    // debug the wrong system.
    const envError = new Error('Invalid environment configuration:\n  - BASE_RPC_URLS: required')
    envError.name = 'EnvironmentError'
    expect(classifyRpcError(envError)).toBe('CONFIGURATION_ERROR')
    expect(classifyRpcError(new Error('No RPC endpoints configured for Base Mainnet.'))).toBe(
      'CONFIGURATION_ERROR',
    )
  })

  it('falls back to UNKNOWN rather than guessing', () => {
    expect(classifyRpcError(new Error('something odd happened'))).toBe('UNKNOWN')
    expect(classifyRpcError(null)).toBe('UNKNOWN')
    expect(classifyRpcError(undefined)).toBe('UNKNOWN')
  })
})

describe('extractMessage', () => {
  it('includes the cause message when present', () => {
    const error = new Error('outer', { cause: new Error('inner detail') })
    expect(extractMessage(error)).toContain('inner detail')
  })

  it('handles non-Error values', () => {
    expect(extractMessage('plain string')).toBe('plain string')
    expect(extractMessage({ a: 1 })).toBe('{"a":1}')
  })

  it('always returns a string, including for values JSON cannot encode', () => {
    // JSON.stringify(undefined) is `undefined`, not a string. Callers do string
    // work on this result, so returning undefined crashes the error path — the
    // one path that must never crash.
    for (const value of [undefined, null, 42, () => {}, Symbol('x')]) {
      expect(typeof extractMessage(value)).toBe('string')
    }
  })
})
