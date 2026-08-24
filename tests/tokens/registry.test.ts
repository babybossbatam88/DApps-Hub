import { describe, expect, it } from 'vitest'
import { getAddress, isAddress } from 'viem'
import {
  BASE_TOKENS,
  findTokenDefinition,
  getMarketMapping,
  listTokens,
  tokenKey,
} from '@/lib/tokens/registry'

const CBBTC = '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDBC = '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA'

describe('token registry', () => {
  it('stores every address checksummed and valid', () => {
    for (const token of BASE_TOKENS) {
      expect(isAddress(token.address)).toBe(true)
      expect(getAddress(token.address)).toBe(token.address)
    }
  })

  it('has no duplicate entries', () => {
    const keys = BASE_TOKENS.map((t) => tokenKey(t.chainId, t.address))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('looks up case-insensitively, since RPCs return lowercase addresses', () => {
    expect(findTokenDefinition(8453, CBBTC.toLowerCase())?.symbol).toBe('cbBTC')
    expect(findTokenDefinition(8453, CBBTC)?.symbol).toBe('cbBTC')
  })

  it('returns null for an unlisted token instead of guessing', () => {
    // Unlisted tokens are resolved from their contract during sync, which is how
    // pairs with no canonical registry entry are tracked without a hard-coded
    // address that might be wrong.
    expect(findTokenDefinition(8453, '0x0000000000000000000000000000000000000001')).toBeNull()
    expect(findTokenDefinition(1, USDC)).toBeNull()
  })

  it('marks every entry unverified until confirmed on chain', () => {
    // decimals here is a labelling hint. Arithmetic always reads the contract.
    expect(BASE_TOKENS.every((t) => t.verified === false)).toBe(true)
  })

  it('lists tokens per chain', () => {
    expect(listTokens(8453).length).toBe(BASE_TOKENS.length)
    expect(listTokens(1)).toEqual([])
  })
})

describe('market mapping — cbBTC is not BTC', () => {
  it('maps cbBTC to BTCUSDT but flags it as a proxy', () => {
    const mapping = getMarketMapping(8453, CBBTC)
    expect(mapping).toEqual({ binanceSymbol: 'BTCUSDT', isProxy: true })
  })

  it('flags WETH as a proxy too', () => {
    expect(getMarketMapping(8453, '0x4200000000000000000000000000000000000006')?.isProxy).toBe(true)
  })

  it('does not flag native USDC as a proxy', () => {
    expect(getMarketMapping(8453, USDC)).toEqual({ binanceSymbol: 'USDCUSDT', isProxy: false })
  })

  it('prices USDC rather than assuming 1.00', () => {
    // Pinning a stablecoin to $1.00 fabricates value during a depeg, which is
    // exactly when the number matters.
    const usdc = findTokenDefinition(8453, USDC)
    expect(usdc?.isStablecoin).toBe(true)
    expect(usdc?.binanceSymbol).toBe('USDCUSDT')
  })

  it('keeps bridged USDbC distinct from native USDC', () => {
    const bridged = findTokenDefinition(8453, USDBC)
    const native = findTokenDefinition(8453, USDC)
    expect(bridged?.symbol).toBe('USDbC')
    expect(native?.symbol).toBe('USDC')
    expect(bridged?.address).not.toBe(native?.address)
    // No market mapping: it must not inherit USDC's price silently.
    expect(getMarketMapping(8453, USDBC)).toBeNull()
  })

  it('returns null rather than deriving a symbol heuristically', () => {
    // A rule like "strip the leading W and append USDT" is exactly how a tracker
    // ends up pricing cbETH as ETH without saying so.
    expect(getMarketMapping(8453, '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22')).toBeNull()
  })

  it('records the decimals that matter for the test pair', () => {
    expect(findTokenDefinition(8453, CBBTC)?.decimals).toBe(8)
    expect(findTokenDefinition(8453, USDC)?.decimals).toBe(6)
  })
})
