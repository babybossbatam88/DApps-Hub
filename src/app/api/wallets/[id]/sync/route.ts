import { NextResponse } from 'next/server'
import { syncWalletBalances } from '@/server/wallets/service'
import { toApiError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Sync one wallet's balances from chain.
 *
 * A sync that fails on the RPC still returns 200 with `status: "FAILED"` and
 * the reason: the request itself succeeded, the audit row was written, and the
 * UI needs the error text to display. Reserving non-2xx for request-level
 * problems keeps those two kinds of failure distinguishable.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await syncWalletBalances(id)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
