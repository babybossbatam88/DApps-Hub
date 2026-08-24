'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

export const PERIODS = ['24h', '7d', '30d', '90d', '1y', 'all'] as const
export type Period = (typeof PERIODS)[number]

const LABELS: Record<Period, string> = {
  '24h': '24H',
  '7d': '7D',
  '30d': '30D',
  '90d': '90D',
  '1y': '1Y',
  all: 'ALL',
}

export function PeriodSelector({
  value,
  onChange,
  className,
}: {
  value?: Period
  onChange?: (period: Period) => void
  className?: string
}) {
  const [internal, setInternal] = useState<Period>('30d')
  const active = value ?? internal

  function select(period: Period) {
    setInternal(period)
    onChange?.(period)
  }

  return (
    <div
      role="tablist"
      aria-label="Time period"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-terminal-border bg-terminal-surface p-0.5',
        className,
      )}
    >
      {PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="tab"
          aria-selected={active === period}
          onClick={() => select(period)}
          className={cn(
            'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
            active === period
              ? 'bg-terminal-raised text-terminal-fg'
              : 'text-terminal-faint hover:text-terminal-muted',
          )}
        >
          {LABELS[period]}
        </button>
      ))}
    </div>
  )
}
