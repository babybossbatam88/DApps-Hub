import 'server-only'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/generated/prisma/client'

/**
 * Prisma singleton.
 *
 * Next dev-mode hot reload creates a new module instance on every edit, which
 * would open a new connection pool each time until Postgres refuses more. The
 * global cache is the standard workaround and is dev-only in effect.
 *
 * Prisma 7 requires a driver adapter; `PrismaPg` carries the pooled URL.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL is not set. The database is required for position storage; ' +
        'see .env.example and docs/deployment.md.',
    )
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

export function getPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient()
  }
  return globalForPrisma.prisma
}

/** Health probe. Returns a result rather than throwing, so /api/health can report it. */
export async function checkDatabase(): Promise<
  { ok: true; latencyMs: number } | { ok: false; message: string }
> {
  const startedAt = Date.now()
  try {
    const prisma = getPrisma()
    await prisma.$queryRaw`SELECT 1`
    return { ok: true, latencyMs: Date.now() - startedAt }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}
