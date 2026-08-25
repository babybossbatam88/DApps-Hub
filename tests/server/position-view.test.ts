import { describe, expect, it } from 'vitest'
import { toPositionView, type PositionRow } from '@/server/positions/view'

const USDC = {
  address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  symbol: 'USDC',
  name: 'USD Coin',
  decimals: 6,
  verified: true,
}
const CBBTC = {
  address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
  symbol: 'cbBTC',
  name: 'Coinbase Wrapped BTC',
  decimals: 8,
  verified: true,
}
const WETH = {
  address: '0x4200000000000000000000000000000000000006',
  symbol: 'WETH',
  name: 'Wrapped Ether',
  decimals: 18,
  verified: true,
}

function row(over: Partial<PositionRow> = {}): PositionRow {
  return {
    id: 'p1',
    positionNftId: '1348792',
    chainId: 8453,
    poolAddress: '0xfBb6Eed8e7aa03B138556eeDaF5D271A5E1e43ef',
    feeTier: 3000,
    tickLower: -67680,
    tickUpper: -65400,
    currentLiquidity: '61800000',
    status: 'ACTIVE',
    entryTimestamp: new Date('2026-01-01T00:00:00.000Z'),
    lastSyncedAt: new Date('2026-01-02T00:00:00.000Z'),
    lastSyncError: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    token0: USDC,
    token1: CBBTC,
    pool: { tickSpacing: 60 },
    protocol: { name: 'Uniswap', version: 'v3' },
    wallet: { address: '0x4f3a120E72C76c22ae802D129F599BFDbc31cb81', label: 'Main LP wallet' },
    entrySnapshot: null,
    ...over,
  }
}

describe('toPositionView — price orientation', () => {
  it('quotes the volatile asset in the stablecoin', () => {
    const view = toPositionView(row())
    expect(view.pairLabel).toBe('cbBTC / USDC')
    expect(view.baseSymbol).toBe('cbBTC')
    expect(view.quoteSymbol).toBe('USDC')
    expect(view.quoteIsToken0).toBe(true)
  })

  it('reports the test position range as 69,206 to 86,928 USDC per cbBTC', () => {
    const view = toPositionView(row())
    expect(Number(view.priceLower)).toBeCloseTo(69206, -1)
    expect(Number(view.priceUpper)).toBeCloseTo(86928, -1)
  })

  it('swaps which tick bound reads as the lower price when the quote is token0', () => {
    // The orientation trap. USDC sorts below cbBTC, so USDC is token0 and the
    // raw price is cbBTC per USDC. Inverting it means the LOWER tick produces
    // the HIGHER readable price. Getting this backwards puts the range upside
    // down and makes "near lower" mean near the upper bound.
    const view = toPositionView(row())
    expect(Number(view.priceLower)).toBeLessThan(Number(view.priceUpper))
  })

  it('does not invert when the quote is token1', () => {
    // A hypothetical pool where the volatile asset sorts first.
    const view = toPositionView(row({ token0: CBBTC, token1: USDC }))
    expect(view.quoteIsToken0).toBe(false)
    expect(view.baseSymbol).toBe('cbBTC')
    expect(view.quoteSymbol).toBe('USDC')
    expect(Number(view.priceLower)).toBeLessThan(Number(view.priceUpper))
  })

  it('handles an 18/6 decimal pair', () => {
    const view = toPositionView(
      row({ token0: USDC, token1: WETH, tickLower: 193890, tickUpper: 196260, feeTier: 500 }),
    )
    expect(view.pairLabel).toBe('WETH / USDC')
    expect(Number(view.priceLower)).toBeCloseTo(2999, -2)
    expect(Number(view.priceUpper)).toBeCloseTo(3801, -2)
  })

  it('computes range width from the readable bounds', () => {
    const view = toPositionView(row())
    // (86928 - 69206) / 69206 = 25.6%
    expect(Number(view.rangeWidthPercent)).toBeCloseTo(25.6, 0)
  })
})

describe('toPositionView — identity and status', () => {
  it('carries protocol, chain, fee tier and ticks through', () => {
    const view = toPositionView(row())
    expect(view.protocol).toBe('Uniswap')
    expect(view.protocolVersion).toBe('v3')
    expect(view.chainName).toBe('Base')
    expect(view.feeTierLabel).toBe('0.30%')
    expect(view.tickLower).toBe(-67680)
    expect(view.tickUpper).toBe(-65400)
    expect(view.tickSpacing).toBe(60)
  })

  it('keeps the NFT id and liquidity as strings', () => {
    // Both are uint256/uint128 values that exceed Number.MAX_SAFE_INTEGER.
    const view = toPositionView(row({ positionNftId: '9007199254740993', currentLiquidity: '2' }))
    expect(view.positionNftId).toBe('9007199254740993')
    expect(typeof view.liquidity).toBe('string')
  })

  it('marks a zero-liquidity position as closed', () => {
    const view = toPositionView(row({ currentLiquidity: '0', status: 'CLOSED' }))
    expect(view.isClosed).toBe(true)
  })

  it('builds an explorer link for the pool', () => {
    expect(toPositionView(row()).explorerUrl).toBe(
      'https://basescan.org/address/0xfBb6Eed8e7aa03B138556eeDaF5D271A5E1e43ef',
    )
  })

  it('serialises cleanly — no bigint or Decimal leaks', () => {
    expect(() => JSON.stringify(toPositionView(row()))).not.toThrow()
  })
})

describe('toPositionView — entry basis', () => {
  it('is null when no snapshot exists, never a zero basis', () => {
    // A zero basis would make LP-vs-HODL read as pure profit.
    expect(toPositionView(row()).entry).toBeNull()
  })

  it('converts raw amounts using the decimals recorded at entry', () => {
    const view = toPositionView(
      row({
        entrySnapshot: {
          token0RawAmount: { toString: () => '95060000' },
          token1RawAmount: { toString: () => '137000' },
          token0Decimals: 6,
          token1Decimals: 8,
          blockNumber: 33_000_000n,
          txHash: '0xabc',
        },
      }),
    )

    expect(view.entry?.token0Amount).toBe('95.06')
    expect(view.entry?.token1Amount).toBe('0.00137')
    // The raw integers stay available and authoritative.
    expect(view.entry?.token0Raw).toBe('95060000')
    expect(view.entry?.blockNumber).toBe('33000000')
    expect(view.entry?.source).toBe('chain-logs')
  })

  it('uses the decimals stored on the snapshot, not the token record', () => {
    // The snapshot's decimals are part of the immutable basis. If a token
    // record were ever corrected, historical amounts must not shift with it.
    const view = toPositionView(
      row({
        entrySnapshot: {
          token0RawAmount: { toString: () => '1000000000000000000' },
          token1RawAmount: { toString: () => '1' },
          token0Decimals: 18,
          token1Decimals: 8,
          blockNumber: null,
          txHash: null,
        },
      }),
    )
    expect(view.entry?.token0Amount).toBe('1')
  })
})
