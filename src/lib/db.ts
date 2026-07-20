import { Prisma, PrismaClient } from '@prisma/client'

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

export const db =
  globalThis.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.prisma = db
}

/** Type of the interactive transaction client passed to db.$transaction(async (tx) => ...). */
export type TxClient = Prisma.TransactionClient
