import * as React from 'react'
import { cn } from '@/lib/utils/cn'
import { NA } from '@/lib/utils/format'
import { DataFreshness } from './data-freshness'
import type { DataSource } from '@/types/sourced'

/**
 * The only sanctioned way to render a figure.
 *
 * `value === null` renders the placeholder — never `0`, never `—$0.00`. A read
 * that failed and a value that is genuinely zero are different facts and this
 * component refuses to conflate them.
 */
export interface MetricProps {
  label: string
  value: string | null
  /** Sub-line, e.g. the same figure in percent. */
  secondary?: string | null
  /** Colour the value by sign. Pass null for neutral figures. */
  tone?: 'positive' | 'negative' | 'neutral' | null
  observedAt?: string | Date | null
  source?: DataSource
  hasError?: boolean
  errorMessage?: string
  /** Rendered when `value` is null, explaining why. */
  unavailableReason?: string
  mono?: boolean
  className?: string
  hint?: string
}

const TONE_CLASS = {
  positive: 'text-signal-positive',
  negative: 'text-signal-negative',
  neutral: 'text-terminal-fg',
} as const

export function Metric({
  label,
  value,
  secondary,
  tone = 'neutral',
  observedAt,
  source,
  hasError,
  errorMessage,
  unavailableReason,
  mono = true,
  className,
  hint,
}: MetricProps) {
  const unavailable = value === null

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium tracking-wide text-terminal-muted uppercase">
          {label}
        </span>
        {hint ? (
          <span
            className="cursor-help text-[11px] text-terminal-faint"
            title={hint}
            aria-label={hint}
          >
            ⓘ
          </span>
        ) : null}
      </div>

      <div
        className={cn(
          'mt-1 truncate text-2xl leading-tight font-semibold',
          mono && 'font-mono',
          unavailable ? 'text-terminal-faint' : TONE_CLASS[tone ?? 'neutral'],
        )}
        title={value ?? unavailableReason ?? NA}
      >
        {value ?? NA}
      </div>

      {unavailable && unavailableReason ? (
        <div className="mt-1 text-[11px] text-terminal-faint">{unavailableReason}</div>
      ) : null}

      {!unavailable && secondary ? (
        <div
          className={cn(
            'mt-0.5 text-sm',
            mono && 'font-mono',
            tone === 'positive'
              ? 'text-signal-positive/80'
              : tone === 'negative'
                ? 'text-signal-negative/80'
                : 'text-terminal-muted',
          )}
        >
          {secondary}
        </div>
      ) : null}

      {observedAt !== undefined || hasError ? (
        <DataFreshness
          className="mt-2"
          observedAt={observedAt}
          source={source}
          hasError={hasError}
          errorMessage={errorMessage}
        />
      ) : null}
    </div>
  )
}
