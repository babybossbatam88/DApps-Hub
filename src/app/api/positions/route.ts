import { NextResponse } from 'next/server'
import { listPositions } from '@/server/positions/service'
import { attachValuations } from '@/server/positions/valuation'
import { toApiError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    // Valuation costs a chain read; `?value=false` returns persisted facts only.
    const withValuation = url.searchParams.get('value') !== 'false'

    const stored = await listPositions()
    const positions = withValuation ? await attachValuations(stored) : stored
    return NextResponse.json(
      { positions, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
