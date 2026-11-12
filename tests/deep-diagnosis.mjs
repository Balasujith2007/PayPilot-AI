// Deep Neon ECONNREFUSED diagnosis
import { config } from "dotenv"
import dns from "node:dns"
import net from "node:net"

// Load environment variables
config({ path: ".env.local" })

const DATABASE_URL = process.env.DATABASE_URL
const DIRECT_URL = process.env.DIRECT_URL

function extractHostname(url) {
  if (!url) return null
  try {
    // Parse postgresql://user:pass@host:port/db
    const match = url.match(/@([^\/:]+)/)
    return match ? match[1] : null
  } catch {
    return null
  }
}

function extractPort(url) {
  if (!url) return null
  try {
    // Extract port from host:port or default to 5432
    const hostPart = url.match(/@([^\/]+)/)?.[1]
    if (!hostPart) return 5432
    const portMatch = hostPart.match(/:(\d+)/)
    return portMatch ? parseInt(portMatch[1], 10) : 5432
  } catch {
    return 5432
  }
}

async function testDNS(hostname) {
  try {
    const addresses = await dns.promises.resolve4(hostname)
    return { success: true, addresses }
  } catch (error) {
    return { success: false, error: error.code }
  }
}

async function testTCP(hostname, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(5000)

    socket.on("connect", () => {
      socket.destroy()
      resolve({ success: true })
    })

    socket.on("timeout", () => {
      socket.destroy()
      resolve({ success: false, error: "ETIMEDOUT" })
    })

    socket.on("error", (error) => {
      socket.destroy()
      resolve({ success: false, error: error.code })
    })

    socket.connect(port, hostname)
  })
}

async function testPostgresDirect(connectionString) {
  const { Client } = await import("pg")
  const client = new Client({ connectionString })

  try {
    await client.connect()
    await client.query("SELECT 1")
    await client.end()
    return { success: true }
  } catch (error) {
    await client.end().catch(() => {})
    return { success: false, error: error.code, message: error.message }
  }
}

async function main() {
  console.log("\n=== Deep Neon ECONNREFUSED Diagnosis ===\n")

  // 1. Configuration Analysis
  console.log("1. Configuration Analysis")
  console.log("─".repeat(60))
  console.log(`DATABASE_URL present: ${Boolean(DATABASE_URL)}`)
  console.log(`DIRECT_URL present: ${Boolean(DIRECT_URL)}`)

  const dbHostname = extractHostname(DATABASE_URL)
  const directHostname = extractHostname(DIRECT_URL)
  const dbPort = extractPort(DATABASE_URL)
  const directPort = extractPort(DIRECT_URL)

  console.log(`DATABASE_URL hostname: ${dbHostname}`)
  console.log(`DATABASE_URL port: ${dbPort}`)
  console.log(`DIRECT_URL hostname: ${directHostname}`)
  console.log(`DIRECT_URL port: ${directPort}`)

  // 2. DNS Resolution
  console.log("\n2. DNS Resolution")
  console.log("─".repeat(60))

  if (dbHostname) {
    const dbDns = await testDNS(dbHostname)
    console.log(`DATABASE_URL DNS (${dbHostname}): ${dbDns.success ? "✓" : "✗"} ${dbDns.success ? dbDns.addresses.join(", ") : dbDns.error}`)
  }

  if (directHostname) {
    const directDns = await testDNS(directHostname)
    console.log(`DIRECT_URL DNS (${directHostname}): ${directDns.success ? "✓" : "✗"} ${directDns.success ? directDns.addresses.join(", ") : directDns.error}`)
  }

  // 3. TCP Connectivity
  console.log("\n3. TCP Connectivity")
  console.log("─".repeat(60))

  if (dbHostname && dbPort) {
    const dbTcp = await testTCP(dbHostname, dbPort)
    console.log(`DATABASE_URL TCP (${dbHostname}:${dbPort}): ${dbTcp.success ? "✓" : "✗"} ${dbTcp.success ? "Connected" : dbTcp.error}`)
  }

  if (directHostname && directPort) {
    const directTcp = await testTCP(directHostname, directPort)
    console.log(`DIRECT_URL TCP (${directHostname}:${directPort}): ${directTcp.success ? "✓" : "✗"} ${directTcp.success ? "Connected" : directTcp.error}`)
  }

  // 4. Direct PostgreSQL Test
  console.log("\n4. Direct PostgreSQL Connection Test")
  console.log("─".repeat(60))

  if (DIRECT_URL) {
    const pgResult = await testPostgresDirect(DIRECT_URL)
    console.log(`DIRECT_URL PostgreSQL test: ${pgResult.success ? "✓" : "✗"}`)
    if (!pgResult.success) {
      console.log(`  Error code: ${pgResult.error}`)
      console.log(`  Error message: ${pgResult.message}`)
    }
  }

  // 5. Prisma Adapter Analysis
  console.log("\n5. Prisma Adapter Configuration")
  console.log("─".repeat(60))
  console.log(`Prisma adapter using: ${process.env.DIRECT_URL ? "DIRECT_URL" : "DATABASE_URL"}`)
  console.log(`Adapter target: ${process.env.DIRECT_URL || process.env.DATABASE_URL ? "Present" : "Missing"}`)

  console.log("\n=== Diagnosis Complete ===\n")
}

main().catch((error) => {
  console.error("Diagnosis failed:", error)
  process.exit(1)
})
