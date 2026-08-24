import 'server-only'
import { createPublicClient, fallback, http, defineChain, type PublicClient } from 'viem'
import { getServerEnv } from '@/lib/config/env'
import { requireChain, type ChainDefinition } from '@/lib/chains/registry'
import { resolveRpcEndpoints, redactEndpoint } from './endpoints'

/**
 * Server-side viem clients.
 *
 * `server-only` at the top of this file is load-bearing: it makes importing the
 * RPC layer from a client component a build error, so provider URLs (which
 * usually embed an API key) can never reach the browser bundle.
 *
 * Only `createPublicClient` is ever constructed. There is no wallet client, no
 * signer, and no account anywhere in this codebase — the product is read-only
 * by construction, not by convention.
 */

function toViemChain(definition: ChainDefinition, endpoints: string[]) {
  return defineChain({
    id: definition.chainId,
    name: definition.name,
    nativeCurrency: {
      name: definition.nativeSymbol,
      symbol: definition.nativeSymbol,
      decimals: definition.nativeDecimals,
    },
    rpcUrls: { default: { http: endpoints } },
    blockExplorers: {
      default: { name: 'Explorer', url: definition.explorerUrl },
    },
    contracts: {
      multicall3: { address: definition.multicall3Address },
    },
  })
}

const clientCache = new Map<number, PublicClient>()

export interface RpcClientInfo {
  chainId: number
  endpointCount: number
  redactedEndpoints: string[]
  usedFallback: boolean
}

export function getRpcEndpointsForChain(chainId: number): RpcClientInfo {
  const definition = requireChain(chainId)
  const env = getServerEnv()
  const envUrls = definition.chainId === 8453 ? env.BASE_RPC_URLS : []
  const { endpoints, usedFallback } = resolveRpcEndpoints(definition.chainId, envUrls)
  return {
    chainId: definition.chainId,
    endpointCount: endpoints.length,
    redactedEndpoints: endpoints.map(redactEndpoint),
    usedFallback,
  }
}

/**
 * Build (or reuse) the public client for a chain.
 *
 * - `fallback()` moves to the next endpoint on failure and ranks by latency.
 * - `batch.multicall` collapses dozens of position reads into one round trip
 *   through Multicall3, which is what makes wallet discovery affordable.
 */
export function getPublicClient(chainId: number): PublicClient {
  const cached = clientCache.get(chainId)
  if (cached) return cached

  const definition = requireChain(chainId)
  const env = getServerEnv()
  const envUrls = definition.chainId === 8453 ? env.BASE_RPC_URLS : []
  const { endpoints } = resolveRpcEndpoints(definition.chainId, envUrls)

  if (endpoints.length === 0) {
    throw new Error(
      `No RPC endpoints configured for ${definition.name}. Set BASE_RPC_URLS in the environment.`,
    )
  }

  const transports = endpoints.map((url) =>
    http(url, {
      timeout: 10_000,
      retryCount: 2,
      retryDelay: 250,
      batch: { wait: 16 },
    }),
  )

  const client = createPublicClient({
    chain: toViemChain(definition, endpoints),
    transport: fallback(transports, { rank: { interval: 60_000 }, retryCount: 1 }),
    batch: { multicall: { wait: 16 } },
  }) as PublicClient

  clientCache.set(chainId, client)
  return client
}

/** For tests and for hot-reloading a changed endpoint list. */
export function clearRpcClientCache(): void {
  clientCache.clear()
}
