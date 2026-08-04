import { Prisma, PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
  // eslint-disable-next-line no-var
  var prismaShutdownHooksRegistered: boolean | undefined
}

/**
 * Prisma's query engine keeps its own internal connection pool to Postgres —
 * there's no separate `pg.Pool` to wire up. `connection_limit` caps how many
 * connections THIS process's pool may open; `pool_timeout` is how long a
 * query waits for a free connection before failing fast (instead of piling
 * up indefinitely) when the pool is saturated during a traffic spike.
 *
 * Defaults are sized for a single small-to-medium Railway container (2-8
 * vCPU) sharing a Postgres instance whose own `max_connections` is typically
 * ~100. If this app ever runs as multiple Railway replicas, each replica
 * gets its OWN pool of this size — multiply DATABASE_CONNECTION_LIMIT by the
 * replica count and make sure the total stays comfortably under Postgres's
 * max_connections (leave headroom for `prisma migrate`, `db:studio`, and any
 * other clients). Tune via env rather than editing this file.
 */
function buildPooledDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL
  if (!rawUrl) throw new Error('DATABASE_URL is not set.')

  const url = new URL(rawUrl)
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', process.env.DATABASE_CONNECTION_LIMIT ?? '10')
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', process.env.DATABASE_POOL_TIMEOUT ?? '20')
  }
  return url.toString()
}

export const db =
  globalThis.prisma ??
  new PrismaClient({
    datasources: { db: { url: buildPooledDatabaseUrl() } },
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

// Release every pooled connection back cleanly on shutdown/redeploy instead
// of leaving them to time out on the Postgres side. Guarded by a global flag
// so Next.js dev's hot-reload doesn't stack a new listener on every reload.
if (!globalThis.prismaShutdownHooksRegistered) {
  globalThis.prismaShutdownHooksRegistered = true
  const shutdown = () => {
    void db.$disconnect()
  }
  process.once('SIGTERM', shutdown)
  process.once('SIGINT', shutdown)
}

/** Type of the interactive transaction client passed to db.$transaction(async (tx) => ...). */
export type TxClient = Prisma.TransactionClient
