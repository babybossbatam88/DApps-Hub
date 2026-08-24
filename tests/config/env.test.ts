import { describe, expect, it } from 'vitest'
import { getServerEnv, tryGetServerEnv, EnvironmentError } from '@/lib/config/env'

const base: NodeJS.ProcessEnv = {
  NODE_ENV: 'development',
  BASE_RPC_URLS: 'https://mainnet.base.org',
}

describe('server environment validation', () => {
  it('parses a minimal development environment', () => {
    const env = getServerEnv({ ...base })
    expect(env.BASE_RPC_URLS).toEqual(['https://mainnet.base.org'])
    expect(env.BINANCE_API_BASE_URL).toBe('https://api.binance.com')
    expect(env.FEATURE_BINANCE_TRADING).toBe(false)
  })

  it('splits and trims a comma-separated endpoint list', () => {
    const env = getServerEnv({
      ...base,
      BASE_RPC_URLS: ' https://a.example.com , https://b.example.com ,,',
    })
    expect(env.BASE_RPC_URLS).toEqual(['https://a.example.com', 'https://b.example.com'])
  })

  it('rejects a non-URL endpoint rather than silently dropping it', () => {
    expect(() => getServerEnv({ ...base, BASE_RPC_URLS: 'not-a-url' })).toThrow(EnvironmentError)
  })

  describe('V1 security invariants', () => {
    it('refuses to boot with Binance trading enabled', () => {
      expect(() => getServerEnv({ ...base, FEATURE_BINANCE_TRADING: 'true' })).toThrow(
        /FEATURE_BINANCE_TRADING must be false/,
      )
    })

    it('treats any truthy spelling of the trading flag as enabled', () => {
      for (const value of ['true', '1', 'yes', 'ON', ' True ']) {
        expect(() => getServerEnv({ ...base, FEATURE_BINANCE_TRADING: value })).toThrow()
      }
    })

    it('accepts falsy spellings', () => {
      for (const value of ['false', '0', 'no', '', 'off']) {
        expect(getServerEnv({ ...base, FEATURE_BINANCE_TRADING: value }).FEATURE_BINANCE_TRADING).toBe(
          false,
        )
      }
    })

    it('requires a 32-byte encryption key before enabling Binance account reads', () => {
      expect(() =>
        getServerEnv({ ...base, BINANCE_ENABLE_ACCOUNT_READ: 'true' }),
      ).toThrow(/BINANCE_ENCRYPTION_KEY/)

      expect(() =>
        getServerEnv({
          ...base,
          BINANCE_ENABLE_ACCOUNT_READ: 'true',
          BINANCE_ENCRYPTION_KEY: Buffer.alloc(16).toString('base64'),
        }),
      ).toThrow(/32-byte/)

      const env = getServerEnv({
        ...base,
        BINANCE_ENABLE_ACCOUNT_READ: 'true',
        BINANCE_ENCRYPTION_KEY: Buffer.alloc(32).toString('base64'),
      })
      expect(env.BINANCE_ENABLE_ACCOUNT_READ).toBe(true)
    })

    it('requires RPC endpoints and a database URL in production', () => {
      const result = tryGetServerEnv({ NODE_ENV: 'production' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.issues.join(' ')).toMatch(/BASE_RPC_URLS/)
        expect(result.issues.join(' ')).toMatch(/DATABASE_URL/)
      }
    })
  })

  it('reports every problem at once instead of failing on the first', () => {
    const result = tryGetServerEnv({
      NODE_ENV: 'production',
      BASE_RPC_URLS: 'https://mainnet.base.org',
      DATABASE_URL: 'postgres://x',
      FEATURE_BINANCE_TRADING: 'true',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues.length).toBeGreaterThanOrEqual(1)
  })

  it('never throws from the reporting variant', () => {
    expect(() => tryGetServerEnv({ BASE_RPC_URLS: 'garbage' })).not.toThrow()
  })
})
