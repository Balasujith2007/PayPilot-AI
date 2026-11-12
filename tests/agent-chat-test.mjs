// Integration test for the PayPilot AI chat endpoint (Task 14).
//
// Usage:
//   1. Start the dev server:  npx next dev -p 3100
//   2. Run:                   node tests/agent-chat-test.mjs
//
// Environment is read from .env.local using Next.js' own loader (@next/env),
// so the test sees the same values the server does. The API key value is never
// printed — only whether it is present.
//
// Optional:
//   BASE_URL=http://localhost:3100   override the target server
//
// NOTE: this test process and the server must agree on GEMINI_API_KEY. Both
// load .env.local, so they normally do. To exercise the missing-key path,
// start the server without a key and run this script the same way, e.g.
//   $env:GEMINI_API_KEY=''; npx next dev -p 3101
//   $env:GEMINI_API_KEY=''; $env:BASE_URL='http://localhost:3101'; node tests/agent-chat-test.mjs

// @next/env is a bundled CommonJS module, so import it via the default export.
import nextEnv from "@next/env"

const { loadEnvConfig } = nextEnv

loadEnvConfig(process.cwd())

// Probe the common dev ports when BASE_URL is not given, so the test works
// whichever port the dev server picked.
const BASE_URL_CANDIDATES = process.env.BASE_URL
  ? [process.env.BASE_URL]
  : ["http://localhost:3100", "http://localhost:3001", "http://localhost:3000"]

let BASE_URL = BASE_URL_CANDIDATES[0].replace(/\/$/, "")
let ENDPOINT = `${BASE_URL}/api/agent/chat`

const API_KEY = process.env.GEMINI_API_KEY
const HAS_KEY = Boolean(API_KEY)
const MODEL = process.env.GEMINI_MODEL ?? "(unset — server default)"

const LIVE_ATTEMPTS = 3
const LIVE_TIMEOUT_MS = 90000

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass })
  console.log(`  ${pass ? "\u2713" : "\u2717"} ${name}${detail ? ` — ${detail}` : ""}`)
}

function assertNoKeyLeak(text, name) {
  const leaked = HAS_KEY && typeof text === "string" && text.includes(API_KEY)
  record(name, !leaked, leaked ? "API key found in response" : "")
}

async function postJson(body, raw, timeoutMs = 30000) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: raw ?? JSON.stringify(body),
      signal: controller.signal,
    })
    const text = await response.text()
    let json = null
    try {
      json = JSON.parse(text)
    } catch {
      /* non-JSON body */
    }
    return { status: response.status, json, text }
  } catch (error) {
    if (error?.name === "AbortError") {
      return { status: 0, json: null, text: "", timedOut: true }
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const base = candidate.replace(/\/$/, "")
    try {
      await fetch(base, { method: "HEAD" })
      BASE_URL = base
      ENDPOINT = `${base}/api/agent/chat`
      return true
    } catch {
      /* try the next candidate */
    }
  }
  return false
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// --- Section 1: request validation (always runs) ---
async function testValidation() {
  console.log("\n[1] Request validation")

  {
    const res = await postJson(null, "{ not json")
    record(
      "invalid JSON → 400 INVALID_REQUEST",
      res.status === 400 && res.json?.error?.code === "INVALID_REQUEST",
      `status ${res.status}`
    )
  }
  {
    const res = await postJson({})
    record(
      "missing messages → 400",
      res.status === 400 && res.json?.error?.code === "INVALID_REQUEST",
      `status ${res.status}`
    )
  }
  {
    const res = await postJson({ messages: [] })
    record("empty messages → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postJson({ messages: [{ role: "user", content: "a".repeat(2001) }] })
    record("oversized message → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const messages = Array.from({ length: 21 }, () => ({ role: "user", content: "hi" }))
    const res = await postJson({ messages })
    record("too many messages → 400", res.status === 400, `status ${res.status}`)
  }
}

// --- Section 2: fail-closed when no key is configured ---
async function testMissingKey() {
  console.log("\n[2] Configuration guard (no API key)")

  if (HAS_KEY) {
    console.log("  – skipped: an API key is configured for this environment")
    return
  }

  const res = await postJson({ messages: [{ role: "user", content: "Hello" }] })
  const ok = res.status === 503 && res.json?.error?.code === "AI_UNAVAILABLE"
  record(
    "no API key → 503 AI_UNAVAILABLE",
    ok,
    `status ${res.status}${res.json?.error?.code ? ` ${res.json.error.code}` : ""}`
  )

  if (!ok) {
    console.log("    note: this process found no key, but the target server may still")
    console.log("    have one — start the server without GEMINI_API_KEY to verify 503.")
  }
}

// --- Section 3: live generation (only when a key is configured) ---
async function testLiveGeneration() {
  console.log("\n[3] Live Gemini generation")

  if (!HAS_KEY) {
    console.log("  – skipped: no API key configured (fail-closed path covered above)")
    return
  }

  // Live generation can be slow or briefly unavailable when the provider is
  // under heavy demand, so retry a few times before recording a failure.
  let last = null
  let passed = false
  let passDetail = ""

  for (let attempt = 1; attempt <= LIVE_ATTEMPTS; attempt += 1) {
    const res = await postJson(
      { messages: [{ role: "user", content: "Say hello in three words." }] },
      undefined,
      LIVE_TIMEOUT_MS
    )
    last = res

    if (
      res.status === 200 &&
      typeof res.json?.data?.reply === "string" &&
      res.json.data.reply.trim().length > 0 &&
      typeof res.json?.data?.model === "string"
    ) {
      passed = true
      passDetail = `model ${res.json.data.model}`
      break
    }

    const retriable = res.timedOut || [429, 502, 503].includes(res.status)
    if (!retriable || attempt === LIVE_ATTEMPTS) break

    console.log(`  … attempt ${attempt}/${LIVE_ATTEMPTS} unavailable, retrying`)
    await sleep(4000 * attempt)
  }

  record(
    "valid request → 200 with non-empty reply",
    passed,
    passed
      ? passDetail
      : last?.timedOut
        ? `timed out after ${LIVE_TIMEOUT_MS / 1000}s`
        : `status ${last?.status} ${last?.json?.error?.code ?? ""}`
  )

  if (!passed) {
    console.log("    note: 502 PROVIDER_ERROR means the upstream Gemini API refused")
    console.log("    the call (overload or network) — it is not a route defect.")
  }

  if (last?.text) assertNoKeyLeak(last.text, "response does not leak API key")
}

async function main() {
  if (!(await resolveBaseUrl())) {
    console.error(`\n✗ Cannot reach any of: ${BASE_URL_CANDIDATES.join(", ")}`)
    console.error("  Start the dev server first, e.g.  npx next dev -p 3100")
    process.exit(1)
  }

  console.log(`\nPayPilot AI — /api/agent/chat  (${ENDPOINT})`)
  console.log(`API key present: ${HAS_KEY ? "yes" : "no"}   GEMINI_MODEL: ${MODEL}`)
  console.log("─".repeat(60))

  await testValidation()
  await testMissingKey()
  await testLiveGeneration()

  const failed = results.filter((r) => !r.pass)
  console.log("\n" + "═".repeat(60))
  console.log(`SUMMARY  ✓ ${results.length - failed.length} passed   ✗ ${failed.length} failed`)

  if (!HAS_KEY) {
    console.log("Live generation was NOT exercised (no GEMINI_API_KEY configured).")
  }

  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const f of failed) console.log(`  ✗ ${f.name}`)
  }
  console.log("═".repeat(60))

  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error("Test run failed:", error)
  process.exit(1)
})
