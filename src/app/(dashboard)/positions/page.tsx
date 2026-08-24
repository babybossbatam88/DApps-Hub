import type { Metadata } from 'next'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { PageHeader } from '@/components/ui/section'
import { EmptyState } from '@/components/data/empty-state'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

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
            Each position card will show
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              'Pair', 'Protocol', 'Version', 'Chain', 'Fee tier', 'Range status',
              'Current price', 'Lower / upper price', 'Distance to lower %',
              'Distance to upper %', 'Position value', 'Token A amount', 'Token B amount',
              'Uncollected fees', 'Collected fees', 'Total fees', 'Fee APR 24h / 7d / 30d',
              'Time in range %', 'LP vs HODL $', 'LP vs HODL %', 'Net P/L', 'Age', 'Last synced',
            ].map((field) => (
              <Badge key={field} variant="outline">
                {field}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <EmptyState
        icon={<Layers className="size-6" />}
        title="No positions discovered"
        description="Position discovery reads the Uniswap V3 NonfungiblePositionManager on Base for each tracked wallet. Add a public address to begin."
        action={
          <Link href="/wallets" className={buttonVariants({ variant: 'primary' })}>
            Go to Wallets
          </Link>
        }
      />
    </>
  )
}
