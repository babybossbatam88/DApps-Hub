'use client'

import { ExternalLink, Loader2, RefreshCw, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataFreshness } from '@/components/data/data-freshness'
import { formatTokenAmount, truncateHex } from '@/lib/utils/format'
import type { WalletView } from '@/server/wallets/types'

export function WalletCard({
  wallet,
  onSync,
  onRemove,
  isSyncing,
  isRemoving,
  syncError,
}: {
  wallet: WalletView
  onSync: () => void
  onRemove: () => void
  isSyncing: boolean
  isRemoving: boolean
  syncError: string | null
}) {
  const neverSynced = wallet.lastSyncedAt === null
  // A partial sync is a warning, not an error. The balances that did read are
  // current and correct; flagging them red trains the reader to ignore the
  // badge, which is exactly when a real outage gets missed.
  const failed = wallet.lastSyncStatus === 'FAILED' || Boolean(syncError)
  const partial = !failed && wallet.lastSyncStatus === 'PARTIAL'
  const notice = syncError ?? wallet.lastSyncError

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-terminal-fg">
                {wallet.label ?? 'Untitled wallet'}
              </span>
              <Badge variant="outline">{wallet.chainName}</Badge>
              <Badge variant="info">read-only</Badge>
            </div>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="font-mono text-[12px] text-terminal-muted"
                title={wallet.address}
              >
                {truncateHex(wallet.address, 10, 8)}
              </span>
              {wallet.explorerUrl ? (
                <a
                  href={wallet.explorerUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-terminal-faint hover:text-terminal-muted"
                  aria-label="View on block explorer"
                >
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="sm" variant="secondary" onClick={onSync} disabled={isSyncing}>
              {isSyncing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              Sync
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              disabled={isRemoving}
              aria-label="Stop tracking this wallet"
              title="Stop tracking. Nothing on chain is affected."
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <DataFreshness
            observedAt={wallet.observedAt}
            source="onchain"
            hasError={failed}
            errorMessage={notice ?? undefined}
          />
          {partial ? <Badge variant="warning">partial</Badge> : null}
          {wallet.blockNumber ? (
            <span className="font-mono text-[11px] text-terminal-faint" title="Block read">
              @ #{wallet.blockNumber}
            </span>
          ) : null}
        </div>

        {notice ? (
          <p
            className={
              failed
                ? 'mt-2 rounded-lg border border-signal-negative/25 bg-signal-negative/[0.06] px-3 py-2 text-[12px] text-signal-negative'
                : 'mt-2 rounded-lg border border-signal-warning/25 bg-signal-warning/[0.06] px-3 py-2 text-[12px] text-signal-warning'
            }
          >
            {notice}
          </p>
        ) : null}

        <div className="mt-4">
          {neverSynced && wallet.balances.length === 0 ? (
            <p className="text-[12px] text-terminal-muted">
              Not synced yet. Run a sync to read this wallet&rsquo;s balances from Base.
            </p>
          ) : wallet.balances.length === 0 ? (
            <p className="text-[12px] text-terminal-muted">
              No balances found at the last read. This wallet holds none of the tracked assets —
              that is a real result, not a missing one.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-terminal-border text-[10px] tracking-[0.1em] text-terminal-faint uppercase">
                    <th className="pb-2 font-medium">Asset</th>
                    <th className="pb-2 text-right font-medium">Balance</th>
                    <th className="hidden pb-2 text-right font-medium sm:table-cell">Decimals</th>
                    <th className="hidden pb-2 text-right font-medium sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-border/60">
                  {wallet.balances.map((balance) => (
                    <tr key={balance.tokenAddress}>
                      <td className="py-2">
                        <span className="font-medium text-terminal-fg">{balance.symbol}</span>
                        {balance.isNative ? (
                          <span className="ml-1.5 text-[10px] text-terminal-faint">native</span>
                        ) : null}
                      </td>
                      <td className="py-2 text-right font-mono text-terminal-fg">
                        {formatTokenAmount(balance.amount)}
                      </td>
                      <td className="hidden py-2 text-right font-mono text-terminal-faint sm:table-cell">
                        {balance.decimals}
                      </td>
                      <td className="hidden py-2 text-right sm:table-cell">
                        <Badge variant={balance.verified ? 'positive' : 'warning'}>
                          {balance.verified ? 'on-chain' : 'unverified'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-terminal-faint">
                USD values arrive with the price provider in Phase 4. Decimals shown are read from
                each token contract, not from the static registry.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
