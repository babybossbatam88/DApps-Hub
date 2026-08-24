import type { Metadata } from 'next'
import { Bell } from 'lucide-react'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'Alerts' }

const ALERT_TYPES = [
  ['Position near lower bound', 'Price approaching the bottom of the range'],
  ['Position near upper bound', 'Price approaching the top of the range'],
  ['Out of range', 'No longer earning fees'],
  ['Fees reach threshold', 'Uncollected fees worth collecting'],
  ['Fee APR below threshold', 'Yield has decayed'],
  ['LP vs HODL below threshold', 'The position is losing to simply holding'],
  ['Price movement threshold', 'Large move in either direction'],
  ['Sync failure', 'Data has stopped updating — the most important alert of all'],
]

export default function AlertsPage() {
  return (
    <>
      <PageHeader
        title="Alerts"
        description="In-app first, with the channel layer built so email, Telegram, and WhatsApp are additions rather than rewrites."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Available alert types</CardTitle>
          <Badge variant="outline">In-app in V1</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-terminal-border">
            {ALERT_TYPES.map(([name, description]) => (
              <li key={name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
                <span className="text-sm text-terminal-fg">{name}</span>
                <span className="text-[12px] text-terminal-muted">{description}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <EmptyState
        className="mb-6"
        icon={<Bell className="size-6" />}
        title="No alerts configured"
        description="Alert rules are evaluated inside the snapshot worker, so an alert can only fire once position snapshots exist."
      />

      <PhasePlaceholder
        phase="Phase 12"
        title="Alert engine"
        summary="Rules evaluated on every snapshot, with cooldowns so a price oscillating around a boundary does not produce a hundred notifications."
        delivers={[
          'Threshold rules per position or across the portfolio',
          'Per-rule cooldown and a delivery history that records what was sent and when',
          'A channel abstraction that emits channel-agnostic events',
        ]}
      />
    </>
  )
}
