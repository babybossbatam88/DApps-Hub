'use client'

import { cn } from '@/lib/utils/cn'
import { useNow } from '@/lib/utils/use-now'
import { classifyFreshness, formatAge, type FreshnessLevel } from '@/lib/utils/time'
import type { DataSource } from '@/types/sourced'

/**
 * Every number in this product is required to say where it came from and how
 * old it is. This component is that contract, made visible.
 *
 * States: Live · Delayed · Stale · Sync error · Unknown. The age ticks without
 * re-fetching, so a screen left open visibly goes stale rather than quietly
 * lying about being current.
 */

const LEVEL_STYLES: Record<FreshnessLevel, { dot: string; text: string; label: string }> = {
  live: { dot: 'bg-signal-positive', text: 'text-signal-positive', label: 'Live' },
  delayed: { dot: 'bg-signal-warning', text: 'text-signal-warning', label: 'Delayed' },
  stale: { dot: 'bg-signal-negative', text: 'text-signal-negative', label: 'Stale' },
  error: { dot: 'bg-signal-negative', text: 'text-signal-negative', label: 'Sync error' },
  unknown: { dot: 'bg-terminal-faint', text: 'text-terminal-faint', label: 'No data' },
}

const SOURCE_LABEL: Record<DataSource, string> = {
  onchain: 'on-chain',
  binance: 'Binance',
  derived: 'derived',
  database: 'cached',
  fixture: 'fixture',
}

export interface DataFreshnessProps {
  observedAt?: string | Date | null
  source?: DataSource
  hasError?: boolean
  errorMessage?: string
  className?: string
  showSource?: boolean
}

export function DataFreshness({
  observedAt,
  source,
  hasError = false,
  errorMessage,
  className,
  showSource = true,
}: DataFreshnessProps) {
  // Null during SSR and hydration: an age is only meaningful against the
  // viewer's clock, and rendering the server's would mismatch on hydration.
  const now = useNow()

  const level: FreshnessLevel =
    now === null ? 'unknown' : classifyFreshness(observedAt, now, undefined, hasError)
  const styles = LEVEL_STYLES[level]
  const age = now === null ? '—' : formatAge(observedAt, now)

  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-[11px]', styles.text, className)}
      title={errorMessage ?? (observedAt ? new Date(observedAt).toISOString() : undefined)}
    >
      <span
        className={cn('size-1.5 rounded-full', styles.dot, level === 'live' && 'animate-pulse-dot')}
        aria-hidden
      />
      <span className="font-medium">{styles.label}</span>
      {level !== 'error' && level !== 'unknown' ? (
        <>
          <span className="text-terminal-faint">·</span>
          <span className="text-terminal-faint tabular">{age}</span>
        </>
      ) : null}
      {showSource && source ? (
        <>
          <span className="text-terminal-faint">·</span>
          <span className="text-terminal-faint">{SOURCE_LABEL[source]}</span>
        </>
      ) : null}
    </span>
  )
}
