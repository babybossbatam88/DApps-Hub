import { Badge } from '@/components/ui/badge'
import { appMode } from '@/lib/config/env'

/**
 * Demo vs live mode, stated plainly and never hidden.
 *
 * Demo mode may render development fixtures; live mode may not render a single
 * fabricated figure. Because the difference is invisible in a screenshot, the
 * indicator is permanent chrome rather than a dismissible toast.
 */
export function ModeIndicator({ compact = false }: { compact?: boolean }) {
  if (appMode === 'live') {
    return (
      <Badge variant="positive" title="Live mode — every figure comes from a real source.">
        <span className="size-1.5 rounded-full bg-signal-positive animate-pulse-dot" />
        LIVE
      </Badge>
    )
  }
  return (
    <Badge
      variant="warning"
      title="Demo mode — development fixtures may be shown and are labelled as such."
    >
      <span className="size-1.5 rounded-full bg-signal-warning" />
      {compact ? 'DEMO' : 'DEMO MODE'}
    </Badge>
  )
}

/** Full-width banner for demo mode, shown above the content area. */
export function DemoModeBanner() {
  if (appMode !== 'demo') return null
  return (
    <div className="border-b border-signal-warning/20 bg-signal-warning/[0.07] px-4 py-2 text-center text-[12px] text-signal-warning sm:px-6">
      <strong className="font-semibold">Demo mode.</strong> Figures shown here may be development
      fixtures. Set <code className="font-mono">NEXT_PUBLIC_APP_MODE=live</code> to require real
      data sources for every value.
    </div>
  )
}
