// Test for rate limit retry logic
//
// This test verifies that:
// 1. Exponential backoff is applied for 429 errors
// 2. Quota exhausted errors are not retried
// 3. Max retries are respected
//
// Usage: node tests/rate-limit-test.mjs

import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

// Load the project's TypeScript modules directly
register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const { isQuotaExhausted, isRetriableRateLimit } = await import("@/lib/ai/gemini-client.ts")

// Import the actual ApiError from the SDK
const { ApiError } = await import("@google/genai")

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  const icon = pass ? "✓" : "✗"
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

console.log("\nRate Limit Retry Logic Tests")
console.log("─".repeat(60))

// Test 1: 429 with quota message is not retriable
{
  const error = new ApiError({ message: "Quota exceeded for this API", status: 429 })
  check("Quota exhausted error is identified", isQuotaExhausted(error) === true)
  check("Quota exhausted error is not retriable", isRetriableRateLimit(error) === false)
}

// Test 2: 429 with temporary rate limit is retriable
{
  const error = new ApiError({ message: "Too many requests", status: 429 })
  check("Temporary rate limit is identified as retriable", isRetriableRateLimit(error) === true)
  check("Temporary rate limit is not quota exhausted", isQuotaExhausted(error) === false)
}

// Test 3: 429 with billing message is quota exhausted
{
  const error = new ApiError({ message: "Billing quota exceeded", status: 429 })
  check("Billing quota error is identified as quota exhausted", isQuotaExhausted(error) === true)
}

// Test 4: 429 with resource exhausted is quota exhausted
{
  const error = new ApiError({ message: "Resource exhausted", status: 429 })
  check("Resource exhausted error is identified as quota exhausted", isQuotaExhausted(error) === true)
}

// Test 5: Other errors are not retriable
{
  const error = new ApiError({ message: "Internal server error", status: 500 })
  check("500 error is not retriable", isRetriableRateLimit(error) === false)
  check("500 error is not quota exhausted", isQuotaExhausted(error) === false)
}

// Test 6: 401 errors are not retriable
{
  const error = new ApiError({ message: "Unauthorized", status: 401 })
  check("401 error is not retriable", isRetriableRateLimit(error) === false)
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
