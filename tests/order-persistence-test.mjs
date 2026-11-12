// Task 21 — Persistent Order Management & Order History test suite.
//
// Sections A–D are deterministic and run in-process:
//   * Exercises JsonOrderRepository directly against an isolated temporary storage file.
//   * Exercises PayPal capture integration with repository persistence.
//   * Exercises GET /api/orders and GET /api/orders/[id] route handlers with Request objects.
//   * Simulates process restarts / storage reloads.
//
// Section E exercises the live HTTP endpoints against port 3000 if reachable.
//
// Run: node tests/order-persistence-test.mjs
import { register } from "node:module"
import { mkdtempSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
nextEnv.loadEnvConfig(PROJECT_ROOT)
register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const { JsonOrderRepository } = await import("@/lib/repositories/json-order-repository.ts")
const { orderRepository } = await import("@/lib/repositories/index.ts")
const { capturePaypalCheckout, createPaypalCheckout } = await import("@/lib/paypal/checkout.ts")
const { resetPaypalCheckoutStore } = await import("@/lib/paypal/checkout-store.ts")

const ordersListRoute = await import("@/app/api/orders/route.ts")
const orderDetailsRoute = await import("@/app/api/orders/[id]/route.ts")

const BASE_URL_CANDIDATES = process.env.BASE_URL
  ? [process.env.BASE_URL]
  : ["http://localhost:3000", "http://localhost:3001", "http://localhost:3100"]

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

// ---------------------------------------------------------------------------
// Helpers & Fixtures
// ---------------------------------------------------------------------------

function makeSampleOrder(overrides = {}) {
  const id = overrides.id || `chk_${Math.random().toString(36).slice(2, 10)}`
  const now = new Date().toISOString()

  return {
    id,
    orderNumber: `ORD-${Date.now().toString(36).toUpperCase()}`,
    userId: "user-2",
    customerEmail: "demo@example.com",
    customerName: "Jane Smith",
    status: "processing",
    paymentStatus: "captured",
    paymentMethod: "paypal",
    paymentReference: `CAPTURE-${Math.random().toString(36).slice(2, 10)}`,
    paypalOrderId: `PAYPAL-${Math.random().toString(36).slice(2, 10)}`,
    currency: "USD",
    subtotal: 12000,
    shipping: 0,
    tax: 840,
    total: 12840,
    items: [
      {
        id: "var-1",
        productId: "prod-1",
        variantId: "var-1",
        name: "Wireless Over-Ear Headphones",
        variantName: "Black",
        sku: "HDPH-BLK",
        price: 12000,
        quantity: 1,
        total: 12000,
        image: { url: "/images/headphones.jpg", alt: "Headphones" },
      },
    ],
    shippingAddress: {
      id: "addr-1",
      type: "shipping",
      firstName: "Jane",
      lastName: "Smith",
      line1: "123 Market St",
      city: "San Francisco",
      state: "CA",
      postalCode: "94105",
      country: "US",
      isDefault: true,
    },
    createdAt: now,
    updatedAt: now,
    completedAt: now,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Section A: Persistent Storage Contract (JsonOrderRepository)
// ---------------------------------------------------------------------------

async function testRepositoryContract() {
  console.log("\n[A] Persistent Storage Contract (JsonOrderRepository)")

  const tempDir = mkdtempSync(path.join(tmpdir(), "orders-test-"))
  const testFile = path.join(tempDir, "test-orders.json")
  const repo = new JsonOrderRepository(testFile)

  try {
    // 1. Initial empty read
    const initial = await repo.list()
    check("initial read on missing/empty file returns empty list", initial.items.length === 0)
    check("initial pagination total is 0", initial.pagination.total === 0)

    // 2. Create order
    const sample = makeSampleOrder({ id: "ord-test-1", userId: "user-2" })
    const created = await repo.create(sample)
    check("order creation returns created order", created.id === "ord-test-1")
    check("creation persists to disk", existsSync(testFile))

    // 3. Retrieve by ID
    const fetched = await repo.getById("ord-test-1")
    check("getById returns the stored order", fetched !== null && fetched.id === "ord-test-1")
    check("stored order has correct total", fetched?.total === 12840)
    check("stored order has correct customer email", fetched?.customerEmail === "demo@example.com")
    check("stored order has PayPal payment reference", fetched?.paymentReference === sample.paymentReference)
    check("stored order has PayPal order ID", fetched?.paypalOrderId === sample.paypalOrderId)

    // 4. Retrieve by payment reference
    const byRef = await repo.getById(sample.paymentReference)
    check("getById can lookup by payment reference", byRef !== null && byRef.id === "ord-test-1")

    // 5. Idempotency: duplicate creation does not add new record
    const dup = await repo.create(sample)
    check("duplicate create returns existing order", dup.id === sample.id)
    const afterDup = await repo.list()
    check("duplicate create did not increase total count", afterDup.pagination.total === 1)

    // Duplicate by payment reference
    const dupRef = await repo.create(makeSampleOrder({ id: "ord-test-diff", paymentReference: sample.paymentReference }))
    check("duplicate create by paymentReference returns existing order", dupRef.id === sample.id)
    const afterDupRef = await repo.list()
    check("store still has exactly 1 order", afterDupRef.pagination.total === 1)

    // 6. User filtering and pagination
    const orderUser1 = makeSampleOrder({ id: "ord-user-1", userId: "user-1", customerEmail: "admin@example.com" })
    await repo.create(orderUser1)

    const user2Orders = await repo.list("user-2")
    check("filtering by user-2 returns only user-2 orders", user2Orders.items.length === 1 && user2Orders.items[0].userId === "user-2")

    const user1Orders = await repo.list("user-1")
    check("filtering by user-1 returns only user-1 orders", user1Orders.items.length === 1 && user1Orders.items[0].userId === "user-1")

    const emailFiltered = await repo.list("admin@example.com")
    check("filtering by email returns matching orders", emailFiltered.items.length === 1)

    // 7. Update status
    const updated = await repo.updateStatus("ord-test-1", "shipped")
    check("updateStatus updates order status", updated.status === "shipped")
    const reFetched = await repo.getById("ord-test-1")
    check("re-fetch reflects updated status", reFetched?.status === "shipped")

    // 8. Server restart / Process restart simulation
    const freshRepoInstance = new JsonOrderRepository(testFile)
    const persisted = await freshRepoInstance.getById("ord-test-1")
    check("new repository instance reads orders persisted from prior instance", persisted !== null && persisted.status === "shipped")
    const persistedList = await freshRepoInstance.list()
    check("new instance lists all 2 orders across restarts", persistedList.pagination.total === 2)
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Section B: PayPal Capture & Persistence Integration
// ---------------------------------------------------------------------------

async function testPaypalCapturePersistence() {
  console.log("\n[B] PayPal Capture & Persistence Integration")

  const tempDir = mkdtempSync(path.join(tmpdir(), "paypal-orders-"))
  const testFile = path.join(tempDir, "paypal-orders.json")

  const originalPath = orderRepository.getStoragePath()
  orderRepository.setStoragePath(testFile)

  resetPaypalCheckoutStore()

  try {
    // 1. Create a checkout with mock client
    const mockOrder = {
      id: "PAYPAL-ORDER-100",
      status: "COMPLETED",
      purchase_units: [
        {
          reference_id: "",
          amount: { currency_code: "USD", value: "86.39" },
          payments: {
            captures: [
              {
                id: "MOCK-CAPTURE-100",
                status: "COMPLETED",
                amount: { currency_code: "USD", value: "86.39" },
              },
            ],
          },
        },
      ],
    }

    const mockClient = {
      createOrder: async () => ({ id: "PAYPAL-ORDER-100", status: "CREATED" }),
      captureOrder: async () => mockOrder,
      getOrder: async () => mockOrder,
    }

    const createdCheckout = await createPaypalCheckout(
      {
        items: [{ productId: "prod-1", variantId: "var-1-1", quantity: 1 }],
        customerEmail: "jane@example.com",
        customerName: "Jane Smith",
        userId: "user-2",
      },
      { client: mockClient }
    )
    assert(createdCheckout.ok, "create checkout failed")
    const { checkoutRef, paypalOrderId } = createdCheckout.response
    mockOrder.purchase_units[0].reference_id = checkoutRef

    // Before capture: repository must NOT have this order
    const beforeCapture = await orderRepository.getById(checkoutRef)
    check("before capture, order is NOT in persistent storage", beforeCapture === null)

    // 2. Successful Capture
    const captureResult = await capturePaypalCheckout(
      { checkoutRef, paypalOrderId },
      { client: mockClient }
    )
    check("capture succeeds", captureResult.ok === true)
    if (captureResult.ok) {
      check("capture reports COMPLETED", captureResult.response.status === "COMPLETED")
      check("capture returns order object", captureResult.response.order !== undefined)
    }

    // After capture: order MUST be in persistent storage
    const storedOrder = await orderRepository.getById(checkoutRef)
    check("after capture, order is saved in persistent storage", storedOrder !== null)
    check("stored order matches checkout reference ID", storedOrder?.id === checkoutRef)
    check("stored order has userId attached", storedOrder?.userId === "user-2")
    check("stored order has capture ID attached", storedOrder?.paymentReference === "MOCK-CAPTURE-100")
    check("stored order has paypalOrderId attached", storedOrder?.paypalOrderId === paypalOrderId)
    check("stored order status is processing", storedOrder?.status === "processing")
    check("stored order paymentStatus is captured", storedOrder?.paymentStatus === "captured")

    // 3. Failed capture must NOT persist an order
    const failedOrder = {
      id: "PAYPAL-ORDER-FAIL",
      status: "VOIDED",
      purchase_units: [{ reference_id: "", amount: { currency_code: "USD", value: "10.00" } }],
    }
    const failClient = {
      createOrder: async () => ({ id: "PAYPAL-ORDER-FAIL", status: "CREATED" }),
      captureOrder: async () => failedOrder,
      getOrder: async () => failedOrder,
    }
    const failCheckout = await createPaypalCheckout(
      { items: [{ productId: "prod-1", variantId: "var-1-1", quantity: 1 }] },
      { client: failClient }
    )
    assert(failCheckout.ok, "fail checkout create failed")
    failedOrder.purchase_units[0].reference_id = failCheckout.response.checkoutRef

    const failCapture = await capturePaypalCheckout(
      { checkoutRef: failCheckout.response.checkoutRef, paypalOrderId: "PAYPAL-ORDER-FAIL" },
      { client: failClient }
    )
    check("failed capture returns failure", failCapture.ok === false)
    const orderAfterFail = await orderRepository.getById(failCheckout.response.checkoutRef)
    check("failed capture did NOT create a completed order in storage", orderAfterFail === null)

    // 4. Duplicate capture replay must not duplicate orders
    const replayResult = await capturePaypalCheckout(
      { checkoutRef, paypalOrderId },
      { client: mockClient }
    )
    check("replayed capture returns COMPLETED", replayResult.ok && replayResult.response.status === "COMPLETED")
    const allOrders = await orderRepository.list()
    check("duplicate capture did not duplicate the order in storage", allOrders.pagination.total === 1)

    // 5. Server restart recovery: reset in-memory checkouts and verify recovery
    resetPaypalCheckoutStore()
    const recovered = await capturePaypalCheckout(
      { checkoutRef, paypalOrderId },
      { client: mockClient }
    )
    check("after in-memory store reset, capture still succeeds from persistent storage", recovered.ok && recovered.response.status === "COMPLETED")
    check("recovered response contains the persisted order", recovered.ok && recovered.response.order?.id === checkoutRef)
  } finally {
    orderRepository.setStoragePath(originalPath)
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Section C: Order History & Details APIs
// ---------------------------------------------------------------------------

async function testOrderApis() {
  console.log("\n[C] Order History & Details APIs (/api/orders, /api/orders/[id])")

  const tempDir = mkdtempSync(path.join(tmpdir(), "api-orders-"))
  const testFile = path.join(tempDir, "api-orders.json")

  const originalPath = orderRepository.getStoragePath()
  orderRepository.setStoragePath(testFile)

  try {
    const user1Order = makeSampleOrder({ id: "ord-u1", userId: "user-1", customerEmail: "admin@example.com" })
    const user2Order = makeSampleOrder({ id: "ord-u2", userId: "user-2", customerEmail: "demo@example.com" })
    await orderRepository.create(user1Order)
    await orderRepository.create(user2Order)

    // 1. Unauthenticated GET /api/orders -> 401
    const unauthReq = new Request("http://localhost/api/orders")
    const unauthRes = await ordersListRoute.GET(unauthReq)
    check("unauthenticated GET /api/orders returns 401", unauthRes.status === 401)
    const unauthBody = await unauthRes.json()
    check("401 response has UNAUTHORIZED code", unauthBody.error?.code === "UNAUTHORIZED")

    // 2. Authenticated customer (user-2) GET /api/orders -> only user-2 orders
    const user2Req = new Request("http://localhost/api/orders", {
      headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
    })
    const user2Res = await ordersListRoute.GET(user2Req)
    check("authenticated customer GET /api/orders returns 200", user2Res.status === 200)
    const user2Body = await user2Res.json()
    check("response returns exactly user-2 orders", user2Body.data?.items?.length === 1)
    check("order in list belongs to user-2", user2Body.data?.items?.[0]?.id === "ord-u2")

    // 3. Cross-user access attempt -> 403 Forbidden
    const crossReq = new Request("http://localhost/api/orders?userId=user-1", {
      headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
    })
    const crossRes = await ordersListRoute.GET(crossReq)
    check("cross-user order history request returns 403 FORBIDDEN", crossRes.status === 403)

    // 4. Invalid pagination parameters -> 400
    const invalidReq = new Request("http://localhost/api/orders?page=-5", {
      headers: { "x-user-id": "user-2" },
    })
    const invalidRes = await ordersListRoute.GET(invalidReq)
    check("invalid pagination parameter returns 400", invalidRes.status === 400)

    // 5. Unauthenticated GET /api/orders/[id] -> 401
    const unauthDetailReq = new Request("http://localhost/api/orders/ord-u2")
    const unauthDetailRes = await orderDetailsRoute.GET(unauthDetailReq, {
      params: Promise.resolve({ id: "ord-u2" }),
    })
    check("unauthenticated GET /api/orders/[id] returns 401", unauthDetailRes.status === 401)

    // 6. Non-existent order ID -> 404
    const notFoundReq = new Request("http://localhost/api/orders/ord-nonexistent", {
      headers: { "x-user-id": "user-2" },
    })
    const notFoundRes = await orderDetailsRoute.GET(notFoundReq, {
      params: Promise.resolve({ id: "ord-nonexistent" }),
    })
    check("non-existent order ID returns 404 ORDER_NOT_FOUND", notFoundRes.status === 404)

    // 7. Invalid order ID format -> 400
    const malformedReq = new Request("http://localhost/api/orders/<invalid>", {
      headers: { "x-user-id": "user-2" },
    })
    const malformedRes = await orderDetailsRoute.GET(malformedReq, {
      params: Promise.resolve({ id: "<invalid>" }),
    })
    check("malformed order ID returns 400 INVALID_REQUEST", malformedRes.status === 400)

    // 8. Cross-user order details attempt -> 404 (prevents enumeration)
    const unauthorizedDetailReq = new Request("http://localhost/api/orders/ord-u1", {
      headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
    })
    const unauthorizedDetailRes = await orderDetailsRoute.GET(unauthorizedDetailReq, {
      params: Promise.resolve({ id: "ord-u1" }),
    })
    check("attempt to view another customer's order returns 404", unauthorizedDetailRes.status === 404)

    // 9. Legitimate customer viewing own order -> 200
    const ownerDetailReq = new Request("http://localhost/api/orders/ord-u2", {
      headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
    })
    const ownerDetailRes = await orderDetailsRoute.GET(ownerDetailReq, {
      params: Promise.resolve({ id: "ord-u2" }),
    })
    check("owner viewing own order returns 200", ownerDetailRes.status === 200)
    const ownerBody = await ownerDetailRes.json()
    check("order details contain verified total", ownerBody.data?.total === 12840)
    check("order details contain items list", ownerBody.data?.items?.length === 1)
    check("order details contain paymentReference", ownerBody.data?.paymentReference !== undefined)
    check("order details contain paymentStatus", ownerBody.data?.paymentStatus === "captured")
    check("order details contain customerEmail", ownerBody.data?.customerEmail === "demo@example.com")

    // 10. Admin customer accessing order -> 200
    const adminDetailReq = new Request("http://localhost/api/orders/ord-u2", {
      headers: { "x-user-id": "user-1", "x-user-email": "admin@example.com" },
    })
    const adminDetailRes = await orderDetailsRoute.GET(adminDetailReq, {
      params: Promise.resolve({ id: "ord-u2" }),
    })
    check("admin can view customer order", adminDetailRes.status === 200)
  } finally {
    orderRepository.setStoragePath(originalPath)
    try {
      rmSync(tempDir, { recursive: true, force: true })
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// Section D: Live HTTP API tests (against running server)
// ---------------------------------------------------------------------------

async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const base = candidate.replace(/\/$/, "")
    try {
      const response = await fetch(`${base}/api/orders`, {
        method: "GET",
      })
      if (response.status === 401) return base
    } catch {}
  }
  return null
}

async function testLiveServer(baseUrl) {
  console.log(`\n[D] Live Server Endpoint Verification (${baseUrl})`)

  // 1. GET /api/orders without auth -> 401
  const unauth = await fetch(`${baseUrl}/api/orders`)
  check("live GET /api/orders without auth returns 401", unauth.status === 401)

  // 2. GET /api/orders with auth header -> 200
  const auth = await fetch(`${baseUrl}/api/orders`, {
    headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
  })
  check("live GET /api/orders with auth returns 200", auth.status === 200)
  const authData = await auth.json()
  check("live GET /api/orders returns valid response structure", authData.data !== undefined)

  // 3. GET /api/orders/non-existent-order -> 404
  const notFound = await fetch(`${baseUrl}/api/orders/ord_nonexistent`, {
    headers: { "x-user-id": "user-2", "x-user-email": "demo@example.com" },
  })
  check("live GET /api/orders/[id] for missing order returns 404", notFound.status === 404)

  // 4. GET /api/orders/<invalid_id> -> 400
  const badId = await fetch(`${baseUrl}/api/orders/%3Cscript%3E`, {
    headers: { "x-user-id": "user-2" },
  })
  check("live GET /api/orders/[id] for invalid format returns 400", badId.status === 400)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("Task 21 — Persistent Order Management & Order History Tests\n" + "─".repeat(60))

  await testRepositoryContract()
  await testPaypalCapturePersistence()
  await testOrderApis()

  const baseUrl = await resolveBaseUrl()
  if (baseUrl) {
    await testLiveServer(baseUrl)
  } else {
    console.log("\n[D] Live server skipped — dev server not detected on 3000/3001/3100")
  }

  const failed = results.filter((r) => !r.pass)
  console.log("\n" + "─".repeat(60))
  console.log(`SUMMARY: ${results.length - failed.length} passed, ${failed.length} failed`)

  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const f of failed) console.log(`  ✗ ${f.name} — ${f.detail}`)
  }

  process.exitCode = failed.length === 0 ? 0 : 1
}

main().catch((err) => {
  console.error("Test run crashed:", err)
  process.exitCode = 1
})

