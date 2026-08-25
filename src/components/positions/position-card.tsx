'use client'

import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataFreshness } from '@/components/data/data-freshness'
import { formatPrice, formatTokenAmount, truncateHex } from '@/lib/utils/format'
import type { PositionView } from '@/server/positions/types'

/**
 * A discovered position, showing only what Phase 3 can actually establish.
 *
 * Everything here derives from the position struct and its tick bounds: the
 * pair, the fee tier, the range, the liquidity, and the entry basis. Current
 * price, inventory, and fees need pool state and land in Phases 4–5, and are
 * labelled rather than estimated.
 */
export function PositionCard({ position }: { position: PositionView }) {
  const hasEntry = position.entry !== null

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-terminal-fg">{position.pairLabel}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge variant="outline">
                {position.protocol} {position.protocolVersion}
              </Badge>
              <Badge variant="outline">{position.chainName}</Badge>
              <Badge variant="outline">{position.feeTierLabel}</Badge>
              <Badge variant="outline" className="font-mono">
                #{position.positionNftId}
              </Badge>
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            {position.isClosed ? (
              <Badge variant="neutral">Closed</Badge>
            ) : (
              <Badge variant="info">Liquidity on chain</Badge>
            )}
            {position.explorerUrl ? (
              <a
                href={position.explorerUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="flex items-center gap-1 font-mono text-[10px] text-terminal-faint hover:text-terminal-muted"
              >
                pool {truncateHex(position.poolAddress, 6, 4)}
                <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        </div>

        {/* Range bar. Ticks alone define the bounds; the current-price marker
            arrives with pool state in Phase 4. */}
        <div className="mt-5">
          <div className="relative h-8">
            <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-terminal-raised" />
            <div className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
            <div className="absolute top-1/2 right-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
          </div>
          <div className="flex items-start justify-between font-mono text-[11.5px]">
            <div>
              <div className="text-terminal-fg">{formatPrice(position.priceLower)}</div>
              <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
                Lower
              </div>
            </div>
            <div className="text-center">
              <div className="text-terminal-faint">N/A</div>
              <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
                Current · Phase 4
              </div>
            </div>
            <div className="text-right">
              <div className="text-terminal-fg">{formatPrice(position.priceUpper)}</div>
              <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
                Upper
              </div>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-terminal-faint">
            {position.quoteSymbol} per {position.baseSymbol} · width {position.rangeWidthPercent}% ·
            ticks {position.tickLower} to {position.tickUpper} (spacing {position.tickSpacing})
          </p>
        </div>

        <dl className="mt-4 divide-y divide-terminal-border/60">
          <Row label="Liquidity" value={position.liquidity} mono />
          <Row
            label={`Entry ${position.token0.symbol}`}
            value={hasEntry ? formatTokenAmount(position.entry!.token0Amount) : null}
            fallback="No entry basis on chain"
          />
          <Row
            label={`Entry ${position.token1.symbol}`}
            value={hasEntry ? formatTokenAmount(position.entry!.token1Amount) : null}
            fallback="No entry basis on chain"
          />
          <Row label="Position value" value={null} fallback="Needs pool state — Phase 4" />
          <Row label="Uncollected fees" value={null} fallback="Needs tick data — Phase 5" />
          <Row label="LP vs HODL" value={null} fallback="Needs prices — Phase 6" />
        </dl>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <DataFreshness
            observedAt={position.lastSyncedAt}
            source="onchain"
            hasError={Boolean(position.lastSyncError)}
            errorMessage={position.lastSyncError ?? undefined}
          />
          <span className="font-mono text-[10px] text-terminal-faint">
            {position.walletLabel ?? truncateHex(position.walletAddress)}
          </span>
        </div>

        {!hasEntry ? (
          <p className="mt-3 rounded-lg border border-signal-warning/25 bg-signal-warning/[0.06] px-3 py-2 text-[11px] text-signal-warning">
            No entry basis recorded. The deposit history could not be read — many public RPC
            endpoints reject a full-history log query. LP vs HODL stays unavailable until it is
            known; a partial window would understate the basis and flatter every figure derived
            from it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Row({
  label,
  value,
  fallback,
  mono = false,
}: {
  label: string
  value: string | null
  fallback?: string
  mono?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[13px] text-terminal-muted">{label}</dt>
      <dd
        className={
          value === null
            ? 'text-right text-[11px] text-terminal-faint'
            : `text-right text-[13px] text-terminal-fg ${mono ? 'font-mono' : 'font-mono'}`
        }
      >
        {value ?? fallback ?? 'N/A'}
      </dd>
    </div>
  )
}
