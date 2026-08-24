import type { Address, PublicClient } from 'viem'
import { ERC20_ABI } from '@/lib/protocols/uniswap-v3/abis'

/**
 * ERC-20 reads, batched through Multicall3.
 *
 * Two rules hold throughout this module:
 *
 * 1. `decimals` is always read from the contract. A wrong value silently scales
 *    every downstream amount by a power of ten, so a token whose `decimals()`
 *    reverts is reported as a failure rather than defaulted to 18.
 * 2. `allowFailure: true` on every batch. One non-standard token must not take
 *    down the whole wallet sync — it fails alone and says so.
 */

export interface TokenMetadata {
  address: Address
  symbol: string
  name: string
  decimals: number
}

export type TokenMetadataResult =
  | { ok: true; metadata: TokenMetadata }
  | { ok: false; address: Address; message: string }

export interface BalanceReading {
  address: Address
  rawAmount: bigint
}

export type BalanceResult =
  | { ok: true; balance: BalanceReading }
  | { ok: false; address: Address; message: string }

export interface NativeBalance {
  rawAmount: bigint
  decimals: number
  symbol: string
}

export interface WalletReadOptions {
  /** Pin every read to one block so the resulting snapshot is self-consistent. */
  blockNumber?: bigint
}

/**
 * Read symbol/name/decimals for a set of tokens.
 *
 * Three calls per token, all in one multicall batch. Results are keyed by
 * lowercased address because RPCs return addresses in mixed conventions.
 */
export async function readTokenMetadata(
  client: PublicClient,
  addresses: readonly Address[],
  options: WalletReadOptions = {},
): Promise<Map<string, TokenMetadataResult>> {
  const out = new Map<string, TokenMetadataResult>()
  if (addresses.length === 0) return out

  const contracts = addresses.flatMap((address) => [
    { address, abi: ERC20_ABI, functionName: 'symbol' } as const,
    { address, abi: ERC20_ABI, functionName: 'name' } as const,
    { address, abi: ERC20_ABI, functionName: 'decimals' } as const,
  ])

  const results = await client.multicall({
    contracts,
    allowFailure: true,
    ...(options.blockNumber !== undefined ? { blockNumber: options.blockNumber } : {}),
  })

  addresses.forEach((address, index) => {
    const symbolResult = results[index * 3]
    const nameResult = results[index * 3 + 1]
    const decimalsResult = results[index * 3 + 2]

    // decimals is the only one that is load-bearing for arithmetic. Without it
    // the token is unusable, so this is a hard failure.
    if (!decimalsResult || decimalsResult.status !== 'success') {
      out.set(address.toLowerCase(), {
        ok: false,
        address,
        message: 'decimals() could not be read; amounts for this token cannot be trusted.',
      })
      return
    }

    // symbol/name are cosmetic. Some older tokens return bytes32 rather than
    // string and will fail to decode — that is not a reason to drop a balance,
    // so the token is shown by its address instead.
    const symbol =
      symbolResult?.status === 'success' ? String(symbolResult.result) : shortAddress(address)
    const name = nameResult?.status === 'success' ? String(nameResult.result) : symbol

    out.set(address.toLowerCase(), {
      ok: true,
      metadata: { address, symbol, name, decimals: Number(decimalsResult.result) },
    })
  })

  return out
}

/** Read ERC-20 balances for one owner across many tokens, in a single batch. */
export async function readTokenBalances(
  client: PublicClient,
  owner: Address,
  tokens: readonly Address[],
  options: WalletReadOptions = {},
): Promise<Map<string, BalanceResult>> {
  const out = new Map<string, BalanceResult>()
  if (tokens.length === 0) return out

  const results = await client.multicall({
    contracts: tokens.map(
      (address) =>
        ({ address, abi: ERC20_ABI, functionName: 'balanceOf', args: [owner] }) as const,
    ),
    allowFailure: true,
    ...(options.blockNumber !== undefined ? { blockNumber: options.blockNumber } : {}),
  })

  tokens.forEach((address, index) => {
    const result = results[index]
    if (!result || result.status !== 'success') {
      out.set(address.toLowerCase(), {
        ok: false,
        address,
        message:
          result && result.status === 'failure' && result.error instanceof Error
            ? result.error.message
            : 'balanceOf() reverted.',
      })
      return
    }
    out.set(address.toLowerCase(), {
      ok: true,
      balance: { address, rawAmount: result.result as bigint },
    })
  })

  return out
}

export async function readNativeBalance(
  client: PublicClient,
  owner: Address,
  nativeSymbol: string,
  nativeDecimals: number,
  options: WalletReadOptions = {},
): Promise<NativeBalance> {
  const rawAmount = await client.getBalance({
    address: owner,
    ...(options.blockNumber !== undefined ? { blockNumber: options.blockNumber } : {}),
  })
  return { rawAmount, decimals: nativeDecimals, symbol: nativeSymbol }
}

function shortAddress(address: Address): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}
