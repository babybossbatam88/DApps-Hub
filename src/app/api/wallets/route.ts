import { NextResponse } from 'next/server'
import { z } from 'zod'
import { addWallet, listWallets } from '@/server/wallets/service'
import { toApiError } from '@/server/errors'
import { DEFAULT_CHAIN_ID } from '@/lib/chains/registry'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const wallets = await listWallets()
    return NextResponse.json(
      { wallets, fetchedAt: new Date().toISOString() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}

const createSchema = z.object({
  address: z.string().min(1, 'Enter a public EVM address.'),
  label: z.string().max(64).optional().nullable(),
  chainId: z.number().int().optional().default(DEFAULT_CHAIN_ID),
})

export async function POST(request: Request) {
  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'UNKNOWN', message: 'Request body must be JSON.' } },
      { status: 400 },
    )
  }

  const parsed = createSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'INVALID_ADDRESS',
          message: parsed.error.issues[0]?.message ?? 'Invalid request.',
          details: parsed.error.issues,
        },
      },
      { status: 400 },
    )
  }

  try {
    const wallet = await addWallet(parsed.data)
    return NextResponse.json({ wallet }, { status: 201 })
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
