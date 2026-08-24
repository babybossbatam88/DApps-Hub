import type { Metadata } from 'next'
import { AlertTriangle, Check, X } from 'lucide-react'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhasePlaceholder } from '@/components/data/empty-state'

export const metadata: Metadata = { title: 'Binance' }

/**
 * Binance integration.
 *
 * Public market data needs no credentials and lands first. Authenticated access
 * is optional, read-only, and refuses to operate on a key that can withdraw.
 */
export default function BinancePage() {
  return (
    <>
      <PageHeader
        title="Binance Integration"
        description="Public market data first. Account access is optional, read-only, and off by default."
      />

      <Card className="mb-6 border-signal-negative/25 bg-signal-negative/[0.04]">
        <CardContent className="flex gap-3 pt-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-signal-negative" />
          <div className="text-sm">
            <p className="font-medium text-terminal-fg">Withdrawals must be disabled</p>
            <p className="mt-1.5 text-terminal-muted">
              If an API key reports <code className="font-mono">enableWithdrawals: true</code>, the
              connection is marked <span className="text-signal-negative">UNSAFE</span> and account
              sync is refused until you disable it in your Binance API settings. This product will
              not read from a key that can move money — the read is not worth the blast radius if
              the credential leaks.
            </p>
            <p className="mt-2 text-terminal-muted">
              No withdrawal endpoint and no order endpoint is implemented. Trading is behind a
              feature flag that the environment validator requires to be{' '}
              <code className="font-mono">false</code> in V1 — the server refuses to boot otherwise.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Permission health</CardTitle>
          <Badge variant="outline">Not connected</Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-terminal-border">
            {[
              { label: 'Read', requirement: 'Required', tone: 'positive' as const, icon: Check },
              { label: 'Spot trading', requirement: 'Not needed — disable it', tone: 'warning' as const, icon: X },
              { label: 'Withdrawals', requirement: 'MUST be disabled', tone: 'negative' as const, icon: X },
              { label: 'IP restriction', requirement: 'Recommended', tone: 'info' as const, icon: Check },
            ].map((row) => {
              const Icon = row.icon
              return (
                <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-2 text-sm text-terminal-fg">
                    <Icon className="size-3.5 text-terminal-faint" />
                    {row.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-[11px] text-terminal-muted">{row.requirement}</span>
                    <Badge variant="outline">unknown</Badge>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-[11px] text-terminal-faint">
            Scopes are read live from <code className="font-mono">/sapi/v1/account/apiRestrictions</code>.
            Credentials are AES-256-GCM encrypted server-side and are never sent to the browser or
            stored in localStorage.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <PhasePlaceholder
          phase="Phase 10"
          title="Public market data"
          summary="No credentials required. Used as the rank-1 price provider behind the on-chain pool price."
          delivers={[
            'BTCUSDT and ETHUSDT spot marks, 24h tickers, and historical candles',
            'Order-book depth as a slippage reference for rebalance cost estimates',
            'Rate limits read from exchangeInfo at startup rather than hard-coded',
          ]}
        />
        <PhasePlaceholder
          phase="Phase 11"
          title="Read-only account access"
          summary="Optional. Balances, trades, deposits, withdrawals, and Convert history — read only."
          delivers={[
            'HMAC-SHA256 signed requests with clock-skew correction against /api/v3/time',
            'Permission health checked before any account read is attempted',
            'Sync refused outright on a key with withdrawals enabled',
          ]}
        />
      </div>
    </>
  )
}
