/**
 * Every value that crosses an adapter boundary is wrapped in `Sourced`.
 *
 * The point is that the UI can never render a number without knowing where it
 * came from and when it was read. A failed read produces `value: null` plus an
 * `error` — it must never be coerced to `0`, because `0` is a real answer that
 * means something different.
 */

export type DataSource =
  | 'onchain'
  | 'binance'
  | 'derived'
  | 'database'
  | 'fixture'

export type Confidence = 'very-low' | 'low' | 'medium' | 'higher'

export interface SourcedError {
  code: ErrorCode
  message: string
}

export interface Sourced<T> {
  value: T | null
  source: DataSource
  /** ISO-8601 timestamp of when the value was actually observed. */
  observedAt: string
  confidence?: Confidence
  /** True when derived from a proxy market (e.g. cbBTC priced from BTCUSDT). */
  isProxy?: boolean
  error?: SourcedError
}

/** The complete error taxonomy. Documented in docs/integrations.md §4. */
export const ERROR_CODES = [
  'RPC_TIMEOUT',
  'RPC_RATE_LIMITED',
  'RPC_ALL_PROVIDERS_FAILED',
  'RPC_CHAIN_ID_MISMATCH',
  'INVALID_ADDRESS',
  'UNSUPPORTED_NETWORK',
  'POSITION_NOT_FOUND',
  'TOKEN_METADATA_FAILED',
  'PRICE_SOURCE_UNAVAILABLE',
  'BINANCE_AUTH_FAILED',
  'BINANCE_UNSAFE_PERMISSIONS',
  'BINANCE_RATE_LIMITED',
  'PARTIAL_SYNC',
  'CHAIN_REORG',
  'DATABASE_UNAVAILABLE',
  'NOT_IMPLEMENTED',
  'CONFIGURATION_ERROR',
  'UNKNOWN',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

/** Human-readable copy for each error code, used by the UI. */
export const ERROR_COPY: Record<ErrorCode, string> = {
  RPC_TIMEOUT: 'The RPC provider did not respond in time.',
  RPC_RATE_LIMITED: 'The RPC provider is rate limiting this deployment.',
  RPC_ALL_PROVIDERS_FAILED: 'Every configured RPC endpoint failed.',
  RPC_CHAIN_ID_MISMATCH: 'The RPC endpoint reported an unexpected chain id.',
  INVALID_ADDRESS: 'That is not a valid EVM address.',
  UNSUPPORTED_NETWORK: 'That network is not supported yet.',
  POSITION_NOT_FOUND: 'The position NFT could not be found on chain.',
  TOKEN_METADATA_FAILED: 'Token metadata could not be read from the contract.',
  PRICE_SOURCE_UNAVAILABLE: 'No price source is currently available for this asset.',
  BINANCE_AUTH_FAILED: 'Binance rejected the API credentials.',
  BINANCE_UNSAFE_PERMISSIONS: 'This API key has withdrawals enabled and will not be used.',
  BINANCE_RATE_LIMITED: 'Binance is rate limiting this deployment.',
  PARTIAL_SYNC: 'Some items failed to sync. Figures below are incomplete.',
  CHAIN_REORG: 'A chain reorganisation invalidated recent data.',
  DATABASE_UNAVAILABLE: 'The database is unreachable.',
  NOT_IMPLEMENTED: 'This is not implemented yet.',
  CONFIGURATION_ERROR: 'The deployment is misconfigured.',
  UNKNOWN: 'An unexpected error occurred.',
}

export function ok<T>(
  value: T,
  source: DataSource,
  extra: Partial<Omit<Sourced<T>, 'value' | 'source'>> = {},
): Sourced<T> {
  return {
    value,
    source,
    observedAt: extra.observedAt ?? new Date().toISOString(),
    ...(extra.confidence !== undefined ? { confidence: extra.confidence } : {}),
    ...(extra.isProxy !== undefined ? { isProxy: extra.isProxy } : {}),
  }
}

export function fail<T>(
  code: ErrorCode,
  source: DataSource,
  message?: string,
  observedAt?: string,
): Sourced<T> {
  return {
    value: null,
    source,
    observedAt: observedAt ?? new Date().toISOString(),
    error: { code, message: message ?? ERROR_COPY[code] },
  }
}

export function isOk<T>(s: Sourced<T>): s is Sourced<T> & { value: T } {
  return s.value !== null && s.error === undefined
}
