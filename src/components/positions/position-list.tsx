'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Loader2, Search } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/data/empty-state'
import { PositionCard } from './position-card'
import type { PositionView, DiscoveryResult } from '@/server/positions/types'
import type { WalletView } from '@/server/wallets/types'

interface ApiError {
  error?: { code?: string; message?: string }
}

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    cache: 'no-store',
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error((body as ApiError | null)?.error?.message ?? `Request failed (${response.status}).`)
  }
  return body as T
}

export function PositionList() {
  const queryClient = useQueryClient()

  const positionsQuery = useQuery({
    queryKey: ['positions'],
    queryFn: () => request<{ positions: PositionView[] }>('/api/positions'),
  })

  const walletsQuery = useQuery({
    queryKey: ['wallets'],
    queryFn: () => request<{ wallets: WalletView[] }>('/api/wallets'),
  })

  const discover = useMutation({
    mutationFn: (walletId: string) =>
      request<DiscoveryResult>(`/api/wallets/${walletId}/discover`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['positions'] }),
  })

  const positions = positionsQuery.data?.positions ?? []
  const wallets = walletsQuery.data?.wallets ?? []
  const result = discover.data

  return (
    <>
      <Card className="mb-6">
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-terminal-fg">Discover positions</p>
              <p className="mt-1 text-[12px] text-terminal-muted">
                Reads the Uniswap V3 position manager for a tracked wallet: NFT enumeration,
                position structs, then the factory for each pool.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {wallets.length === 0 ? (
                <Link href="/wallets" className={buttonVariants({ variant: 'primary', size: 'sm' })}>
                  Add a wallet first
                </Link>
              ) : (
                wallets.map((wallet) => (
                  <Button
                    key={wallet.id}
                    size="sm"
                    variant="secondary"
                    disabled={discover.isPending}
                    onClick={() => discover.mutate(wallet.id)}
                  >
                    {discover.isPending && discover.variables === wallet.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Search className="size-3.5" />
                    )}
                    {wallet.label ?? `${wallet.address.slice(0, 6)}…`}
                  </Button>
                ))
              )}
            </div>
          </div>

          {discover.error ? (
            <p className="mt-3 rounded-lg border border-signal-negative/25 bg-signal-negative/[0.06] px-3 py-2 text-[12px] text-signal-negative">
              {discover.error.message}
            </p>
          ) : null}

          {result ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
              <Badge
                variant={
                  result.status === 'SUCCEEDED'
                    ? 'positive'
                    : result.status === 'PARTIAL'
                      ? 'warning'
                      : 'negative'
                }
              >
                {result.status}
              </Badge>
              <span className="text-terminal-muted">
                {result.tokenIdsFound} NFT{result.tokenIdsFound === 1 ? '' : 's'} found ·{' '}
                {result.positionsPersisted} persisted · {result.positionsCreated} new
              </span>
              {result.error ? (
                <span className="font-mono text-signal-negative">{result.error.code}</span>
              ) : null}
            </div>
          ) : null}

          {result?.error ? (
            <p className="mt-2 rounded-lg border border-signal-negative/25 bg-signal-negative/[0.06] px-3 py-2 text-[12px] text-signal-negative">
              {result.error.message}
            </p>
          ) : null}

          {result?.failures.length ? (
            <ul className="mt-2 space-y-1">
              {result.failures.map((failure) => (
                <li key={failure.tokenId} className="text-[11px] text-signal-warning">
                  #{failure.tokenId}: {failure.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {positionsQuery.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : positionsQuery.isError ? (
        <Card className="border-signal-negative/25 bg-signal-negative/[0.05]">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-signal-negative">Positions could not be loaded</p>
            <p className="mt-1.5 text-[12px] text-terminal-muted">
              {positionsQuery.error.message}
            </p>
          </CardContent>
        </Card>
      ) : positions.length === 0 ? (
        <EmptyState
          icon={<Layers className="size-6" />}
          title="No positions discovered yet"
          description="Run discovery against a tracked wallet above. Nothing is signed — this reads the position manager and the factory."
        />
      ) : (
        <div className="space-y-4">
          {positions.map((position) => (
            <PositionCard key={position.id} position={position} />
          ))}
        </div>
      )}
    </>
  )
}
