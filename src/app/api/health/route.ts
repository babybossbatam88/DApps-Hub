import { NextResponse } from 'next/server'
import { tryGetServerEnv, appMode } from '@/lib/config/env'
import { checkDatabase } from '@/lib/db/prisma'
import { getPublicClient, getRpcEndpointsForChain } from '@/lib/rpc/client'
import { probeChain } from '@/lib/rpc/health'
import { classifyRpcError, extractMessage } from '@/lib/rpc/errors'
import { DEFAULT_CHAIN_ID } from '@/lib/chains/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type ComponentHealth =
  | { status: 'ok'; detail?: Record<string, unknown> }
  | { status: 'degraded' | 'down'; error: string; detail?: Record<string, unknown> }

/**
 * Deployment health. Each dependency is probed independently so a database
 * outage and an RPC outage are distinguishable — "the app is broken" is not an
 * actionable answer at 3am.
 *
 * Returns 200 when everything is up, 503 when any component is down.
 */
export async function GET() {
  const components: Record<string, ComponentHealth> = {}

  // --- configuration -------------------------------------------------------
  const env = tryGetServerEnv()
  components.configuration = env.ok
    ? { status: 'ok', detail: { mode: appMode } }
    : { status: 'down', error: env.issues.join('; ') }

  // --- database ------------------------------------------------------------
  if (!process.env.DATABASE_URL) {
    components.database = {
      status: 'down',
      error: 'DATABASE_URL is not set.',
    }
  } else {
    const db = await checkDatabase()
    components.database = db.ok
      ? { status: 'ok', detail: { latencyMs: db.latencyMs } }
      : { status: 'down', error: db.message }
  }

  // --- Base RPC ------------------------------------------------------------
  try {
    const client = getPublicClient(DEFAULT_CHAIN_ID)
    const status = await probeChain(
      {
        getBlockNumber: () => client.getBlockNumber({ cacheTime: 0 }),
        getChainId: () => client.getChainId(),
      },
      DEFAULT_CHAIN_ID,
      { timeoutMs: 8_000 },
    )
    const endpoints = getRpcEndpointsForChain(DEFAULT_CHAIN_ID)
    components.baseRpc = status.reachable
      ? {
          status: 'ok',
          detail: {
            blockNumber: status.blockNumber,
            latencyMs: status.latencyMs,
            endpointCount: endpoints.endpointCount,
            usingPublicFallback: endpoints.usedFallback,
          },
        }
      : {
          status: 'down',
          error: `${status.error?.code}: ${status.error?.message}`,
          detail: { endpointCount: endpoints.endpointCount },
        }
  } catch (error) {
    components.baseRpc = {
      status: 'down',
      error: `${classifyRpcError(error)}: ${extractMessage(error)}`,
    }
  }

  const anyDown = Object.values(components).some((c) => c.status === 'down')

  return NextResponse.json(
    {
      status: anyDown ? 'down' : 'ok',
      mode: appMode,
      checkedAt: new Date().toISOString(),
      components,
    },
    { status: anyDown ? 503 : 200, headers: { 'Cache-Control': 'no-store' } },
  )
}
