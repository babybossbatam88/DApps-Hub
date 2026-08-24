'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataFreshness } from '@/components/data/data-freshness'
import { Skeleton } from '@/components/ui/skeleton'
import type { ChainStatus } from '@/lib/rpc/health'

interface ChainStatusResponse extends ChainStatus {
  endpoints?: { endpointCount: number; redactedEndpoints: string[]; usedFallback: boolean }
}

async function fetchStatus(): Promise<ChainStatusResponse> {
  const response = await fetch('/api/chain/status', { cache: 'no-store' })
  return (await response.json()) as ChainStatusResponse
}

/**
 * The live RPC probe, rendered honestly.
 *
 * When the probe fails this shows the error code and message rather than an
 * empty card. "We could not reach Base" is actionable; a blank panel is not.
 */
export function LiveChainPanel() {
  const { data, isPending, isError, error, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['chain-status-panel', 8453],
    queryFn: fetchStatus,
    refetchInterval: 30_000,
  })

  const reachable = data?.reachable === true

  return (
    <Card>
      <CardHeader>
        <CardTitle>Base Mainnet RPC</CardTitle>
        <div className="flex items-center gap-2">
          {isPending ? (
            <Badge variant="outline">probing…</Badge>
          ) : reachable ? (
            <Badge variant="positive">Reachable</Badge>
          ) : (
            <Badge variant="negative">Unreachable</Badge>
          )}
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="text-[11px] text-terminal-faint hover:text-terminal-muted disabled:opacity-50"
          >
            {isFetching ? 'checking…' : 'recheck'}
          </button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : (
          <dl className="divide-y divide-terminal-border/60">
            <Row label="Chain id" value={String(data?.chainId ?? 8453)} />
            <Row label="Latest block" value={data?.blockNumber ?? null} />
            <Row
              label="Latency"
              value={data?.latencyMs !== null && data?.latencyMs !== undefined ? `${data.latencyMs} ms` : null}
            />
            <Row
              label="Endpoints configured"
              value={data?.endpoints ? String(data.endpoints.endpointCount) : null}
            />
            {data?.endpoints?.redactedEndpoints.length ? (
              <div className="py-2">
                <dt className="text-[13px] text-terminal-muted">Endpoints</dt>
                <dd className="mt-1 space-y-0.5">
                  {data.endpoints.redactedEndpoints.map((endpoint) => (
                    <div key={endpoint} className="font-mono text-[11px] text-terminal-faint">
                      {endpoint}
                    </div>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        )}

        {!isPending && !reachable ? (
          <div className="mt-3 rounded-lg border border-signal-negative/25 bg-signal-negative/[0.06] px-3 py-2.5">
            <p className="font-mono text-[11px] text-signal-negative">
              {data?.error?.code ?? (isError ? 'REQUEST_FAILED' : 'UNKNOWN')}
            </p>
            <p className="mt-1 text-[12px] text-terminal-muted">
              {data?.error?.message ?? (error instanceof Error ? error.message : 'The probe failed.')}
            </p>
          </div>
        ) : null}

        {data?.endpoints?.usedFallback ? (
          <p className="mt-3 text-[11px] text-signal-warning">
            Using the public fallback endpoint. Position discovery will rate-limit under load — set
            BASE_RPC_URLS to a dedicated provider.
          </p>
        ) : null}

        <DataFreshness
          className="mt-3"
          observedAt={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
          source="onchain"
          hasError={!reachable && !isPending}
        />
      </CardContent>
    </Card>
  )
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[13px] text-terminal-muted">{label}</dt>
      <dd className="font-mono text-[13px] text-terminal-fg">{value ?? 'N/A'}</dd>
    </div>
  )
}
