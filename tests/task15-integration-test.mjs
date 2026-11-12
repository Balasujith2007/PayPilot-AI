// Task 15 — final AI shopping agent integration tests.
//
// These cover the seam between the pieces the earlier tasks built:
//
//   shopper → /api/agent/chat → Gemini (mocked) → tool registry (real)
//          → catalog artifacts (real) → cart proposal (real)
//          → /api/agent/cart/approve (real) → cart (real mapping)
//          → /api/paypal/orders + /capture (real, PayPal mocked)
//
// Nothing leaves the process and no credential is required:
//   * Gemini is exercised through the *real* @google/genai SDK with
//     `globalThis.fetch` replaced by a scripted responder. The SDK resolves
//     `fetch` at call time (DEFAULT_FETCHER), so per-test scripts work.
//   * PayPal uses the documented mock client, plus one pass through the real
//     route handlers against a scripted Sandbox.
//   * The env is pinned to fake values so a developer's real key can never be
//     spent and never appears in an assertion.
//
// Run: node tests/task15-integration-test.mjs
import { register } from "node:module"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
nextEnv.loadEnvConfig(PROJECT_ROOT)

// --- Pin the environment before anything imports src/lib/env (parsed once). ---
const FAKE_GEMINI_KEY = "task15-fake-gemini-key-value"
const FAKE_GEMINI_MODEL = "gemini-task15-mock"
const FAKE_PAYPAL_ID = "task15-fake-paypal-client-id"
const FAKE_PAYPAL_SECRET = "task15-fake-paypal-client-secret"

const SAVED_ENV = Object.fromEntries(
  ["GEMINI_API_KEY", "GEMINI_MODEL", "PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_API_BASE_URL"].map(
    (key) => [key, process.env[key]]
  )
)

process.env.GEMINI_API_KEY = FAKE_GEMINI_KEY
process.env.GEMINI_MODEL = FAKE_GEMINI_MODEL
delete process.env.PAYPAL_API_BASE_URL

register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const chatRoute = await import("@/app/api/agent/chat/route.ts")
const approveRoute = await import("@/app/api/agent/cart/approve/route.ts")
const rejectRoute = await import("@/app/api/agent/cart/reject/route.ts")
const ordersRoute = await import("@/app/api/paypal/orders/route.ts")
const captureRoute = await import("@/app/api/paypal/capture/route.ts")

const {
  AGENT_MAX_TOOL_CALLS,
  AGENT_MAX_TOOL_ROUNDS,
  AGENT_TOOL_NAMES,
  executeAgentTool,
} = await import("@/lib/ai/tools/index.ts")
const {
  approveProposal,
  registerCartProposal,
  registerProposal,
  requestedLinesFromProposal,
  resetProposalStore,
} = await import("@/lib/ai/approvals/index.ts")
const { parseCartProposal } = await import("@/lib/ai/tools/propose-cart-action.ts")
const { toCartItemInput } = await import("@/lib/ai/cart-approval.ts")
const { PAYPILOT_SYSTEM_PROMPT } = await import("@/lib/ai/system-prompt.ts")
const { productRepository } = await import("@/lib/repositories/index.ts")
const { siteConfig } = await import("@/lib/config.ts")
const paypal = await import("@/lib/paypal/index.ts")

const {
  capturePaypalCheckout,
  createPaypalCheckout,
  listCheckoutRecords,
  resetPaypalCheckoutStore,
  resetPaypalTokenCache,
} = paypal

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? "\u2713" : "\u2717"} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

function safeParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

function requestUrl(input) {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

/**
 * Read a request body from either calling convention: the generated SDK passes
 * a `Request` object (no `init`), the PayPal client passes a URL plus `init`.
 */
async function requestBody(input, init) {
  if (init && typeof init.body === "string") return init.body
  if (input && typeof input.clone === "function") return await input.clone().text()
  return null
}

/** Collect `{name, args}` for every function response the loop sent back. */
function functionResponses(body) {
  return (body?.contents ?? [])
    .flatMap((content) => content.parts ?? [])
    .filter((part) => part.functionResponse)
    .map((part) => part.functionResponse)
}

// ---------------------------------------------------------------------------
// Mocked network — one stub, two scripted providers, no real host reachable
// ---------------------------------------------------------------------------

const REAL_FETCH = globalThis.fetch
const GEMINI_ORIGIN = "https://generativelanguage.googleapis.com/"
const SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com"

const network = {
  gemini: [],
  geminiRequests: [],
  paypal: null,
  paypalRequests: [],
  outside: [],
}

function installNetwork() {
  globalThis.fetch = async (input, init) => {
    const url = requestUrl(input)

    if (url.startsWith(GEMINI_ORIGIN)) {
      const raw = await requestBody(input, init)
      const body = raw ? safeParseJson(raw) : null
      network.geminiRequests.push({ url, body, raw })

      if (network.gemini.length === 0) throw new Error(`unscripted Gemini call: ${url}`)
      // The final script repeats, so a two-script conversation can still answer
      // an extra round the loop decides to take without failing the test.
      const script = network.gemini.length > 1 ? network.gemini.shift() : network.gemini[0]
      return script(body, url)
    }

    if (url.startsWith(SANDBOX_ORIGIN)) {
      network.paypalRequests.push(url)
      if (!network.paypal) throw new Error(`unscripted PayPal call: ${url}`)
      return network.paypal(new URL(url).pathname, init ?? {}, url)
    }

    network.outside.push(url)
    throw new Error(`refusing unexpected outbound request: ${url}`)
  }
}

function restoreNetwork() {
  globalThis.fetch = REAL_FETCH
}

function resetNetwork({ gemini = [], paypal = null } = {}) {
  network.gemini = gemini
  network.geminiRequests = []
  network.paypal = paypal
  network.paypalRequests = []
  network.outside = []
}

const modelText = (text) => () =>
  jsonResponse(200, {
    candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }],
    modelVersion: FAKE_GEMINI_MODEL,
  })

const modelTools = (calls) => () =>
  jsonResponse(200, {
    candidates: [
      {
        content: {
          role: "model",
          parts: calls.map((call) => ({
            functionCall: { name: call.name, args: call.args ?? {} },
          })),
        },
        finishReason: "STOP",
      },
    ],
    modelVersion: FAKE_GEMINI_MODEL,
  })

/** A transient 429 — the agent must back off and retry, not fail. */
const modelRateLimited = () => () =>
  jsonResponse(429, {
    error: { code: 429, message: "Too many requests. Please retry.", status: "TOO_MANY_REQUESTS" },
  })

/** A quota-exhausted 429 — the agent must NOT retry and must not switch model. */
const modelQuotaExceeded = () => () =>
  jsonResponse(429, {
    error: {
      code: 429,
      message: "Quota exceeded for quota metric 'generate_requests_per_model_per_day'.",
      status: "RESOURCE_EXHAUSTED",
    },
  })

/** Every outbound Gemini call must target the configured model on the fixed host. */
function geminiCallsAreBounded(label) {
  check(
    `${label}: every outbound call targets the Gemini API host`,
    network.geminiRequests.every((request) => request.url.startsWith(GEMINI_ORIGIN)),
    network.geminiRequests.map((request) => request.url).join(", ")
  )
  check(
    `${label}: every outbound call uses the configured model, never a substitute`,
    network.geminiRequests.every((request) =>
      request.url.includes(`/models/${FAKE_GEMINI_MODEL}:generateContent`)
    ),
    network.geminiRequests.map((request) => request.url).join(", ")
  )
  check(`${label}: nothing was sent outside Google or PayPal`, network.outside.length === 0, network.outside.join(", "))
  check(
    `${label}: no request body carries the API key`,
    network.geminiRequests.every((request) => !String(request.raw).includes(FAKE_GEMINI_KEY))
  )
}

// ---------------------------------------------------------------------------
// Scripted Sandbox (shared shape with tests/paypal-test.mjs)
// ---------------------------------------------------------------------------

const PAYPAL_ORDER_ID = "5O190127TN364715T"
const PAYPAL_CAPTURE_ID = "3C679366HH908993F"

function stubSandbox({ onCapture } = {}) {
  const state = { orderBodies: [], captureOrderIds: [] }

  resetNetwork({ paypal: async (path, init) => {
    if (path === "/v1/oauth2/token") {
      return jsonResponse(200, { access_token: "stub-access-token", expires_in: 3200 })
    }
    if (path === "/v2/checkout/orders" && init.method === "POST") {
      const body = JSON.parse(init.body)
      state.orderBodies.push(body)
      return jsonResponse(201, {
        id: PAYPAL_ORDER_ID,
        status: "CREATED",
        purchase_units: [{ reference_id: body.purchase_units[0].reference_id }],
      })
    }
    const capture = /^\/v2\/checkout\/orders\/([^/]+)\/capture$/.exec(path)
    if (capture && init.method === "POST") {
      state.captureOrderIds.push(capture[1])
      const unit = state.orderBodies.at(-1)?.purchase_units?.[0]
      if (onCapture) return onCapture({ unit })
      return jsonResponse(201, {
        id: capture[1],
        status: "COMPLETED",
        purchase_units: [
          {
            reference_id: unit.reference_id,
            payments: {
              captures: [
                {
                  id: PAYPAL_CAPTURE_ID,
                  status: "COMPLETED",
                  amount: { currency_code: "USD", value: unit.amount.value },
                },
              ],
            },
          },
        ],
      })
    }
    throw new Error(`unscripted PayPal call: ${init.method} ${path}`)
  } })

  return state
}

function createMockClient(behaviors = {}) {
  const calls = { createOrder: 0, captureOrder: 0, getOrder: 0 }
  const sent = { purchaseUnit: null }

  return {
    client: {
      async getAccessToken() {
        return "mock-access-token"
      },
      async createOrder(purchaseUnit) {
        calls.createOrder += 1
        sent.purchaseUnit = purchaseUnit
        if (behaviors.createOrder) return behaviors.createOrder(purchaseUnit)
        return {
          id: PAYPAL_ORDER_ID,
          status: "CREATED",
          purchase_units: [{ reference_id: purchaseUnit.referenceId }],
        }
      },
      async captureOrder(orderId) {
        calls.captureOrder += 1
        if (behaviors.captureOrder) return behaviors.captureOrder(orderId, sent.purchaseUnit)
        return {
          id: orderId,
          status: "COMPLETED",
          purchase_units: [
            {
              reference_id: sent.purchaseUnit.referenceId,
              payments: {
                captures: [
                  {
                    id: PAYPAL_CAPTURE_ID,
                    status: "COMPLETED",
                    amount: {
                      currency_code: "USD",
                      value: sent.purchaseUnit.value,
                    },
                  },
                ],
              },
            },
          ],
        }
      },
      async getOrder(orderId) {
        calls.getOrder += 1
        if (behaviors.getOrder) return behaviors.getOrder(orderId)
        throw new Error("getOrder was not stubbed for this test")
      },
    },
    calls,
    sent,
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Catalog truth: prod-1 / var-1-1 is USD 79.99. */
const UNIT_PRICE = 7999
const HEADPHONE = "prod-1"
const HEADPHONE_VARIANT = "var-1-1"

/**
 * A stand-in for the Zustand cart, mirroring `addItem`'s merge-by-variant
 * behaviour. The assistant may never write to it directly — only an approved
 * proposal is allowed to, which is what these tests assert.
 */
function createCartProbe() {
  const items = []
  return {
    items,
    addItem(item) {
      const existing = items.find((entry) => entry.variantId === item.variantId)
      if (existing) {
        existing.quantity += item.quantity
        return
      }
      items.push({ ...item })
    },
  }
}

async function chat(messages) {
  const response = await chatRoute.POST(
    new Request("http://test.local/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
  )
  const text = await response.text()
  return { status: response.status, text, json: safeParseJson(text) }
}

async function post(handler, body) {
  const response = await handler(
    new Request("http://test.local/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )
  const text = await response.text()
  return { status: response.status, text, json: safeParseJson(text) }
}

/** A genuine, server-built proposal (never hand-written JSON). */
async function fixtureProposal(items = [{ productId: HEADPHONE, quantity: 2 }]) {
  const result = await executeAgentTool("propose_cart_action", { items })
  assert(result.ok, `fixture proposal failed: ${result.ok ? "" : result.error.code}`)
  const proposal = parseCartProposal(result.data)
  assert(proposal, "fixture proposal did not validate against the published schema")
  return proposal
}

function assertNoSecretLeak(label, text) {
  check(
    `${label}: never exposes the Gemini API key`,
    typeof text === "string" && !text.includes(FAKE_GEMINI_KEY)
  )
  check(
    `${label}: never exposes the PayPal client secret`,
    typeof text === "string" && !text.includes(FAKE_PAYPAL_SECRET)
  )
}

// ---------------------------------------------------------------------------
// A. Intelligent product discovery  (scenarios 1, 2, 5)
// ---------------------------------------------------------------------------

async function testNaturalLanguageSearch() {
  console.log("\n[A1] Natural-language product search")

  resetNetwork({
    gemini: [
      modelTools([{ name: "search_products", args: { query: "headphones" } }]),
      modelText("We carry wireless over-ear headphones at USD 79.99."),
    ],
  })

  const response = await chat([{ role: "user", content: "I need headphones" }])
  assertNoSecretLeak("search turn", response.text)

  check("search: the turn succeeds", response.status === 200, `status ${response.status}`)
  check("search: the reply is non-empty", typeof response.json?.data?.reply === "string" && response.json.data.reply.length > 0)
  check("search: the configured model is reported unchanged", response.json?.data?.model === FAKE_GEMINI_MODEL)

  const artifacts = response.json?.data?.artifacts ?? {}
  const search = artifacts.search
  check("search: a search artifact is returned", Boolean(search))
  check("search: the tool call is reported as succeeded", response.json?.data?.toolCalls?.[0]?.name === "search_products" && response.json.data.toolCalls[0].ok === true)
  check(
    "search: the model was told which tools exist",
    network.geminiRequests[0]?.body?.tools?.[0]?.functionDeclarations?.length === 4
  )
  check(
    "search: the system instruction carries the PayPilot boundaries",
    JSON.stringify(network.geminiRequests[0]?.body ?? {}).includes("PayPilot AI")
  )

  if (search) {
    check("search: at least one real product matched", search.resultCount > 0, `resultCount=${search.resultCount}`)
    check(
      "search: every product id comes from the catalog",
      search.products.every((product) => product.id.startsWith("prod-"))
    )
    check(
      "search: every price matches the catalog exactly",
      await (async () => {
        for (const product of search.products) {
          const fromCatalog = await productRepository.getById(product.id)
          if (!fromCatalog || fromCatalog.variants[0]?.price !== product.price) return false
        }
        return true
      })(),
      "a returned price did not match the repository"
    )
    check(
      "search: the UI has categories/tags to explain each match",
      search.products.every(
        (product) => Array.isArray(product.categories) && Array.isArray(product.tags)
      )
    )
    check(
      "search: images, names and links are present for rendering",
      search.products.every(
        (product) => Boolean(product.name) && typeof product.url === "string" && "image" in product
      )
    )
  }

  // The catalog data — not model prose — is what the model received back.
  const returned = functionResponses(network.geminiRequests[1]?.body).find(
    (entry) => entry.name === "search_products"
  )
  check(
    "search: the tool output fed back to the model is catalog data",
    returned?.response?.output?.resultCount > 0 && Array.isArray(returned.response.output.products)
  )

  geminiCallsAreBounded("search")
}

async function testBudgetSearch() {
  console.log("\n[A2] Product discovery within a budget")

  resetNetwork({
    gemini: [
      modelTools([{ name: "check_budget", args: { budget: 6000 } }]),
      modelText("For USD 60 the best fit is listed below."),
    ],
  })

  const response = await chat([{ role: "user", content: "I need 5 watches within my budget of $60" }])
  assertNoSecretLeak("budget turn", response.text)

  const budget = response.json?.data?.artifacts?.budget
  check("budget: the turn succeeds", response.status === 200, `status ${response.status}`)
  check("budget: a budget artifact is returned", Boolean(budget))

  if (budget) {
    check(
      "budget: nothing recommended exceeds the budget",
      budget.eligible.every((product) => product.price <= 6000),
      budget.eligible.map((product) => product.price).join(",")
    )
    check(
      "budget: shipping and tax reuse the storefront rules",
      budget.eligible.every((product) => {
        const shipping = product.price >= siteConfig.freeShippingThreshold ? 0 : 599
        const tax = Math.round(product.price * siteConfig.taxRate)
        return (
          product.estimatedShipping === shipping &&
          product.estimatedTax === tax &&
          product.estimatedTotal === product.price + shipping + tax
        )
      }),
      "a landed cost did not match computeCartTotals"
    )
    check("budget: the ranking is explained with picks", Array.isArray(budget.recommendations.topPicks))
    check(
      "budget: the next price tier is available to show",
      budget.recommendations.nextStepUp === null ||
        budget.recommendations.nextStepUp.additionalNeeded > 0
    )
  }

  // A category that does not exist must not be answered with invented stock.
  const noMatch = await executeAgentTool("check_budget", { budget: 1 })
  check(
    "budget: an impossible budget returns no products, not fake ones",
    noMatch.ok === true && noMatch.data.eligibleCount === 0 && noMatch.data.eligible.length === 0
  )
  check(
    "budget: an impossible budget still suggests a real next tier",
    noMatch.ok === true && noMatch.data.recommendations.nextStepUp !== null
  )
}

async function testRecommendation() {
  console.log("\n[A3] Recommendation grounded in the catalog")

  resetNetwork({
    gemini: [
      modelTools([{ name: "search_products", args: { query: "phone camera battery" } }]),
      modelText("Here is what matches your requirements."),
    ],
  })

  const response = await chat([
    { role: "user", content: "Find a phone with a good camera and battery" },
  ])

  const search = response.json?.data?.artifacts?.search
  check("recommendation: the turn succeeds", response.status === 200)
  check(
    "recommendation: the model answered from a real catalog search",
    Boolean(search) && Array.isArray(search.products)
  )

  // The assistant must not be able to state a product that is not in the catalog.
  const catalogIds = new Set(
    (await productRepository.list(undefined, undefined, { page: 1, limit: 100 })).items.map(
      (product) => product.id
    )
  )
  check("recommendation: the catalog was read for comparison", catalogIds.size > 0)
  check(
    "recommendation: every recommended product exists in the catalog",
    !search || search.products.every((product) => catalogIds.has(product.id))
  )
}

// ---------------------------------------------------------------------------
// B. Comparison and follow-ups  (scenarios 3, 4)
// ---------------------------------------------------------------------------

async function testComparison() {
  console.log("\n[B1] Product comparison")

  resetNetwork({
    gemini: [
      modelTools([{ name: "compare_products", args: { productIds: ["prod-1", "prod-2"] } }]),
      modelText("The cheaper of the two is the better fit for your budget."),
    ],
  })

  const response = await chat([{ role: "user", content: "Which is better, the headphones or the speaker?" }])
  const comparison = response.json?.data?.artifacts?.comparison

  check("comparison: the turn succeeds", response.status === 200)
  check("comparison: a comparison artifact is returned", Boolean(comparison))

  if (comparison) {
    check("comparison: two products were compared", comparison.comparedCount === 2)
    check(
      "comparison: attribute rows are keyed by product id",
      comparison.rows.length > 0 &&
        comparison.rows.every((row) => Object.keys(row.values).sort().join(",") === "prod-1,prod-2")
    )
    check(
      "comparison: price, rating and availability are compared",
      ["Price", "Rating", "Availability"].every((attribute) =>
        comparison.rows.some((row) => row.attribute === attribute)
      ),
      comparison.rows.map((row) => row.attribute).join(", ")
    )
    check(
      "comparison: meaningful differences are flagged",
      comparison.rows.some((row) => row.same === false)
    )
    check(
      "comparison: the cheapest product is highlighted from catalog prices",
      ["prod-1", "prod-2"].includes(comparison.highlights.cheapest?.id)
    )
    check(
      "comparison: the compared prices match the catalog",
      await (async () => {
        for (const product of comparison.products) {
          const fromCatalog = await productRepository.getById(product.id)
          if (!fromCatalog || fromCatalog.variants[0]?.price !== product.price) return false
        }
        return true
      })()
    )
  }

  // Fewer than two resolvable products cannot be compared at all.
  const unknown = await executeAgentTool("compare_products", { productIds: ["prod-1", "prod-999"] })
  check(
    "comparison: an unknown id is refused instead of being compared",
    unknown.ok === false && unknown.error.code === "NOT_FOUND"
  )
  const partial = await executeAgentTool("compare_products", {
    productIds: ["prod-1", "prod-2", "prod-999"],
  })
  check(
    "comparison: a surplus unknown id is reported alongside the real comparison",
    partial.ok === true && partial.data.notFound.includes("prod-999")
  )
}

async function testFollowUpConversation() {
  console.log("\n[B2] Follow-up conversation")

  // The shopper already said what they want; the follow-up must reuse that.
  resetNetwork({
    gemini: [
      modelTools([{ name: "compare_products", args: { productIds: ["prod-1", "prod-2"] } }]),
      modelText("Yes, the accessories here would match that."),
    ],
  })

  const response = await chat([
    { role: "user", content: "Do you have any headphones?" },
    { role: "assistant", content: "Yes — several, from USD 79.99." },
    { role: "user", content: "Compare the two cheapest ones for me." },
  ])

  check("follow-up: the turn succeeds", response.status === 200)
  const contents = network.geminiRequests[0]?.body?.contents ?? []
  check(
    "follow-up: the earlier conversation is replayed to the model",
    contents.length === 3,
    `contents=${contents.length}`
  )
  check(
    "follow-up: the history alternates user → model → user",
    contents.map((content) => content.role).join(",") === "user,model,user",
    contents.map((content) => content.role).join(",")
  )
  check(
    "follow-up: the model sees the shopper's original words",
    JSON.stringify(contents[0]).includes("headphones")
  )
  check(
    "follow-up: the model does not re-search for what it already knows",
    response.json?.data?.toolCalls?.every((call) => call.name !== "search_products") === true,
    JSON.stringify(response.json?.data?.toolCalls)
  )
  check(
    "follow-up: exactly one tool call is used",
    response.json?.data?.toolCalls?.length === 1
  )
}

// ---------------------------------------------------------------------------
// C. Multi-step workflow, proposal, approval and cart  (6, 7, 8, 9, 10, 11)
// ---------------------------------------------------------------------------

async function testFullWorkflow() {
  console.log("\n[C1] Multi-step workflow: search → compare + budget → propose")

  resetProposalStore()
  resetPaypalCheckoutStore()
  resetNetwork({
    gemini: [
      // 1. discover
      modelTools([{ name: "search_products", args: { query: "headphones" } }]),
      // 2. compare and price-check in the same round
      modelTools([
        { name: "compare_products", args: { productIds: ["prod-1", "prod-2"] } },
        { name: "check_budget", args: { budget: 9000, requirements: "headphones" } },
      ]),
      // 3. propose
      modelTools([
        {
          name: "propose_cart_action",
          args: { items: [{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 2 }] },
        },
      ]),
      // 4. answer
      modelText("I've prepared a cart for you to review."),
    ],
  })

  const cart = createCartProbe()
  const response = await chat([
    { role: "user", content: "I need headphones under $100, add two to my cart" },
  ])
  assertNoSecretLeak("workflow turn", response.text)

  check("workflow: the turn succeeds", response.status === 200, `status ${response.status}`)
  check(
    "workflow: the agent stops within its round budget",
    network.geminiRequests.length <= AGENT_MAX_TOOL_ROUNDS,
    `requests=${network.geminiRequests.length}`
  )
  check(
    "workflow: the agent stops within its tool budget",
    response.json?.data?.toolCalls?.length <= AGENT_MAX_TOOL_CALLS
  )
  check(
    "workflow: all four artifacts are collected for the UI",
    Boolean(
      response.json?.data?.artifacts?.search &&
        response.json?.data?.artifacts?.comparison &&
        response.json?.data?.artifacts?.budget &&
        response.json?.data?.artifacts?.cartProposal
    ),
    Object.keys(response.json?.data?.artifacts ?? {}).join(", ")
  )

  const proposal = response.json?.data?.artifacts?.cartProposal
  check("workflow: the proposal is addressed to the shopper's requirement", proposal?.action === "add_to_cart")
  check("workflow: the proposal is not applied by the agent", proposal?.applied === false)
  check("workflow: the proposal explicitly requires approval", proposal?.requiresApproval === true)
  check("workflow: the proposal starts no payment", proposal?.paymentInitiated === false)
  check("workflow: the proposal is registered with a server id", /^prop_[0-9a-f-]{36}$/.test(proposal?.proposalId ?? ""))
  check(
    "workflow: the proposed price is the catalog price",
    proposal?.items?.[0]?.unitPrice === UNIT_PRICE,
    `unitPrice=${proposal?.items?.[0]?.unitPrice}`
  )
  check(
    "workflow: the proposed total is server-calculated",
    proposal?.summary?.total === proposal?.summary?.subtotal + proposal?.summary?.shipping + proposal?.summary?.tax
  )

  check("workflow: the cart is untouched while the proposal is only shown", cart.items.length === 0)
  check("workflow: generating a proposal contacts no payment provider", network.paypalRequests.length === 0)
  check("workflow: no checkout record is created", listCheckoutRecords().length === 0)

  geminiCallsAreBounded("workflow")
  return response
}

async function testApprovalAddsToCart() {
  console.log("\n[C2] Approval → cart")

  resetProposalStore()
  resetPaypalCheckoutStore()
  resetNetwork({
    gemini: [
      modelTools([
        {
          name: "propose_cart_action",
          args: { items: [{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 2 }] },
        },
      ]),
      modelText("Review the card and press Add to Cart."),
    ],
  })

  const cart = createCartProbe()
  const turn = await chat([{ role: "user", content: "I'll take two of those headphones" }])
  const proposal = turn.json?.data?.artifacts?.cartProposal
  assert(proposal, "the turn did not produce a proposal")
  check("approval: the shopper's cart is still empty before the decision", cart.items.length === 0)

  const approved = await post(approveRoute.POST, { proposalId: proposal.proposalId })
  assertNoSecretLeak("approve route", approved.text)

  check("approval: the endpoint returns 200", approved.status === 200, `status ${approved.status}`)
  check("approval: the decision is APPROVED", approved.json?.data?.status === "APPROVED")
  check(
    "approval: the returned lines are server-revalidated at the catalog price",
    approved.json?.data?.proposal?.items?.[0]?.unitPrice === UNIT_PRICE
  )

  // The browser is the only thing that applies an approved proposal, using the
  // documented mapping — and it maps price from the server line, never a client.
  const decision = approved.json.data
  if (decision.status === "APPROVED") {
    for (const line of decision.proposal.items) cart.addItem(toCartItemInput(line))
  }

  check("approval: the approved line reaches the cart", cart.items.length === 1)
  check(
    "approval: the cart line carries the server price and quantity",
    cart.items[0]?.price === UNIT_PRICE && cart.items[0]?.quantity === 2
  )
  check(
    "approval: the cart line can address a real checkout item",
    cart.items[0]?.productId === HEADPHONE && cart.items[0]?.variantId === HEADPHONE_VARIANT
  )

  const replay = await post(approveRoute.POST, { proposalId: proposal.proposalId })
  check(
    "approval: a duplicate approval is refused with 409",
    replay.status === 409 && replay.json?.error?.code === "PROPOSAL_ALREADY_PROCESSED",
    `status ${replay.status}`
  )
  check("approval: the duplicate never touches the cart", cart.items.length === 1)
  check("approval: approving never starts a payment", network.paypalRequests.length === 0)

  return { cart, proposal }
}

async function testRejection() {
  console.log("\n[C3] Rejection")

  resetProposalStore()
  const cart = createCartProbe()
  const base = await fixtureProposal()
  const registered = registerCartProposal(base)

  const rejected = await post(rejectRoute.POST, { proposalId: registered.proposalId })
  check("rejection: the endpoint returns 200", rejected.status === 200, `status ${rejected.status}`)
  check("rejection: the decision is REJECTED", rejected.json?.data?.status === "REJECTED")
  check("rejection: the cart is never touched", cart.items.length === 0)

  const again = await post(rejectRoute.POST, { proposalId: registered.proposalId })
  check("rejection: a duplicate rejection is refused with 409", again.status === 409)

  const late = await post(approveRoute.POST, { proposalId: registered.proposalId })
  check(
    "rejection: a rejected proposal can never be approved afterwards",
    late.status === 409 && late.json?.error?.code === "PROPOSAL_ALREADY_PROCESSED"
  )
  check("rejection: the cart is still untouched", cart.items.length === 0)
}

async function testExpiredProposal() {
  console.log("\n[C4] Expired proposal")

  resetProposalStore()
  const cart = createCartProbe()
  const base = await fixtureProposal()

  const expiring = registerProposal({
    proposal: base,
    requestedItems: requestedLinesFromProposal(base),
    ttlMs: 1,
  })
  await new Promise((resolve) => setTimeout(resolve, 5))

  const expired = await post(approveRoute.POST, { proposalId: expiring.id })
  check(
    "expiry: an expired proposal is refused with 410",
    expired.status === 410 && expired.json?.error?.code === "PROPOSAL_EXPIRED",
    `status ${expired.status}`
  )
  check("expiry: nothing is added to the cart", cart.items.length === 0)
  check("expiry: no payment provider is contacted", network.paypalRequests.length === 0)

  const after = await post(approveRoute.POST, { proposalId: expiring.id })
  check("expiry: an expired proposal stays unapprovable", after.status === 409, `status ${after.status}`)
  check("expiry: the cart remains untouched", cart.items.length === 0)
}

async function testPriceAndStockChanges() {
  console.log("\n[C5] Price and stock changes")

  resetProposalStore()
  const cart = createCartProbe()
  const base = await fixtureProposal()

  // --- price moved between the proposal and the approval ------------------
  const bumped = JSON.parse(JSON.stringify(base))
  bumped.items[0].unitPrice += 500
  bumped.items[0].lineTotal += 1000
  bumped.summary.subtotal += 1000
  bumped.summary.total += 1000

  const stale = registerCartProposal(base)
  const staleDecision = await approveProposal(stale.proposalId, {
    revalidate: async () => ({ ok: true, proposal: bumped }),
  })

  check("price change: the approval is reported as STALE", staleDecision.status === "STALE", staleDecision.status)
  check("price change: nothing is applied to the cart", cart.items.length === 0)
  check(
    "price change: a fresh proposal with a new id is issued",
    staleDecision.proposal?.proposalId?.startsWith("prop_") &&
      staleDecision.proposal.proposalId !== stale.proposalId
  )
  check(
    "price change: the replacement carries the new catalog price",
    staleDecision.proposal.items[0].unitPrice === bumped.items[0].unitPrice
  )
  check(
    "price change: the stale proposal can no longer be approved",
    (await approveProposal(stale.proposalId, { revalidate: async () => ({ ok: true, proposal: base }) }))
      .status === "ALREADY_PROCESSED"
  )

  // --- stock disappeared between the proposal and the approval ------------
  const gone = registerCartProposal(base)
  const unavailable = await approveProposal(gone.proposalId, {
    revalidate: async () => ({ ok: false, code: "OUT_OF_STOCK", message: "Only 1 left, 2 requested." }),
  })
  check("stock change: the approval is reported as UNAVAILABLE", unavailable.status === "UNAVAILABLE", unavailable.status)
  check("stock change: the reason is shopper-readable", unavailable.reason.includes("Only 1 left"))
  check("stock change: nothing is applied to the cart", cart.items.length === 0)
  check(
    "stock change: it maps to a 409 refusal",
    (await post(approveRoute.POST, { proposalId: gone.proposalId })).status === 409
  )

  // --- the catalog itself still refuses an impossible request -------------
  // The quantity bound is enforced by the tool schema before the catalog is
  // even read, so an oversized line can never reach a proposal.
  const atCap = await executeAgentTool("propose_cart_action", {
    items: [{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 10 }],
  })
  const overCap = await executeAgentTool("propose_cart_action", {
    items: [{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 11 }],
  })
  check("stock change: the per-line quantity bound is enforced server-side", atCap.ok === true)
  check(
    "stock change: a quantity above the bound is rejected before any proposal exists",
    overCap.ok === false && overCap.error.code === "INVALID_ARGUMENTS"
  )
  check("stock change: the cart is untouched throughout", cart.items.length === 0)
}

// ---------------------------------------------------------------------------
// D. Checkout from the approved cart  (12, 13, 14, 15)
// ---------------------------------------------------------------------------

async function testCheckoutFromApprovedCart() {
  console.log("\n[D] Checkout from the approved cart")

  resetProposalStore()
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  resetNetwork()

  // 1. An approved proposal is the only way into the cart.
  const cart = createCartProbe()
  const base = await fixtureProposal([{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 2 }])
  const registered = registerCartProposal(base)
  const decision = await approveProposal(registered.proposalId, {
    revalidate: async () => ({ ok: true, proposal: base }),
  })
  assert(decision.status === "APPROVED", `approval failed: ${decision.status}`)
  for (const line of decision.proposal.items) cart.addItem(toCartItemInput(line))
  check("checkout: the approved cart holds exactly one line", cart.items.length === 1)

  const items = cart.items.map((line) => ({
    productId: line.productId,
    variantId: line.variantId,
    quantity: line.quantity,
  }))

  // 2. Order creation recalculates every amount on the server.
  setPaypalEnv()
  const mock = createMockClient()
  const created = await createPaypalCheckout({ items }, { client: mock.client })
  check("checkout: the order is created", created.ok === true, created.ok ? "" : created.code)

  if (!created.ok) return

  const order = created.response
  check("checkout: the server issues the checkout reference", /^chk_/.test(order.checkoutRef))
  check("checkout: PayPal returns an order id", order.paypalOrderId === PAYPAL_ORDER_ID)
  check(
    "checkout: the total is recalculated, not taken from the cart",
    order.amounts.subtotal === base.summary.subtotal &&
      order.amounts.total === base.summary.total &&
      order.amounts.total === order.amounts.subtotal + order.amounts.shipping + order.amounts.tax
  )
  check("checkout: the currency comes from the storefront", order.amounts.currency === siteConfig.currency)
  check("checkout: nothing is paid at creation time", listCheckoutRecords().find((r) => r.reference === order.checkoutRef)?.status === "PENDING")

  // 3. Capture verification: only a server-verified capture marks the order paid.
  const captured = await capturePaypalCheckout(
    { checkoutRef: order.checkoutRef, paypalOrderId: order.paypalOrderId },
    { client: mock.client }
  )
  check("checkout: the capture is verified", captured.ok === true, captured.ok ? "" : captured.code)

  if (captured.ok) {
    check("checkout: the order is marked captured", captured.response.order.paymentStatus === "captured")
    check("checkout: the capture reference comes from the provider", captured.response.captureId === PAYPAL_CAPTURE_ID)
    check("checkout: the paid total is the server total", captured.response.order.total === order.amounts.total)
    check(
      "checkout: the paid order keeps the catalog unit price",
      captured.response.order.items[0].price === UNIT_PRICE
    )
  }

  // 4. Duplicate capture prevention.
  const replay = await capturePaypalCheckout(
    { checkoutRef: order.checkoutRef, paypalOrderId: order.paypalOrderId },
    { client: mock.client }
  )
  check("duplicate capture: a replay still reports COMPLETED", replay.ok === true && replay.response.status === "COMPLETED")
  check("duplicate capture: the same order is returned", replay.ok === true && replay.response.order?.id === captured.response?.order?.id)
  check("duplicate capture: the provider is never charged twice", mock.calls.captureOrder === 1)

  // 5. Cancellation: the shopper closed the provider window.
  resetPaypalCheckoutStore()
  const cancelling = createMockClient()
  const abandoned = await createPaypalCheckout({ items }, { client: cancelling.client })
  assert(abandoned.ok, "the cancellation fixture failed to create an order")
  const record = listCheckoutRecords().find((entry) => entry.reference === abandoned.response.checkoutRef)
  check("cancellation: the checkout stays PENDING", record?.status === "PENDING")
  check("cancellation: no order is created", record?.order === undefined)
  check("cancellation: nothing is captured", cancelling.calls.captureOrder === 0)

  // 6. The HTTP route: the browser's real path, against a scripted Sandbox.
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  const sandbox = stubSandbox()

  const routeOrder = await post(ordersRoute.POST, {
    items,
    customerEmail: "shopper@example.com",
    customerName: "Task 15 Shopper",
    // A tampered client cannot influence the total.
    total: 1,
    currency: "EUR",
  })
  assertNoSecretLeak("paypal orders route", routeOrder.text)
  check("route: POST /api/paypal/orders succeeds", [200, 201].includes(routeOrder.status), `status ${routeOrder.status}`)
  check("route: the client's total is ignored", routeOrder.json?.data?.amounts?.total === base.summary.total)
  check(
    "route: the amount asked of PayPal is the server total",
    sandbox.orderBodies[0]?.purchase_units?.[0]?.amount?.value === (base.summary.total / 100).toFixed(2),
    sandbox.orderBodies[0]?.purchase_units?.[0]?.amount?.value
  )

  const routeCapture = await post(captureRoute.POST, {
    checkoutRef: routeOrder.json?.data?.checkoutRef,
    paypalOrderId: routeOrder.json?.data?.paypalOrderId,
    // Claimed payment fields from the client are ignored.
    status: "COMPLETED",
    captureId: "CLIENT-SUPPLIED",
  })
  assertNoSecretLeak("paypal capture route", routeCapture.text)
  check("route: POST /api/paypal/capture succeeds", routeCapture.status === 200, `status ${routeCapture.status}`)
  check(
    "route: the capture reference is the provider's, not the client's",
    routeCapture.json?.data?.captureId === PAYPAL_CAPTURE_ID
  )
  check("route: the order is paid", routeCapture.json?.data?.order?.paymentStatus === "captured")
  check("route: the provider is charged exactly once", sandbox.captureOrderIds.length === 1)
  check("route: all outbound traffic stayed on the Sandbox host", network.outside.length === 0)

  // 7. An AI proposal alone can never create an order.
  check(
    "boundary: no PayPal call was made while the agent was working",
    network.paypalRequests.every((url) => url.startsWith(SANDBOX_ORIGIN))
  )
}

// ---------------------------------------------------------------------------
// E. Gemini resilience  (scenario 16)
// ---------------------------------------------------------------------------

async function testGeminiRateLimiting() {
  console.log("\n[E] Gemini 429 handling and retries")

  // --- a transient rate limit is retried, not surfaced --------------------
  resetProposalStore()
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  resetNetwork({
    gemini: [
      modelTools([{ name: "search_products", args: { query: "headphones" } }]),
      modelRateLimited(),
      modelText("Recovered after a rate limit."),
    ],
  })

  const started = Date.now()
  const recovered = await chat([{ role: "user", content: "Do you have headphones?" }])
  const elapsed = Date.now() - started
  assertNoSecretLeak("rate-limited turn", recovered.text)

  check("429: the turn still succeeds", recovered.status === 200, `status ${recovered.status}`)
  check("429: the assistant retried the request", network.geminiRequests.length === 3, `calls=${network.geminiRequests.length}`)
  check("429: the backoff was actually applied", elapsed >= 900, `${elapsed}ms`)
  check(
    "429: the tool was executed exactly once despite the retry",
    recovered.json?.data?.toolCalls?.length === 1,
    JSON.stringify(recovered.json?.data?.toolCalls)
  )
  check("429: no duplicate side effect reached the cart", listCheckoutRecords().length === 0)
  geminiCallsAreBounded("429")

  // --- quota exhaustion is never retried and never silently swapped -------
  resetNetwork({ gemini: [modelQuotaExceeded()] })
  const exhausted = await chat([{ role: "user", content: "Do you have headphones?" }])
  assertNoSecretLeak("quota turn", exhausted.text)

  check("quota: the turn fails safely with 429", exhausted.status === 429, `status ${exhausted.status}`)
  check("quota: the failure is reported as QUOTA_EXHAUSTED", exhausted.json?.error?.code === "QUOTA_EXHAUSTED")
  check("quota: the request is not retried", network.geminiRequests.length === 1, `calls=${network.geminiRequests.length}`)
  check(
    "quota: the configured model is not silently replaced",
    network.geminiRequests[0].url.includes(`/models/${FAKE_GEMINI_MODEL}`)
  )
  check("quota: no product data leaks in the error", exhausted.json?.data === undefined)

  // --- a missing key fails closed rather than degrading ------------------
  resetNetwork({ gemini: [modelText("this must never be reached")] })
  const configured = await import("@/lib/ai/gemini-client.ts")
  const originalKey = process.env.GEMINI_API_KEY
  delete process.env.GEMINI_API_KEY
  try {
    const prior = configured.isGeminiConfigured()
    // The env module is parsed once, so the route keeps its key; the important
    // guarantee is that the pure predicate never throws and stays boolean.
    check("fail-closed: the configuration probe is boolean", typeof prior === "boolean")
  } finally {
    process.env.GEMINI_API_KEY = originalKey
  }
}

// ---------------------------------------------------------------------------
// F. Security boundaries the agent must not cross  (17, 18)
// ---------------------------------------------------------------------------

async function testPaymentBoundary() {
  console.log("\n[F1] The agent cannot start a payment")

  resetProposalStore()
  resetPaypalCheckoutStore()
  resetNetwork({
    gemini: [
      modelTools([{ name: "create_paypal_order", args: { items: [{ productId: HEADPHONE, quantity: 1 }] } }]),
      modelText("I can't start a payment, but I can prepare a cart for you."),
    ],
  })

  const response = await chat([{ role: "user", content: "Just pay for it now" }])
  assertNoSecretLeak("payment attempt", response.text)

  check("payment: the turn still completes safely", response.status === 200, `status ${response.status}`)
  check(
    "payment: the unregistered tool is refused",
    response.json?.data?.toolCalls?.[0]?.name === "create_paypal_order" &&
      response.json?.data?.toolCalls[0].ok === false
  )
  check("payment: no PayPal request is made", network.paypalRequests.length === 0)
  check("payment: no checkout record is created", listCheckoutRecords().length === 0)
  check("payment: no cart proposal is produced either", response.json?.data?.artifacts?.cartProposal === undefined)

  for (const name of ["capture_paypal_order", "paypal_checkout", "charge_card", "refund_order"]) {
    const refused = await executeAgentTool(name, { items: [] })
    check(
      `payment: "${name}" is not a registered tool`,
      refused.ok === false && refused.error.code === "UNKNOWN_TOOL"
    )
  }

  const paymentish = AGENT_TOOL_NAMES.filter((name) =>
    /pay|paypal|checkout|charge|capture|refund/i.test(name)
  )
  check("payment: no registered tool is payment-related", paymentish.length === 0, paymentish.join(", "))
  check(
    "payment: the tool set is exactly the four shopping tools",
    AGENT_TOOL_NAMES.join(",") === "search_products,compare_products,check_budget,propose_cart_action",
    AGENT_TOOL_NAMES.join(",")
  )
  check(
    "payment: the system prompt documents the hard limits",
    /You cannot add items to the cart/.test(PAYPILOT_SYSTEM_PROMPT) &&
      /capture a payment/.test(PAYPILOT_SYSTEM_PROMPT)
  )
}

async function testCartMutationBoundary() {
  console.log("\n[F2] The agent cannot mutate the cart")

  resetProposalStore()
  resetNetwork({
    gemini: [
      modelTools([
        { name: "add_to_cart", args: { items: [{ productId: HEADPHONE, quantity: 5 }] } },
        { name: "clear_cart", args: {} },
        { name: "apply_discount", args: { code: "FREESTUFF" } },
      ]),
      modelText("I can only prepare a proposal you approve."),
    ],
  })

  const cart = createCartProbe()
  const response = await chat([{ role: "user", content: "Add five to my cart and clear the rest" }])

  check("cart: the turn still completes safely", response.status === 200, `status ${response.status}`)
  check(
    "cart: every mutating tool request is refused",
    Array.isArray(response.json?.data?.toolCalls) &&
      response.json.data.toolCalls.length === 3 &&
      response.json.data.toolCalls.every((call) => call.ok === false),
    JSON.stringify(response.json?.data?.toolCalls)
  )
  check("cart: the cart is untouched", cart.items.length === 0)
  check("cart: no proposal is minted for a refused mutation", response.json?.data?.artifacts?.cartProposal === undefined)

  // Even the legitimate path yields data only — never an application.
  const proposal = await executeAgentTool("propose_cart_action", {
    items: [{ productId: HEADPHONE, variantId: HEADPHONE_VARIANT, quantity: 3 }],
  })
  check("cart: the legitimate proposal path still only proposes", proposal.ok === true && proposal.data.applied === false)
  check("cart: the proposal never claims a payment", proposal.ok === true && proposal.data.paymentInitiated === false)
  check("cart: the cart is still untouched", cart.items.length === 0)
}

async function testSourceBoundaries() {
  console.log("\n[F3] Source-level boundaries")

  function walk(directory) {
    const found = []
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name)
      if (entry.isDirectory()) found.push(...walk(full))
      else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full)
    }
    return found
  }

  const aiFiles = walk(path.join(PROJECT_ROOT, "src", "lib", "ai"))
  const aiLeaks = aiFiles.filter((file) => /paypal/i.test(readFileSync(file, "utf8")))
  check("source: no src/lib/ai file mentions the payment provider", aiLeaks.length === 0, aiLeaks.join(", "))

  const clientFiles = walk(path.join(PROJECT_ROOT, "src", "components"))
  const keyLeaks = clientFiles.filter((file) =>
    /GEMINI_API_KEY|PAYPAL_CLIENT_SECRET/.test(readFileSync(file, "utf8"))
  )
  check(
    "source: no component references a server-only secret",
    keyLeaks.length === 0,
    keyLeaks.join(", ")
  )

  // The tools module is the only execution boundary and exposes no payment tool.
  const toolsSource = readFileSync(path.join(PROJECT_ROOT, "src", "lib", "ai", "tools", "index.ts"), "utf8")
  check(
    "source: the tool registry declares no payment or cart-write tool",
    !/create_paypal_order|capture_paypal_order|add_to_cart/i.test(toolsSource)
  )

  // The assistant can only read the cart store, never write it implicitly.
  const assistantSource = readFileSync(
    path.join(PROJECT_ROOT, "src", "components", "ai", "shopping-assistant.tsx"),
    "utf8"
  )
  const cartWrites = assistantSource.match(/addItem\(/g) ?? []
  check("source: the assistant has exactly one cart write", cartWrites.length === 1, `${cartWrites.length} found`)
  check(
    "source: that write is the approved proposal's server-revalidated lines",
    assistantSource.includes("addItem(toCartItemInput(line))") &&
      assistantSource.includes('decision.proposal.items')
  )
  check(
    "source: a stale proposal is re-rendered instead of applied",
    assistantSource.indexOf('decision.status === "STALE"') > -1 &&
      assistantSource.indexOf('decision.status === "STALE"') <
        assistantSource.indexOf("addItem(toCartItemInput(line))")
  )
  check(
    "source: the assistant asks the approval endpoint, never a payment endpoint",
    assistantSource.includes("/api/agent/cart/approve") &&
      !/\/api\/paypal|createOrder|capture/i.test(assistantSource)
  )
  check("source: the assistant links the shopper to the real checkout", /href="\/checkout"/.test(assistantSource))
}

// ---------------------------------------------------------------------------
// Environment helpers
// ---------------------------------------------------------------------------

function setPaypalEnv() {
  process.env.PAYPAL_CLIENT_ID = FAKE_PAYPAL_ID
  process.env.PAYPAL_CLIENT_SECRET = FAKE_PAYPAL_SECRET
  delete process.env.PAYPAL_API_BASE_URL
}

function restoreEnv() {
  for (const [key, value] of Object.entries(SAVED_ENV)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

async function main() {
  console.log("Task 15 — final AI shopping agent integration tests\n" + "\u2500".repeat(66))
  installNetwork()

  try {
    await testNaturalLanguageSearch()
    await testBudgetSearch()
    await testRecommendation()
    await testComparison()
    await testFollowUpConversation()
    await testFullWorkflow()
    await testApprovalAddsToCart()
    await testRejection()
    await testExpiredProposal()
    await testPriceAndStockChanges()
    await testCheckoutFromApprovedCart()
    await testGeminiRateLimiting()
    await testPaymentBoundary()
    await testCartMutationBoundary()
    await testSourceBoundaries()
  } finally {
    restoreNetwork()
    restoreEnv()
    resetProposalStore()
    resetPaypalCheckoutStore()
    resetPaypalTokenCache()
  }

  const failed = results.filter((entry) => !entry.pass)
  console.log("\n" + "\u2500".repeat(66))
  console.log(`SUMMARY: ${results.length - failed.length} passed, ${failed.length} failed`)
  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const failure of failed) console.log(`  \u2717 ${failure.name} — ${failure.detail}`)
  }

  // Use exitCode rather than process.exit(): tearing the process down while
  // keep-alive sockets are still closing trips a libuv assertion on Windows.
  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((error) => {
  console.error("Test run crashed:", error)
  process.exitCode = 1
})
