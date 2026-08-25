import 'server-only'
import type { Address } from 'viem'
import type { PrismaClient } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/db/prisma'
import { getCurrentUserId } from '@/server/auth/current-user'
import { ensureRegistrySeeded } from '@/server/registry/seed'
import { AppError } from '@/server/errors'
import { getPublicClient } from '@/lib/rpc/client'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { requireChain } from '@/lib/chains/registry'
import { findTokenDefinition } from '@/lib/tokens/registry'
import { readTokenMetadata, type TokenMetadata } from '@/lib/tokens/erc20'
import { PROTOCOL_KEY } from '@/lib/protocols/uniswap-v3/contracts'
import {
  enumeratePositionIds,
  readPositionEntry,
  readPositions,
} from '@/lib/protocols/uniswap-v3/positions'
import { poolKeyId, readPoolMetadata, resolvePools } from '@/lib/protocols/uniswap-v3/pools'
import { tickSpacingForFee } from '@/lib/protocols/uniswap-v3/math'
import type { DiscoveryResult, DiscoveryFailure } from './types'
import { toPositionView } from './view'
import type { PositionView } from './types'

/**
 * Phase 3 — Uniswap V3 position discovery.
 *
 * Reads a wallet's position NFTs and persists what is STATIC about them:
 * identity, pair, fee tier, tick bounds, liquidity, and the immutable entry
 * basis. Current price, inventory, and fees are Phase 4 and 5 — this phase
 * deliberately stores nothing that would go stale between syncs.
 */

export async function discoverPositionsForWallet(
  walletId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<DiscoveryResult> {
  const userId = await getCurrentUserId(prisma)
  const wallet = await prisma.wallet.findFirst({ where: { id: walletId, userId } })
  if (!wallet) throw new AppError('UNKNOWN', 'That wallet does not exist.', 404)

  await ensureRegistrySeeded(prisma)
  // Throws for an unsupported network before any chain read is attempted.
  requireChain(wallet.chainId)

  const job = await prisma.syncJob.create({
    data: { userId, kind: 'POSITION_DISCOVERY', targetId: wallet.id, status: 'RUNNING' },
  })

  const failures: DiscoveryFailure[] = []
  let discovered = 0
  let created = 0

  try {
    const client = getPublicClient(wallet.chainId)
    const owner = wallet.address as Address

    // ---- enumerate ------------------------------------------------------
    const tokenIds = await enumeratePositionIds(client, wallet.chainId, owner)
    if (tokenIds.length === 0) {
      await finishJob(prisma, job.id, 'SUCCEEDED', 0, 0, null)
      await prisma.wallet.update({
        where: { id: wallet.id },
        data: { lastSyncedAt: new Date(), lastSyncStatus: 'SUCCEEDED', lastSyncError: null },
      })
      return {
        walletId: wallet.id,
        syncJobId: job.id,
        status: 'SUCCEEDED',
        tokenIdsFound: 0,
        positionsPersisted: 0,
        positionsCreated: 0,
        failures: [],
        error: null,
      }
    }

    // ---- position structs -----------------------------------------------
    const { positions, failures: readFailures } = await readPositions(
      client,
      wallet.chainId,
      tokenIds,
    )
    for (const failure of readFailures) {
      failures.push({ tokenId: failure.tokenId.toString(), reason: failure.reason })
    }

    // ---- token metadata, always from the contract ------------------------
    const tokenAddresses = [
      ...new Set(positions.flatMap((p) => [p.token0.toLowerCase(), p.token1.toLowerCase()])),
    ] as Address[]
    const metadata = await readTokenMetadata(client, tokenAddresses)

    // ---- pools -----------------------------------------------------------
    const poolAddresses = await resolvePools(
      client,
      wallet.chainId,
      positions.map((p) => ({ token0: p.token0, token1: p.token1, feeTier: p.fee })),
    )

    const protocol = await prisma.protocol.findUniqueOrThrow({ where: { key: PROTOCOL_KEY } })

    for (const position of positions) {
      const tokenId = position.tokenId.toString()

      const meta0 = metadata.get(position.token0.toLowerCase())
      const meta1 = metadata.get(position.token1.toLowerCase())
      // Without decimals from the contract, every amount for this position
      // would be scaled by a guess. It is skipped and reported, never stored.
      if (!meta0?.ok || !meta1?.ok) {
        failures.push({
          tokenId,
          reason: `Token metadata unavailable: ${(!meta0?.ok && meta0?.message) || ''} ${(!meta1?.ok && meta1?.message) || ''}`.trim(),
        })
        continue
      }

      const poolAddress = poolAddresses.get(
        poolKeyId({ token0: position.token0, token1: position.token1, feeTier: position.fee }),
      )
      if (!poolAddress) {
        failures.push({
          tokenId,
          reason: 'The factory returned no pool for this pair and fee tier.',
        })
        continue
      }

      const token0 = await upsertToken(prisma, wallet.chainId, meta0.metadata)
      const token1 = await upsertToken(prisma, wallet.chainId, meta1.metadata)

      // tickSpacing is read from the pool where possible and falls back to the
      // canonical value for the fee tier, which is fixed by the protocol.
      const poolMeta = await readPoolMetadata(client, poolAddress)
      const tickSpacing = poolMeta?.tickSpacing ?? tickSpacingForFee(position.fee)

      const pool = await prisma.pool.upsert({
        where: { chainId_address: { chainId: wallet.chainId, address: poolAddress } },
        update: { tickSpacing, feeTier: position.fee },
        create: {
          chainId: wallet.chainId,
          protocolId: protocol.id,
          address: poolAddress,
          token0Id: token0.id,
          token1Id: token1.id,
          feeTier: position.fee,
          tickSpacing,
        },
        select: { id: true },
      })

      const existing = await prisma.lPPosition.findUnique({
        where: {
          chainId_protocolId_positionNftId: {
            chainId: wallet.chainId,
            protocolId: protocol.id,
            positionNftId: tokenId,
          },
        },
        select: { id: true, entrySnapshot: { select: { id: true } } },
      })

      // ---- entry basis, write-once ---------------------------------------
      // Only read from chain when there is no snapshot yet. Re-reading and
      // re-writing an existing basis is exactly what must never happen: the
      // whole HODL comparison rests on it never moving.
      let entry: Awaited<ReturnType<typeof readPositionEntry>> = null
      if (!existing?.entrySnapshot) {
        entry = await readPositionEntry(client, wallet.chainId, position.tokenId)
      }

      const status = position.liquidity === 0n ? 'CLOSED' : 'ACTIVE'
      const entryTimestamp = existing ? undefined : new Date()

      const record = await prisma.lPPosition.upsert({
        where: {
          chainId_protocolId_positionNftId: {
            chainId: wallet.chainId,
            protocolId: protocol.id,
            positionNftId: tokenId,
          },
        },
        update: {
          walletId: wallet.id,
          poolId: pool.id,
          poolAddress,
          token0Id: token0.id,
          token1Id: token1.id,
          feeTier: position.fee,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          currentLiquidity: position.liquidity.toString(),
          status,
          lastSyncedAt: new Date(),
          lastSyncError: null,
        },
        create: {
          walletId: wallet.id,
          protocolId: protocol.id,
          chainId: wallet.chainId,
          poolId: pool.id,
          poolAddress,
          positionNftId: tokenId,
          token0Id: token0.id,
          token1Id: token1.id,
          feeTier: position.fee,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          entryTimestamp: entryTimestamp ?? new Date(),
          initialToken0: (entry?.amount0 ?? 0n).toString(),
          initialToken1: (entry?.amount1 ?? 0n).toString(),
          currentLiquidity: position.liquidity.toString(),
          status,
          lastSyncedAt: new Date(),
        },
        select: { id: true, createdAt: true, updatedAt: true },
      })

      if (!existing) created += 1
      discovered += 1

      // The snapshot is written only when the basis is actually known. A
      // placeholder would have to be corrected later, and correcting a
      // write-once row is the failure this design exists to prevent.
      if (!existing?.entrySnapshot && entry) {
        await prisma.positionEntrySnapshot.create({
          data: {
            positionId: record.id,
            entryTimestamp: new Date(),
            blockNumber: entry.blockNumber,
            txHash: entry.txHash,
            token0RawAmount: entry.amount0.toString(),
            token1RawAmount: entry.amount1.toString(),
            token0Decimals: meta0.metadata.decimals,
            token1Decimals: meta1.metadata.decimals,
          },
        })
        await prisma.lPPosition.update({
          where: { id: record.id },
          data: {
            initialToken0: entry.amount0.toString(),
            initialToken1: entry.amount1.toString(),
          },
        })
      }
    }

    const status = failures.length > 0 ? 'PARTIAL' : 'SUCCEEDED'
    await finishJob(prisma, job.id, status, discovered, failures.length, { failures })
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: status,
        lastSyncError:
          failures.length > 0
            ? `${failures.length} of ${tokenIds.length} positions could not be read and are omitted.`
            : null,
      },
    })

    return {
      walletId: wallet.id,
      syncJobId: job.id,
      status,
      tokenIdsFound: tokenIds.length,
      positionsPersisted: discovered,
      positionsCreated: created,
      failures,
      error: null,
    }
  } catch (error) {
    const code = classifyRpcError(error)
    const message = extractMessage(error)
    await finishJob(prisma, job.id, 'FAILED', discovered, failures.length, null, `${code}: ${message}`)
    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { lastSyncStatus: 'FAILED', lastSyncError: `${code}: ${message}` },
    })
    return {
      walletId: wallet.id,
      syncJobId: job.id,
      status: 'FAILED',
      tokenIdsFound: 0,
      positionsPersisted: discovered,
      positionsCreated: created,
      failures,
      error: { code, message },
    }
  }
}

export async function listPositions(prisma: PrismaClient = getPrisma()): Promise<PositionView[]> {
  await ensureRegistrySeeded(prisma)
  const userId = await getCurrentUserId(prisma)

  const positions = await prisma.lPPosition.findMany({
    where: { wallet: { userId } },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    include: {
      token0: true,
      token1: true,
      pool: true,
      wallet: { select: { address: true, label: true } },
      entrySnapshot: true,
      protocol: true,
    },
  })

  return positions.map(toPositionView)
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

async function upsertToken(
  prisma: PrismaClient,
  chainId: number,
  metadata: TokenMetadata,
): Promise<{ id: string }> {
  const hint = findTokenDefinition(chainId, metadata.address)
  const data = {
    symbol: metadata.symbol,
    name: metadata.name,
    decimals: metadata.decimals,
    // True because these came from the token contract in this sync, not from
    // the static registry — which is a labelling hint only.
    verified: true,
    isStablecoin: hint?.isStablecoin ?? false,
    binanceSymbol: hint?.binanceSymbol ?? null,
    isProxyPriced: hint?.isProxyPriced ?? false,
  }
  return prisma.token.upsert({
    where: { chainId_address: { chainId, address: metadata.address } },
    update: data,
    create: { chainId, address: metadata.address, ...data },
    select: { id: true },
  })
}

async function finishJob(
  prisma: PrismaClient,
  jobId: string,
  status: 'SUCCEEDED' | 'PARTIAL' | 'FAILED',
  processed: number,
  failed: number,
  details: unknown,
  error?: string,
): Promise<void> {
  await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      itemsProcessed: processed,
      itemsFailed: failed,
      ...(details ? { detailsJson: details as object } : {}),
      ...(error ? { error } : {}),
    },
  })
}
