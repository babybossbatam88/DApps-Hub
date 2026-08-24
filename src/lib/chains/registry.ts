import type { Address } from 'viem'

/**
 * Chain registry. Adding a chain is a registry entry plus a token list — no
 * engine or UI change. Contract addresses live per (chain, protocol) so a
 * protocol adapter never hard-codes an address.
 */

export interface ProtocolDeployment {
  /** Stable machine key matching `Protocol.key` in the database. */
  protocolKey: string
  contracts: Record<string, Address>
}

export interface ChainDefinition {
  chainId: number
  key: string
  name: string
  shortName: string
  nativeSymbol: string
  nativeDecimals: number
  explorerUrl: string
  /** Fallback endpoints used when no env override is supplied. */
  defaultRpcUrls: string[]
  /** Multicall3 — same address on every major EVM chain. */
  multicall3Address: Address
  /** Block time in seconds, used to size reorg-safety windows. */
  blockTimeSeconds: number
  deployments: ProtocolDeployment[]
  isEnabled: boolean
}

export const MULTICALL3_ADDRESS: Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

export const BASE_MAINNET: ChainDefinition = {
  chainId: 8453,
  key: 'base',
  name: 'Base Mainnet',
  shortName: 'Base',
  nativeSymbol: 'ETH',
  nativeDecimals: 18,
  explorerUrl: 'https://basescan.org',
  defaultRpcUrls: ['https://mainnet.base.org'],
  multicall3Address: MULTICALL3_ADDRESS,
  blockTimeSeconds: 2,
  isEnabled: true,
  deployments: [
    {
      protocolKey: 'uniswap-v3',
      contracts: {
        factory: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
        nonfungiblePositionManager: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
        swapRouter02: '0x2626664c2603336E57B271c5C0b26F421741e481',
        quoterV2: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a',
        tickLens: '0x0CdeE061c75D43c82520eD998C23ac2991c9ac6d',
      },
    },
  ],
}

const CHAINS: ChainDefinition[] = [BASE_MAINNET]

export function listChains(options: { enabledOnly?: boolean } = {}): ChainDefinition[] {
  return options.enabledOnly ? CHAINS.filter((c) => c.isEnabled) : [...CHAINS]
}

export function getChain(chainId: number): ChainDefinition | null {
  return CHAINS.find((c) => c.chainId === chainId) ?? null
}

export function requireChain(chainId: number): ChainDefinition {
  const chain = getChain(chainId)
  if (!chain) {
    const supported = CHAINS.map((c) => `${c.name} (${c.chainId})`).join(', ')
    throw new Error(`Unsupported network: chain id ${chainId}. Supported: ${supported}`)
  }
  return chain
}

export function getDeployment(
  chainId: number,
  protocolKey: string,
): ProtocolDeployment | null {
  return getChain(chainId)?.deployments.find((d) => d.protocolKey === protocolKey) ?? null
}

export function requireContract(
  chainId: number,
  protocolKey: string,
  contract: string,
): Address {
  const deployment = getDeployment(chainId, protocolKey)
  if (!deployment) {
    throw new Error(`Protocol "${protocolKey}" is not deployed on chain ${chainId}.`)
  }
  const address = deployment.contracts[contract]
  if (!address) {
    throw new Error(
      `Contract "${contract}" is not registered for ${protocolKey} on chain ${chainId}.`,
    )
  }
  return address
}

export function explorerAddressUrl(chainId: number, address: string): string | null {
  const chain = getChain(chainId)
  return chain ? `${chain.explorerUrl}/address/${address}` : null
}

export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const chain = getChain(chainId)
  return chain ? `${chain.explorerUrl}/tx/${txHash}` : null
}

export const DEFAULT_CHAIN_ID = BASE_MAINNET.chainId
