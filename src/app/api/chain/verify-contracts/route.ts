import { NextResponse } from 'next/server'
import { getPublicClient } from '@/lib/rpc/client'
import { verifyContracts } from '@/lib/protocols/uniswap-v3/contracts'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { DEFAULT_CHAIN_ID, getChain } from '@/lib/chains/registry'
import { findTokenDefinition } from '@/lib/tokens/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Assert that every registered Uniswap V3 address on the chain is really a
 * deployed contract, and that the factory returns a pool for a known live pair.
 *
 * Run this once after any registry change and before trusting a sync. A wrong
 * address that quietly returns `0x` would otherwise produce plausible but wrong
 * position data — the exact failure mode this product exists to prevent.
 *
 * Read-only, but it is a diagnostic rather than a user-facing screen, so it is
 * gated behind CRON_SECRET whenever that is configured.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (provided !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const url = new URL(request.url)
  const chainId = Number(url.searchParams.get('chainId') ?? DEFAULT_CHAIN_ID)

  if (!Number.isInteger(chainId) || !getChain(chainId)) {
    return NextResponse.json(
      { error: `Chain id ${chainId} is not in the registry.` },
      { status: 400 },
    )
  }

  // cbBTC/USDC — the pair this deployment is built around, and a live 0.30%
  // pool, so a zero address back from the factory is a real signal.
  const cbbtc = findTokenDefinition(chainId, '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf')
  const usdc = findTokenDefinition(chainId, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913')
  const probePair =
    cbbtc && usdc ? { token0: cbbtc.address, token1: usdc.address } : undefined

  try {
    const client = getPublicClient(chainId)
    const { ok, results } = await verifyContracts(client, chainId, probePair)
    return NextResponse.json(
      { chainId, ok, checkedAt: new Date().toISOString(), results },
      { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return NextResponse.json(
      {
        chainId,
        ok: false,
        checkedAt: new Date().toISOString(),
        error: { code: classifyRpcError(error), message: extractMessage(error) },
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
