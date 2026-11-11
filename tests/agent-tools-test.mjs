// Task 18 — Agent Tool Calling test suite.
//
// Deterministic tests import the server-side tool registry and the bounded
// tool loop directly (see tests/ts-alias-loader.mjs) and drive them with
// scripted/mocked Gemini responses, so they need no API key and no network.
//
// The last section exercises the live /api/agent/chat endpoint end-to-end and
// is skipped automatically when no GEMINI_API_KEY is configured.
//
//   node tests/agent-tools-test.mjs
//
// Never prints the API key or any request payload.
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

import nextEnv from "@next/env"

const { loadEnvConfig } = nextEnv

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
loadEnvConfig(PROJECT_ROOT)

// Load the project's TypeScript modules directly.
register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const { executeAgentTool, getAgentTool, AGENT_TOOL_DECLARATIONS, AGENT_TOOL_NAMES, AGENT_MAX_TOOL_CALLS, AGENT_MAX_TOOL_ROUNDS } =
  await import("@/lib/ai/tools/index.ts")
const { runToolLoop } = await import("@/lib/ai/tool-loop.ts")
const { productRepository } = await import("@/lib/repositories/index.ts")
const { siteConfig } = await import("@/lib/config.ts")

const API_KEY = process.env.GEMINI_API_KEY
const HAS_KEY = Boolean(API_KEY)
const LIVE_TIMEOUT_MS = 90_000

const BASE_URL_CANDIDATES = process.env.BASE_URL
  ? [process.env.BASE_URL]
  : ["http://localhost:3100", "http://localhost:3001", "http://localhost:3000"]

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  const icon = pass ? "✓" : "✗"
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

function assertNoKeyLeak(label, text) {
  const leaked = HAS_KEY && typeof text === "string" && text.includes(API_KEY)
  record(`${label}: no API key leak`, !leaked, leaked ? "API key found in output" : "")
}

/** A model whose responses are supplied up front. */
function scriptedModel(turns) {
  let index = 0
  const requests = []
  return {
    requests,
    async generate(request) {
      requests.push(request)
      const turn = turns[Math.min(index, turns.length - 1)]
      index += 1
      return typeof turn === "function" ? turn(request) : turn
    },
  }
}

function call(name, args = {}) {
  return executeAgentTool(name, args)
}

// ---------------------------------------------------------------------------
// 1. search_products
// ---------------------------------------------------------------------------
async function testSearchProducts() {
  const result = await call("search_products", { query: "headphones" })

  check("search_products: returns a success result", result.ok === true)
  if (!result.ok) return

  check(
    "search_products: finds matching products",
    result.data.resultCount > 0,
    `resultCount=${result.data.resultCount}`
  )
  check(
    "search_products: every product comes from the server catalog",
    result.data.products.every((p) => typeof p.id === "string" && p.id.startsWith("prod-"))
  )
  check(
    "search_products: prices match the repository",
    await (async () => {
      for (const product of result.data.products) {
        const fromCatalog = await productRepository.getById(product.id)
        if (!fromCatalog) return false
        if (fromCatalog.variants[0]?.price !== product.price) return false
      }
      return true
    })(),
    "a returned price did not match the catalog"
  )

  const byCategory = await call("search_products", {
    query: "wireless",
    category: "electronics",
  })
  check("search_products: honours an optional category", byCategory.ok === true)

  const unknownCategory = await call("search_products", { query: "lamp", category: "not-a-category" })
  check(
    "search_products: reports an unknown category instead of guessing",
    unknownCategory.ok === true && unknownCategory.data.categoryMatched === false
  )
}

// ---------------------------------------------------------------------------
// 2. compare_products
// ---------------------------------------------------------------------------
async function testCompareProducts() {
  const result = await call("compare_products", { productIds: ["prod-1", "prod-2"] })

  check("compare_products: returns a success result", result.ok === true)
  if (!result.ok) return

  check("compare_products: compares both products", result.data.comparedCount === 2)
  check(
    "compare_products: returns structured attribute rows",
    Array.isArray(result.data.rows) &&
      result.data.rows.length > 0 &&
      result.data.rows.every(
        (row) =>
          typeof row.attribute === "string" &&
          typeof row.same === "boolean" &&
          typeof row.values === "object"
      )
  )
  check(
    "compare_products: row values are keyed by product id",
    result.data.rows.every((row) => Object.keys(row.values).sort().join(",") === "prod-1,prod-2")
  )
  check(
    "compare_products: highlights the cheapest product",
    ["prod-1", "prod-2"].includes(result.data.highlights.cheapest?.id)
  )
}

// ---------------------------------------------------------------------------
// 3. check_budget
// ---------------------------------------------------------------------------
async function testCheckBudget() {
  const result = await call("check_budget", { budget: 8000 })

  check("check_budget: returns a success result", result.ok === true)
  if (!result.ok) return

  check(
    "check_budget: every eligible product is within budget",
    result.data.eligible.every((p) => p.price <= 8000),
    `prices=${result.data.eligible.map((p) => p.price).join(",")}`
  )
  check(
    "check_budget: totals reuse the storefront shipping and tax rules",
    result.data.eligible.every((p) => {
      const expectedShipping = p.price >= siteConfig.freeShippingThreshold ? 0 : 599
      const expectedTax = Math.round(p.price * siteConfig.taxRate)
      return (
        p.estimatedShipping === expectedShipping &&
        p.estimatedTax === expectedTax &&
        p.estimatedTotal === p.price + expectedShipping + expectedTax
      )
    }),
    "estimated totals did not match computeCartTotals"
  )
  check("check_budget: returns recommendations", Array.isArray(result.data.recommendations.topPicks))

  const tiny = await call("check_budget", { budget: 1, requirements: "headphones" })
  check(
    "check_budget: suggests the next step up when nothing fits",
    tiny.ok === true && tiny.data.eligibleCount === 0 && tiny.data.recommendations.nextStepUp !== null
  )
}

// ---------------------------------------------------------------------------
// 4. propose_cart_action
// ---------------------------------------------------------------------------
async function testProposeCartAction() {
  const result = await call("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 2 }],
  })

  check("propose_cart_action: returns a success result", result.ok === true)
  if (!result.ok) return

  const data = result.data
  check("propose_cart_action: marks the proposal as not applied", data.applied === false)
  check("propose_cart_action: requires explicit user approval", data.requiresApproval === true)
  check(
    "propose_cart_action: never starts a payment",
    data.paymentInitiated === false &&
      !JSON.stringify(data).toLowerCase().includes("paypal")
  )
  check("propose_cart_action: describes itself as a proposal", data.status === "proposed")

  const catalogProduct = await productRepository.getById("prod-1")
  const expectedUnitPrice = catalogProduct.variants[0].price
  check(
    "propose_cart_action: uses the server-side price, not a client-supplied one",
    data.items[0].unitPrice === expectedUnitPrice && data.items[0].lineTotal === expectedUnitPrice * 2,
    `unitPrice=${data.items[0].unitPrice} expected=${expectedUnitPrice}`
  )
  check(
    "propose_cart_action: totals match the storefront summary",
    data.summary.subtotal === expectedUnitPrice * 2 &&
      data.summary.total ===
        data.summary.subtotal + data.summary.shipping + data.summary.tax
  )

  const spoofed = await call("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 1, price: 1, variantName: "Free" }],
  })
  check(
    "propose_cart_action: ignores caller-supplied price fields",
    spoofed.ok === true && spoofed.data.items[0].unitPrice === expectedUnitPrice
  )

  const unknownVariant = await call("propose_cart_action", {
    items: [{ productId: "prod-1", variantId: "var-nope", quantity: 1 }],
  })
  check(
    "propose_cart_action: rejects an unknown variant",
    unknownVariant.ok === false && unknownVariant.error.code === "NOT_FOUND"
  )
}

// ---------------------------------------------------------------------------
// 5. Invalid tool names
// ---------------------------------------------------------------------------
async function testInvalidToolNames() {
  const unknown = await call("delete_all_products", {})
  check(
    "invalid tool name: rejects an unregistered tool",
    unknown.ok === false && unknown.error.code === "UNKNOWN_TOOL"
  )

  for (const name of ["__proto__", "constructor", "prototype", "searchProducts", "SEARCH_PRODUCTS"]) {
    const result = await call(name, { query: "headphones" })
    check(
      `invalid tool name: rejects "${name}"`,
      result.ok === false && result.error.code === "UNKNOWN_TOOL"
    )
  }

  for (const name of [undefined, null, 42, {}, []]) {
    const result = await executeAgentTool(name, { query: "x" })
    check(
      `invalid tool name: rejects non-string name ${JSON.stringify(name)}`,
      result.ok === false && result.error.code === "UNKNOWN_TOOL"
    )
  }

  check(
    "invalid tool name: every declared name is registered",
    AGENT_TOOL_DECLARATIONS[0].functionDeclarations.every((d) => typeof getAgentTool(d.name) === "object")
  )
  check(
    "invalid tool name: declarations expose exactly the four tools",
    AGENT_TOOL_NAMES.join(",") === "search_products,compare_products,check_budget,propose_cart_action",
    AGENT_TOOL_NAMES.join(",")
  )
}

// ---------------------------------------------------------------------------
// 6. Invalid arguments
// ---------------------------------------------------------------------------
async function testInvalidArguments() {
  const cases = [
    ["search_products", { query: 123 }],
    ["search_products", {}],
    ["search_products", { query: "" }],
    ["search_products", { query: "ok", limit: 9999 }],
    ["compare_products", { productIds: ["prod-1"] }],
    ["compare_products", { productIds: [] }],
    ["compare_products", {}],
    ["check_budget", { budget: -5 }],
    ["check_budget", {}],
    ["check_budget", { budget: "not-a-number" }],
    ["propose_cart_action", { items: [] }],
    ["propose_cart_action", { items: [{ productId: "prod-1", quantity: 0 }] }],
    ["propose_cart_action", { items: [{ productId: "prod-1", quantity: 999 }] }],
    ["propose_cart_action", { items: [{ quantity: 1 }] }],
  ]

  for (const [tool, args] of cases) {
    const result = await executeAgentTool(tool, args)
    check(
      `invalid arguments: ${tool} rejects ${JSON.stringify(args)}`,
      result.ok === false && result.error.code === "INVALID_ARGUMENTS",
      `got ${result.ok ? "ok" : result.error.code}`
    )
  }

  const coerced = await call("search_products", { query: "coffee", limit: "3" })
  check(
    "invalid arguments: numeric strings are coerced, not rejected",
    coerced.ok === true && coerced.data.products.length <= 3
  )
}

// ---------------------------------------------------------------------------
// 7. Unknown product IDs
// ---------------------------------------------------------------------------
async function testUnknownProductIds() {
  const compare = await call("compare_products", { productIds: ["prod-999", "prod-1"] })
  check(
    "unknown product id: compare fails when fewer than two products resolve",
    compare.ok === false && compare.error.code === "NOT_FOUND"
  )

  const partial = await call("compare_products", {
    productIds: ["prod-1", "prod-2", "prod-999"],
  })
  check(
    "unknown product id: compare reports the missing id",
    partial.ok === true && partial.data.notFound.includes("prod-999"),
    JSON.stringify(partial.ok ? partial.data.notFound : partial.error)
  )

  const cart = await call("propose_cart_action", {
    items: [{ productId: "prod-999", quantity: 1 }],
  })
  check(
    "unknown product id: cart proposal fails when nothing resolves",
    cart.ok === false && cart.error.code === "NOT_FOUND"
  )

  const mixed = await call("propose_cart_action", {
    items: [
      { productId: "prod-1", quantity: 1 },
      { productId: "prod-999", quantity: 1 },
    ],
  })
  check(
    "unknown product id: cart proposal keeps valid lines and reports the rest",
    mixed.ok === true &&
      mixed.data.items.length === 1 &&
      mixed.data.rejected.some((r) => r.productId === "prod-999" && r.code === "NOT_FOUND")
  )
}

// ---------------------------------------------------------------------------
// 8. Tool execution limits
// ---------------------------------------------------------------------------
async function testExecutionLimits() {
  const model = scriptedModel([
    { functionCalls: [{ name: "search_products", args: { query: "headphones" } }] },
    { functionCalls: [{ name: "search_products", args: { query: "speaker" } }] },
    { functionCalls: [{ name: "search_products", args: { query: "coffee" } }] },
    { functionCalls: [{ name: "search_products", args: { query: "bag" } }] },
    { text: "Here is what I found." },
  ])

  const result = await runToolLoop({
    model,
    messages: [{ role: "user", text: "keep searching forever" }],
    tools: AGENT_TOOL_DECLARATIONS,
    executeTool: executeAgentTool,
    maxToolCalls: 2,
    maxRounds: 4,
    fallbackMessage: "stopped",
  })

  check(
    "execution limits: never exceeds maxToolCalls",
    result.toolCalls.length === 2,
    `executed=${result.toolCalls.length}`
  )
  check("execution limits: reports the limit was reached", result.limitReached === true)
  check(
    "execution limits: model round trips stay within maxRounds + 1",
    model.requests.length <= 5,
    `requests=${model.requests.length}`
  )
  check("execution limits: still returns a user-facing answer", result.text.length > 0)

  // Every function call must get a matching response or the next Gemini
  // request would be rejected.
  const lastRequest = model.requests[model.requests.length - 1]
  const callIds = lastRequest.contents
    .flatMap((c) => c.parts ?? [])
    .filter((p) => p.functionCall)
    .map((p) => p.functionCall.id)
  const responseIds = lastRequest.contents
    .flatMap((c) => c.parts ?? [])
    .filter((p) => p.functionResponse)
    .map((p) => p.functionResponse.id)
  check(
    "execution limits: every function call is answered",
    callIds.length > 0 && callIds.every((id) => responseIds.includes(id)),
    `calls=${callIds.length} responses=${responseIds.length}`
  )
  assertNoKeyLeak("execution limits", JSON.stringify(result))
}

// ---------------------------------------------------------------------------
// 9. Tool failure handling
// ---------------------------------------------------------------------------
async function testToolFailure() {
  // (a) A tool implementation that throws must not leak its message.
  const tool = getAgentTool("search_products")
  const originalExecute = tool.execute
  tool.execute = async () => {
    throw new Error("boom: /srv/app/secret/config.json")
  }
  const thrown = await executeAgentTool("search_products", { query: "headphones" })
  tool.execute = originalExecute

  check(
    "tool failure: a throwing tool returns TOOL_FAILED",
    thrown.ok === false && thrown.error.code === "TOOL_FAILED"
  )
  check(
    "tool failure: internal error text is not exposed",
    thrown.ok === false && !thrown.error.message.includes("secret") && !thrown.error.message.includes("/srv/")
  )

  // (b) A failed tool result is fed back to the model and the loop still
  //     produces a final answer.
  const model = scriptedModel([
    { functionCalls: [{ id: "c1", name: "check_budget", args: { budget: 8000 } }] },
    { text: "I couldn't check that budget, but I can help another way." },
  ])

  const result = await runToolLoop({
    model,
    messages: [{ role: "user", text: "what fits $80?" }],
    tools: AGENT_TOOL_DECLARATIONS,
    executeTool: async () => ({
      ok: false,
      tool: "check_budget",
      error: { code: "TOOL_FAILED", message: "check_budget could not complete the request." },
    }),
    maxToolCalls: 4,
    maxRounds: 4,
    fallbackMessage: "fallback",
  })

  const failureResponse = model.requests[1].contents
    .flatMap((c) => c.parts ?? [])
    .find((p) => p.functionResponse)
    ?.functionResponse

  check("tool failure: the loop records the failed call", result.toolCalls[0]?.ok === false)
  check(
    "tool failure: the model receives the error instead of output",
    Boolean(failureResponse?.response?.error) && failureResponse.response.output === undefined
  )
  check(
    "tool failure: the agent still returns an answer",
    result.text === "I couldn't check that budget, but I can help another way."
  )

  // (c) An unregistered tool requested by the model is blocked.
  const blockedModel = scriptedModel([
    { functionCalls: [{ id: "x1", name: "transfer_funds", args: { amount: 999 } }] },
    { text: "I can't do that." },
  ])
  const blocked = await runToolLoop({
    model: blockedModel,
    messages: [{ role: "user", text: "transfer funds" }],
    tools: AGENT_TOOL_DECLARATIONS,
    executeTool: executeAgentTool,
    maxToolCalls: 4,
    maxRounds: 4,
    fallbackMessage: "fallback",
  })

  check("tool failure: an unregistered tool is blocked", blocked.blockedCall === true)
  check(
    "tool failure: the blocked call is reported as not ok",
    blocked.toolCalls.every((c) => c.name === "transfer_funds" && c.ok === false)
  )
}

// ---------------------------------------------------------------------------
// 10. Mocked Gemini tool-calling response and final answer
// ---------------------------------------------------------------------------
async function testMockedToolCalling() {
  const model = scriptedModel([
    {
      content: {
        role: "model",
        parts: [{ functionCall: { id: "fc-1", name: "search_products", args: { query: "headphones" } } }],
      },
      functionCalls: [{ id: "fc-1", name: "search_products", args: { query: "headphones" } }],
    },
    { content: { role: "model", parts: [{ text: "We have headphones from $79.99." }] }, text: "We have headphones from $79.99." },
  ])

  const result = await runToolLoop({
    model,
    messages: [{ role: "user", text: "Do you have any headphones?" }],
    tools: AGENT_TOOL_DECLARATIONS,
    executeTool: executeAgentTool,
    maxToolCalls: AGENT_MAX_TOOL_CALLS,
    maxRounds: AGENT_MAX_TOOL_ROUNDS,
    fallbackMessage: "fallback",
  })

  check(
    "mocked tool calling: the model's tool request is executed",
    result.toolCalls.length === 1 && result.toolCalls[0].name === "search_products" && result.toolCalls[0].ok
  )
  check(
    "mocked tool calling: the final answer is returned",
    result.text === "We have headphones from $79.99.",
    result.text
  )
  check("mocked tool calling: uses one round trip per turn", result.rounds === 2)
  check("mocked tool calling: no limit was hit", result.limitReached === false)

  const toolOutput = model.requests[1].contents
    .flatMap((c) => c.parts ?? [])
    .find((p) => p.functionResponse)?.functionResponse?.response?.output
  check(
    "mocked tool calling: catalog results are sent back to the model",
    toolOutput?.resultCount > 0 && Array.isArray(toolOutput?.products)
  )
  check(
    "mocked tool calling: the tool loop sends the tool declarations",
    model.requests[0].tools?.[0]?.functionDeclarations?.length === 4
  )
  assertNoKeyLeak("mocked tool calling", JSON.stringify(result) + JSON.stringify(model.requests))
}

// ---------------------------------------------------------------------------
// Live end-to-end (skipped without a server-side key)
// ---------------------------------------------------------------------------
async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const base = candidate.replace(/\/$/, "")
    try {
      const response = await fetch(`${base}/api/agent/chat`, { method: "HEAD" })
      if (response.status < 500) return base
    } catch {
      // try the next candidate
    }
  }
  return null
}

async function testLiveAgent(baseUrl) {
  if (!HAS_KEY) {
    console.log("\n… Live Gemini test skipped (no GEMINI_API_KEY configured)")
    return
  }

  const body = {
    messages: [{ role: "user", content: "Do you have any headphones under $100?" }],
  }

  let lastFailure = "no attempt made"
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), LIVE_TIMEOUT_MS)
    try {
      const response = await fetch(`${baseUrl}/api/agent/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      clearTimeout(timer)

      const text = await response.text()
      assertNoKeyLeak("live agent", text)

      if (response.status === 200) {
        const payload = JSON.parse(text)
        check("live agent: returns 200", true)
        check(
          "live agent: reply is a non-empty string",
          typeof payload.data?.reply === "string" && payload.data.reply.length > 0
        )
        check("live agent: reports the model", typeof payload.data?.model === "string")
        check(
          "live agent: reports tool calls as a name/ok list",
          Array.isArray(payload.data?.toolCalls) &&
            payload.data.toolCalls.every((c) => typeof c.name === "string" && typeof c.ok === "boolean")
        )
        check(
          "live agent: answers a catalog question with a tool",
          payload.data.toolCalls.length > 0,
          `toolCalls=${JSON.stringify(payload.data?.toolCalls)}`
        )
        return
      }

      lastFailure = `status ${response.status}`
      if (![429, 502, 503].includes(response.status)) break
    } catch (error) {
      clearTimeout(timer)
      lastFailure = error?.name === "AbortError" ? "timeout" : String(error?.message ?? error)
    }
  }

  record("live agent: returns 200 with a tool-backed answer", false, lastFailure)
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Task 18 — Agent tool calling tests\n" + "─".repeat(60))

  console.log("\nTool registry (deterministic, mocked)")
  await testSearchProducts()
  await testCompareProducts()
  await testCheckBudget()
  await testProposeCartAction()
  await testInvalidToolNames()
  await testInvalidArguments()
  await testUnknownProductIds()
  await testExecutionLimits()
  await testToolFailure()
  await testMockedToolCalling()

  console.log("\nLive endpoint")
  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    record("live agent: dev server reachable", false, `no server at ${BASE_URL_CANDIDATES.join(", ")}`)
  } else {
    record("live agent: dev server reachable", true, baseUrl)
    await testLiveAgent(baseUrl)
  }

  const failed = results.filter((r) => !r.pass)
  console.log("\n" + "─".repeat(60))
  console.log(`SUMMARY: ${results.length - failed.length} passed, ${failed.length} failed`)
  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const failure of failed) console.log(`  ✗ ${failure.name} — ${failure.detail}`)
  }

  // Use exitCode rather than process.exit(): tearing the process down while
  // keep-alive sockets are still closing trips a libuv assertion on Windows.
  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error("Test run crashed:", error)
  process.exitCode = 1
})
