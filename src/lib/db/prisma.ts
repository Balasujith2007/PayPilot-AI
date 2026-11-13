import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

/**
 * Prisma Client singleton for Next.js with PrismaPg driver adapter.
 *
 * This must be imported from server-side code only. Never import this in
 * client components or the connection string could leak to the browser.
 */

// Ensure environment variables are loaded if running outside Next.js
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("dotenv").config()
  } catch {
    // dotenv might not be needed in Next.js runtime
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pool: Pool | undefined
}

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DIRECT_URL || process.env.DATABASE_URL

  const pool =
    globalForPrisma.pool ??
    new Pool({
      connectionString,
      connectionTimeoutMillis: 30000,
    })

  // Prevent uncaught error crashes on idle connection drops or build-time offline workers
  pool.on("error", (err) => {
    console.warn("PostgreSQL pool background error:", err?.message || err)
  })

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool
  }

  const adapter = new PrismaPg(pool)

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
