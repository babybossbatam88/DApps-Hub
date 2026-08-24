import * as React from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Rendered when there is genuinely nothing to show. Distinct from a skeleton
 * (still loading) and from an error (a read failed) — conflating the three is
 * how a dashboard ends up implying a portfolio is worth zero.
 */
export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-terminal-border px-6 py-12 text-center',
        className,
      )}
    >
      {icon ? <div className="mb-3 text-terminal-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-terminal-fg">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-md text-sm text-terminal-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

/**
 * Placeholder for a page whose engine lands in a later phase. It states the
 * phase explicitly rather than showing a convincing-looking mock, because a
 * mock that looks real is indistinguishable from a bug.
 */
export function PhasePlaceholder({
  phase,
  title,
  summary,
  delivers,
}: {
  phase: string
  title: string
  summary: string
  delivers: string[]
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-terminal-border bg-terminal-surface/40 p-6">
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-signal-neutral/30 bg-signal-neutral/10 px-2.5 py-0.5 text-[11px] font-medium text-signal-neutral">
          {phase}
        </span>
        <span className="text-[11px] text-terminal-faint">not yet implemented</span>
      </div>
      <h3 className="mt-3 text-base font-medium text-terminal-fg">{title}</h3>
      <p className="mt-1.5 max-w-2xl text-sm text-terminal-muted">{summary}</p>
      <ul className="mt-4 space-y-1.5">
        {delivers.map((item) => (
          <li key={item} className="flex gap-2 text-sm text-terminal-muted">
            <span className="mt-[7px] size-1 shrink-0 rounded-full bg-terminal-border-strong" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[11px] text-terminal-faint">
        This screen shows no figures until the engine behind it is built. Placeholder numbers are
        not used anywhere in this product.
      </p>
    </div>
  )
}
