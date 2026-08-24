import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Metric } from '@/components/data/metric'
import { PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'HODL Benchmark' }

export default function HodlPage() {
  return (
    <>
      <PageHeader
        title="HODL Benchmark"
        description="The counterfactual: what the deposited tokens would be worth today if they had simply been held."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          'HODL value now',
          'LP value ex-fees',
          'LP value with fees',
          'LP vs HODL',
        ].map((label) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <Metric label={label} value={null} unavailableReason="Awaiting position data" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>How it is computed</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <pre className="overflow-x-auto rounded-lg border border-terminal-border bg-terminal-void px-4 py-3 font-mono text-[12px] leading-relaxed text-terminal-muted">
{`HODL_VALUE_NOW     = entry_token0_qty × current_token0_price
                   + entry_token1_qty × current_token1_price

LP_VALUE_EX_FEES   = current inventory valued at current prices

LP_VALUE_WITH_FEES = LP_VALUE_EX_FEES
                   + uncollected fees
                   + collected fees attributable to the position

LP_VS_HODL         = LP_VALUE_WITH_FEES − HODL_VALUE_NOW
LP_VS_HODL_PERCENT = LP_VS_HODL / HODL_VALUE_NOW × 100`}
          </pre>
          <div className="mt-4 space-y-2 text-[12px] text-terminal-muted">
            <p>
              <span className="text-terminal-fg">The entry basis is immutable.</span> Entry
              quantities and prices are captured once, when a position is first discovered, and are
              never recalculated. A mutable basis would silently rewrite history and make every
              comparison meaningless.
            </p>
            <p>
              <span className="text-terminal-fg">Stablecoins are priced, not assumed.</span> USDC is
              marked at its actual price rather than pinned to $1.00 — pinning it would fabricate
              value during a depeg, which is exactly when the number matters most.
            </p>
          </div>
        </CardContent>
      </Card>

      <PhasePlaceholder
        phase="Phase 6"
        title="Benchmark engine"
        summary="Per-position and portfolio-wide HODL comparison, plus the historical benchmark curve."
        delivers={[
          'Original token quantities alongside their value today',
          'LP value with and without fees, so the fee contribution is visible rather than buried',
          'The benchmark line for the Overview chart, reconstructed from stored price snapshots',
        ]}
      />
    </>
  )
}
