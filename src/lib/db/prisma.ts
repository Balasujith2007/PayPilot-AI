import { PrismaClient } from "@prisma/client"

/**
 * Prisma Client singleton for Next.js.
 *
 * In development, this prevents multiple instances during hot reloading.
 * In production, a single instance is created and reused.
 *
 * This must be imported from server-side code only. Never import this in
 * client components or the connection string could leak to the browser.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
