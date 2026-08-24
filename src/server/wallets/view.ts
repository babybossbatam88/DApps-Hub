import { explorerAddressUrl } from '@/lib/chains/registry'
import { rawToDecimal } from '@/lib/utils/format'
import { NATIVE_ASSET_ADDRESS } from './constants'
import type { WalletBalanceView, WalletView } from './types'

/**
 * Database rows -> serialisable view models.
 *
 * Split out from the service so it can be unit tested directly: this is where
 * raw uint256 strings become human amounts and where display ordering is fixed,
 * and both are easy to get subtly wrong.
 */

export interface WalletRow {
  id: string
  address: string
  label: string | null
  chainId: number
  isActive: boolean
  createdAt: Date
  lastSyncedAt: Date | null
  lastSyncStatus: string | null
  lastSyncError: string | null
  balances: Array<{
    rawAmount: { toString(): string }
    blockNumber: bigint | null
    observedAt: Date
    token: {
      address: string
      symbol: string
      name: string
      decimals: number
      verified: boolean
    }
  }>
}

export function toWalletView(wallet: WalletRow, chainName: string): WalletView {
  const balances: WalletBalanceView[] = wallet.balances.map((row) => {
    const isNative = row.token.address.toLowerCase() === NATIVE_ASSET_ADDRESS.toLowerCase()
    const raw = row.rawAmount.toString()
    return {
      tokenAddress: row.token.address,
      symbol: row.token.symbol,
      name: row.token.name,
      decimals: row.token.decimals,
      rawAmount: raw,
      amount: rawToDecimal(raw, row.token.decimals).toString(),
      isNative,
      verified: row.token.verified || isNative,
      observedAt: row.observedAt.toISOString(),
      blockNumber: row.blockNumber?.toString() ?? null,
    }
  })

  // Native first, then case-insensitively by symbol. A stable order means the
  // list does not reshuffle between syncs as balances change, and case-folding
  // keeps cbBTC with the c's rather than after every uppercase symbol.
  balances.sort((a, b) => {
    if (a.isNative !== b.isNative) return a.isNative ? -1 : 1
    return a.symbol.localeCompare(b.symbol, 'en', { sensitivity: 'base' })
  })

  const first = balances[0]

  return {
    id: wallet.id,
    address: wallet.address,
    label: wallet.label,
    chainId: wallet.chainId,
    chainName,
    explorerUrl: explorerAddressUrl(wallet.chainId, wallet.address),
    isActive: wallet.isActive,
    createdAt: wallet.createdAt.toISOString(),
    lastSyncedAt: wallet.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: (wallet.lastSyncStatus as WalletView['lastSyncStatus']) ?? null,
    lastSyncError: wallet.lastSyncError,
    balances,
    observedAt: first?.observedAt ?? wallet.lastSyncedAt?.toISOString() ?? null,
    blockNumber: first?.blockNumber ?? null,
  }
}
