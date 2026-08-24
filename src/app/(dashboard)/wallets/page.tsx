import type { Metadata } from 'next'
import { ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { listChains } from '@/lib/chains/registry'
import { WalletManager } from '@/components/wallets/wallet-manager'

export const metadata: Metadata = { title: 'Wallets' }

export default function WalletsPage() {
  const chains = listChains({ enabledOnly: true })

  return (
    <>
      <PageHeader
        title="Wallets"
        description="Track any public EVM address. No wallet connection, no signature, and no key material — ever."
      />

      <Card className="mb-6 border-signal-positive/20 bg-signal-positive/[0.04]">
        <CardContent className="flex gap-3 pt-5">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-signal-positive" />
          <div className="text-sm">
            <p className="font-medium text-terminal-fg">Read-only by construction</p>
            <ul className="mt-2 space-y-1 text-terminal-muted">
              <li>· This application never asks for a seed phrase or a private key.</li>
              <li>· No signer is constructed anywhere in the codebase; only public RPC clients.</li>
              <li>
                · The Uniswap adapter has no ABI entry for <code className="font-mono">mint</code>,{' '}
                <code className="font-mono">burn</code>, <code className="font-mono">collect</code>,
                or <code className="font-mono">swap</code>, so it cannot send a transaction even by
                mistake.
              </li>
              <li>
                · Any future transaction support would require you to sign explicitly in your own
                wallet.
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Supported networks</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ul className="divide-y divide-terminal-border">
            {chains.map((chain) => (
              <li key={chain.chainId} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-terminal-fg">{chain.name}</span>
                  <span className="ml-2 font-mono text-[11px] text-terminal-faint">
                    chain id {chain.chainId}
                  </span>
                </div>
                <span className="text-[11px] text-terminal-muted">
                  {chain.deployments.map((d) => d.protocolKey).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <WalletManager />
    </>
  )
}
