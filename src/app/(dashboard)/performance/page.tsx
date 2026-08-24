import type { Metadata } from 'next'
import { PageHeader, SectionTitle } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PhasePlaceholder } from '@/components/data/empty-state'
import { NA } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Performance' }

const ROWS = [
  'LP return',
  'HODL return',
  'LP vs HODL',
  'Fees earned',
  'Fee APR',
  'Time in range',
  'Rebalances',
  'Gas cost',
  'Net result',
]

export default function PerformancePage() {
  return (
    <>
      <PageHeader
        title="Performance"
        description="Rolling 30, 90, and 365 day returns measured against the HODL benchmark, net of fees and gas."
      />

      <SectionTitle>Period cards</SectionTitle>
      <div className="mb-6 grid gap-3 sm:gap-4 lg:grid-cols-3">
        {['30 days', '90 days', '365 days'].map((period) => (
          <Card key={period}>
            <CardHeader>
              <CardTitle>{period}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <dl className="divide-y divide-terminal-border/60">
                {ROWS.map((row) => (
                  <div key={row} className="flex items-baseline justify-between gap-4 py-2">
                    <dt className="text-[13px] text-terminal-muted">{row}</dt>
                    <dd className="font-mono text-[13px] text-terminal-faint">{NA}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mb-6">
        <CardContent className="pt-5 text-[12px] text-terminal-muted">
          <p>
            <span className="text-terminal-fg">Positions younger than the window</span> are labelled
            &ldquo;partial period&rdquo; with their actual age, rather than having a stub return
            annualised into something that looks authoritative.
          </p>
        </CardContent>
      </Card>

      <PhasePlaceholder
        phase="Phase 8"
        title="Historical performance"
        summary="Period returns computed from the 15-minute snapshot series, with gas costs netted out."
        delivers={[
          'LP and HODL returns from the first and last snapshot inside each window',
          'Fees, rebalance count, and gas cost aggregated per period',
          'Net result: fees earned minus divergence minus gas',
        ]}
      />
    </>
  )
}
