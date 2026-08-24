import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/section'
import { Metric } from '@/components/data/metric'
import { PhasePlaceholder } from '@/components/data/empty-state'
import { truncateHex } from '@/lib/utils/format'

export const metadata: Metadata = { title: 'Position detail' }

/**
 * Position detail. The section order is fixed and deliberate: summary, then the
 * range visualisation (the single most decision-relevant view), then inventory,
 * fees, the HODL benchmark, divergence, and finally the recommendation — which
 * is presented last because it is a conclusion drawn from everything above it.
 */
export default async function PositionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <>
      <PageHeader
        title="Position detail"
        description={`Position reference ${truncateHex(id, 10, 6)} — not yet resolvable until position discovery lands.`}
        actions={
          <Link
            href="/positions"
            className="text-[12px] text-terminal-muted hover:text-terminal-fg"
          >
            ← All positions
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {['Position value', 'Total fees', 'LP vs HODL', 'Divergence ex-fees'].map((label) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <Metric label={label} value={null} unavailableReason="Position not loaded" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-6">
        <Card>
          <CardHeader>
            <CardTitle>B · Price range</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <RangeVisualisationSkeleton />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>C · Inventory</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-terminal-muted">
            Token A and token B units, their USD value, and the current allocation split.
            Populated in Phase 4.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>D · Fees</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-terminal-muted">
            Uncollected fees per token, collected total, lifetime total, and fee APR with its
            confidence label. Populated in Phase 5.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>E · HODL benchmark</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-terminal-muted">
            Original token quantities, their value today, LP value excluding fees, LP value
            including fees, and the difference. Populated in Phase 6.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>F · Divergence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-terminal-muted">
              Shown as a decomposition rather than a single &ldquo;IL&rdquo; percentage, because
              the sum is what matters:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-lg border border-terminal-border bg-terminal-void px-4 py-3 font-mono text-[12px] leading-relaxed text-terminal-muted">
{`Divergence before fees    -$4.30
Fees earned               +$6.80
────────────────────────────────
LP vs HODL                +$2.50`}
            </pre>
            <p className="mt-2 text-[11px] text-terminal-faint">
              Illustrative layout only — these are not figures from any position.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <PhasePlaceholder
          phase="Phase 9"
          title="G · Rebalance analysis"
          summary="A recommendation — HOLD, WATCH, REBALANCE, OUT OF RANGE, or EXIT REVIEW — with the metrics behind it and an estimated cost. Never executed automatically."
          delivers={[
            'Edge distance combined with fee income, fee APR, and time in range',
            'Estimated gas plus slippage cost, and the breakeven period at current fee rates',
            'An explicit downgrade when the rebalance would cost more than it earns',
          ]}
        />
      </div>
    </>
  )
}

/**
 * The range bar, rendered structurally with no data. Once a position loads, the
 * marker moves to `position_progress_percent` and the bar colours by range state.
 */
function RangeVisualisationSkeleton() {
  return (
    <div>
      <div className="relative h-12">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-terminal-raised" />
        <div className="absolute top-1/2 left-1/2 h-8 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-terminal-border-strong" />
        <div className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
        <div className="absolute top-1/2 right-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
      </div>
      <div className="flex items-start justify-between font-mono text-[11px]">
        <div>
          <div className="text-terminal-faint">N/A</div>
          <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
            Lower
          </div>
        </div>
        <div className="text-center">
          <div className="text-terminal-faint">N/A</div>
          <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
            Current
          </div>
        </div>
        <div className="text-right">
          <div className="text-terminal-faint">N/A</div>
          <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
            Upper
          </div>
        </div>
      </div>
    </div>
  )
}
