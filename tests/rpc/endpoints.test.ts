import { describe, expect, it } from 'vitest'
import { resolveRpcEndpoints, redactEndpoint } from '@/lib/rpc/endpoints'

describe('resolveRpcEndpoints', () => {
  it('puts environment endpoints ahead of the public fallback', () => {
    const { endpoints } = resolveRpcEndpoints(8453, ['https://paid.example.com/key'])
    expect(endpoints[0]).toBe('https://paid.example.com/key')
    expect(endpoints).toContain('https://mainnet.base.org')
  })

  it('falls back to the registry list when nothing is configured', () => {
    const { endpoints, usedFallback } = resolveRpcEndpoints(8453, [])
    expect(endpoints).toEqual(['https://mainnet.base.org'])
    // The flag drives a visible warning: the public endpoint rate-limits under
    // position discovery load, and the user should know that is happening.
    expect(usedFallback).toBe(true)
  })

  it('does not flag a fallback when a dedicated provider is configured', () => {
    const { usedFallback } = resolveRpcEndpoints(8453, ['https://paid.example.com'])
    expect(usedFallback).toBe(false)
  })

  it('de-duplicates while preserving priority order', () => {
    const { endpoints } = resolveRpcEndpoints(8453, [
      'https://a.example.com',
      'https://a.example.com',
      'https://mainnet.base.org',
    ])
    expect(endpoints).toEqual(['https://a.example.com', 'https://mainnet.base.org'])
  })

  it('ignores blank entries', () => {
    const { endpoints } = resolveRpcEndpoints(8453, ['', '   ', 'https://a.example.com'])
    expect(endpoints).toEqual(['https://a.example.com', 'https://mainnet.base.org'])
  })

  it('returns nothing for an unknown chain', () => {
    expect(resolveRpcEndpoints(1, ['https://eth.example.com']).endpoints).toEqual([])
  })
})

describe('redactEndpoint', () => {
  it('strips a provider key from the path', () => {
    const redacted = redactEndpoint('https://base-mainnet.g.alchemy.com/v2/abcdefghijklmnopqrstuvwxyz')
    expect(redacted).not.toContain('abcdefghijklmnopqrstuvwxyz')
    expect(redacted).toContain('base-mainnet.g.alchemy.com')
  })

  it('leaves short path segments readable', () => {
    expect(redactEndpoint('https://mainnet.base.org')).toBe('https://mainnet.base.org')
    expect(redactEndpoint('https://rpc.example.com/v2')).toBe('https://rpc.example.com/v2')
  })

  it('never throws on malformed input', () => {
    expect(redactEndpoint('not a url')).toBe('invalid-url')
  })
})
