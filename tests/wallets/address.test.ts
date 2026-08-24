import { describe, expect, it } from 'vitest'
import { isValidEvmAddress, normalizeEvmAddress } from '@/lib/wallets/address'

// A real, correctly checksummed Base address (native USDC).
const CHECKSUMMED = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const LOWERCASE = CHECKSUMMED.toLowerCase()
const UPPERCASE = '0x' + CHECKSUMMED.slice(2).toUpperCase()

describe('normalizeEvmAddress', () => {
  it('accepts a correctly checksummed address unchanged', () => {
    const result = normalizeEvmAddress(CHECKSUMMED)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.address).toBe(CHECKSUMMED)
      expect(result.wasChecksummed).toBe(true)
    }
  })

  it('checksums an all-lowercase address rather than rejecting it', () => {
    // Lowercase carries no checksum information, so there is nothing to verify
    // and nothing to reject — block explorers hand these out routinely.
    const result = normalizeEvmAddress(LOWERCASE)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.address).toBe(CHECKSUMMED)
      expect(result.wasChecksummed).toBe(false)
    }
  })

  it('accepts an all-uppercase address', () => {
    const result = normalizeEvmAddress(UPPERCASE)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.address).toBe(CHECKSUMMED)
  })

  it('rejects a mixed-case address whose checksum does not verify', () => {
    // This is the important case: a single mistyped character in a mixed-case
    // address changes which wallet is tracked, and the checksum is the only
    // thing that catches it.
    const corrupted = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02914'
    const result = normalizeEvmAddress(corrupted)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('BAD_CHECKSUM')
      expect(result.message).toMatch(/checksum/i)
    }
  })

  it('rejects a case-flipped address even though the hex is unchanged', () => {
    const flipped = '0x833589FcD6eDb6E08f4c7C32D4f71b54bdA02913'
    const result = normalizeEvmAddress(flipped)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('BAD_CHECKSUM')
  })

  it('trims surrounding whitespace from a paste', () => {
    const result = normalizeEvmAddress(`   ${CHECKSUMMED}   `)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.address).toBe(CHECKSUMMED)
  })

  it('rejects an empty value with a prompt rather than an error', () => {
    const result = normalizeEvmAddress('   ')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('EMPTY')
  })

  it('names ENS specifically instead of saying "invalid address"', () => {
    for (const value of ['vitalik.eth', 'someone.base.eth']) {
      const result = normalizeEvmAddress(value)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('ENS_UNSUPPORTED')
        expect(result.message).toMatch(/ENS/)
      }
    }
  })

  it('rejects wrong-length input and says how long it should be', () => {
    const short = normalizeEvmAddress('0x8335')
    expect(short.ok).toBe(false)
    if (!short.ok) {
      expect(short.reason).toBe('BAD_FORMAT')
      expect(short.message).toMatch(/42 characters/)
    }

    const long = normalizeEvmAddress(`${CHECKSUMMED}00`)
    expect(long.ok).toBe(false)
  })

  it('rejects input missing the 0x prefix', () => {
    const result = normalizeEvmAddress(CHECKSUMMED.slice(2))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/starts with 0x/)
  })

  it('rejects non-hex characters', () => {
    const result = normalizeEvmAddress('0xZZ3589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('BAD_FORMAT')
  })

  it('rejects the zero address', () => {
    const result = normalizeEvmAddress('0x0000000000000000000000000000000000000000')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('ZERO_ADDRESS')
  })

  it('never throws on hostile input', () => {
    for (const value of ['<script>', '0x'.repeat(50), ' ', '0x ']) {
      expect(() => normalizeEvmAddress(value)).not.toThrow()
      expect(normalizeEvmAddress(value).ok).toBe(false)
    }
  })
})

describe('isValidEvmAddress', () => {
  it('agrees with the full validator', () => {
    expect(isValidEvmAddress(CHECKSUMMED)).toBe(true)
    expect(isValidEvmAddress(LOWERCASE)).toBe(true)
    expect(isValidEvmAddress('nope')).toBe(false)
  })
})
