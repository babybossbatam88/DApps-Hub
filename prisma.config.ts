import 'node:process'
import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * Prisma 7 moves connection URLs out of schema.prisma.
 * `DATABASE_URL` is the pooled app connection; `DIRECT_URL` is the unpooled
 * connection Migrate needs on serverless Postgres (Neon/Supabase/RDS Proxy).
 */
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    // Migrate needs a DIRECT (unpooled) connection: PgBouncer-style poolers do
    // not support the advisory locks and DDL session state migrations require.
    // The app itself uses DATABASE_URL via the driver adapter in src/lib/db.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
})
