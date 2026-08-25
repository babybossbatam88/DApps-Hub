import { NextResponse } from 'next/server'
import { discoverPositionsForWallet } from '@/server/positions/service'
import { toApiError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Discover a wallet's Uniswap V3 positions.
 *
 * Like the balance sync, a chain failure returns 200 with `status: "FAILED"`
 * and the reason: the request itself succeeded, the audit row was written, and
 * the UI needs the message. Non-2xx is reserved for request-level problems.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const result = await discoverPositionsForWallet(id)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
