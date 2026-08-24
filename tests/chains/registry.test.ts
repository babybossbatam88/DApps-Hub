import { describe, expect, it } from 'vitest'
import {
  BASE_MAINNET,
  MULTICALL3_ADDRESS,
  getChain,
  getDeployment,
  listChains,
  requireChain,
  requireContract,
  explorerTxUrl,
  explorerAddressUrl,
} from '@/lib/chains/registry'
import { isAddress, getAddress } from 'viem'

describe('chain registry', () => {
  it('registers Base Mainnet with the correct chain id', () => {
    expect(BASE_MAINNET.chainId).toBe(8453)
    expect(getChain(8453)?.key).toBe('base')
  })

  it('returns null for an unknown chain rather than guessing', () => {
    expect(getChain(1)).toBeNull()
    expect(getChain(999999)).toBeNull()
  })

  it('names the supported networks when an unsupported one is required', () => {
    expect(() => requireChain(1)).toThrow(/Unsupported network/)
    expect(() => requireChain(1)).toThrow(/Base Mainnet \(8453\)/)
  })

  it('exposes only enabled chains when asked', () => {
    expect(listChains({ enabledOnly: true }).every((c) => c.isEnabled)).toBe(true)
  })

  describe('Uniswap V3 deployment on Base', () => {
    const contracts = ['factory', 'nonfungiblePositionManager', 'swapRouter02', 'quoterV2', 'tickLens']

    it.each(contracts)('registers a checksummed address for %s', (name) => {
      const address = requireContract(8453, 'uniswap-v3', name)
      expect(isAddress(address)).toBe(true)
      // EIP-55: the stored form must already be checksummed, so a copy-paste
      // into a block explorer or a contract read never silently differs.
      expect(getAddress(address)).toBe(address)
    })

    it('throws for an unregistered contract instead of returning undefined', () => {
      expect(() => requireContract(8453, 'uniswap-v3', 'nonsense')).toThrow(/not registered/)
    })

    it('throws for a protocol not deployed on the chain', () => {
      expect(() => requireContract(8453, 'uniswap-v4', 'factory')).toThrow(/not deployed/)
      expect(getDeployment(8453, 'uniswap-v4')).toBeNull()
    })
  })

  it('uses the canonical Multicall3 address', () => {
    expect(BASE_MAINNET.multicall3Address).toBe(MULTICALL3_ADDRESS)
    expect(getAddress(MULTICALL3_ADDRESS)).toBe(MULTICALL3_ADDRESS)
  })

  it('builds explorer links, and null for unknown chains', () => {
    expect(explorerTxUrl(8453, '0xabc')).toBe('https://basescan.org/tx/0xabc')
    expect(explorerAddressUrl(8453, '0xdef')).toBe('https://basescan.org/address/0xdef')
    expect(explorerTxUrl(1, '0xabc')).toBeNull()
  })
})
