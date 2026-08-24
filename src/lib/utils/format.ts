import { Decimal } from 'decimal.js'

// 40 significant digits: enough for Q64.96 / Q128.128 intermediate maths without
// the drift that IEEE-754 doubles introduce on 2^96-scaled values.
Decimal.set({ precision: 40, toExpNeg: -40, toExpPos: 40 })

export { Decimal }

/** The placeholder shown when a value could not be read. Never "0". */
export const NA = 'N/A'

export type Numeric = Decimal | bigint | number | string | null | undefined

function toDecimal(value: Numeric): Decimal | null {
  if (value === null || value === undefined) return null
  try {
    if (value instanceof Decimal) return value
    if (typeof value === 'bigint') return new Decimal(value.toString())
    const d = new Decimal(value)
    return d.isFinite() ? d : null
  } catch {
    return null
  }
}

/**
 * Convert a raw base-unit integer to human units without ever going through a
 * JS float. `rawToDecimal(123456789n, 8)` -> 1.23456789
 */
export function rawToDecimal(raw: bigint | string, decimals: number): Decimal {
  return new Decimal(raw.toString()).div(new Decimal(10).pow(decimals))
}

/** Inverse of `rawToDecimal`, truncating (never rounding up) sub-unit dust. */
export function decimalToRaw(value: Decimal | string | number, decimals: number): bigint {
  const scaled = new Decimal(value).mul(new Decimal(10).pow(decimals))
  return BigInt(scaled.toFixed(0, Decimal.ROUND_DOWN))
}

export interface UsdOptions {
  /** Show a leading + on positive values (for P/L figures). */
  signed?: boolean
  /** Force a specific number of decimal places. */
  decimals?: number
  /** Abbreviate large values: 1.2M, 45.3K. */
  compact?: boolean
}

export function formatUsd(value: Numeric, options: UsdOptions = {}): string {
  const d = toDecimal(value)
  if (d === null) return NA

  const abs = d.abs()
  let decimals = options.decimals
  if (decimals === undefined) {
    // Sub-cent amounts still matter on a $190 position, so widen rather than
    // rounding a real number to $0.00.
    if (abs.gte(1000)) decimals = 0
    else if (abs.gte(1)) decimals = 2
    else if (abs.gte(0.01)) decimals = 3
    else if (abs.isZero()) decimals = 2
    else decimals = 4
  }

  if (options.compact && abs.gte(1000)) {
    const units: Array<[Decimal, string]> = [
      [new Decimal(1e9), 'B'],
      [new Decimal(1e6), 'M'],
      [new Decimal(1e3), 'K'],
    ]
    for (const [scale, suffix] of units) {
      if (abs.gte(scale)) {
        const scaled = d.div(scale)
        return `${sign(d, options.signed)}$${scaled.abs().toFixed(scaled.abs().gte(100) ? 0 : 1)}${suffix}`
      }
    }
  }

  const body = abs
    .toFixed(decimals)
    .replace(/\B(?=(\d{3})+(?!\d))/, '')
  return `${sign(d, options.signed)}$${groupThousands(body)}`
}

function sign(d: Decimal, signed?: boolean): string {
  if (d.isNegative()) return '-'
  return signed && !d.isZero() ? '+' : ''
}

function groupThousands(fixed: string): string {
  const [intPart = '0', fracPart] = fixed.split('.')
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return fracPart === undefined ? grouped : `${grouped}.${fracPart}`
}

export function formatPercent(
  value: Numeric,
  options: { signed?: boolean; decimals?: number } = {},
): string {
  const d = toDecimal(value)
  if (d === null) return NA
  const decimals = options.decimals ?? 2
  return `${sign(d, options.signed)}${d.abs().toFixed(decimals)}%`
}

/**
 * Token quantities. Uses significant digits rather than fixed decimals so
 * 0.00137 cbBTC and 95.06 USDC both read correctly.
 */
export function formatTokenAmount(value: Numeric, options: { maxDecimals?: number } = {}): string {
  const d = toDecimal(value)
  if (d === null) return NA
  const abs = d.abs()
  let decimals = options.maxDecimals
  if (decimals === undefined) {
    if (abs.isZero()) decimals = 2
    else if (abs.gte(1000)) decimals = 2
    else if (abs.gte(1)) decimals = 4
    else if (abs.gte(0.0001)) decimals = 6
    else decimals = 8
  }
  const fixed = d.toFixed(decimals, Decimal.ROUND_DOWN)
  // Trim trailing zeros but keep at least two decimals for readability.
  const trimmed = fixed.includes('.') ? fixed.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '.00') : fixed
  return groupThousands(trimmed)
}

/** Prices: wide dynamic range from 0.9998 (USDC/USDT) to 77,000 (cbBTC). */
export function formatPrice(value: Numeric): string {
  const d = toDecimal(value)
  if (d === null) return NA
  const abs = d.abs()
  let decimals: number
  if (abs.gte(10_000)) decimals = 0
  else if (abs.gte(100)) decimals = 2
  else if (abs.gte(1)) decimals = 4
  else decimals = 6
  return groupThousands(d.toFixed(decimals))
}

/** 0x1234…abcd — for addresses and tx hashes in monospace cells. */
export function truncateHex(value: string, lead = 6, tail = 4): string {
  if (value.length <= lead + tail + 1) return value
  return `${value.slice(0, lead)}…${value.slice(-tail)}`
}

/** Uniswap fee tier (hundredths of a bip) -> "0.30%". */
export function formatFeeTier(feeTier: number): string {
  return `${(feeTier / 10_000).toFixed(2)}%`
}
