import { describe, expect, it } from 'vitest'
import { toWalletView, type WalletRow } from '@/server/wallets/view'
import { NATIVE_ASSET_ADDRESS } from '@/server/wallets/constants'

const OBSERVED = new Date('2026-01-01T12:00:00.000Z')
const CREATED = new Date('2025-12-01T09:00:00.000Z')

function balanceRow(
  symbol: string,
  address: string,
  decimals: number,
  rawAmount: string,
  overrides: Partial<WalletRow['balances'][number]> = {},
): WalletRow['balances'][number] {
  return {
    rawAmount: { toString: () => rawAmount },
    blockNumber: 20_000_000n,
    observedAt: OBSERVED,
    token: { address, symbol, name: symbol, decimals, verified: true },
    ...overrides,
  }
}

function walletRow(balances: WalletRow['balances'] = []): WalletRow {
  return {
    id: 'w1',
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    label: 'Main LP wallet',
    chainId: 8453,
    isActive: true,
    createdAt: CREATED,
    lastSyncedAt: OBSERVED,
    lastSyncStatus: 'SUCCEEDED',
    lastSyncError: null,
    balances,
  }
}

describe('toWalletView', () => {
  it('converts raw base units to human amounts using each token decimals', () => {
    const view = toWalletView(
      walletRow([
        balanceRow('USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, '95060000'),
        balanceRow('cbBTC', '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 8, '137000'),
      ]),
      'Base Mainnet',
    )

    const usdc = view.balances.find((b) => b.symbol === 'USDC')
    const cbbtc = view.balances.find((b) => b.symbol === 'cbBTC')

    expect(usdc?.amount).toBe('95.06')
    expect(cbbtc?.amount).toBe('0.00137')
  })

  it('keeps the raw amount as a string alongside the human value', () => {
    // The raw integer is the authoritative value; the human one is for display.
    const view = toWalletView(
      walletRow([balanceRow('USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, '95060000')]),
      'Base Mainnet',
    )
    expect(view.balances[0]?.rawAmount).toBe('95060000')
    expect(typeof view.balances[0]?.rawAmount).toBe('string')
  })

  it('does not lose precision on an 18-decimal balance', () => {
    const view = toWalletView(
      walletRow([
        balanceRow('WETH', '0x4200000000000000000000000000000000000006', 18, '1000000000000000001'),
      ]),
      'Base Mainnet',
    )
    expect(view.balances[0]?.amount).toBe('1.000000000000000001')
  })

  it('sorts the native asset first, then case-insensitively by symbol', () => {
    const view = toWalletView(
      walletRow([
        balanceRow('USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, '1000000'),
        balanceRow('ETH', NATIVE_ASSET_ADDRESS, 18, '1000000000000000000'),
        balanceRow('cbBTC', '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 8, '100000'),
      ]),
      'Base Mainnet',
    )

    // A stable order means the list does not reshuffle between syncs as
    // balances change, which would make it hard to read at a glance.
    // Case-insensitive: cbBTC sorts with the c's, not after every uppercase
    // symbol, which is how a reader expects to find it.
    expect(view.balances.map((b) => b.symbol)).toEqual(['ETH', 'cbBTC', 'USDC'])
    expect(view.balances[0]?.isNative).toBe(true)
  })

  it('marks the native asset as verified even though it has no contract', () => {
    const view = toWalletView(
      walletRow([
        balanceRow('ETH', NATIVE_ASSET_ADDRESS, 18, '1000', { token: {
          address: NATIVE_ASSET_ADDRESS,
          symbol: 'ETH',
          name: 'ETH',
          decimals: 18,
          verified: false,
        } }),
      ]),
      'Base Mainnet',
    )
    expect(view.balances[0]?.verified).toBe(true)
  })

  it('serialises every value — no bigint or Decimal leaks to the client', () => {
    const view = toWalletView(
      walletRow([balanceRow('USDC', '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 6, '1000000')]),
      'Base Mainnet',
    )
    expect(() => JSON.stringify(view)).not.toThrow()
    expect(view.balances[0]?.blockNumber).toBe('20000000')
    expect(view.observedAt).toBe('2026-01-01T12:00:00.000Z')
  })

  it('builds an explorer link for a known chain', () => {
    const view = toWalletView(walletRow(), 'Base Mainnet')
    expect(view.explorerUrl).toBe(
      'https://basescan.org/address/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    )
  })

  it('reports a never-synced wallet as having no observation time', () => {
    const row = { ...walletRow(), lastSyncedAt: null }
    const view = toWalletView(row, 'Base Mainnet')
    // Null, not "now" — claiming freshness for data that was never read is the
    // exact failure this product is built to avoid.
    expect(view.observedAt).toBeNull()
    expect(view.blockNumber).toBeNull()
    expect(view.balances).toEqual([])
  })

  it('carries the last sync error and its outcome through to the view', () => {
    const row = {
      ...walletRow(),
      lastSyncStatus: 'FAILED',
      lastSyncError: 'RPC_TIMEOUT: provider did not respond',
    }
    const view = toWalletView(row, 'Base Mainnet')
    expect(view.lastSyncError).toMatch(/RPC_TIMEOUT/)
    expect(view.lastSyncStatus).toBe('FAILED')
  })

  it('keeps PARTIAL distinct from FAILED', () => {
    // Partial data is fresh and correct, just incomplete. Rendering it as an
    // error trains the reader to ignore the badge, and then a real outage is
    // missed. The UI colours these differently and this is the field it reads.
    const row = {
      ...walletRow(),
      lastSyncStatus: 'PARTIAL',
      lastSyncError: '1 of 6 assets could not be read and are omitted.',
    }
    const view = toWalletView(row, 'Base Mainnet')
    expect(view.lastSyncStatus).toBe('PARTIAL')
    expect(view.lastSyncStatus).not.toBe('FAILED')
  })
})
