import { z } from 'zod'

/**
 * Environment validation.
 *
 * Two schemas, deliberately separate:
 *  - `publicEnv` is inlined into the browser bundle. It may contain nothing
 *    sensitive, by construction — there is no NEXT_PUBLIC_ variable for any
 *    credential anywhere in this project.
 *  - `serverEnv` is validated lazily on the server only. Importing it from a
 *    client component is a build error, which is the point.
 */

export type AppMode = 'demo' | 'live'

const publicSchema = z.object({
  NEXT_PUBLIC_APP_MODE: z.enum(['demo', 'live']).default('demo'),
})

// Must be a literal property access so Next can statically inline it.
export const publicEnv: { NEXT_PUBLIC_APP_MODE: AppMode } = publicSchema.parse({
  NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE,
})

export const appMode: AppMode = publicEnv.NEXT_PUBLIC_APP_MODE
export const isLiveMode = appMode === 'live'
export const isDemoMode = appMode === 'demo'

/** Accepts "true"/"1"/"yes" (case-insensitive); everything else is false. */
const booleanish = z
  .string()
  .optional()
  .transform((v) => ['true', '1', 'yes', 'on'].includes((v ?? '').trim().toLowerCase()))

const csvUrls = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.url()))

const serverSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

    DATABASE_URL: z.string().optional(),
    DIRECT_URL: z.string().optional(),

    BASE_RPC_URLS: csvUrls,
    BASESCAN_API_KEY: z.string().optional(),

    BINANCE_API_BASE_URL: z.url().default('https://api.binance.com'),
    BINANCE_ENABLE_ACCOUNT_READ: booleanish,
    BINANCE_ENCRYPTION_KEY: z.string().optional(),

    FEATURE_BINANCE_TRADING: booleanish,
    FEATURE_BACKGROUND_SYNC: booleanish,

    CRON_SECRET: z.string().optional(),
    AUTH_SECRET: z.string().optional(),
  })
  // ---- V1 security invariants. These are not warnings; they stop the boot. ----
  .refine((env) => env.FEATURE_BINANCE_TRADING === false, {
    message:
      'FEATURE_BINANCE_TRADING must be false. Live trading is out of scope for V1 and no order endpoint is implemented.',
    path: ['FEATURE_BINANCE_TRADING'],
  })
  .refine(
    (env) =>
      !env.BINANCE_ENABLE_ACCOUNT_READ ||
      (env.BINANCE_ENCRYPTION_KEY !== undefined &&
        Buffer.from(env.BINANCE_ENCRYPTION_KEY, 'base64').length === 32),
    {
      message:
        'BINANCE_ENABLE_ACCOUNT_READ requires BINANCE_ENCRYPTION_KEY to be a base64-encoded 32-byte key (openssl rand -base64 32).',
      path: ['BINANCE_ENCRYPTION_KEY'],
    },
  )
  .refine((env) => env.NODE_ENV !== 'production' || env.BASE_RPC_URLS.length > 0, {
    message: 'BASE_RPC_URLS must list at least one endpoint in production.',
    path: ['BASE_RPC_URLS'],
  })
  .refine((env) => env.NODE_ENV !== 'production' || Boolean(env.DATABASE_URL), {
    message: 'DATABASE_URL is required in production.',
    path: ['DATABASE_URL'],
  })

export type ServerEnv = z.infer<typeof serverSchema>

/** Any environment-shaped record — `process.env` in production, a literal in tests. */
export type EnvSource = Record<string, string | undefined>

let cached: ServerEnv | null = null

export class EnvironmentError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration:\n  - ${issues.join('\n  - ')}`)
    this.name = 'EnvironmentError'
  }
}

/**
 * Validate and cache the server environment. Throws `EnvironmentError` with all
 * problems at once, rather than failing on the first missing variable at 3am.
 */
export function getServerEnv(source: EnvSource = process.env): ServerEnv {
  if (cached && source === process.env) return cached
  const parsed = serverSchema.safeParse(source)
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `${i.path.join('.') || '(root)'}: ${i.message}`,
    )
    throw new EnvironmentError(issues)
  }
  if (source === process.env) cached = parsed.data
  return parsed.data
}

/** For tests. */
export function resetServerEnvCache(): void {
  cached = null
}

/**
 * Non-throwing variant for health endpoints, which need to *report* a bad
 * configuration rather than crash on it.
 */
export function tryGetServerEnv(
  source: EnvSource = process.env,
): { ok: true; env: ServerEnv } | { ok: false; issues: string[] } {
  try {
    return { ok: true, env: getServerEnv(source) }
  } catch (error) {
    if (error instanceof EnvironmentError) return { ok: false, issues: error.issues }
    return { ok: false, issues: [(error as Error).message] }
  }
}
