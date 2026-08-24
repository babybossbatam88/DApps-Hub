import type { Address, PublicClient } from 'viem'
import { requireContract, getDeployment } from '@/lib/chains/registry'
import { UNISWAP_V3_FACTORY_ABI } from './abis'
import { FEE_TIERS } from './types'

export const PROTOCOL_KEY = 'uniswap-v3'

export function factoryAddress(chainId: number): Address {
  return requireContract(chainId, PROTOCOL_KEY, 'factory')
}

export function positionManagerAddress(chainId: number): Address {
  return requireContract(chainId, PROTOCOL_KEY, 'nonfungiblePositionManager')
}

export function quoterAddress(chainId: number): Address {
  return requireContract(chainId, PROTOCOL_KEY, 'quoterV2')
}

export function isProtocolAvailable(chainId: number): boolean {
  return getDeployment(chainId, PROTOCOL_KEY) !== null
}

export interface ContractVerification {
  name: string
  address: Address
  deployed: boolean
  error: string | null
}

/**
 * Assert that every registered address is actually a deployed contract, and
 * that the factory behaves like a Uniswap V3 factory.
 *
 * This runs before any sync. A wrong address that silently returns `0x` would
 * otherwise produce plausible-looking but wrong position data, which is the
 * failure mode this whole product exists to avoid. Failing loudly at startup is
 * strictly better.
 */
export async function verifyContracts(
  client: PublicClient,
  chainId: number,
  probePair?: { token0: Address; token1: Address },
): Promise<{ ok: boolean; results: ContractVerification[] }> {
  const deployment = getDeployment(chainId, PROTOCOL_KEY)
  if (!deployment) {
    return {
      ok: false,
      results: [
        {
          name: PROTOCOL_KEY,
          address: '0x0000000000000000000000000000000000000000',
          deployed: false,
          error: `Uniswap V3 is not registered for chain ${chainId}.`,
        },
      ],
    }
  }

  const results: ContractVerification[] = []

  for (const [name, address] of Object.entries(deployment.contracts)) {
    try {
      const code = await client.getCode({ address })
      const deployed = Boolean(code && code !== '0x')
      results.push({
        name,
        address,
        deployed,
        error: deployed ? null : 'No contract code at this address.',
      })
    } catch (error) {
      results.push({
        name,
        address,
        deployed: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  // Behavioural check: a real factory returns a pool for a known live pair.
  if (probePair) {
    try {
      const pool = await client.readContract({
        address: factoryAddress(chainId),
        abi: UNISWAP_V3_FACTORY_ABI,
        functionName: 'getPool',
        args: [probePair.token0, probePair.token1, FEE_TIERS.MEDIUM],
      })
      const found = pool !== '0x0000000000000000000000000000000000000000'
      results.push({
        name: 'factory.getPool(probe)',
        address: pool,
        deployed: found,
        error: found ? null : 'Factory returned the zero address for the probe pair.',
      })
    } catch (error) {
      results.push({
        name: 'factory.getPool(probe)',
        address: factoryAddress(chainId),
        deployed: false,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return { ok: results.every((r) => r.deployed), results }
}
