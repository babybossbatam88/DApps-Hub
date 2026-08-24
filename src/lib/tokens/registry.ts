import type { Address } from 'viem'

/**
 * Canonical asset registry.
 *
 * Two rules this table exists to enforce:
 *
 * 1. **`decimals` here is a hint, never an input to arithmetic.** Every sync
 *    reads `decimals()` from the token contract. A wrong hard-coded value would
 *    corrupt every amount downstream, so the maths never trusts this file.
 *    Entries carry `verified: false` until confirmed on-chain by
 *    `npm run verify:contracts`.
 *
 * 2. **Wrapped assets are not their underlying.** cbBTC is not BTC, WBTC is not
 *    BTC, USDbC is not USDC. When a price is derived from a proxy market the
 *    value is flagged `isProxy` all the way to the UI, which renders a marker.
 */

export interface TokenDefinition {
  chainId: number
  address: Address
  symbol: string
  name: string
  /** Hint only — see rule 1 above. */
  decimals: number
  isStablecoin: boolean
  /** Explicit Binance market mapping. Absent means "no market mapping". */
  binanceSymbol?: string
  /**
   * True when `binanceSymbol` prices a *different* asset that we accept as an
   * approximation (cbBTC via BTCUSDT). Never silently collapsed.
   */
  isProxyPriced: boolean
  /** Set true only after on-chain confirmation of symbol/decimals. */
  verified: boolean
  notes?: string
}

const BASE = 8453

export const BASE_TOKENS: TokenDefinition[] = [
  {
    chainId: BASE,
    address: '0x4200000000000000000000000000000000000006',
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    isStablecoin: false,
    binanceSymbol: 'ETHUSDT',
    isProxyPriced: true,
    verified: false,
    notes: 'Base predeploy. Priced via ETHUSDT — a 1:1 wrapper, but still a proxy.',
  },
  {
    chainId: BASE,
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    isStablecoin: true,
    binanceSymbol: 'USDCUSDT',
    isProxyPriced: false,
    verified: false,
    notes: 'Native Circle USDC on Base. Priced, not assumed to be 1.00.',
  },
  {
    chainId: BASE,
    address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    symbol: 'USDbC',
    name: 'USD Base Coin (bridged)',
    decimals: 6,
    isStablecoin: true,
    isProxyPriced: false,
    verified: false,
    notes: 'Bridged USDC. A DISTINCT asset from native USDC — never merged with it.',
  },
  {
    chainId: BASE,
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    symbol: 'cbBTC',
    name: 'Coinbase Wrapped BTC',
    decimals: 8,
    isStablecoin: false,
    binanceSymbol: 'BTCUSDT',
    isProxyPriced: true,
    verified: false,
    notes:
      'cbBTC is NOT BTC. It is a Coinbase-issued wrapper with issuer risk and a ' +
      'trading spread. BTCUSDT is used as a proxy mark and is flagged as such.',
  },
  {
    chainId: BASE,
    address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
    symbol: 'cbETH',
    name: 'Coinbase Wrapped Staked ETH',
    decimals: 18,
    isStablecoin: false,
    isProxyPriced: true,
    verified: false,
    notes: 'Accrues staking yield, so it trades above ETH. No direct proxy mapping.',
  },
  {
    chainId: BASE,
    address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    isStablecoin: true,
    isProxyPriced: false,
    verified: false,
    notes: 'Quote unit for most Binance markets.',
  },
]

const BY_KEY = new Map<string, TokenDefinition>(
  BASE_TOKENS.map((t) => [tokenKey(t.chainId, t.address), t]),
)

export function tokenKey(chainId: number, address: string): string {
  return `${chainId}:${address.toLowerCase()}`
}

/**
 * Look up a registry hint. Returning `null` is normal and expected: any token
 * found in a discovered position that is not listed here is resolved from its
 * contract and inserted into the database with `verified: true`. This is how
 * WBTC/USDC positions are tracked without hard-coding an address that may not
 * be canonical on Base.
 */
export function findTokenDefinition(
  chainId: number,
  address: string,
): TokenDefinition | null {
  return BY_KEY.get(tokenKey(chainId, address)) ?? null
}

export function listTokens(chainId: number): TokenDefinition[] {
  return BASE_TOKENS.filter((t) => t.chainId === chainId)
}

/**
 * Explicit asset -> market mapping. There is deliberately no fallback rule such
 * as "strip the leading W and append USDT": that heuristic is exactly how a
 * tracker ends up pricing cbBTC as BTC without saying so.
 */
export interface MarketMapping {
  binanceSymbol: string
  isProxy: boolean
}

export function getMarketMapping(
  chainId: number,
  address: string,
): MarketMapping | null {
  const definition = findTokenDefinition(chainId, address)
  if (!definition?.binanceSymbol) return null
  return { binanceSymbol: definition.binanceSymbol, isProxy: definition.isProxyPriced }
}
