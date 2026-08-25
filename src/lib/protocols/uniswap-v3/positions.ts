import type { Address, PublicClient } from 'viem'
import { NONFUNGIBLE_POSITION_MANAGER_ABI, POSITION_MANAGER_EVENTS_ABI } from './abis'
import { positionManagerAddress } from './contracts'
import type { RawPosition } from './types'

/**
 * Position NFT discovery.
 *
 * `NonfungiblePositionManager` is ERC-721 Enumerable, so a wallet's positions
 * are `balanceOf` followed by `tokenOfOwnerByIndex` for each index. Every read
 * here is batched through Multicall3 by the viem client, which is what makes
 * discovering a wallet with dozens of positions two round trips rather than
 * a hundred.
 *
 * Nothing in this module can write: the ABI it imports has no state-changing
 * entry at all.
 */

export interface PositionReadFailure {
  tokenId: bigint
  reason: string
}

export interface PositionReadResult {
  positions: RawPosition[]
  failures: PositionReadFailure[]
}

/**
 * Enumerate the token ids held by an owner.
 *
 * A wallet with no positions returns an empty array — that is a real answer,
 * distinct from a failed read, which throws.
 */
export async function enumeratePositionIds(
  client: PublicClient,
  chainId: number,
  owner: Address,
): Promise<bigint[]> {
  const address = positionManagerAddress(chainId)

  const balance = await client.readContract({
    address,
    abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
    functionName: 'balanceOf',
    args: [owner],
  })

  const count = Number(balance)
  if (count === 0) return []

  const results = await client.multicall({
    contracts: Array.from({ length: count }, (_, index) => ({
      address,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: 'tokenOfOwnerByIndex' as const,
      args: [owner, BigInt(index)] as const,
    })),
    allowFailure: true,
  })

  const ids: bigint[] = []
  for (const result of results) {
    // A failed index is skipped rather than guessed. Enumeration can race with
    // a transfer, and inventing an id would produce a phantom position.
    if (result.status === 'success' && typeof result.result === 'bigint') {
      ids.push(result.result)
    }
  }
  return ids
}

/**
 * Read the `positions(tokenId)` struct for each id.
 *
 * Failures are collected rather than thrown: one burnt or transferred NFT must
 * not abort discovery for the rest of the wallet.
 */
export async function readPositions(
  client: PublicClient,
  chainId: number,
  tokenIds: readonly bigint[],
): Promise<PositionReadResult> {
  if (tokenIds.length === 0) return { positions: [], failures: [] }

  const address = positionManagerAddress(chainId)
  const results = await client.multicall({
    contracts: tokenIds.map((tokenId) => ({
      address,
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: 'positions' as const,
      args: [tokenId] as const,
    })),
    allowFailure: true,
  })

  const positions: RawPosition[] = []
  const failures: PositionReadFailure[] = []

  tokenIds.forEach((tokenId, index) => {
    const result = results[index]
    if (!result || result.status !== 'success') {
      failures.push({
        tokenId,
        reason:
          result && result.status === 'failure' && result.error instanceof Error
            ? result.error.message
            : 'positions() reverted or returned nothing.',
      })
      return
    }

    const decoded = decodePositionStruct(result.result)
    if (!decoded) {
      failures.push({ tokenId, reason: 'positions() returned an unexpected shape.' })
      return
    }
    positions.push({ ...decoded, tokenId })
  })

  return { positions, failures }
}

/** The 12-field tuple from `positions(tokenId)`, named. */
function decodePositionStruct(value: unknown): Omit<RawPosition, 'tokenId'> | null {
  if (!Array.isArray(value) || value.length < 12) return null
  const [
    nonce,
    operator,
    token0,
    token1,
    fee,
    tickLower,
    tickUpper,
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  ] = value as [
    bigint,
    Address,
    Address,
    Address,
    number,
    number,
    number,
    bigint,
    bigint,
    bigint,
    bigint,
    bigint,
  ]

  return {
    nonce,
    operator,
    token0,
    token1,
    fee: Number(fee),
    tickLower: Number(tickLower),
    tickUpper: Number(tickUpper),
    liquidity,
    feeGrowthInside0LastX128,
    feeGrowthInside1LastX128,
    tokensOwed0,
    tokensOwed1,
  }
}

/**
 * Confirm current ownership of a token id.
 *
 * Enumeration already implies ownership, so this exists for importing a
 * position by id directly — where the user could type any number.
 */
export async function ownerOfPosition(
  client: PublicClient,
  chainId: number,
  tokenId: bigint,
): Promise<Address | null> {
  try {
    return await client.readContract({
      address: positionManagerAddress(chainId),
      abi: NONFUNGIBLE_POSITION_MANAGER_ABI,
      functionName: 'ownerOf',
      args: [tokenId],
    })
  } catch {
    // ownerOf reverts for a burnt or never-minted id. That is an answer, not an
    // error condition to propagate.
    return null
  }
}

/**
 * A position with zero liquidity is closed but its NFT still exists and is
 * still enumerable. It is kept for lifetime fee accounting and excluded from
 * active KPIs — not silently dropped, which would make historical fees vanish.
 */
export function isClosed(position: Pick<RawPosition, 'liquidity'>): boolean {
  return position.liquidity === 0n
}

/**
 * The quantities originally deposited, reconstructed from `IncreaseLiquidity`
 * events, plus the block and transaction of the first one.
 *
 * This is the immutable HODL basis. Only the QUANTITIES are needed — the
 * counterfactual is "those same tokens, valued today" — so no historical price
 * lookup is required, which is what makes it derivable at all.
 *
 * Returns `null` when the history cannot be read. Many public RPC endpoints
 * reject an unbounded `eth_getLogs`, and a partial window would understate the
 * basis and silently flatter every LP-vs-HODL figure. No basis is strictly
 * better than a wrong one.
 */
export async function readPositionEntry(
  client: PublicClient,
  chainId: number,
  tokenId: bigint,
  options: { fromBlock?: bigint } = {},
): Promise<{
  amount0: bigint
  amount1: bigint
  blockNumber: bigint | null
  txHash: string | null
  depositCount: number
} | null> {
  try {
    const logs = await client.getLogs({
      address: positionManagerAddress(chainId),
      event: POSITION_MANAGER_EVENTS_ABI[0],
      args: { tokenId },
      fromBlock: options.fromBlock ?? 0n,
      toBlock: 'latest',
    })

    if (logs.length === 0) return null

    let amount0 = 0n
    let amount1 = 0n
    for (const log of logs) {
      amount0 += log.args.amount0 ?? 0n
      amount1 += log.args.amount1 ?? 0n
    }

    const first = logs[0]
    return {
      amount0,
      amount1,
      blockNumber: first?.blockNumber ?? null,
      txHash: first?.transactionHash ?? null,
      depositCount: logs.length,
    }
  } catch {
    return null
  }
}
