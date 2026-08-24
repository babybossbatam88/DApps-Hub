import { getChain } from '@/lib/chains/registry'

/**
 * Resolve the ordered RPC endpoint list for a chain.
 *
 * Order matters: the transport fails over left-to-right. Environment-supplied
 * endpoints (usually a paid provider with a key) always precede the public
 * fallbacks, which rate-limit aggressively under position discovery load.
 *
 * Pure and side-effect free so it can be unit tested without a network.
 */
export function resolveRpcEndpoints(
  chainId: number,
  envUrls: string[] = [],
): { endpoints: string[]; usedFallback: boolean } {
  const chain = getChain(chainId)
  if (!chain) return { endpoints: [], usedFallback: false }

  const seen = new Set<string>()
  const endpoints: string[] = []

  for (const url of [...envUrls, ...chain.defaultRpcUrls]) {
    const trimmed = url.trim()
    if (!trimmed) continue
    // De-duplicate while preserving priority order.
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    endpoints.push(trimmed)
  }

  return { endpoints, usedFallback: envUrls.length === 0 && endpoints.length > 0 }
}

/**
 * Endpoint URLs frequently embed an API key in the path. This is what gets
 * logged and what the Data Sources page renders — never the raw URL.
 */
export function redactEndpoint(url: string): string {
  try {
    const parsed = new URL(url)
    const segments = parsed.pathname.split('/').filter(Boolean)
    // Anything longer than 16 chars in the path is assumed to be a key.
    const redacted = segments.map((s) => (s.length > 16 ? `${s.slice(0, 4)}…` : s))
    const path = redacted.length ? `/${redacted.join('/')}` : ''
    return `${parsed.protocol}//${parsed.host}${path}`
  } catch {
    return 'invalid-url'
  }
}
