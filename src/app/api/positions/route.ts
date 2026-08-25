import { NextResponse } from 'next/server'
import { listPositions } from '@/server/positions/service'
import { toApiError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const positions = await listPositions()
    return NextResponse.json(
      { positions, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
