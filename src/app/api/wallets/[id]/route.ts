import { NextResponse } from 'next/server'
import { removeWallet } from '@/server/wallets/service'
import { toApiError } from '@/server/errors'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await removeWallet(id)
    // Removing a wallet deletes its positions and balances by cascade. It does
    // not touch the chain — there is nothing on chain to remove.
    return NextResponse.json({ removed: id })
  } catch (error) {
    const { body, status } = toApiError(error)
    return NextResponse.json(body, { status })
  }
}
