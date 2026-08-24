import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Metric } from '@/components/data/metric'
import { PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'Fees' }

const CONFIDENCE = [
  { window: 'Under 24 hours', label: 'VERY LOW', variant: 'negative' as const },
  { window: '1–7 days', label: 'LOW', variant: 'warning' as const },
  { window: '7–30 days', label: 'MEDIUM', variant: 'info' as const },
  { window: '30 days or more', label: 'HIGHER', variant: 'positive' as const },
]

export default function FeesPage() {
  return (
    <>
      <PageHeader
        title="Fees"
        description="Uncollected, collected, and lifetime fees, with an annualised rate that states how much to trust it."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {['Uncollected fees', 'Collected fees', 'Lifetime fees', 'Weighted fee APR'].map((label) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <Metric label={label} value={null} unavailableReason="Awaiting position data" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Fee APR and its confidence</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="overflow-x-auto rounded-lg border border-terminal-border bg-terminal-void px-4 py-3 font-mono text-[12px] leading-relaxed text-terminal-muted">
{`fee_apr = fees_earned_over_period
        / average_capital_over_period
        × 365 / period_days
        × 100`}
          </pre>
          <p className="mt-3 text-[12px] text-terminal-muted">
            <span className="text-terminal-fg">Average capital</span> is the time-weighted mean of
            position value across the window — not the current value and not the entry value. A
            position that halved mid-window would otherwise report a nonsense rate.
          </p>
          <p className="mt-2 text-[12px] text-terminal-muted">
            Annualising a short observation is close to meaningless, so every rate carries a
            confidence label. Below 24 hours the raw fee amount is shown prominently and the
            annualised figure is de-emphasised. It is never displayed bare.
          </p>
          <ul className="mt-4 divide-y divide-terminal-border">
            {CONFIDENCE.map((row) => (
              <li key={row.label} className="flex items-center justify-between py-2">
                <span className="text-sm text-terminal-muted">{row.window}</span>
                <Badge variant={row.variant}>{row.label}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <PhasePlaceholder
        phase="Phase 5"
        title="Fee engine"
        summary="Uncollected fees computed from feeGrowthInside, collected fees reconstructed from Collect events, and growth broken down by window."
        delivers={[
          'feeGrowthInside computed with uint256 wrap-around masking — the arithmetic that most third-party trackers get wrong',
          'Fee growth over 24h, 7d, 30d, and 90d from stored snapshots',
          'Fee APR per window with the confidence label attached to the value, not the footnote',
        ]}
      />
    </>
  )
}
