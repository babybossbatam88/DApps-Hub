'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({ children }: { children: React.ReactNode }) {
  // Created inside state so each browser session gets one client, and so SSR
  // never shares a cache between requests.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Chain and market data go stale quickly; the freshness badge is
            // driven by `dataUpdatedAt`, so a short staleTime keeps the badge
            // honest rather than showing "Live" over a five-minute-old figure.
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
          },
        },
      }),
  )

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
