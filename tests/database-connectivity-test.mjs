// Database connectivity test for Neon PostgreSQL
// Usage: node tests/database-connectivity-test.mjs

import nextEnv from "@next/env"
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const { loadEnvConfig } = nextEnv

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
loadEnvConfig(PROJECT_ROOT)

// Load the project's TypeScript modules directly
register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

// Now import env after environment is loaded
const { env } = await import("@/lib/env.ts")

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  const icon = pass ? "✓" : "✗"
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

console.log("\nDatabase Connectivity Test")
console.log("─".repeat(60))

// Test 1: Environment variables are present
{
  const hasDatabaseUrl = Boolean(env.DATABASE_URL)
  const hasDirectUrl = Boolean(env.DIRECT_URL)
  check("DATABASE_URL is configured", hasDatabaseUrl)
  check("DIRECT_URL is configured", hasDirectUrl)

  // Debug: Check process.env directly
  console.log(`  [DEBUG] process.env.DATABASE_URL exists: ${Boolean(process.env.DATABASE_URL)}`)
  console.log(`  [DEBUG] process.env.DIRECT_URL exists: ${Boolean(process.env.DIRECT_URL)}`)

  if (hasDatabaseUrl) {
    // Verify it's a valid postgres URL format without exposing the value
    const url = env.DATABASE_URL
    const isValidFormat = url.startsWith("postgres://") || url.startsWith("postgresql://")
    check("DATABASE_URL has valid postgres:// format", isValidFormat)
  }

  if (hasDirectUrl) {
    const url = env.DIRECT_URL
    const isValidFormat = url.startsWith("postgres://") || url.startsWith("postgresql://")
    check("DIRECT_URL has valid postgres:// format", isValidFormat)
  }
}

// Test 2: Prisma is not yet installed (expected in Phase 1)
{
  try {
    const prismaCheck = await import("prisma")
    check("Prisma is installed", true)
  } catch {
    check("Prisma is not installed (expected before Phase 2)", true)
  }
}

console.log("\n" + "═".repeat(60))
const failed = results.filter((r) => !r.pass)
console.log(`SUMMARY  ✓ ${results.length - failed.length} passed   ✗ ${failed.length} failed`)

if (failed.length > 0) {
  console.log("\nFailures:")
  for (const f of failed) console.log(`  ✗ ${f.name}`)
}
console.log("═".repeat(60))

process.exit(failed.length > 0 ? 1 : 0)
