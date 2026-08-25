import { Decimal, rawToDecimal } from '@/lib/utils/format'

/**
 * Position valuation.
 *
 * Values an inventory in the QUOTE token of the pair, not in dollars. That is a
 * deliberate limit of Phase 4: the only price available so far is the pool's
 * own, which prices one token in the other and says nothing about what either
 * is worth in USD. Calling a USDC figure "dollars" would be assuming a peg the
 * system has not checked — and a stablecoin's peg is exactly the thing that
 * stops being true when it matters most. USD marks arrive with the Binance
 * provider in Phase 10, at which point these figures gain a currency.
 *
 * Pure: no I/O, no clock. Every input is explicit so the result is reproducible
 * and testable against an independent calculation.
 */

export interface ValuationInput {
  amount0: bigint
  amount1: bigint
  decimals0: number
  decimals1: number
  /** Price of the base asset expressed in the quote asset, human units. */
  priceQuotePerBase: Decimal
  /** True when token0 is the quote asset (e.g. USDC in a USDC/cbBTC pool). */
  quoteIsToken0: boolean
}

export interface Valuation {
  /** Human-unit amounts. */
  amount0: Decimal
  amount1: Decimal
  /** Each side's worth in quote units. */
  value0: Decimal
  value1: Decimal
  totalValue: Decimal
  /** Share of total value on each side, or null when the position is empty. */
  allocation0Percent: Decimal | null
  allocation1Percent: Decimal | null
}

export function valuePosition(input: ValuationInput): Valuation {
  const amount0 = rawToDecimal(input.amount0, input.decimals0)
  const amount1 = rawToDecimal(input.amount1, input.decimals1)

  // The quote side is already denominated in quote units; only the base side
  // needs multiplying by the price.
  const value0 = input.quoteIsToken0 ? amount0 : amount0.mul(input.priceQuotePerBase)
  const value1 = input.quoteIsToken0 ? amount1.mul(input.priceQuotePerBase) : amount1

  const totalValue = value0.plus(value1)
  const empty = totalValue.isZero()

  return {
    amount0,
    amount1,
    value0,
    value1,
    totalValue,
    // Percentages of zero are undefined, not 0% — an empty position has no
    // allocation, and rendering "0% / 0%" would imply it does.
    allocation0Percent: empty ? null : value0.div(totalValue).mul(100),
    allocation1Percent: empty ? null : value1.div(totalValue).mul(100),
  }
}

/**
 * Value an arbitrary token pair in quote units. Used for uncollected fees,
 * collected fees, and the HODL basket, all of which are just (amount0, amount1)
 * pairs valued at the same price as the inventory.
 */
export function valueTokenPair(
  amount0: bigint,
  amount1: bigint,
  input: Pick<ValuationInput, 'decimals0' | 'decimals1' | 'priceQuotePerBase' | 'quoteIsToken0'>,
): Decimal {
  const a0 = rawToDecimal(amount0, input.decimals0)
  const a1 = rawToDecimal(amount1, input.decimals1)
  return input.quoteIsToken0
    ? a0.plus(a1.mul(input.priceQuotePerBase))
    : a1.plus(a0.mul(input.priceQuotePerBase))
}
