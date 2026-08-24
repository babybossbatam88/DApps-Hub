import 'server-only'
import type { PrismaClient } from '@/generated/prisma/client'
import { getPrisma } from '@/lib/db/prisma'

/**
 * Current user resolution.
 *
 * ---------------------------------------------------------------------------
 * PHASE 13 REPLACES THIS.
 *
 * V1 has no authentication yet, so every request resolves to a single local
 * account. This exists so foreign keys are real from the start: retrofitting a
 * `userId` onto positions and snapshots after the fact means a migration over
 * live history, which is exactly the kind of change that corrupts an immutable
 * entry basis.
 *
 * Two things this deliberately does NOT do:
 *  - it does not read any header, cookie, or query parameter to choose a user,
 *    so there is no impersonation surface to get wrong later;
 *  - it does not create per-request users, so repeated calls are idempotent.
 *
 * A deployment running this without auth must not be exposed publicly. The
 * deployment checklist says so, and Phase 13 makes it moot.
 * ---------------------------------------------------------------------------
 */

const LOCAL_USER_EMAIL = 'local@lp-command-center.invalid'

export async function getCurrentUserId(prisma: PrismaClient = getPrisma()): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: LOCAL_USER_EMAIL },
    update: {},
    create: {
      email: LOCAL_USER_EMAIL,
      displayName: 'Local user',
      settings: { create: {} },
    },
    select: { id: true },
  })
  return user.id
}

export const AUTH_STATUS = {
  implemented: false,
  phase: 'Phase 13',
  note: 'Single local account until authentication lands.',
} as const
