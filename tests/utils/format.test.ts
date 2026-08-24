import { describe, expect, it } from 'vitest'
import {
  Decimal,
  NA,
  decimalToRaw,
  formatFeeTier,
  formatPercent,
  formatPrice,
  formatTokenAmount,
  formatUsd,
  rawToDecimal,
  truncateHex,
} from '@/lib/utils/format'

describe('raw <-> human conversion', () => {
  it('converts base units exactly, without floating point', () => {
    // 0.00137 cbBTC at 8 decimals.
    expect(rawToDecimal(137000n, 8).toString()).toBe('0.00137')
    // 95.06 USDC at 6 decimals.
    expect(rawToDecimal(95_060_000n, 6).toString()).toBe('95.06')
  })

  it('survives values beyond Number.MAX_SAFE_INTEGER', () => {
    const raw = 123456789012345678901234n // 24 digits
    expect(rawToDecimal(raw, 18).toString()).toBe('123456.789012345678901234')
  })

  it('round-trips through decimalToRaw', () => {
    const raw = 137000n
    expect(decimalToRaw(rawToDecimal(raw, 8), 8)).toBe(raw)
  })

  it('truncates sub-unit dust rather than rounding it up into existence', () => {
    // Rounding up would invent tokens that do not exist on chain.
    expect(decimalToRaw('0.000000019', 8)).toBe(1n)
    expect(decimalToRaw('0.0000000099', 8)).toBe(0n)
  })

  it('does not lose precision on an 18-decimal value', () => {
    const raw = 1_000_000_000_000_000_001n
    expect(decimalToRaw(rawToDecimal(raw, 18), 18)).toBe(raw)
  })
})

describe('formatUsd', () => {
  it('scales precision to magnitude', () => {
    expect(formatUsd(1234.5)).toBe('$1,235')
    expect(formatUsd(190)).toBe('$190.00')
    expect(formatUsd(0.0421)).toBe('$0.042')
  })

  it('keeps sub-cent amounts visible instead of rounding them to $0.00', () => {
    // On a $190 position a $0.004 fee accrual is real and should not vanish.
    expect(formatUsd(0.004)).toBe('$0.0040')
    expect(formatUsd(0.004)).not.toBe('$0.00')
  })

  it('renders negatives with the sign before the currency symbol', () => {
    expect(formatUsd(-3.75)).toBe('-$3.75')
  })

  it('adds an explicit + only when asked', () => {
    expect(formatUsd(2.5, { signed: true })).toBe('+$2.50')
    expect(formatUsd(2.5)).toBe('$2.50')
    expect(formatUsd(0, { signed: true })).toBe('$0.00')
  })

  it('groups thousands', () => {
    expect(formatUsd(1_234_567)).toBe('$1,234,567')
  })

  it('compacts large values on request', () => {
    expect(formatUsd(1_250_000, { compact: true })).toBe('$1.3M')
    expect(formatUsd(45_300, { compact: true })).toBe('$45.3K')
  })

  it('renders N/A for a missing value rather than zero', () => {
    expect(formatUsd(null)).toBe(NA)
    expect(formatUsd(undefined)).toBe(NA)
    expect(formatUsd('not a number')).toBe(NA)
    expect(formatUsd(Number.NaN)).toBe(NA)
    expect(formatUsd(Number.POSITIVE_INFINITY)).toBe(NA)
  })

  it('accepts bigint and Decimal inputs', () => {
    expect(formatUsd(190n)).toBe('$190.00')
    expect(formatUsd(new Decimal('190.005'))).toBe('$190.01')
  })
})

describe('formatPercent', () => {
  it('formats with a sign when asked', () => {
    expect(formatPercent(-1.87)).toBe('-1.87%')
    expect(formatPercent(1.87, { signed: true })).toBe('+1.87%')
    expect(formatPercent(0)).toBe('0.00%')
  })

  it('returns N/A for a null value', () => {
    expect(formatPercent(null)).toBe(NA)
  })
})

describe('formatTokenAmount', () => {
  it('widens precision for small balances', () => {
    expect(formatTokenAmount('0.00137')).toBe('0.00137')
    expect(formatTokenAmount('95.06')).toBe('95.06')
    expect(formatTokenAmount('1234.5678')).toBe('1,234.56')
  })

  it('never rounds a tiny balance up to a larger one', () => {
    expect(formatTokenAmount('0.000000019')).toBe('0.00000001')
  })

  it('returns N/A for a missing amount', () => {
    expect(formatTokenAmount(null)).toBe(NA)
  })
})

describe('formatPrice', () => {
  it('handles the full range from stablecoin pairs to BTC', () => {
    expect(formatPrice(77000)).toBe('77,000')
    expect(formatPrice(3421.55)).toBe('3,421.55')
    expect(formatPrice(0.9998)).toBe('0.999800')
  })
})

describe('misc formatters', () => {
  it('truncates hex for display but keeps both ends', () => {
    const address = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    expect(truncateHex(address)).toBe('0x8335…2913')
    expect(truncateHex('0xabc')).toBe('0xabc')
  })

  it('renders Uniswap fee tiers from hundredths of a bip', () => {
    expect(formatFeeTier(3000)).toBe('0.30%')
    expect(formatFeeTier(500)).toBe('0.05%')
    expect(formatFeeTier(10000)).toBe('1.00%')
    expect(formatFeeTier(100)).toBe('0.01%')
  })
})
