import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'Simulations' }

export default function SimulationsPage() {
  return (
    <>
      <PageHeader
        title="Simulation Lab"
        description="Scenario modelling for range width and price movement."
        actions={<Badge variant="warning">Estimates — not forecasts</Badge>}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[
              ['Capital', 'Any amount'],
              ['Pair and fee tier', 'From tracked pools'],
              ['Range width', '±2% · ±5% · ±10% · ±15% · ±25% · custom'],
              ['Price scenario', '−20% · −10% · 0% · +10% · +20% · custom'],
              ['Volume assumption', "Defaults to the pool's trailing 30-day average"],
              ['Duration', '30d · 90d · 365d'],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-terminal-border/60 pb-2">
                <span className="text-sm text-terminal-muted">{label}</span>
                <span className="text-[12px] text-terminal-faint">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {[
              'Estimated fees over the period',
              'Ending LP inventory under the scenario',
              'HODL value for the same scenario',
              'LP value and LP vs HODL',
              'Estimated divergence',
              'Time-in-range sensitivity',
            ].map((item) => (
              <div key={item} className="flex gap-2 text-sm text-terminal-muted">
                <span className="mt-[7px] size-1 shrink-0 rounded-full bg-terminal-border-strong" />
                <span>{item}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-5">
          <p className="text-[12px] text-terminal-muted">
            The simulator does not predict volume. Narrowing a range raises your share of in-range
            liquidity but lowers the probability of staying in range — that tension is the entire
            point, so both terms are shown separately rather than collapsed into a single yield
            number that hides the trade-off.
          </p>
        </CardContent>
      </Card>

      <PhasePlaceholder
        phase="Phase 9+"
        title="Scenario engine"
        summary="Uses the same concentrated-liquidity amount maths as live valuation, applied to a hypothetical price rather than the current one."
        delivers={[
          'Fee estimate from assumed volume × fee tier × estimated liquidity share',
          'Terminal inventory from the scenario sqrtPrice, using the production amount maths',
          'The classic x*y=k IL curve retained only as a clearly labelled reference line',
        ]}
      />
    </>
  )
}
