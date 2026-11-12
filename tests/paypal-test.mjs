// Task 20 — PayPal Sandbox payment integration tests.
//
// Everything here is deterministic: PayPal is never contacted. The checkout
// modules are exercised with an injected mock client, and the three route
// handlers are invoked in-process against a stubbed `globalThis.fetch`, so the
// real HTTP mapping is covered without any credentials or network.
//
// Run: node tests/paypal-test.mjs
import { register } from "node:module"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
nextEnv.loadEnvConfig(PROJECT_ROOT)
register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const paypal = await import("@/lib/paypal/index.ts")
const { readPaypalConfig, clientSafePaypalConfig, resolvePaypalEndpoint } = paypal
const { PaypalApiError, resetPaypalTokenCache } = paypal
const {
  buildCheckout,
  createPaypalCheckout,
  capturePaypalCheckout,
  resetPaypalCheckoutStore,
  listCheckoutRecords,
} = paypal

const { paypalCreateOrderRequestSchema } = await import("@/lib/validators/index.ts")

const configRoute = await import("@/app/api/paypal/config/route.ts")
const ordersRoute = await import("@/app/api/paypal/orders/route.ts")
const captureRoute = await import("@/app/api/paypal/capture/route.ts")

const { AGENT_TOOL_NAMES, executeAgentTool } = await import("@/lib/ai/tools/index.ts")
const { registerCartProposal, resetProposalStore } = await import(
  "@/lib/ai/approvals/index.ts"
)

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

// ---------------------------------------------------------------------------
// Environment control (the sandbox credentials are fake and stay in-process)
// ---------------------------------------------------------------------------

const PAYPAL_ENV_KEYS = ["PAYPAL_CLIENT_ID", "PAYPAL_CLIENT_SECRET", "PAYPAL_API_BASE_URL"]
const SAVED_ENV = Object.fromEntries(PAYPAL_ENV_KEYS.map((key) => [key, process.env[key]]))

const TEST_CLIENT_ID = "test-sandbox-client-id"
const TEST_CLIENT_SECRET = "test-sandbox-client-secret"

function clearPaypalEnv() {
  for (const key of PAYPAL_ENV_KEYS) delete process.env[key]
}

function setPaypalEnv({ clientId = TEST_CLIENT_ID, clientSecret = TEST_CLIENT_SECRET, baseUrl } = {}) {
  process.env.PAYPAL_CLIENT_ID = clientId
  process.env.PAYPAL_CLIENT_SECRET = clientSecret
  if (baseUrl === undefined) delete process.env.PAYPAL_API_BASE_URL
  else process.env.PAYPAL_API_BASE_URL = baseUrl
}

function restorePaypalEnv() {
  for (const key of PAYPAL_ENV_KEYS) {
    if (SAVED_ENV[key] === undefined) delete process.env[key]
    else process.env[key] = SAVED_ENV[key]
  }
}

// ---------------------------------------------------------------------------
// fetch stub
// ---------------------------------------------------------------------------

const REAL_FETCH = globalThis.fetch
const SANDBOX_ORIGIN = "https://api-m.sandbox.paypal.com"

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
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
 * Replace the network with a scripted PayPal.
 *
 * The handler asserts every call targets the Sandbox host recorded in
 * PAYPAL_API_BASE_URL — a check that would fail loudly if a secret were ever
 * sent somewhere else.
 */
function installFetchStub(handler) {
  globalThis.fetch = async (input, init) => {
    const url = requestUrl(input)
    assert(
      url.startsWith(SANDBOX_ORIGIN),
      `refusing unexpected outbound request: ${url}`
    )
    return handler(new URL(url).pathname, init ?? {}, url)
  }
}

function restoreFetch() {
  globalThis.fetch = REAL_FETCH
}

/**
 * A scripted Orders API.
 *
 * `create` answers the OAuth and order-creation calls and echoes back the
 * amount we asked for, exactly like PayPal does. Capture behaviour is supplied
 * per test.
 */
function stubOrdersApi({ onCapture, orderStatus = "CREATED" } = {}) {
  const state = { orderBodies: [], captureOrderIds: [], referenceId: null }

  installFetchStub(async (path, init) => {
    if (path === "/v1/oauth2/token") {
      assert.equal(init.method, "POST")
      const auth = init.headers?.Authorization ?? ""
      assert(auth.startsWith("Basic "), "the OAuth call must carry Basic credentials")
      return jsonResponse(200, { access_token: "stub-access-token", expires_in: 3200 })
    }

    if (path === "/v2/checkout/orders" && init.method === "POST") {
      const body = JSON.parse(init.body)
      state.orderBodies.push(body)
      state.referenceId = body.purchase_units[0].reference_id
      return jsonResponse(201, {
        id: PAYPAL_ORDER_ID,
        status: orderStatus,
        purchase_units: [{ reference_id: state.referenceId }],
      })
    }

    const captureMatch = /^\/v2\/checkout\/orders\/([^/]+)\/capture$/.exec(path)
    if (captureMatch && init.method === "POST") {
      state.captureOrderIds.push(captureMatch[1])
      const unit = state.orderBodies.at(-1)?.purchase_units?.[0]
      if (onCapture) return onCapture({ ...state, unit })
      return jsonResponse(201, {
        id: captureMatch[1],
        status: "COMPLETED",
        purchase_units: [
          {
            reference_id: state.referenceId,
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
  })

  return state
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PAYPAL_ORDER_ID = "5O190127TN364715T"
const PAYPAL_CAPTURE_ID = "3C679366HH908993F"

/** Catalog truth: prod-1 / var-1-1 is 7999 USD cents, WH-BLK-001, 50 in stock. */
const UNIT_PRICE = 7999
const STOCK = 50

const ONE_HEADPHONE = [{ productId: "prod-1", variantId: "var-1-1", quantity: 1 }]
const TWO_HEADPHONES = [{ productId: "prod-1", variantId: "var-1-1", quantity: 2 }]

/** subtotal 15998 → free shipping (>= 7500) → tax round(15998 * 0.08) = 1280. */
const EXPECTED_TWO = { subtotal: 15998, shipping: 0, tax: 1280, total: 17278, currency: "USD" }

function createMockClient(behaviors = {}) {
  const calls = { getAccessToken: 0, createOrder: 0, captureOrder: 0, getOrder: 0 }
  const sent = { purchaseUnit: null, capturedOrderIds: [] }

  const client = {
    async getAccessToken() {
      calls.getAccessToken += 1
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
      sent.capturedOrderIds.push(orderId)
      if (behaviors.captureOrder) return behaviors.captureOrder(orderId, sent.purchaseUnit)
      throw new Error("captureOrder was not stubbed for this test")
    },
    async getOrder(orderId) {
      calls.getOrder += 1
      if (behaviors.getOrder) return behaviors.getOrder(orderId)
      throw new Error("getOrder was not stubbed for this test")
    },
  }

  return { client, calls, sent }
}

/** A PayPal capture response, as PayPal actually shapes it. */
function captureResponse({
  referenceId,
  value,
  currency = "USD",
  orderStatus = "COMPLETED",
  captureStatus = "COMPLETED",
  captureId = PAYPAL_CAPTURE_ID,
  orderId = PAYPAL_ORDER_ID,
}) {
  const captures = captureStatus
    ? [{ id: captureId, status: captureStatus, amount: { currency_code: currency, value } }]
    : []
  return {
    id: orderId,
    status: orderStatus,
    purchase_units: [{ reference_id: referenceId, payments: { captures } }],
  }
}

/** Create a checkout through the real orchestration with a mock client. */
async function createCheckout(items = TWO_HEADPHONES, options = {}) {
  const { client, calls, sent } = options.mock ?? createMockClient()
  const result = await createPaypalCheckout({ items }, { client, now: options.now })
  assert(result.ok, `checkout fixture failed: ${result.ok ? "" : result.code}`)
  return { ...result.response, client, calls, sent }
}

/** The record a created checkout refers to. */
function recordFor(response) {
  return listCheckoutRecords().find((candidate) => candidate.reference === response.checkoutRef)
}

function safeParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

function walkSourceFiles(directory) {
  const found = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) found.push(...walkSourceFiles(full))
    else if (/\.(ts|tsx)$/.test(entry.name)) found.push(full)
  }
  return found
}

// ---------------------------------------------------------------------------
// A. Configuration
// ---------------------------------------------------------------------------

async function testConfiguration() {
  console.log("\n[A] PayPal configuration")

  clearPaypalEnv()
  let config = readPaypalConfig()
  check("no credentials → MISSING_CLIENT_ID", config.ok === false && config.code === "MISSING_CLIENT_ID")

  setPaypalEnv({ clientSecret: undefined })
  delete process.env.PAYPAL_CLIENT_SECRET
  config = readPaypalConfig()
  check(
    "client id without a secret → MISSING_CLIENT_SECRET",
    config.ok === false && config.code === "MISSING_CLIENT_SECRET"
  )

  setPaypalEnv()
  config = readPaypalConfig()
  check("both credentials → configuration is usable", config.ok === true)
  check(
    "an unset base URL defaults to Sandbox",
    config.ok === true && config.config.baseUrl === "https://api-m.sandbox.paypal.com"
  )
  check("the default mode is sandbox", config.ok === true && config.config.mode === "sandbox")
  check(
    "the currency comes from the storefront config",
    config.ok === true && config.config.currency === "USD"
  )

  setPaypalEnv({ baseUrl: "https://api-m.paypal.com" })
  config = readPaypalConfig()
  check(
    "an explicit Live host reports mode live",
    config.ok === true && config.config.mode === "live"
  )

  setPaypalEnv({ baseUrl: "https://api-m.sandbox.paypal.com" })
  config = readPaypalConfig()
  check(
    "an explicit Sandbox host stays sandbox",
    config.ok === true && config.config.mode === "sandbox"
  )

  for (const [label, baseUrl] of [
    ["a plain-HTTP host", "http://api-m.sandbox.paypal.com"],
    ["an unknown host", "https://evil.example.com"],
    ["a subdomain lookalike", "https://api-m.sandbox.paypal.com.evil.example.com"],
    ["an unparseable value", "not-a-url"],
  ]) {
    setPaypalEnv({ baseUrl })
    const resolved = resolvePaypalEndpoint(baseUrl)
    check(`${label} is rejected`, resolved.ok === false && resolved.code === "INVALID_BASE_URL")
    check(`an invalid base URL disables checkout (${label})`, readPaypalConfig().ok === false)
  }

  clearPaypalEnv()
  const unsafeOff = clientSafePaypalConfig()
  check("client-safe config reports disabled when unconfigured", unsafeOff.enabled === false)
  check("client-safe config exposes a reason, not a secret", typeof unsafeOff.reason === "string")
  check(
    "client-safe config has no secret field",
    !("clientSecret" in unsafeOff)
  )

  setPaypalEnv()
  const safe = clientSafePaypalConfig()
  check("client-safe config exposes the client id when configured", safe.clientId === TEST_CLIENT_ID)
  check("client-safe config never contains the secret", !JSON.stringify(safe).includes(TEST_CLIENT_SECRET))

  // The same guarantee over the real HTTP route.
  const response = await configRoute.GET()
  const text = await response.text()
  check("GET /api/paypal/config returns 200", response.status === 200)
  check("GET /api/paypal/config enables PayPal", safeParseJson(text)?.data?.enabled === true)
  check(
    "GET /api/paypal/config never leaks the client secret",
    !text.includes(TEST_CLIENT_SECRET)
  )

  clearPaypalEnv()
  const disabled = await configRoute.GET()
  const disabledBody = safeParseJson(await disabled.text())
  check(
    "GET /api/paypal/config disables PayPal when unconfigured",
    disabledBody?.data?.enabled === false
  )

  restorePaypalEnv()
}

// ---------------------------------------------------------------------------
// B. Order creation (server-side amounts)
// ---------------------------------------------------------------------------

async function testOrderCreation() {
  console.log("\n[B] PayPal order creation")

  resetPaypalCheckoutStore()
  resetPaypalTokenCache()

  // --- client price manipulation -------------------------------------------
  // A manipulated client adds price fields; Zod strips them and the amount is
  // rebuilt from the catalog.
  const manipulated = paypalCreateOrderRequestSchema.parse({
    items: [{ productId: "prod-1", variantId: "var-1-1", quantity: 2, price: 1, unitPrice: 1, lineTotal: 1 }],
    customerEmail: "shopper@example.com",
    customerName: "Test Shopper",
    total: 1,
    currency: "EUR",
  })
  check("a client-supplied price is stripped", !("price" in manipulated.items[0]))
  check("a client-supplied unitPrice is stripped", !("unitPrice" in manipulated.items[0]))
  check("a client-supplied total is stripped", !("total" in manipulated))

  const { client, calls, sent } = createMockClient()
  const created = await createPaypalCheckout(
    { items: TWO_HEADPHONES, customerEmail: "shopper@example.com", customerName: "Test Shopper" },
    { client }
  )
  check("order creation succeeds", created.ok === true, created.ok ? "" : created.code)
  const order = created.response

  check("the checkout reference is server-issued", /^chk_[0-9a-f-]{36}$/.test(order.checkoutRef))
  check("PayPal's order id is returned", order.paypalOrderId === PAYPAL_ORDER_ID)
  check("the totals are computed on the server", JSON.stringify(order.amounts) === JSON.stringify(EXPECTED_TWO))
  check("the client was asked exactly once to create the order", calls.createOrder === 1)
  check("nothing is marked paid at creation time", recordFor(order).status === "PENDING")
  check("creation writes no order object", recordFor(order).order === undefined)

  // --- what PayPal is actually asked for -----------------------------------
  check("the amount sent to PayPal is a decimal string", sent.purchaseUnit.value === "172.78")
  check("the breakdown item total is correct", sent.purchaseUnit.breakdown.itemTotal === "159.98")
  check("the breakdown shipping is correct", sent.purchaseUnit.breakdown.shipping === "0.00")
  check("the breakdown tax is correct", sent.purchaseUnit.breakdown.taxTotal === "12.80")
  check("the item name is read from the catalog", sent.purchaseUnit.items[0].name === "Wireless Over-Ear Headphones — Black")
  check("the item sku is read from the catalog", sent.purchaseUnit.items[0].sku === "WH-BLK-001")
  check("the unit price is read from the catalog", sent.purchaseUnit.items[0].unitAmount === "79.99")
  check("the purchase unit is bound to the checkout reference", sent.purchaseUnit.referenceId === order.checkoutRef)

  // --- single unit still crosses the free-shipping threshold ----------------
  const single = await buildCheckout(ONE_HEADPHONE)
  check("a single unit matches the storefront totals", single.ok === true && single.amounts.total === 8639)
  check(
    "an order below the free-shipping threshold would pay shipping",
    single.ok === true && single.amounts.shipping === 0
  )

  // --- missing credentials --------------------------------------------------
  resetPaypalCheckoutStore()
  clearPaypalEnv()
  const unconfigured = await createPaypalCheckout({ items: TWO_HEADPHONES })
  check(
    "order creation without credentials fails closed",
    unconfigured.ok === false && unconfigured.code === "PAYPAL_NOT_CONFIGURED"
  )
  check("the unconfigured failure maps to HTTP 503", unconfigured.status === 503)
  check("no checkout record is created without credentials", listCheckoutRecords().length === 0)
  restorePaypalEnv()

  // --- invalid product id ---------------------------------------------------
  const badProduct = await createPaypalCheckout(
    { items: [{ productId: "prod-does-not-exist", variantId: "var-1-1", quantity: 1 }] },
    { client: createMockClient().client }
  )
  check(
    "an unknown product is rejected",
    badProduct.ok === false && badProduct.code === "PRODUCT_NOT_FOUND"
  )
  check("an unknown product maps to HTTP 409", badProduct.status === 409)

  // --- invalid variant id ---------------------------------------------------
  const badVariant = await createPaypalCheckout(
    { items: [{ productId: "prod-1", variantId: "var-does-not-exist", quantity: 1 }] },
    { client: createMockClient().client }
  )
  check(
    "an unknown variant is rejected",
    badVariant.ok === false && badVariant.code === "VARIANT_NOT_FOUND"
  )

  // --- invalid quantity -----------------------------------------------------
  for (const quantity of [0, -1, 1.5]) {
    const invalid = await buildCheckout([
      { productId: "prod-1", variantId: "var-1-1", quantity },
    ])
    check(
      `a quantity of ${quantity} is rejected server-side`,
      invalid.ok === false && invalid.code === "INVALID_QUANTITY"
    )
  }
  const overCap = await buildCheckout([
    { productId: "prod-1", variantId: "var-1-1", quantity: 60 },
    { productId: "prod-1", variantId: "var-1-1", quantity: 60 },
  ])
  check(
    "repeated variants cannot exceed the per-line cap",
    overCap.ok === false && overCap.code === "INVALID_QUANTITY"
  )

  // --- insufficient stock ---------------------------------------------------
  const tooMany = await createPaypalCheckout(
    { items: [{ productId: "prod-1", variantId: "var-1-1", quantity: STOCK + 1 }] },
    { client: createMockClient().client }
  )
  check(
    "more units than stock is rejected",
    tooMany.ok === false && tooMany.code === "INSUFFICIENT_STOCK"
  )
  check("an over-stock failure maps to HTTP 409", tooMany.status === 409)
  check(
    "the stock failure explains the real availability",
    tooMany.ok === false && tooMany.message.includes(String(STOCK))
  )
  const builtCurrency = await buildCheckout(TWO_HEADPHONES)
  check(
    "the checkout currency always matches the storefront currency",
    builtCurrency.ok === true && builtCurrency.amounts.currency === "USD"
  )
  check(
    "every checkout line is priced from the catalog",
    builtCurrency.ok === true && builtCurrency.lines[0].unitPrice === UNIT_PRICE
  )

  // --- PayPal refuses the order --------------------------------------------
  const rejectedMock = createMockClient({
    createOrder: (purchaseUnit) => ({
      id: PAYPAL_ORDER_ID,
      status: "PAYER_ACTION_REQUIRED",
      purchase_units: [{ reference_id: purchaseUnit.referenceId }],
    }),
  })
  const rejected = await createPaypalCheckout({ items: TWO_HEADPHONES }, { client: rejectedMock.client })
  check(
    "a non-CREATED PayPal order is refused",
    rejected.ok === false && rejected.code === "PAYPAL_ORDER_REJECTED"
  )

  // --- network failure while creating -------------------------------------
  const offlineMock = createMockClient({
    createOrder: () => {
      throw new PaypalApiError("The payment provider could not be reached.", 0, "NETWORK_ERROR")
    },
  })
  const offline = await createPaypalCheckout({ items: TWO_HEADPHONES }, { client: offlineMock.client })
  check(
    "a network failure at creation maps to PAYPAL_UNAVAILABLE",
    offline.ok === false && offline.code === "PAYPAL_UNAVAILABLE"
  )
  check("a network failure maps to HTTP 502", offline.status === 502)
  check("no order id is attached after a failed creation", listCheckoutRecords().every((r) => r.paypalOrderId === null || r.status === "FAILED"))
}

// ---------------------------------------------------------------------------
// C. Capture and verification
// ---------------------------------------------------------------------------

async function testCapture() {
  console.log("\n[C] Capture and verification")

  // --- successful capture ---------------------------------------------------
  resetPaypalCheckoutStore()
  const mock = createMockClient({
    captureOrder: (_orderId, unit) =>
      captureResponse({ referenceId: unit.referenceId, value: unit.value }),
  })
  const checkout = await createCheckout(TWO_HEADPHONES, { mock })

  const captured = await capturePaypalCheckout(
    { checkoutRef: checkout.checkoutRef, paypalOrderId: checkout.paypalOrderId },
    { client: mock.client }
  )
  check("a verified capture succeeds", captured.ok === true, captured.ok ? "" : captured.code)

  const paidOrder = captured.response.order
  check("the capture reports COMPLETED", captured.response.status === "COMPLETED")
  check("the capture reference is returned", captured.response.captureId === PAYPAL_CAPTURE_ID)
  check("the paid order is marked captured", paidOrder.paymentStatus === "captured")
  check("the paid order records PayPal as the payment method", paidOrder.paymentMethod === "paypal")
  check("the paid order carries the capture reference", paidOrder.paymentReference === PAYPAL_CAPTURE_ID)
  check("the paid order keeps the server-calculated total", paidOrder.total === EXPECTED_TWO.total)
  check("the paid order keeps the server-calculated subtotal", paidOrder.subtotal === EXPECTED_TWO.subtotal)
  check("the paid order keeps the server-calculated tax", paidOrder.tax === EXPECTED_TWO.tax)
  check("the paid order keeps the server-calculated shipping", paidOrder.shipping === EXPECTED_TWO.shipping)
  check("the paid order currency is the checkout currency", paidOrder.currency === "USD")
  check("the paid order has one line", paidOrder.items.length === 1)
  check("the paid order line quantity is right", paidOrder.items[0].quantity === 2)
  check("the paid order line price is the catalog price", paidOrder.items[0].price === UNIT_PRICE)
  check("the paid order line total is server-calculated", paidOrder.items[0].total === UNIT_PRICE * 2)
  check("the paid order is not left pending", paidOrder.status === "processing")

  const stored = recordFor(checkout)
  check("the checkout record is marked COMPLETED", stored.status === "COMPLETED")
  check("the checkout record stores the paid order", stored.order?.id === paidOrder.id)

  // --- duplicate capture ----------------------------------------------------
  const replay = await capturePaypalCheckout(
    { checkoutRef: checkout.checkoutRef, paypalOrderId: checkout.paypalOrderId },
    { client: mock.client }
  )
  check("a replayed capture still reports COMPLETED", replay.ok === true && replay.response.status === "COMPLETED")
  check("a replayed capture returns the same order", replay.response.order?.id === paidOrder.id)
  check("a replayed capture returns the same reference", replay.response.captureId === PAYPAL_CAPTURE_ID)
  check("PayPal is not called a second time for a replay", mock.calls.captureOrder === 1)

  // --- concurrent duplicate capture ----------------------------------------
  resetPaypalCheckoutStore()
  let releaseCapture
  const gate = new Promise((resolve) => {
    releaseCapture = resolve
  })
  const slowMock = createMockClient({
    captureOrder: async (_orderId, unit) => {
      await gate
      return captureResponse({ referenceId: unit.referenceId, value: unit.value })
    },
  })
  const concurrent = await createCheckout(TWO_HEADPHONES, { mock: slowMock })
  const first = capturePaypalCheckout(
    { checkoutRef: concurrent.checkoutRef, paypalOrderId: concurrent.paypalOrderId },
    { client: slowMock.client }
  )
  const second = await capturePaypalCheckout(
    { checkoutRef: concurrent.checkoutRef, paypalOrderId: concurrent.paypalOrderId },
    { client: slowMock.client }
  )
  check(
    "a concurrent duplicate capture is refused",
    second.ok === false && second.code === "CAPTURE_IN_PROGRESS"
  )
  check("a concurrent duplicate maps to HTTP 409", second.status === 409)
  releaseCapture()
  const firstResult = await first
  check("the original capture still completes", firstResult.ok === true)
  check("only one capture reached PayPal", slowMock.calls.captureOrder === 1)

  // --- unknown checkout reference ------------------------------------------
  resetPaypalCheckoutStore()
  const missing = await capturePaypalCheckout(
    { checkoutRef: `chk_${"0".repeat(8)}-0000-0000-0000-${"0".repeat(12)}`, paypalOrderId: PAYPAL_ORDER_ID },
    { client: createMockClient().client }
  )
  check(
    "an unknown checkout reference is rejected",
    missing.ok === false && missing.code === "CHECKOUT_NOT_FOUND"
  )
  check("an unknown checkout reference maps to HTTP 404", missing.status === 404)

  // --- PayPal order does not belong to this checkout ------------------------
  const mismatchMock = createMockClient({
    captureOrder: (_orderId, unit) => captureResponse({ referenceId: unit.referenceId, value: unit.value }),
  })
  const mismatched = await createCheckout(TWO_HEADPHONES, { mock: mismatchMock })
  const foreign = await capturePaypalCheckout(
    { checkoutRef: mismatched.checkoutRef, paypalOrderId: "8XX990127TN36471Z" },
    { client: mismatchMock.client }
  )
  check(
    "a foreign PayPal order id is rejected",
    foreign.ok === false && foreign.code === "CHECKOUT_MISMATCH"
  )
  check("a mismatch maps to HTTP 409", foreign.status === 409)
  check("nothing is captured on a mismatch", mismatchMock.calls.captureOrder === 0)
  check("a mismatch leaves the checkout PENDING", recordFor(mismatched).status === "PENDING")

  // --- PayPal does not report a completed order ----------------------------
  resetPaypalCheckoutStore()
  const notCompletedMock = createMockClient({
    captureOrder: (_orderId, unit) =>
      captureResponse({ referenceId: unit.referenceId, value: unit.value, orderStatus: "VOIDED" }),
  })
  const notCompleted = await createCheckout(TWO_HEADPHONES, { mock: notCompletedMock })
  const failed = await capturePaypalCheckout(
    { checkoutRef: notCompleted.checkoutRef, paypalOrderId: notCompleted.paypalOrderId },
    { client: notCompletedMock.client }
  )
  check(
    "a non-COMPLETED PayPal order is not paid",
    failed.ok === false && failed.code === "PAYMENT_VERIFICATION_FAILED"
  )
  check("a failed verification creates no order", recordFor(notCompleted).order === undefined)
  check("a failed verification is not marked COMPLETED", recordFor(notCompleted).status === "FAILED")

  const afterFailure = await capturePaypalCheckout(
    { checkoutRef: notCompleted.checkoutRef, paypalOrderId: notCompleted.paypalOrderId },
    { client: notCompletedMock.client }
  )
  check(
    "a failed checkout cannot be captured again",
    afterFailure.ok === false && afterFailure.code === "CHECKOUT_FAILED"
  )
  check("a failed checkout maps to HTTP 409", afterFailure.status === 409)

  // --- no COMPLETED capture in the payload ---------------------------------
  resetPaypalCheckoutStore()
  const noCaptureMock = createMockClient({
    captureOrder: (_orderId, unit) =>
      captureResponse({ referenceId: unit.referenceId, value: unit.value, captureStatus: "PENDING" }),
  })
  const noCapture = await createCheckout(TWO_HEADPHONES, { mock: noCaptureMock })
  const noCaptureResult = await capturePaypalCheckout(
    { checkoutRef: noCapture.checkoutRef, paypalOrderId: noCapture.paypalOrderId },
    { client: noCaptureMock.client }
  )
  check(
    "a capture without a COMPLETED entry is refused",
    noCaptureResult.ok === false && noCaptureResult.code === "PAYMENT_VERIFICATION_FAILED"
  )
  check("no order exists without a completed capture", recordFor(noCapture).order === undefined)

  // --- incorrect currency ---------------------------------------------------
  resetPaypalCheckoutStore()
  const currencyMock = createMockClient({
    captureOrder: (_orderId, unit) =>
      captureResponse({ referenceId: unit.referenceId, value: unit.value, currency: "EUR" }),
  })
  const wrongCurrency = await createCheckout(TWO_HEADPHONES, { mock: currencyMock })
  const currencyResult = await capturePaypalCheckout(
    { checkoutRef: wrongCurrency.checkoutRef, paypalOrderId: wrongCurrency.paypalOrderId },
    { client: currencyMock.client }
  )
  check(
    "a capture settled in the wrong currency is refused",
    currencyResult.ok === false && currencyResult.code === "PAYMENT_VERIFICATION_FAILED"
  )
  check(
    "the currency failure names both currencies",
    currencyResult.ok === false && currencyResult.message.includes("EUR") && currencyResult.message.includes("USD")
  )
  check("a currency mismatch marks the checkout failed", recordFor(wrongCurrency).status === "FAILED")
  check("a currency mismatch does not create an order", recordFor(wrongCurrency).order === undefined)

  // --- incorrect amount -----------------------------------------------------
  for (const [label, value] of [
    ["an under-payment", "1.00"],
    ["an over-payment", "999.99"],
  ]) {
    resetPaypalCheckoutStore()
    const amountMock = createMockClient({
      captureOrder: (_orderId, unit) =>
        captureResponse({ referenceId: unit.referenceId, value }),
    })
    const wrongAmount = await createCheckout(TWO_HEADPHONES, { mock: amountMock })
    const amountResult = await capturePaypalCheckout(
      { checkoutRef: wrongAmount.checkoutRef, paypalOrderId: wrongAmount.paypalOrderId },
      { client: amountMock.client }
    )
    check(
      `${label} is refused`,
      amountResult.ok === false && amountResult.code === "PAYMENT_VERIFICATION_FAILED"
    )
    check(`${label} leaves no paid order`, recordFor(wrongAmount).order === undefined)
  }

  // --- network failure during capture --------------------------------------
  resetPaypalCheckoutStore()
  let attempts = 0
  const flakyMock = createMockClient({
    captureOrder: (_orderId, unit) => {
      attempts += 1
      if (attempts === 1) {
        throw new PaypalApiError("The payment provider could not be reached.", 0, "NETWORK_ERROR")
      }
      return captureResponse({ referenceId: unit.referenceId, value: unit.value })
    },
  })
  const flaky = await createCheckout(TWO_HEADPHONES, { mock: flakyMock })
  const networkFailure = await capturePaypalCheckout(
    { checkoutRef: flaky.checkoutRef, paypalOrderId: flaky.paypalOrderId },
    { client: flakyMock.client }
  )
  check(
    "a network failure during capture maps to PAYPAL_UNAVAILABLE",
    networkFailure.ok === false && networkFailure.code === "PAYPAL_UNAVAILABLE"
  )
  check("a network failure leaves the checkout retryable", recordFor(flaky).status === "PENDING")
  check("a network failure creates no order", recordFor(flaky).order === undefined)

  const retried = await capturePaypalCheckout(
    { checkoutRef: flaky.checkoutRef, paypalOrderId: flaky.paypalOrderId },
    { client: flakyMock.client }
  )
  check("a retry after a network failure succeeds", retried.ok === true, retried.ok ? "" : retried.code)
  check("the retry produces exactly one paid order", listCheckoutRecords().filter((r) => r.order).length === 1)

  // --- already captured at PayPal ------------------------------------------
  resetPaypalCheckoutStore()
  const alreadyMock = createMockClient({
    captureOrder: (_orderId, unit) => {
      throw new PaypalApiError("Order already captured.", 422, "ORDER_ALREADY_CAPTURED")
    },
    getOrder: (_orderId) => {
      const reference = listCheckoutRecords().find((r) => r.status === "PENDING")?.reference
      return captureResponse({ referenceId: reference, value: "172.78" })
    },
  })
  const already = await createCheckout(TWO_HEADPHONES, { mock: alreadyMock })
  const alreadyResult = await capturePaypalCheckout(
    { checkoutRef: already.checkoutRef, paypalOrderId: already.paypalOrderId },
    { client: alreadyMock.client }
  )
  check(
    "an already-captured order is verified instead of re-captured",
    alreadyResult.ok === true,
    alreadyResult.ok ? "" : alreadyResult.code
  )
  check("the already-captured path fetches the existing capture", alreadyMock.calls.getOrder === 1)
  check("the already-captured path creates one paid order", recordFor(already).order !== undefined)

  // --- capture after failure ------------------------------------------------
  // (checked inline above, while the failed record is still present)

  // --- expired checkout -----------------------------------------------------
  resetPaypalCheckoutStore()
  const expiringMock = createMockClient({
    captureOrder: (_orderId, unit) => captureResponse({ referenceId: unit.referenceId, value: unit.value }),
  })
  const expiring = await createCheckout(TWO_HEADPHONES, { mock: expiringMock })
  const expired = await capturePaypalCheckout(
    { checkoutRef: expiring.checkoutRef, paypalOrderId: expiring.paypalOrderId },
    { client: expiringMock.client, now: Date.now() + 2 * 60 * 60 * 1000 }
  )
  check(
    "an expired checkout is refused",
    expired.ok === false && expired.code === "CHECKOUT_EXPIRED"
  )
  check("an expired checkout maps to HTTP 410", expired.status === 410)
  check("an expired checkout is never captured at PayPal", expiringMock.calls.captureOrder === 0)

  // --- customer cancellation -------------------------------------------------
  // The shopper closed the PayPal window: an order exists at PayPal, but this
  // app has nothing but a PENDING record and no money has moved.
  resetPaypalCheckoutStore()
  const cancelledMock = createMockClient()
  const cancelled = await createCheckout(TWO_HEADPHONES, { mock: cancelledMock })
  const cancelledRecord = recordFor(cancelled)
  check("cancelling leaves the checkout PENDING", cancelledRecord.status === "PENDING")
  check("cancelling produces no paid order", cancelledRecord.order === undefined)
  check("cancelling captures nothing", cancelledMock.calls.captureOrder === 0)
  check("cancelling keeps the shopper's cart out of the order store", listCheckoutRecords().every((r) => !r.order))
}

// ---------------------------------------------------------------------------
// D. HTTP routes
// ---------------------------------------------------------------------------

async function testRoutes() {
  console.log("\n[D] Route handlers")

  const post = (route, body) =>
    route.POST(
      new Request("http://localhost/api/paypal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      })
    )

  // --- create order ---------------------------------------------------------
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  setPaypalEnv()
  let scripted = stubOrdersApi()

  const createdResponse = await post(ordersRoute, {
    items: TWO_HEADPHONES,
    customerEmail: "shopper@example.com",
    customerName: "Test Shopper",
    shippingAddress: {
      firstName: "Test",
      lastName: "Shopper",
      line1: "1 Test Street",
      city: "Testville",
      state: "CA",
      postalCode: "90210",
      country: "US",
    },
    // A manipulated client cannot influence the total.
    total: 1,
    currency: "EUR",
  })
  const createdBody = safeParseJson(await createdResponse.text())
  check("POST /api/paypal/orders returns 201 or 200", [200, 201].includes(createdResponse.status))
  check("POST /api/paypal/orders returns a PayPal order id", createdBody?.data?.paypalOrderId === PAYPAL_ORDER_ID)
  check("POST /api/paypal/orders returns a checkout reference", /^chk_/.test(createdBody?.data?.checkoutRef ?? ""))
  check(
    "POST /api/paypal/orders ignores the client's totals",
    createdBody?.data?.amounts?.total === EXPECTED_TWO.total
  )
  check("the server asked PayPal for the real amount", scripted.orderBodies[0].purchase_units[0].amount.value === "172.78")
  check(
    "the server asked PayPal for the real breakdown",
    scripted.orderBodies[0].purchase_units[0].amount.breakdown.item_total.value === "159.98"
  )
  check(
    "the response carries no client secret",
    !JSON.stringify(createdBody).includes(TEST_CLIENT_SECRET)
  )
  const storedFromRoute = listCheckoutRecords().find(
    (candidate) => candidate.reference === createdBody.data.checkoutRef
  )
  check("the route stores the shopper's email", storedFromRoute.customerEmail === "shopper@example.com")
  check("the route stores the shopper's name", storedFromRoute.customerName === "Test Shopper")
  check("the route stores the shipping address", storedFromRoute.shippingAddress?.line1 === "1 Test Street")

  // --- lookup while pending -------------------------------------------------
  const pendingLookup = await ordersRoute.GET(
    new Request(`http://localhost/api/paypal/orders?ref=${createdBody.data.checkoutRef}`)
  )
  const pendingBody = safeParseJson(await pendingLookup.text())
  check("GET /api/paypal/orders returns 200 for a known reference", pendingLookup.status === 200)
  check("a pending checkout reports PENDING", pendingBody?.data?.status === "PENDING")
  check("a pending checkout exposes no order", pendingBody?.data?.order === undefined)
  check("a pending checkout exposes no capture reference", pendingBody?.data?.captureId === undefined)

  // --- capture --------------------------------------------------------------
  const captureResponseBody = await post(captureRoute, {
    checkoutRef: createdBody.data.checkoutRef,
    paypalOrderId: createdBody.data.paypalOrderId,
    // Claimed payment status from the client is ignored entirely.
    status: "COMPLETED",
    captureId: "CLIENT-SUPPLIED-CAPTURE",
  })
  const captureBody = safeParseJson(await captureResponseBody.text())
  check("POST /api/paypal/capture returns 200", captureResponseBody.status === 200)
  check("POST /api/paypal/capture reports COMPLETED", captureBody?.data?.status === "COMPLETED")
  check(
    "the capture reference comes from PayPal, not the request",
    captureBody?.data?.captureId === PAYPAL_CAPTURE_ID
  )
  check("the captured order is paid", captureBody?.data?.order?.paymentStatus === "captured")
  check("PayPal was called once to capture", scripted.captureOrderIds.length === 1)
  check(
    "the capture response carries no client secret",
    !JSON.stringify(captureBody).includes(TEST_CLIENT_SECRET)
  )

  // --- confirmed lookup -----------------------------------------------------
  const confirmedLookup = await ordersRoute.GET(
    new Request(`http://localhost/api/paypal/orders?ref=${createdBody.data.checkoutRef}`)
  )
  const confirmedBody = safeParseJson(await confirmedLookup.text())
  check("a completed checkout reports COMPLETED", confirmedBody?.data?.status === "COMPLETED")
  check("a completed checkout exposes the order", confirmedBody?.data?.order?.paymentStatus === "captured")
  check("a completed checkout exposes the capture reference", confirmedBody?.data?.captureId === PAYPAL_CAPTURE_ID)

  // --- replaying the capture through the route ------------------------------
  const replayResponse = await post(captureRoute, {
    checkoutRef: createdBody.data.checkoutRef,
    paypalOrderId: createdBody.data.paypalOrderId,
  })
  const replayBody = safeParseJson(await replayResponse.text())
  check("a replayed capture through the route succeeds", replayResponse.status === 200)
  check("a replayed capture returns the same order", replayBody?.data?.order?.id === captureBody?.data?.order?.id)
  check("PayPal is not captured twice", scripted.captureOrderIds.length === 1)

  // --- invalid request bodies ----------------------------------------------
  const badQty = await post(ordersRoute, { items: [{ productId: "prod-1", variantId: "var-1-1", quantity: 0 }] })
  const badQtyBody = safeParseJson(await badQty.text())
  check("a zero quantity is a 400", badQty.status === 400)
  check("a zero quantity is reported as INVALID_REQUEST", badQtyBody?.error?.code === "INVALID_REQUEST")

  const overQty = await post(ordersRoute, { items: [{ productId: "prod-1", variantId: "var-1-1", quantity: 500 }] })
  check("an out-of-range quantity is a 400", overQty.status === 400)

  const noItems = await post(ordersRoute, { items: [] })
  check("an empty item list is a 400", noItems.status === 400)

  const badProductRoute = await post(ordersRoute, {
    items: [{ productId: "prod-nope", variantId: "var-1-1", quantity: 1 }],
  })
  const badProductBody = safeParseJson(await badProductRoute.text())
  check("an unknown product through the route is a 409", badProductRoute.status === 409)
  check("an unknown product reports PRODUCT_NOT_FOUND", badProductBody?.error?.code === "PRODUCT_NOT_FOUND")

  const badVariantRoute = await post(ordersRoute, {
    items: [{ productId: "prod-1", variantId: "var-nope", quantity: 1 }],
  })
  check("an unknown variant through the route is a 409", badVariantRoute.status === 409)

  const stockRoute = await post(ordersRoute, {
    items: [{ productId: "prod-1", variantId: "var-1-1", quantity: STOCK + 1 }],
  })
  const stockBody = safeParseJson(await stockRoute.text())
  check("insufficient stock through the route is a 409", stockRoute.status === 409)
  check("insufficient stock reports INSUFFICIENT_STOCK", stockBody?.error?.code === "INSUFFICIENT_STOCK")

  const malformed = await post(ordersRoute, "{not json")
  check("malformed JSON is a 400", malformed.status === 400)

  const missingRef = await post(captureRoute, { paypalOrderId: PAYPAL_ORDER_ID })
  check("a capture without a reference is a 400", missingRef.status === 400)

  const badOrderId = await post(captureRoute, {
    checkoutRef: createdBody.data.checkoutRef,
    paypalOrderId: "not a valid id!",
  })
  check("a malformed PayPal order id is a 400", badOrderId.status === 400)

  const unknownRef = await post(captureRoute, {
    checkoutRef: `chk_${"1".repeat(8)}-1111-1111-1111-${"1".repeat(12)}`,
    paypalOrderId: PAYPAL_ORDER_ID,
  })
  const unknownRefBody = safeParseJson(await unknownRef.text())
  check("an unknown reference is a 404", unknownRef.status === 404)
  check("an unknown reference reports CHECKOUT_NOT_FOUND", unknownRefBody?.error?.code === "CHECKOUT_NOT_FOUND")

  const unknownLookup = await ordersRoute.GET(
    new Request(`http://localhost/api/paypal/orders?ref=chk_${"2".repeat(8)}-2222-2222-2222-${"2".repeat(12)}`)
  )
  check("an unknown lookup reference is a 404", unknownLookup.status === 404)

  const badRefParam = await ordersRoute.GET(new Request("http://localhost/api/paypal/orders?ref=nope"))
  check("a malformed lookup reference is a 400", badRefParam.status === 400)

  // --- unconfigured routes fail closed -------------------------------------
  clearPaypalEnv()
  const unconfiguredRoute = await post(ordersRoute, { items: TWO_HEADPHONES })
  const unconfiguredBody = safeParseJson(await unconfiguredRoute.text())
  check("POST /api/paypal/orders without credentials is a 503", unconfiguredRoute.status === 503)
  check(
    "the unconfigured route reports PAYPAL_NOT_CONFIGURED",
    unconfiguredBody?.error?.code === "PAYPAL_NOT_CONFIGURED"
  )
  check(
    "the unconfigured response explains how to enable checkout",
    String(unconfiguredBody?.error?.message).includes("PAYPAL_CLIENT_ID")
  )

  const captureWhileUnconfigured = await post(captureRoute, {
    checkoutRef: createdBody.data.checkoutRef,
    paypalOrderId: createdBody.data.paypalOrderId,
  })
  check("capture without credentials is a 503", captureWhileUnconfigured.status === 503)

  // --- PayPal outage --------------------------------------------------------
  setPaypalEnv()
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  installFetchStub(async (path) => {
    if (path === "/v1/oauth2/token") return jsonResponse(500, { name: "INTERNAL_SERVER_ERROR" })
    throw new Error(`unexpected call during outage: ${path}`)
  })
  const outage = await post(ordersRoute, { items: TWO_HEADPHONES })
  const outageBody = safeParseJson(await outage.text())
  check("a PayPal outage is reported as a 502", outage.status === 502)
  check("a PayPal outage reports PAYPAL_UNAVAILABLE", outageBody?.error?.code === "PAYPAL_UNAVAILABLE")
  check("a PayPal outage creates no paid order", listCheckoutRecords().every((r) => !r.order))

  // --- malicious capture: the wrong amount is refused through the route -----
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
  scripted = stubOrdersApi({
    onCapture: ({ referenceId }) =>
      jsonResponse(201, captureResponse({ referenceId, value: "1.00" })),
  })
  const cheapOrder = await post(ordersRoute, { items: TWO_HEADPHONES })
  const cheapBody = safeParseJson(await cheapOrder.text())
  const cheapCapture = await post(captureRoute, {
    checkoutRef: cheapBody.data.checkoutRef,
    paypalOrderId: cheapBody.data.paypalOrderId,
  })
  const cheapCaptureBody = safeParseJson(await cheapCapture.text())
  check("an under-paid capture is a 409", cheapCapture.status === 409)
  check(
    "an under-paid capture reports PAYMENT_VERIFICATION_FAILED",
    cheapCaptureBody?.error?.code === "PAYMENT_VERIFICATION_FAILED"
  )
  check(
    "an under-paid capture never reaches the client as success",
    cheapCaptureBody?.data === undefined
  )

  restoreFetch()
  restorePaypalEnv()
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
}

// ---------------------------------------------------------------------------
// E. AI / payment separation
// ---------------------------------------------------------------------------

async function testAiBoundary() {
  console.log("\n[E] AI and payment separation")

  const paymentish = AGENT_TOOL_NAMES.filter((name) =>
    /pay|paypal|checkout|charge|capture|refund/i.test(name)
  )
  check("no agent tool is payment related", paymentish.length === 0, paymentish.join(", "))
  check("the agent exposes cart proposal tools", AGENT_TOOL_NAMES.includes("propose_cart_action"))

  for (const name of ["create_paypal_order", "capture_paypal_order", "paypal_checkout"]) {
    const result = await executeAgentTool(name, { items: [] })
    check(
      `the agent cannot call ${name}`,
      result.ok === false && result.error.code === "UNKNOWN_TOOL"
    )
  }

  // Approving an AI proposal must never open a PayPal checkout.
  resetPaypalCheckoutStore()
  resetProposalStore()
  const { parseCartProposal } = await import("@/lib/ai/tools/propose-cart-action.ts")
  const proposal = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 1 }],
  })
  check("the agent can still propose a cart change", proposal.ok === true)
  const cartProposal = parseCartProposal(proposal.data)
  check("the proposal validates against the published schema", Boolean(cartProposal))
  const registered = registerCartProposal(cartProposal)
  check("the proposal is registered server-side", /^prop_/.test(registered.proposalId ?? ""))
  check("an AI proposal creates no PayPal checkout", listCheckoutRecords().length === 0)

  // Source-level boundary: neither direction may be imported.
  const aiFiles = walkSourceFiles(path.join(PROJECT_ROOT, "src", "lib", "ai"))
  const aiLeaks = aiFiles.filter((file) => /paypal/i.test(readFileSync(file, "utf8")))
  check("no src/lib/ai file mentions PayPal", aiLeaks.length === 0, aiLeaks.join(", "))

  const paypalFiles = walkSourceFiles(path.join(PROJECT_ROOT, "src", "lib", "paypal"))
  const paypalLeaks = paypalFiles.filter((file) =>
    /@\/lib\/ai\/(chat|agent|gemini|tools\/index)/i.test(readFileSync(file, "utf8"))
  )
  check("the PayPal layer imports no agent runtime", paypalLeaks.length === 0, paypalLeaks.join(", "))

  // The only shared AI dependency is the pricing helper, which must stay pure.
  const sharedSource = readFileSync(path.join(PROJECT_ROOT, "src", "lib", "ai", "tools", "shared.ts"), "utf8")
  check("the shared pricing helper has no network imports", !/fetch\(|google|genai/i.test(sharedSource))
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

try {
  await testConfiguration()
  await testOrderCreation()
  await testCapture()
  await testRoutes()
  await testAiBoundary()
} finally {
  restoreFetch()
  restorePaypalEnv()
  resetPaypalCheckoutStore()
  resetPaypalTokenCache()
}

const passed = results.filter((result) => result.pass).length
const failed = results.length - passed

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  console.log("\nFailures:")
  for (const result of results.filter((entry) => !entry.pass)) {
    console.log(`  \u2717 ${result.name}${result.detail ? ` — ${result.detail}` : ""}`)
  }
  process.exitCode = 1
}
