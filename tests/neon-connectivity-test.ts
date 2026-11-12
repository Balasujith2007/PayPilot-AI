// Neon PostgreSQL connectivity test
import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

// Load environment variables
config({ path: ".env.local" })

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
})
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
  }
}

testConnection()
  .then((success) => {
    process.exit(success ? 0 : 1)
  })
  .catch(() => {
    process.exit(1)
  })
