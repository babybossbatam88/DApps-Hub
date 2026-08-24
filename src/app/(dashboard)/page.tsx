import type { Metadata } from 'next'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { buttonVariants } from '@/components/ui/button'
import { PageHeader, SectionTitle } from '@/components/ui/section'
import { Metric } from '@/components/data/metric'
import { EmptyState } from '@/components/data/empty-state'
import { PeriodSelector } from '@/components/data/period-selector'

export const metadata: Metadata = { title: 'Overview' }

/**
 * Overview.
 *
 * The eight KPI cards are laid out in the order the product's five questions
 * are asked: what is it worth, what have I earned, versus HODL, how much
 * divergence, do I need to rebalance.
 *
 * Every figure reads `N/A` with a reason until Phases 2–7 land. That is
 * deliberate: a dashboard that shows a plausible $0.00 is indistinguishable
 * from one whose sync is broken.
 */
export default function OverviewPage() {
  const awaiting = 'Awaiting position data'

  const kpis = [
    { label: 'Total LP Value', hint: 'Current inventory value of every tracked position, excluding uncollected fees.' },
    { label: 'Net P/L', hint: 'LP value including all fees, minus initial capital and gas costs.' },
    { label: 'LP vs HODL', hint: 'LP value with fees minus what the deposited tokens would be worth today.' },
    { label: 'Total Fees Earned', hint: 'Collected fees plus currently uncollected fees.' },
    { label: 'Divergence / IL', hint: 'LP inventory value minus HODL value, before fees. Concentrated-liquidity divergence, not the x*y=k approximation.' },
    { label: 'Weighted Fee APR', hint: 'Fee APR weighted by position capital. Carries a confidence label based on observation window.' },
    { label: 'Capital In Range', hint: 'Share of tracked capital currently inside its price range and earning fees.' },
    { label: 'Positions Out of Range', hint: 'Count of positions whose current tick sits outside their bounds.' },
  ]

  return (
    <>
      <PageHeader
        title="Overview"
        description="How much is the LP worth, what has it earned, and would holding the tokens have been better."
        actions={<PeriodSelector />}
      />

      <section aria-label="Key performance indicators" className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label}>
              <CardContent className="pt-4">
                <Metric
                  label={kpi.label}
                  value={null}
                  hint={kpi.hint}
                  unavailableReason={awaiting}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section aria-label="Portfolio value against benchmark" className="mb-8">
        <SectionTitle>Portfolio value vs HODL benchmark vs initial capital</SectionTitle>
        <Card>
          <CardContent className="pt-5">
            <EmptyState
              className="border-0 py-10"
              icon={<Wallet className="size-6" />}
              title="No positions are being tracked yet"
              description="Add a public EVM address to discover its Uniswap V3 positions on Base. Nothing is signed and no key is ever requested — tracking is read-only."
              action={
                <Link href="/wallets" className={buttonVariants({ variant: 'primary', size: 'md' })}>
                  Add a wallet address
                </Link>
              }
            />
          </CardContent>
        </Card>
      </section>

      <section aria-label="Range risk">
        <SectionTitle>Range risk</SectionTitle>
        <div className="grid gap-3 sm:gap-4 md:grid-cols-3">
          {[
            { title: 'In range', body: 'Positions earning fees, with room to the nearest edge.' },
            { title: 'Near an edge', body: 'Within the configured warning band. Watch, do not act yet.' },
            { title: 'Out of range', body: 'Earning nothing. Fully converted into one side of the pair.' },
          ].map((item) => (
            <Card key={item.title}>
              <CardHeader>
                <CardTitle>{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="font-mono text-2xl font-semibold text-terminal-faint">N/A</div>
                <p className="mt-1.5 text-[12px] text-terminal-muted">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </>
  )
}
