import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@prisma/client"
import pg from "pg"

/**
 * Prisma 7 singleton for Next.js — uses the PrismaPg driver adapter.
 *
 * Prisma 7 requires a driver adapter; it no longer reads DATABASE_URL from
 * the schema automatically.  We use a pg.Pool so the connection is reused
 * across hot-reloads in development.
 *
 * Server-side only — never import this in Client Components.
 */

const globalForPrisma = globalThis as unknown as {
  prismaPool: pg.Pool | undefined
  prisma: PrismaClient | undefined
}

const pool =
  globalForPrisma.prismaPool ??
  new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
  })

const adapter = new PrismaPg(pool)

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaPool = pool
  globalForPrisma.prisma = prisma
}
