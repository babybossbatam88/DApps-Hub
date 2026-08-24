import 'server-only'
import type { Address } from 'viem'
import type { PrismaClient } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/db/prisma'
import { getCurrentUserId } from '@/server/auth/current-user'
import { ensureRegistrySeeded } from '@/server/registry/seed'
import { AppError } from '@/server/errors'
import { getPublicClient } from '@/lib/rpc/client'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { getChain, requireChain, DEFAULT_CHAIN_ID } from '@/lib/chains/registry'
import { listTokens, findTokenDefinition } from '@/lib/tokens/registry'
import {
  readNativeBalance,
  readTokenBalances,
  readTokenMetadata,
  type TokenMetadata,
} from '@/lib/tokens/erc20'
import { normalizeEvmAddress } from '@/lib/wallets/address'
import { NATIVE_ASSET_ADDRESS } from './constants'
import type { WalletSyncResult, WalletView, SyncOutcome } from './types'
import { toWalletView } from './view'

/**
 * Wallet tracking — Phase 2.
 *
 * Everything here is read-only against the chain. A wallet is a public address
 * and nothing else: there is no field to hold key material, and no code path
 * that could sign.
 */


export interface AddWalletInput {
  address: string
  label?: string | null
  chainId?: number
}

export async function addWallet(
  input: AddWalletInput,
  prisma: PrismaClient = getPrisma(),
): Promise<WalletView> {
  const chainId = input.chainId ?? DEFAULT_CHAIN_ID
  const chain = getChain(chainId)
  if (!chain) {
    throw new AppError('UNSUPPORTED_NETWORK', `Chain id ${chainId} is not supported.`, 400)
  }

  // Re-validated server-side: the client check is for fast feedback only.
  const validation = normalizeEvmAddress(input.address)
  if (!validation.ok) {
    throw new AppError('INVALID_ADDRESS', validation.message, 400, { reason: validation.reason })
  }

  await ensureRegistrySeeded(prisma)
  const userId = await getCurrentUserId(prisma)

  const existing = await prisma.wallet.findUnique({
    where: { userId_chainId_address: { userId, chainId, address: validation.address } },
    select: { id: true },
  })
  if (existing) {
    throw new AppError(
      'INVALID_ADDRESS',
      'That address is already being tracked on this network.',
      409,
    )
  }

  const wallet = await prisma.wallet.create({
    data: {
      userId,
      chainId,
      address: validation.address,
      label: input.label?.trim() || null,
    },
  })

  return toWalletView({ ...wallet, balances: [] }, chain.name)
}

export async function listWallets(prisma: PrismaClient = getPrisma()): Promise<WalletView[]> {
  await ensureRegistrySeeded(prisma)
  const userId = await getCurrentUserId(prisma)

  const wallets = await prisma.wallet.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      chain: true,
      balances: {
        include: { token: true },
        orderBy: { observedAt: 'desc' },
      },
    },
  })

  return wallets.map((wallet) => toWalletView(wallet, wallet.chain.name))
}

export async function removeWallet(
  walletId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<void> {
  const userId = await getCurrentUserId(prisma)
  const result = await prisma.wallet.deleteMany({ where: { id: walletId, userId } })
  if (result.count === 0) {
    throw new AppError('UNKNOWN', 'That wallet does not exist.', 404)
  }
}

/**
 * Sync one wallet's balances from chain.
 *
 * Never throws for an RPC failure: it records the failure on the wallet and in
 * a `SyncJob`, then returns it. A sync that fails silently is worse than one
 * that fails loudly, and a thrown 500 would lose the audit row.
 */
export async function syncWalletBalances(
  walletId: string,
  prisma: PrismaClient = getPrisma(),
): Promise<WalletSyncResult> {
  const userId = await getCurrentUserId(prisma)
  const wallet = await prisma.wallet.findFirst({
    where: { id: walletId, userId },
    include: { chain: true },
  })
  if (!wallet) {
    throw new AppError('UNKNOWN', 'That wallet does not exist.', 404)
  }

  const chain = requireChain(wallet.chainId)
  const job = await prisma.syncJob.create({
    data: { userId, kind: 'WALLET_BALANCES', targetId: wallet.id, status: 'RUNNING' },
  })

  const failures: Array<{ tokenAddress: string; message: string }> = []
  let processed = 0

  try {
    const client = getPublicClient(wallet.chainId)

    // Pin every read to one block. Mixing balances from different blocks would
    // produce a portfolio total that never existed at any single moment.
    const blockNumber = await client.getBlockNumber({ cacheTime: 0 })
    const observedAt = new Date()
    const owner = wallet.address as Address

    const candidates = await candidateTokenAddresses(prisma, wallet.chainId)

    const [metadata, balances, native] = await Promise.all([
      readTokenMetadata(client, candidates, { blockNumber }),
      readTokenBalances(client, owner, candidates, { blockNumber }),
      readNativeBalance(client, owner, chain.nativeSymbol, chain.nativeDecimals, { blockNumber }),
    ])

    // --- native asset ------------------------------------------------------
    const nativeToken = await upsertToken(prisma, wallet.chainId, {
      address: NATIVE_ASSET_ADDRESS,
      symbol: chain.nativeSymbol,
      name: chain.nativeSymbol,
      decimals: chain.nativeDecimals,
    })
    await writeBalance(prisma, wallet.id, nativeToken.id, native.rawAmount, blockNumber, observedAt)
    processed += 1

    // --- ERC-20 ------------------------------------------------------------
    for (const address of candidates) {
      const key = address.toLowerCase()
      const meta = metadata.get(key)
      const balance = balances.get(key)

      if (!meta || !meta.ok) {
        failures.push({
          tokenAddress: address,
          message: meta?.ok === false ? meta.message : 'Token metadata unavailable.',
        })
        continue
      }
      if (!balance || !balance.ok) {
        failures.push({
          tokenAddress: address,
          message: balance?.ok === false ? balance.message : 'Balance unavailable.',
        })
        continue
      }

      const token = await upsertToken(prisma, wallet.chainId, meta.metadata)
      await writeBalance(
        prisma,
        wallet.id,
        token.id,
        balance.balance.rawAmount,
        blockNumber,
        observedAt,
      )
      processed += 1
    }

    const status: SyncOutcome = failures.length > 0 ? 'PARTIAL' : 'SUCCEEDED'

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: {
        lastSyncedAt: observedAt,
        lastSyncStatus: status,
        lastSyncError:
          failures.length > 0
            ? `${failures.length} of ${processed + failures.length} assets could not be read and are omitted. The rest are current.`
            : null,
      },
    })

    const finished = await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status,
        finishedAt: new Date(),
        itemsProcessed: processed,
        itemsFailed: failures.length,
        detailsJson: { blockNumber: blockNumber.toString(), failures },
      },
    })

    return {
      walletId: wallet.id,
      syncJobId: job.id,
      status,
      itemsProcessed: processed,
      itemsFailed: failures.length,
      blockNumber: blockNumber.toString(),
      finishedAt: (finished.finishedAt ?? new Date()).toISOString(),
      error: null,
      failures,
    }
  } catch (error) {
    const code = classifyRpcError(error)
    const message = extractMessage(error)

    await prisma.wallet.update({
      where: { id: wallet.id },
      data: { lastSyncStatus: 'FAILED', lastSyncError: `${code}: ${message}` },
    })
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        finishedAt: new Date(),
        itemsProcessed: processed,
        itemsFailed: failures.length,
        error: `${code}: ${message}`,
      },
    })

    return {
      walletId: wallet.id,
      syncJobId: job.id,
      status: 'FAILED',
      itemsProcessed: processed,
      itemsFailed: failures.length,
      blockNumber: null,
      finishedAt: new Date().toISOString(),
      error: { code, message },
      failures,
    }
  }
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

/**
 * Tokens worth reading for a chain: the static registry plus anything already
 * discovered and stored. The union means a token found by position discovery in
 * a later phase keeps being tracked, without hard-coding it here.
 */
async function candidateTokenAddresses(
  prisma: PrismaClient,
  chainId: number,
): Promise<Address[]> {
  const stored = await prisma.token.findMany({
    where: { chainId },
    select: { address: true },
  })

  const seen = new Set<string>([NATIVE_ASSET_ADDRESS.toLowerCase()])
  const out: Address[] = []

  for (const address of [
    ...listTokens(chainId).map((t) => t.address),
    ...stored.map((t) => t.address as Address),
  ]) {
    const key = address.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(address)
  }

  return out
}

async function upsertToken(
  prisma: PrismaClient,
  chainId: number,
  metadata: TokenMetadata,
): Promise<{ id: string }> {
  const hint = findTokenDefinition(chainId, metadata.address)
  const isNative = metadata.address.toLowerCase() === NATIVE_ASSET_ADDRESS.toLowerCase()

  // `verified: true` records that symbol/name/decimals came from the contract in
  // this sync — not from the static registry, which is only a labelling hint.
  const data = {
    symbol: metadata.symbol,
    name: metadata.name,
    decimals: metadata.decimals,
    verified: !isNative,
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

async function writeBalance(
  prisma: PrismaClient,
  walletId: string,
  tokenId: string,
  rawAmount: bigint,
  blockNumber: bigint,
  observedAt: Date,
): Promise<void> {
  // A zero balance is deleted rather than stored: keeping a stale zero row would
  // render as a real "0.00" holding indistinguishable from a token the wallet
  // actually holds none of on purpose.
  if (rawAmount === 0n) {
    await prisma.walletBalance.deleteMany({ where: { walletId, tokenId } })
    return
  }

  const value = { rawAmount: rawAmount.toString(), blockNumber, observedAt }
  await prisma.walletBalance.upsert({
    where: { walletId_tokenId: { walletId, tokenId } },
    update: value,
    create: { walletId, tokenId, ...value },
  })
}
