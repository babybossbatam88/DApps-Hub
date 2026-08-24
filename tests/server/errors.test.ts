import { describe, expect, it } from 'vitest'
import { AppError, toApiError } from '@/server/errors'
import { splitProtocolKey } from '@/server/registry/seed'

describe('toApiError', () => {
  it('passes an AppError through with its code and status', () => {
    const { body, status } = toApiError(
      new AppError('INVALID_ADDRESS', 'That is not a valid EVM address.', 400),
    )
    expect(status).toBe(400)
    expect(body.error.code).toBe('INVALID_ADDRESS')
    expect(body.error.message).toMatch(/valid EVM address/)
  })

  it('carries AppError details through for form-level feedback', () => {
    const { body } = toApiError(
      new AppError('INVALID_ADDRESS', 'Bad checksum.', 400, { reason: 'BAD_CHECKSUM' }),
    )
    expect(body.error.details).toEqual({ reason: 'BAD_CHECKSUM' })
  })

  it('names a missing DATABASE_URL as a configuration problem, with 503', () => {
    // A deployment problem, not a bug — saying so saves the reader from
    // debugging the query layer.
    const { body, status } = toApiError(new Error('DATABASE_URL is not set. The database is …'))
    expect(status).toBe(503)
    expect(body.error.code).toBe('DATABASE_UNAVAILABLE')
  })

  it('maps a refused database connection to DATABASE_UNAVAILABLE', () => {
    const { body, status } = toApiError(new Error('connect ECONNREFUSED 127.0.0.1:5432'))
    expect(status).toBe(503)
    expect(body.error.code).toBe('DATABASE_UNAVAILABLE')
  })

  it('reuses the RPC taxonomy for provider failures', () => {
    expect(toApiError(new Error('429 Too Many Requests')).body.error.code).toBe('RPC_RATE_LIMITED')
    expect(toApiError(new Error('fetch failed')).body.error.code).toBe('RPC_ALL_PROVIDERS_FAILED')
  })

  it('falls back to UNKNOWN with a 500 rather than inventing a code', () => {
    const { body, status } = toApiError(new Error('something entirely unexpected'))
    expect(status).toBe(500)
    expect(body.error.code).toBe('UNKNOWN')
    expect(body.error.message).toBe('something entirely unexpected')
  })

  it('never throws, whatever it is handed', () => {
    for (const value of [null, undefined, 'string', 42, { a: 1 }]) {
      expect(() => toApiError(value)).not.toThrow()
    }
  })
})

describe('splitProtocolKey', () => {
  it('splits a versioned key into a display name and version', () => {
    expect(splitProtocolKey('uniswap-v3')).toEqual(['Uniswap', 'v3'])
    expect(splitProtocolKey('uniswap-v4')).toEqual(['Uniswap', 'v4'])
  })

  it('handles multi-word protocol names', () => {
    expect(splitProtocolKey('pancake-swap-v3')).toEqual(['Pancake Swap', 'v3'])
  })

  it('degrades gracefully on an unversioned key', () => {
    expect(splitProtocolKey('curve')).toEqual(['curve', '1'])
  })
})
