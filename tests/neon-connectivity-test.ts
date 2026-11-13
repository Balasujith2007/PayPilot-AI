// Neon PostgreSQL connectivity test
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import pg from "pg"

// Load environment variables
config({ path: ".env.local" })

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function testConnection() {
  try {
    // Simple verification query
    const result = await prisma.$queryRaw`SELECT 1 as connected`
    console.log("✓ Neon PostgreSQL connection successful")
    console.log("Connection verified:", result)
    return true
  } catch (error) {
    console.error("✗ Neon PostgreSQL connection failed:", error)
    return false
  } finally {
    await prisma.$disconnect()
    await pool.end()
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch(() => {
    process.exit(1)
  })
