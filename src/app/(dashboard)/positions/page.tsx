import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PositionList } from '@/components/positions/position-list'

export const metadata: Metadata = { title: 'Positions' }

/**
 * Positions list. Cards on every breakpoint — a concentrated-liquidity position
 * has ~18 relevant figures, and a desktop table squeezed onto a phone is
 * unreadable. The desktop layout widens the same card rather than switching
 * component.
 */
export default function PositionsPage() {
  return (
    <>
      <PageHeader
        title="Positions"
        description="Every tracked concentrated-liquidity position with its range state, fees, and performance against HODL."
      />

      <Card className="mb-6">
        <CardContent className="pt-5">
          <p className="text-[11px] font-semibold tracking-[0.12em] text-terminal-faint uppercase">
            Live now
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              'Pair', 'Protocol', 'Chain', 'Fee tier', 'Tick bounds', 'Lower / upper price',
              'Range width', 'Liquidity', 'Entry basis', 'Current price', 'Range state',
              'Token amounts', 'Position value', 'Allocation', 'Block read',
            ].map((field) => (
              <Badge key={field} variant="outline">
                {field}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-[11px] font-semibold tracking-[0.12em] text-terminal-faint uppercase">
            Arrives in later phases
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              'Uncollected fees (5)', 'Fee APR (5)', 'LP vs HODL (6)', 'Divergence (7)',
              'Time in range (8)', 'Rebalance signal (9)',
            ].map((field) => (
              <Badge key={field} variant="outline" className="opacity-60">
                {field}
              </Badge>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-terminal-faint">
            Values are in the pool&rsquo;s quote token, not dollars. The pool prices one token in
            the other and says nothing about what either is worth in USD — a currency arrives with
            the Binance provider in Phase 10.
          </p>
        </CardContent>
      </Card>

      <PositionList />
    </>
  )
}
