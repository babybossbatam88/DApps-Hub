import type { Metadata } from 'next'
import { PageHeader, SectionTitle } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PhasePlaceholder } from '@/components/data/empty-state'
import { DEFAULT_THRESHOLDS } from '@/lib/config/thresholds'
import { appMode } from '@/lib/config/env'

export const metadata: Metadata = { title: 'Settings' }

export default function SettingsPage() {
  const { range, rebalance, fees, snapshotIntervalMinutes } = DEFAULT_THRESHOLDS

  return (
    <>
      <PageHeader
        title="Settings"
        description="Thresholds, data cadence, and the mode this deployment is running in."
      />

      <SectionTitle>Mode</SectionTitle>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Application mode</CardTitle>
          <Badge variant={appMode === 'live' ? 'positive' : 'warning'}>
            {appMode.toUpperCase()}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0 text-[12px] text-terminal-muted">
          <p>
            <span className="text-terminal-fg">Demo</span> permits clearly-labelled development
            fixtures. <span className="text-terminal-fg">Live</span> forbids every fabricated figure:
            fixture providers throw at construction rather than degrading quietly into plausible
            numbers.
          </p>
          <p className="mt-2">
            Set with <code className="font-mono">NEXT_PUBLIC_APP_MODE</code>. The indicator in the
            top bar is permanent chrome, because the difference is invisible in a screenshot.
          </p>
        </CardContent>
      </Card>

      <SectionTitle>Thresholds</SectionTitle>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Range</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SettingRows
              rows={[
                ['Safe distance from edge', `${range.safeEdgePercent}%`],
                ['Near-edge warning', `${range.nearEdgePercent}%`],
                ['Critical edge', `${range.criticalEdgePercent}%`],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rebalance</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SettingRows
              rows={[
                ['Minimum position size', `$${rebalance.minPositionSizeUsd}`],
                ['Max cost / 30d fee ratio', `${rebalance.maxCostToFeeRatio}×`],
                ['Out-of-range grace', `${rebalance.outOfRangeGraceHours} h`],
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fees</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SettingRows
              rows={[['APR windows', fees.aprWindowsDays.map((d) => `${d}d`).join(' · ')]]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data cadence</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <SettingRows rows={[['Snapshot interval', `${snapshotIntervalMinutes} min`]]} />
          </CardContent>
        </Card>
      </div>

      <PhasePlaceholder
        phase="Phase 13"
        title="Per-user settings and authentication"
        summary="These defaults become editable per user, persisted on UserSettings, once accounts exist."
        delivers={[
          'Email/password or magic-link authentication',
          'Per-user threshold overrides merged over these defaults at read time',
          'Display currency and timezone preferences',
        ]}
      />
    </>
  )
}

function SettingRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="divide-y divide-terminal-border/60">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-[13px] text-terminal-muted">{label}</dt>
          <dd className="font-mono text-[13px] text-terminal-fg">{value}</dd>
        </div>
      ))}
    </dl>
  )
}
