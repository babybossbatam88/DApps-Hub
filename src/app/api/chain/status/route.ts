import { NextResponse } from 'next/server'
import { getPublicClient, getRpcEndpointsForChain } from '@/lib/rpc/client'
import { probeChain, type ChainStatus } from '@/lib/rpc/health'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { DEFAULT_CHAIN_ID, getChain } from '@/lib/chains/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Live Base RPC probe.
 *
 * This performs a real `eth_blockNumber` + `eth_chainId` against the configured
 * endpoints. It returns 200 only when the chain is genuinely reachable and
 * reports the expected chain id; anything else is a 503 with a structured
 * `ChainStatus` body so the UI can name the failure instead of showing a
 * plausible-looking stale block number.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const requested = url.searchParams.get('chainId')
  const chainId = requested ? Number(requested) : DEFAULT_CHAIN_ID

  if (!Number.isInteger(chainId) || !getChain(chainId)) {
    const body: ChainStatus = {
      chainId,
      reachable: false,
      blockNumber: null,
      reportedChainId: null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: {
        code: 'UNSUPPORTED_NETWORK',
        message: `Chain id ${requested ?? chainId} is not in the registry.`,
      },
    }
    return NextResponse.json(body, { status: 400 })
  }

  try {
    const client = getPublicClient(chainId)
    const status = await probeChain(
      {
        getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
        getChainId: () => client.getChainId(),
      },
      chainId,
    )
    const endpoints = getRpcEndpointsForChain(chainId)

    return NextResponse.json(
      { ...status, endpoints },
      {
        status: status.reachable ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  } catch (error) {
    // Reaching here means the client could not even be constructed — almost
    // always a configuration problem rather than an outage.
    const body: ChainStatus = {
      chainId,
      reachable: false,
      blockNumber: null,
      reportedChainId: null,
      latencyMs: null,
      checkedAt: new Date().toISOString(),
      error: { code: classifyRpcError(error), message: extractMessage(error) },
    }
    return NextResponse.json(body, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
