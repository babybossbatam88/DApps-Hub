import { describe, expect, it } from 'vitest'
import { ERROR_CODES, ERROR_COPY, fail, isOk, ok } from '@/types/sourced'

describe('Sourced', () => {
  it('carries a source and an observation timestamp on every success', () => {
    const result = ok(42, 'onchain', { observedAt: '2026-01-01T00:00:00.000Z' })
    expect(result.value).toBe(42)
    expect(result.source).toBe('onchain')
    expect(result.observedAt).toBe('2026-01-01T00:00:00.000Z')
    expect(isOk(result)).toBe(true)
  })

  it('represents a failed read as null plus an error, never as zero', () => {
    // This is the rule the whole product rests on: a read that failed and a
    // value that is genuinely zero are different facts.
    const result = fail<number>('RPC_TIMEOUT', 'onchain')
    expect(result.value).toBeNull()
    expect(result.value).not.toBe(0)
    expect(result.error?.code).toBe('RPC_TIMEOUT')
    expect(isOk(result)).toBe(false)
  })

  it('distinguishes a real zero from a failure', () => {
    const zero = ok(0, 'onchain')
    expect(isOk(zero)).toBe(true)
    expect(zero.value).toBe(0)
  })

  it('propagates the proxy flag so a cbBTC price is never mistaken for a BTC price', () => {
    const result = ok(77000, 'binance', { isProxy: true, confidence: 'medium' })
    expect(result.isProxy).toBe(true)
    expect(result.confidence).toBe('medium')
  })

  it('has user-facing copy for every error code', () => {
    for (const code of ERROR_CODES) {
      expect(ERROR_COPY[code]).toBeTruthy()
      expect(ERROR_COPY[code].length).toBeGreaterThan(10)
    }
  })
})
