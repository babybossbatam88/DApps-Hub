import type { Metadata } from 'next'
import { PageHeader, SectionTitle } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LiveChainPanel } from '@/components/data/live-chain-panel'
import { tryGetServerEnv, appMode } from '@/lib/config/env'
import { listChains } from '@/lib/chains/registry'
import { listTokens } from '@/lib/tokens/registry'

export const metadata: Metadata = { title: 'Data Sources' }
export const dynamic = 'force-dynamic'

/**
 * Data Sources is where the product admits what it does and does not know.
 *
 * Configuration is reported from the server (with endpoint URLs redacted, since
 * they usually embed a provider key), while the RPC probe runs client-side so
 * it keeps re-checking while the page is open.
 */
export default function DataSourcesPage() {
  const env = tryGetServerEnv()
  const chains = listChains()
  const tokens = listTokens(8453)

  const databaseConfigured = Boolean(process.env.DATABASE_URL)
  const binanceAccountEnabled = env.ok ? env.env.BINANCE_ENABLE_ACCOUNT_READ : false

  return (
    <>
      <PageHeader
        title="Data Sources"
        description="Where every number comes from, and whether that source is currently answering."
      />

      {!env.ok ? (
        <Card className="mb-6 border-signal-negative/25 bg-signal-negative/[0.05]">
          <CardHeader>
            <CardTitle className="text-signal-negative">Configuration errors</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-1">
              {env.issues.map((issue) => (
                <li key={issue} className="font-mono text-[12px] text-signal-negative">
                  · {issue}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <SectionTitle>Live probes</SectionTitle>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <LiveChainPanel />

        <Card>
          <CardHeader>
            <CardTitle>PostgreSQL</CardTitle>
            {databaseConfigured ? (
              <Badge variant="info">Configured</Badge>
            ) : (
              <Badge variant="warning">Not configured</Badge>
            )}
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-[12px] text-terminal-muted">
              {databaseConfigured
                ? 'DATABASE_URL is set. A live connectivity check runs at /api/health, which probes the connection rather than assuming it works.'
                : 'DATABASE_URL is not set. Position storage, snapshots, and history are unavailable until it is configured — see docs/deployment.md.'}
            </p>
          </CardContent>
        </Card>
      </div>

      <SectionTitle>Configured sources</SectionTitle>
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Networks</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="divide-y divide-terminal-border">
              {chains.map((chain) => (
                <li key={chain.chainId} className="py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-terminal-fg">{chain.name}</span>
                    <Badge variant={chain.isEnabled ? 'positive' : 'outline'}>
                      {chain.isEnabled ? 'enabled' : 'disabled'}
                    </Badge>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-terminal-faint">
                    id {chain.chainId} · {chain.blockTimeSeconds}s blocks ·{' '}
                    {chain.deployments.map((d) => d.protocolKey).join(', ')}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Market data</CardTitle>
            <Badge variant="outline">Phase 10</Badge>
          </CardHeader>
          <CardContent className="pt-0">
            <dl className="divide-y divide-terminal-border/60">
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-terminal-muted">Binance base URL</dt>
                <dd className="font-mono text-[12px] text-terminal-fg">
                  {env.ok ? env.env.BINANCE_API_BASE_URL : 'N/A'}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-terminal-muted">Account read</dt>
                <dd>
                  <Badge variant={binanceAccountEnabled ? 'info' : 'outline'}>
                    {binanceAccountEnabled ? 'enabled' : 'disabled'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-terminal-muted">Trading</dt>
                <dd>
                  <Badge variant="positive">disabled (enforced)</Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-[13px] text-terminal-muted">Application mode</dt>
                <dd>
                  <Badge variant={appMode === 'live' ? 'positive' : 'warning'}>{appMode}</Badge>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      <SectionTitle>Asset registry — Base</SectionTitle>
      <Card>
        <CardContent className="pt-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-terminal-border text-[10px] tracking-[0.1em] text-terminal-faint uppercase">
                  <th className="pb-2 font-medium">Symbol</th>
                  <th className="pb-2 font-medium">Address</th>
                  <th className="pb-2 font-medium">Decimals</th>
                  <th className="pb-2 font-medium">Market mapping</th>
                  <th className="pb-2 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-border/60">
                {tokens.map((token) => (
                  <tr key={token.address}>
                    <td className="py-2 font-medium text-terminal-fg">{token.symbol}</td>
                    <td className="py-2 font-mono text-terminal-faint">{token.address}</td>
                    <td className="py-2 font-mono text-terminal-muted">{token.decimals}</td>
                    <td className="py-2">
                      {token.binanceSymbol ? (
                        <span className="flex items-center gap-1.5">
                          <span className="font-mono text-terminal-muted">{token.binanceSymbol}</span>
                          {token.isProxyPriced ? <Badge variant="warning">proxy</Badge> : null}
                        </span>
                      ) : (
                        <span className="text-terminal-faint">none</span>
                      )}
                    </td>
                    <td className="py-2">
                      <Badge variant={token.verified ? 'positive' : 'outline'}>
                        {token.verified ? 'on-chain' : 'unverified'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-[11px] text-terminal-faint">
            These entries are labelling hints only. Decimals used in arithmetic are always read from
            the token contract during sync — a wrong hard-coded value would corrupt every amount
            downstream, so the maths never trusts this table. A <Badge variant="warning">proxy</Badge>{' '}
            mapping means the price comes from a different asset&rsquo;s market: cbBTC is not BTC,
            and the flag follows the value all the way to the screen.
          </p>
        </CardContent>
      </Card>
    </>
  )
}
