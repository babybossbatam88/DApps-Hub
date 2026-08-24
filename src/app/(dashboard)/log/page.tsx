import type { Metadata } from 'next'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'Transaction Log' }

const EVENTS = [
  'CREATE_POSITION',
  'ADD_LIQUIDITY',
  'REMOVE_LIQUIDITY',
  'COLLECT_FEES',
  'REBALANCE',
  'CLOSE_POSITION',
]

const FIELDS = [
  'Timestamp',
  'Position',
  'Old range',
  'New range',
  'Token amounts',
  'USD value',
  'Fees collected',
  'Gas cost',
  'Reason',
  'Notes',
]

export default function LogPage() {
  return (
    <>
      <PageHeader
        title="Transaction & Rebalance Log"
        description="Every lifecycle event, so a rebalance decision can be reviewed months later against what actually happened."
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Tracked events</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pt-0">
            {EVENTS.map((event) => (
              <Badge key={event} variant="outline" className="font-mono">
                {event}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recorded fields</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5 pt-0">
            {FIELDS.map((field) => (
              <Badge key={field} variant="outline">
                {field}
              </Badge>
            ))}
          </CardContent>
        </Card>
      </div>

      <PhasePlaceholder
        phase="Phase 9"
        title="Lifecycle log"
        summary="Events reconstructed from on-chain transactions, plus manual entries with your own reasoning attached."
        delivers={[
          'On-chain events matched to positions with real gas costs in USD',
          'Free-text reason and notes, because the reasoning is what is worth reviewing later',
          'Gas totals fed into the performance cards and the rebalance cost model',
        ]}
      />
    </>
  )
}
