import 'server-only'
import type { PrismaClient } from '@/generated/prisma/client'
import { listChains } from '@/lib/chains/registry'

/**
 * Mirror the static chain and protocol registries into the database.
 *
 * The registries in `src/lib` are the source of truth; these rows exist so
 * foreign keys resolve and so a pool can reference its protocol. Idempotent by
 * design — it runs before any write path rather than as a one-off seed script
 * that someone forgets on a fresh environment.
 */

let seededOnce = false

export async function ensureRegistrySeeded(prisma: PrismaClient): Promise<void> {
  // Cheap in-process guard. Correctness does not depend on it: every statement
  // below is an upsert, so a concurrent second call is harmless.
  if (seededOnce) return

  for (const chain of listChains()) {
    await prisma.chain.upsert({
      where: { chainId: chain.chainId },
      update: {
        key: chain.key,
        name: chain.name,
        nativeSymbol: chain.nativeSymbol,
        nativeDecimals: chain.nativeDecimals,
        explorerUrl: chain.explorerUrl,
        isEnabled: chain.isEnabled,
      },
      create: {
        chainId: chain.chainId,
        key: chain.key,
        name: chain.name,
        nativeSymbol: chain.nativeSymbol,
        nativeDecimals: chain.nativeDecimals,
        explorerUrl: chain.explorerUrl,
        isEnabled: chain.isEnabled,
      },
    })

    for (const deployment of chain.deployments) {
      const [name, version] = splitProtocolKey(deployment.protocolKey)
      await prisma.protocol.upsert({
        where: { key: deployment.protocolKey },
        update: { name, version },
        create: { key: deployment.protocolKey, name, version },
      })
    }
  }

  seededOnce = true
}

/** For tests, and for picking up a registry edit without a restart. */
export function resetRegistrySeedCache(): void {
  seededOnce = false
}

/** "uniswap-v3" -> ["Uniswap", "v3"] */
export function splitProtocolKey(key: string): [name: string, version: string] {
  const match = /^(.*)-(v\d+)$/.exec(key)
  if (!match) return [key, '1']
  const [, rawName = key, version = '1'] = match
  const name = rawName
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
  return [name, version]
}
