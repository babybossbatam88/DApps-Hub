'use client'

import { ExternalLink } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataFreshness } from '@/components/data/data-freshness'
import { cn } from '@/lib/utils/cn'
import { formatMoney, formatPrice, formatTokenAmount, truncateHex } from '@/lib/utils/format'
import type { PositionValuationView, PositionView } from '@/server/positions/types'

const STATE_VARIANT: Record<string, 'positive' | 'warning' | 'negative'> = {
  IN_RANGE_SAFE: 'positive',
  NEAR_LOWER: 'warning',
  NEAR_UPPER: 'warning',
  OUT_BELOW: 'negative',
  OUT_ABOVE: 'negative',
}

export function PositionCard({ position }: { position: PositionView }) {
  const v = position.valuation
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
            ) : v ? (
              <Badge variant={STATE_VARIANT[v.range.state] ?? 'neutral'}>{v.range.label}</Badge>
            ) : (
              <Badge variant="outline">Range unknown</Badge>
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

        <RangeBar position={position} valuation={v} />

        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric
            label="Position value"
            value={v ? formatMoney(v.totalValue, v.valueUnit) : null}
            fallback={position.valuationError ? 'Pool state unavailable' : 'Not valued'}
          />
          <Metric
            label="Current price"
            value={v ? `${formatPrice(v.currentPrice)} ${position.quoteSymbol}` : null}
            fallback="Pool state unavailable"
          />
          <Metric
            label="Uncollected fees"
            value={null}
            fallback="Phase 5"
          />
          <Metric label="LP vs HODL" value={null} fallback="Phase 6" />
        </div>

        <dl className="mt-4 divide-y divide-terminal-border/60">
          <Row
            label={position.token0.symbol}
            value={v ? formatTokenAmount(v.amount0) : null}
            secondary={v ? formatMoney(v.value0, v.valueUnit) : undefined}
            fallback="—"
          />
          <Row
            label={position.token1.symbol}
            value={v ? formatTokenAmount(v.amount1) : null}
            secondary={v ? formatMoney(v.value1, v.valueUnit) : undefined}
            fallback="—"
          />
          {v?.allocation0Percent ? (
            <Row
              label="Allocation"
              value={`${v.allocation0Percent}% / ${v.allocation1Percent}%`}
            />
          ) : null}
          <Row
            label={`Entry ${position.token0.symbol} / ${position.token1.symbol}`}
            value={
              hasEntry
                ? `${formatTokenAmount(position.entry!.token0Amount)} / ${formatTokenAmount(position.entry!.token1Amount)}`
                : null
            }
            fallback="No entry basis on chain"
          />
        </dl>

        {v?.outOfRangeNote ? (
          <p className="mt-3 rounded-lg border border-signal-warning/30 bg-signal-warning/[0.08] px-3 py-2 text-[12px] text-signal-warning">
            {v.outOfRangeNote}
          </p>
        ) : null}

        {position.valuationError ? (
          <p className="mt-3 rounded-lg border border-signal-negative/30 bg-signal-negative/[0.07] px-3 py-2 text-[12px] text-signal-negative">
            <span className="font-mono">{position.valuationError.code}</span> —{' '}
            {position.valuationError.message}
            <br />
            <span className="text-terminal-muted">
              The range and entry basis below are still accurate; only the live half is missing.
            </span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <DataFreshness
              observedAt={v?.observedAt ?? position.lastSyncedAt}
              source="onchain"
              hasError={Boolean(position.valuationError)}
              errorMessage={position.valuationError?.message}
            />
            {v ? (
              <span className="font-mono text-[11px] text-terminal-faint">@ #{v.blockNumber}</span>
            ) : null}
          </div>
          <span className="font-mono text-[10px] text-terminal-faint">
            {position.walletLabel ?? truncateHex(position.walletAddress)}
          </span>
        </div>

        {!hasEntry ? (
          <p className="mt-3 text-[11px] text-terminal-faint">
            No entry basis recorded — the deposit history could not be read, and many public RPC
            endpoints reject a full-history log query. LP vs HODL stays unavailable until it is
            known; a partial window would understate the basis and flatter every figure derived
            from it.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * The range, with the current price marked.
 *
 * The marker position is `progressPercent`, which the range engine has already
 * mirrored into price space — for a USDC/cbBTC pool a rising tick is a falling
 * price, and using the raw tick figure would slide the marker the wrong way.
 */
function RangeBar({
  position,
  valuation,
}: {
  position: PositionView
  valuation: PositionValuationView | null
}) {
  // Clamped INTO the track: an out-of-range marker drawn at its true offset
  // escapes the card and lands on unrelated chrome. The coloured bar and the
  // signed "% through" label already convey that price is outside the range.
  const progress = valuation
    ? Math.max(0, Math.min(100, valuation.range.progressPercent))
    : null
  const variant = valuation ? (STATE_VARIANT[valuation.range.state] ?? 'neutral') : 'neutral'
  const colour =
    variant === 'positive'
      ? 'var(--color-signal-positive)'
      : variant === 'warning'
        ? 'var(--color-signal-warning)'
        : variant === 'negative'
          ? 'var(--color-signal-negative)'
          : 'var(--color-terminal-border-strong)'

  return (
    <div className="mt-5">
      <div className="relative h-9">
        <div className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full bg-terminal-raised" />
        {valuation?.range.inRange ? (
          <div
            className="absolute top-1/2 right-0 left-0 h-1.5 -translate-y-1/2 rounded-full opacity-30"
            style={{ background: colour }}
          />
        ) : null}
        <div className="absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
        <div className="absolute top-1/2 right-0 h-5 w-0.5 -translate-y-1/2 rounded bg-terminal-border-strong" />
        {progress !== null ? (
          <div
            className="absolute top-1/2 h-7 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded"
            style={{ left: `${progress}%`, background: colour }}
          />
        ) : null}
      </div>

      <div className="flex items-start justify-between font-mono text-[11.5px]">
        <div>
          <div className="text-terminal-fg">{formatPrice(position.priceLower)}</div>
          <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
            Lower
          </div>
        </div>
        <div className="text-center">
          <div
            className={cn(
              valuation
                ? variant === 'positive'
                  ? 'text-signal-positive'
                  : variant === 'warning'
                    ? 'text-signal-warning'
                    : 'text-signal-negative'
                : 'text-terminal-faint',
            )}
          >
            {valuation ? formatPrice(valuation.currentPrice) : 'N/A'}
          </div>
          <div className="mt-0.5 text-[10px] tracking-wider text-terminal-faint uppercase">
            {valuation
              ? `Current · ${valuation.range.progressPercent.toFixed(0)}% through`
              : 'Current'}
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
        ticks {position.tickLower} to {position.tickUpper}
        {valuation ? ` · now ${valuation.currentTick}` : ''}
      </p>
    </div>
  )
}

function Metric({
  label,
  value,
  fallback,
}: {
  label: string
  value: string | null
  fallback?: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] tracking-wide text-terminal-muted uppercase">{label}</div>
      <div
        className={cn(
          'mt-1 truncate font-mono text-[17px] font-semibold',
          value === null ? 'text-terminal-faint' : 'text-terminal-fg',
        )}
        title={value ?? fallback}
      >
        {value ?? 'N/A'}
      </div>
      {value === null && fallback ? (
        <div className="mt-0.5 text-[10px] text-terminal-faint">{fallback}</div>
      ) : null}
    </div>
  )
}

function Row({
  label,
  value,
  secondary,
  fallback,
}: {
  label: string
  value: string | null
  secondary?: string
  fallback?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[13px] text-terminal-muted">{label}</dt>
      <dd className="text-right">
        <span
          className={cn(
            'font-mono text-[13px]',
            value === null ? 'text-terminal-faint' : 'text-terminal-fg',
          )}
        >
          {value ?? fallback ?? 'N/A'}
        </span>
        {secondary ? (
          <span className="ml-2 font-mono text-[11px] text-terminal-faint">{secondary}</span>
        ) : null}
      </dd>
    </div>
  )
}
