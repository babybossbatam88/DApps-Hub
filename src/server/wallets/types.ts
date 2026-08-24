/** View models returned by the wallet API. Serialisable: no bigint, no Decimal. */

export type SyncOutcome = 'SUCCEEDED' | 'PARTIAL' | 'FAILED'

export interface WalletBalanceView {
  tokenAddress: string
  symbol: string
  name: string
  decimals: number
  /** Raw base units as a string — never a JS number. */
  rawAmount: string
  /** Human units, computed with decimal.js. */
  amount: string
  isNative: boolean
  /** True when symbol/decimals were read from the contract in this sync. */
  verified: boolean
  observedAt: string
  blockNumber: string | null
}

export interface WalletView {
  id: string
  address: string
  label: string | null
  chainId: number
  chainName: string
  explorerUrl: string | null
  isActive: boolean
  createdAt: string
  lastSyncedAt: string | null
  /** Outcome of the last sync. PARTIAL means fresh but incomplete, not broken. */
  lastSyncStatus: SyncOutcome | null
  lastSyncError: string | null
  balances: WalletBalanceView[]
  /** Non-null only once the wallet has synced at least once. */
  observedAt: string | null
  blockNumber: string | null
}



export interface WalletSyncResult {
  walletId: string
  syncJobId: string
  status: SyncOutcome
  itemsProcessed: number
  itemsFailed: number
  blockNumber: string | null
  finishedAt: string
  error: { code: string; message: string } | null
  /** Per-token failures on a partial sync, so the UI can name what is missing. */
  failures: Array<{ tokenAddress: string; message: string }>
}
