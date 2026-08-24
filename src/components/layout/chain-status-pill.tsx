'use client'

import { useQuery } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { DataFreshness } from '@/components/data/data-freshness'
import type { ChainStatus } from '@/lib/rpc/health'

async function fetchChainStatus(): Promise<ChainStatus> {
  const response = await fetch('/api/chain/status', { cache: 'no-store' })
  // A non-2xx here still carries a structured ChainStatus body describing the
  // failure, which is more useful to the user than a thrown network error.
  const body: unknown = await response.json()
  return body as ChainStatus
}

export function ChainStatusPill({
  className,
  compact = false,
}: {
  className?: string
  /** Dot + chain name only. Used in the mobile top bar, where space is tight. */
  compact?: boolean
}) {
  const { data, isPending, isError, dataUpdatedAt } = useQuery({
    queryKey: ['chain-status', 8453],
    queryFn: fetchChainStatus,
    refetchInterval: 30_000,
  })

  const reachable = data?.reachable === true
  const failed = isError || (data !== undefined && !data.reachable)

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-full border border-terminal-border bg-terminal-surface px-3 py-1',
        className,
      )}
    >
      <Radio
        className={cn(
          'size-3.5',
          isPending
            ? 'text-terminal-faint'
            : reachable
              ? 'text-signal-positive'
              : 'text-signal-negative',
        )}
      />
      <span className="text-[11px] font-medium text-terminal-fg">Base</span>
      {compact ? null : <span className="text-[11px] text-terminal-faint">·</span>}
      {compact ? null : isPending ? (
        <span className="text-[11px] text-terminal-faint">checking…</span>
      ) : reachable && data?.blockNumber ? (
        <span className="font-mono text-[11px] text-terminal-muted" title="Latest block">
          #{data.blockNumber}
        </span>
      ) : (
        <span
          className="text-[11px] text-signal-negative"
          title={data?.error?.message ?? 'The RPC probe failed.'}
        >
          {data?.error?.code ?? 'RPC unavailable'}
        </span>
      )}
      {compact ? (
        failed ? (
          <span className="text-[11px] font-medium text-signal-negative">offline</span>
        ) : null
      ) : (
        <DataFreshness
          observedAt={dataUpdatedAt ? new Date(dataUpdatedAt) : null}
          source="onchain"
          hasError={failed}
          errorMessage={data?.error?.message}
          showSource={false}
        />
      )}
    </div>
  )
}
