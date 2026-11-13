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
 * **Connection strategy for Neon PostgreSQL:**
 *
 *   DATABASE_URL  → pooled endpoint  (`-pooler` hostname): used for runtime
 *                   queries in the long-running Next.js server.  Neon's
 *                   connection pooler handles cold starts, connection limits,
 *                   and idle-timeout recycling transparently.
 *
 *   DIRECT_URL   → direct endpoint  (no `-pooler`): used only by
 *                   `prisma migrate` / `prisma db push` which need a
 *                   persistent session for DDL locks.  NOT used here.
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
    // Use the pooled URL for runtime; fall back to DIRECT_URL only if
    // DATABASE_URL is completely absent (rare misconfiguration).
    connectionString: process.env.DATABASE_URL ?? process.env.DIRECT_URL,
    ssl: { rejectUnauthorized: false },
    max: 10,
    // Neon databases sleep after inactivity. Allow enough time for a cold
    // start (typically 1-3 s) plus network latency.
    connectionTimeoutMillis: 15_000,
    // Release idle connections before Neon's proxy closes them (~5 min).
    // This prevents the pool from handing out a dead socket.
    idleTimeoutMillis: 120_000,
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
