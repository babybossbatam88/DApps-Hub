'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/data/empty-state'
import { WalletForm } from './wallet-form'
import { WalletCard } from './wallet-card'
import type { WalletSyncResult, WalletView } from '@/server/wallets/types'

interface WalletListResponse {
  wallets: WalletView[]
  fetchedAt: string
}

interface ApiErrorBody {
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
    const message =
      (body as ApiErrorBody | null)?.error?.message ?? `Request failed (${response.status}).`
    throw new Error(message)
  }
  return body as T
}

export function WalletManager() {
  const queryClient = useQueryClient()
  const [syncErrors, setSyncErrors] = useState<Record<string, string | null>>({})

  const walletsQuery = useQuery({
    queryKey: ['wallets'],
    queryFn: () => request<WalletListResponse>('/api/wallets'),
  })

  const addMutation = useMutation({
    mutationFn: (input: { address: string; label: string | null }) =>
      request<{ wallet: WalletView }>('/api/wallets', {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      // Sync immediately: a wallet with no balances tells the user nothing, and
      // waiting for a manual click makes the app look broken on first use.
      syncMutation.mutate(result.wallet.id)
    },
  })

  const syncMutation = useMutation({
    mutationFn: (walletId: string) =>
      request<WalletSyncResult>(`/api/wallets/${walletId}/sync`, { method: 'POST' }),
    onSuccess: async (result) => {
      // A failed sync is a 200 with status FAILED — the request worked, the read
      // did not. Surface the reason per wallet rather than as a global toast.
      setSyncErrors((prev) => ({
        ...prev,
        [result.walletId]:
          result.status === 'FAILED'
            ? `${result.error?.code ?? 'SYNC_FAILED'}: ${result.error?.message ?? 'Sync failed.'}`
            : null,
      }))
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (error: Error, walletId) => {
      setSyncErrors((prev) => ({ ...prev, [walletId]: error.message }))
    },
  })

  const removeMutation = useMutation({
    mutationFn: (walletId: string) =>
      request<{ removed: string }>(`/api/wallets/${walletId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wallets'] }),
  })

  const wallets = walletsQuery.data?.wallets ?? []

  return (
    <>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Track a wallet</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <WalletForm
            onSubmit={(input) => addMutation.mutate(input)}
            isSubmitting={addMutation.isPending}
            serverError={addMutation.error?.message ?? null}
          />
        </CardContent>
      </Card>

      {walletsQuery.isPending ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : walletsQuery.isError ? (
        <Card className="border-signal-negative/25 bg-signal-negative/[0.05]">
          <CardContent className="pt-5">
            <p className="text-sm font-medium text-signal-negative">
              Wallets could not be loaded
            </p>
            <p className="mt-1.5 text-[12px] text-terminal-muted">
              {walletsQuery.error.message}
            </p>
            <p className="mt-2 text-[11px] text-terminal-faint">
              No wallet list is shown rather than an empty one — an empty list and an unreachable
              database look identical, and only one of them means &ldquo;you have no wallets&rdquo;.
            </p>
          </CardContent>
        </Card>
      ) : wallets.length === 0 ? (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No wallets tracked yet"
          description="Paste a public EVM address above. Nothing is signed, no wallet connection is requested, and no key is ever asked for."
        />
      ) : (
        <div className="space-y-4">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              isSyncing={syncMutation.isPending && syncMutation.variables === wallet.id}
              isRemoving={removeMutation.isPending && removeMutation.variables === wallet.id}
              syncError={syncErrors[wallet.id] ?? null}
              onSync={() => syncMutation.mutate(wallet.id)}
              onRemove={() => removeMutation.mutate(wallet.id)}
            />
          ))}
        </div>
      )}
    </>
  )
}
