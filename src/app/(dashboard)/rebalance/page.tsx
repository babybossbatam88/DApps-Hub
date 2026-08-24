import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhasePlaceholder } from '@/components/data/empty-state'
import { DEFAULT_THRESHOLDS } from '@/lib/config/thresholds'

export const metadata: Metadata = { title: 'Rebalance Center' }

const RULES = [
  { when: 'In range, more than 20% from the nearest edge', signal: 'HOLD', variant: 'positive' as const },
  { when: 'Within 15% of an edge', signal: 'WATCH', variant: 'warning' as const },
  { when: 'Within 5% of an edge', signal: 'REBALANCE SOON', variant: 'warning' as const },
  { when: 'Outside the range', signal: 'REBALANCE REVIEW', variant: 'negative' as const },
  { when: 'Small position, or deeply negative versus HODL', signal: 'EXIT REVIEW', variant: 'negative' as const },
]

export default function RebalancePage() {
  const { range, rebalance } = DEFAULT_THRESHOLDS

  return (
    <>
      <PageHeader
        title="Rebalance Center"
        description="Recommendations only. Nothing is executed automatically, and no transaction is ever constructed."
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Signal rules</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-terminal-border">
            {RULES.map((rule) => (
              <li key={rule.signal} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span className="text-sm text-terminal-muted">{rule.when}</span>
                <Badge variant={rule.variant}>{rule.signal}</Badge>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12px] text-terminal-muted">
            The edge signal is only the starting point. It is then weighed against fees earned, fee
            APR, estimated gas and slippage, position size, time in range, and performance versus
            HODL. A rebalance that costs more than it is expected to earn is downgraded, and the
            reasoning says so — chasing yield on a small position is usually value-destroying.
          </p>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Active thresholds</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <dl className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {[
              ['Safe distance from edge', `${range.safeEdgePercent}%`],
              ['Near-edge warning band', `${range.nearEdgePercent}%`],
              ['Critical edge band', `${range.criticalEdgePercent}%`],
              ['Minimum position size', `$${rebalance.minPositionSizeUsd}`],
              ['Max cost / 30d fees ratio', `${rebalance.maxCostToFeeRatio}×`],
              ['Out-of-range grace period', `${rebalance.outOfRangeGraceHours} h`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-terminal-border/60 pb-2">
                <dt className="text-sm text-terminal-muted">{label}</dt>
                <dd className="font-mono text-sm text-terminal-fg">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] text-terminal-faint">
            Distances are measured in tick space as a share of the remaining range, not as a share
            of the price — ticks are linear in log-price, so this behaves correctly at both edges.
          </p>
        </CardContent>
      </Card>

      <PhasePlaceholder
        phase="Phase 9"
        title="Recommendation queue"
        summary="Every position ranked by urgency, each with its reasoning metrics and an estimated cost to act."
        delivers={[
          'Recommendation, confidence, and the metrics that support or oppose it',
          'Estimated rebalance cost from QuoterV2 plus current gas, and breakeven days',
          'Manual lifecycle logging so a rebalance you perform yourself is recorded',
        ]}
      />
    </>
  )
}
