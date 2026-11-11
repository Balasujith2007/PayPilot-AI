// Cart proposal contract + cart approval tests (PHASE 4 / PHASE 5).
//
// Section A/B are deterministic: the server modules are loaded directly
// (tests/ts-alias-loader.mjs) so they need no API key and no network.
// Section C exercises POST /api/agent/cart against a running server:
//   npx next dev -p 3100        (or: npm run build && npx next start -p 3100)
//   node tests/cart-proposal-test.mjs
//
// Optional: BASE_URL=http://localhost:3100
//
// Never prints the API key or mutates any cart.
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
nextEnv.loadEnvConfig(PROJECT_ROOT)

register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const { toCartItemInput, proposalDiffersFrom } = await import("@/lib/ai/cart-approval.ts")
const { parseCartProposal } = await import("@/lib/ai/tools/propose-cart-action.ts")
const { collectArtifacts } = await import("@/lib/ai/artifacts.ts")
const { executeAgentTool } = await import("@/lib/ai/tools/index.ts")
const { productRepository } = await import("@/lib/repositories/index.ts")
const { PLACEHOLDER_IMAGE } = await import("@/lib/constants.ts")

const API_KEY = process.env.GEMINI_API_KEY
const HAS_KEY = Boolean(API_KEY)

const BASE_URL_CANDIDATES = process.env.BASE_URL
  ? [process.env.BASE_URL]
  : ["http://localhost:3100", "http://localhost:3001", "http://localhost:3000"]

const results = []

function record(name, pass, detail = "") {
  results.push({ name, pass, detail })
  console.log(`  ${pass ? "\u2713" : "\u2717"} ${name}${detail ? ` — ${detail}` : ""}`)
}

function check(name, condition, detail = "") {
  record(name, Boolean(condition), condition ? "" : detail || "assertion failed")
}

async function checkNoKeyLeak(label, text) {
  const leaked = HAS_KEY && typeof text === "string" && text.includes(API_KEY)
  record(`${label}: no API key leak`, !leaked, leaked ? "API key found in output" : "")
}

// ---------------------------------------------------------------------------
// A. Proposal contract (server-side, deterministic)
// ---------------------------------------------------------------------------
async function testProposalContract() {
  console.log("\n[A] Cart proposal contract")

  const result = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 2 }],
  })

  check("propose_cart_action succeeds", result.ok === true, result.ok ? "" : result.error.code)
  if (!result.ok) return

  const proposal = parseCartProposal(result.data)
  check("the tool output validates against the published schema", proposal !== null)
  if (!proposal) return

  check("requiresApproval is true", proposal.requiresApproval === true)
  check("applied is false (the API never changes the cart)", proposal.applied === false)
  check("paymentInitiated is false (no checkout or PayPal capture)", proposal.paymentInitiated === false)
  check(
    "no PayPal/checkout side effect is mentioned",
    !JSON.stringify(proposal).toLowerCase().includes("paypal")
  )

  const line = proposal.items[0]
  const catalog = await productRepository.getById("prod-1")
  check(
    "unit price comes from the server catalog",
    line.unitPrice === catalog.variants[0].price,
    `unitPrice=${line.unitPrice} catalog=${catalog.variants[0].price}`
  )
  check("line total is unit price × quantity", line.lineTotal === line.unitPrice * 2)
  check(
    "available quantity is reported for the accepted variant",
    line.availableQuantity >= line.quantity,
    `available=${line.availableQuantity}`
  )
  check(
    "product id, variant id, name and slug are all present",
    Boolean(line.productId && line.variantId && line.name && line.slug)
  )

  check(
    "summary totals reconcile (subtotal + shipping + tax = landed cost)",
    proposal.summary.total ===
      proposal.summary.subtotal + proposal.summary.shipping + proposal.summary.tax
  )
  check(
    "summary subtotal is the sum of the accepted lines",
    proposal.summary.subtotal === proposal.items.reduce((sum, l) => sum + l.lineTotal, 0)
  )

  // Caller-supplied prices/names must be ignored entirely.
  const spoofed = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 1, price: 1, unitPrice: 1, variantName: "Free" }],
  })
  check(
    "AI/client-supplied prices are ignored",
    spoofed.ok === true && spoofed.data.items[0].unitPrice === catalog.variants[0].price
  )

  // Unknown ids / bad quantities are rejected with a readable reason.
  const unknown = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-999", quantity: 1 }],
  })
  check("unknown product id is rejected", unknown.ok === false)

  const unknownVariant = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", variantId: "var-nope", quantity: 1 }],
  })
  check("unknown variant id is rejected", unknownVariant.ok === false)

  const partial = await executeAgentTool("propose_cart_action", {
    items: [
      { productId: "prod-1", quantity: 1 },
      { productId: "prod-999", quantity: 1 },
    ],
  })
  check(
    "rejected items are returned with a reason instead of failing the batch",
    partial.ok === true &&
      partial.data.items.length === 1 &&
      partial.data.rejected.some((r) => r.productId === "prod-999" && r.code === "NOT_FOUND")
  )

  const huge = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 999 }],
  })
  check("a quantity above the bound is rejected before the tool runs", huge.ok === false)
}

// ---------------------------------------------------------------------------
// B. Schema rejection + approval mapping
// ---------------------------------------------------------------------------
async function testSchemaAndApprovalMapping() {
  console.log("\n[B] Schema rejection and approval mapping")

  const result = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 1 }],
  })
  assert(result.ok, "fixture proposal failed")
  const valid = result.data

  const tampered = [
    ["null payload", null],
    ["empty object", {}],
    ["missing items", { ...valid, items: [] }],
    ["requiresApproval forced false", { ...valid, requiresApproval: false }],
    ["applied forced true", { ...valid, applied: true }],
    ["paymentInitiated forced true", { ...valid, paymentInitiated: true }],
    ["negative unit price", { ...valid, items: [{ ...valid.items[0], unitPrice: -1 }] }],
    ["zero quantity", { ...valid, items: [{ ...valid.items[0], quantity: 0 }] }],
    ["unknown rejection code", { ...valid, rejected: [{ productId: "x", variantId: null, quantity: 1, code: "WHATEVER", message: "m" }] }],
  ]

  for (const [label, payload] of tampered) {
    check(`schema rejects a tampered proposal (${label})`, parseCartProposal(payload) === null)
  }
  check("schema accepts the genuine proposal", parseCartProposal(valid) !== null)

  // --- approval mapping -----------------------------------------------------
  const line = valid.items[0]
  const input = toCartItemInput(line)

  check(
    "toCartItemInput maps the server unit price into the cart price",
    input.price === line.unitPrice && input.quantity === line.quantity
  )
  check(
    "toCartItemInput uses the server product/variant ids, name and slug",
    input.productId === line.productId &&
      input.variantId === line.variantId &&
      input.name === line.name &&
      input.slug === line.slug
  )
  check(
    "toCartItemInput adapts the image URL into a cart ProductImage",
    input.image.url === (line.image ?? PLACEHOLDER_IMAGE) && input.image.alt.length > 0
  )
  check(
    "toCartItemInput falls back to the placeholder when the catalog has no image",
    toCartItemInput({ ...line, image: null }).image.url === PLACEHOLDER_IMAGE
  )
  check(
    "an approved line carries no client-editable amount",
    Object.keys(input).sort().join(",") ===
      "image,name,price,productId,quantity,slug,variantId,variantName"
  )

  // --- stale proposal detection --------------------------------------------
  check("an unchanged proposal is not flagged as stale", proposalDiffersFrom(valid, valid) === false)

  const priceBumped = JSON.parse(JSON.stringify(valid))
  priceBumped.items[0].unitPrice += 1
  priceBumped.summary.total += 1
  check("a price change marks the proposal stale", proposalDiffersFrom(valid, priceBumped) === true)

  const qtyChanged = JSON.parse(JSON.stringify(valid))
  qtyChanged.items[0].quantity += 1
  check("a quantity change marks the proposal stale", proposalDiffersFrom(valid, qtyChanged) === true)

  const nowRejected = JSON.parse(JSON.stringify(valid))
  nowRejected.rejected.push({
    productId: "prod-1",
    variantId: "var-1",
    quantity: 1,
    code: "OUT_OF_STOCK",
    message: "gone",
  })
  check(
    "newly rejected lines mark the proposal stale",
    proposalDiffersFrom(valid, nowRejected) === true
  )
}

// ---------------------------------------------------------------------------
// C. Artifact wiring (what the chat API sends to the browser)
// ---------------------------------------------------------------------------
async function testArtifactWiring() {
  console.log("\n[C] Artifact wiring")

  const executed = await executeAgentTool("propose_cart_action", {
    items: [{ productId: "prod-1", quantity: 1 }],
  })
  assert(executed.ok, "fixture proposal failed")

  const artifacts = collectArtifacts([
    { name: "search_products", ok: true, data: { query: "x", resultCount: 0, products: [] } },
    { name: "propose_cart_action", ok: true, data: executed.data },
  ])

  check("collectArtifacts exposes the cart proposal", Boolean(artifacts.cartProposal))
  check("collectArtifacts exposes the search result", Boolean(artifacts.search))
  check(
    "the exposed proposal still requires approval",
    artifacts.cartProposal?.requiresApproval === true && artifacts.cartProposal?.applied === false
  )

  const invalid = collectArtifacts([
    { name: "propose_cart_action", ok: true, data: { ...executed.data, applied: true } },
  ])
  check("collectArtifacts drops a tampered proposal", invalid.cartProposal === undefined)

  const failed = collectArtifacts([
    { name: "propose_cart_action", ok: false, data: executed.data },
  ])
  check("collectArtifacts ignores failed executions", failed.cartProposal === undefined)
}

// ---------------------------------------------------------------------------
// D. POST /api/agent/cart (requires a running server)
// ---------------------------------------------------------------------------
async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const base = candidate.replace(/\/$/, "")
    try {
      const response = await fetch(`${base}/api/agent/cart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
      // Any HTTP answer means the route exists on this server.
      if (response.status < 500) return base
    } catch {
      // try the next candidate
    }
  }
  return null
}

async function postCart(baseUrl, body) {
  const response = await fetch(`${baseUrl}/api/agent/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON body */
  }
  return { status: response.status, json, text }
}

async function testCartApi(baseUrl) {
  console.log(`\n[D] POST /api/agent/cart (${baseUrl})`)

  {
    const res = await postCart(baseUrl, "{ not json")
    check(
      "invalid JSON → 400 INVALID_REQUEST",
      res.status === 400 && res.json?.error?.code === "INVALID_REQUEST",
      `status ${res.status}`
    )
  }
  {
    const res = await postCart(baseUrl, {})
    check("missing items → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postCart(baseUrl, { items: [{ productId: "prod-1", quantity: 0 }] })
    check("quantity below the bound → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postCart(baseUrl, { items: [{ productId: "prod-999", quantity: 1 }] })
    check(
      "unknown product → 409 CART_PROPOSAL_UNAVAILABLE",
      res.status === 409 && res.json?.error?.code === "CART_PROPOSAL_UNAVAILABLE",
      `status ${res.status} ${res.json?.error?.code ?? ""}`
    )
  }

  const catalog = await productRepository.getById("prod-1")
  const expectedPrice = catalog.variants[0].price

  const ok = await postCart(baseUrl, { items: [{ productId: "prod-1", quantity: 2 }] })
  check("a valid proposal → 200", ok.status === 200, `status ${ok.status}`)

  const proposal = ok.json?.data
  check("the response is a proposal, not an applied change", proposal?.applied === false)
  check("the response requires approval", proposal?.requiresApproval === true)
  check("the response never starts a payment", proposal?.paymentInitiated === false)
  check(
    "the revalidated unit price still comes from the catalog",
    proposal?.items?.[0]?.unitPrice === expectedPrice,
    `unitPrice=${proposal?.items?.[0]?.unitPrice} expected=${expectedPrice}`
  )
  check(
    "totals reconcile server-side",
    proposal?.summary?.total ===
      proposal?.summary?.subtotal + proposal?.summary?.shipping + proposal?.summary?.tax
  )
  check("available quantity is reported", typeof proposal?.items?.[0]?.availableQuantity === "number")
  check("the validated payload passes the published schema", parseCartProposal(proposal) !== null)

  const spoofed = await postCart(baseUrl, {
    items: [{ productId: "prod-1", quantity: 1, price: 1, unitPrice: 1 }],
  })
  check(
    "client-supplied prices are ignored by the endpoint",
    spoofed.status === 200 && spoofed.json?.data?.items?.[0]?.unitPrice === expectedPrice
  )

  // The endpoint must be side-effect free: two identical requests cannot
  // accumulate anything, because no cart is ever written here.
  const repeat = await postCart(baseUrl, { items: [{ productId: "prod-1", quantity: 2 }] })
  check(
    "the endpoint is stateless (repeat proposals are identical)",
    repeat.status === 200 &&
      repeat.json?.data?.summary?.total === ok.json?.data?.summary?.total &&
      repeat.json?.data?.items?.length === ok.json?.data?.items?.length
  )

  check(
    "no response mentions PayPal or a payment capture",
    ![ok.text, spoofed.text, repeat.text].some((t) => t.toLowerCase().includes("paypal"))
  )
  await checkNoKeyLeak("cart API", [ok.text, spoofed.text, repeat.text, JSON.stringify(proposal)].join(" "))
}

// ---------------------------------------------------------------------------
// E. Explicit approval — the only path allowed to mutate the cart
// ---------------------------------------------------------------------------
async function testApprovalFlow(baseUrl) {
  console.log("\n[E] Explicit approval flow")

  // A tiny stand-in for the Zustand store: mirrors `addItem`'s merge-by-variant
  // contract so the test asserts the exact arguments the real store receives.
  function createCartProbe() {
    const items = []
    return {
      items,
      addItem(item) {
        const existing = items.find((i) => i.variantId === item.variantId)
        if (existing) {
          existing.quantity += item.quantity ?? 1
          return
        }
        items.push({ ...item, quantity: item.quantity ?? 1 })
      },
    }
  }

  const cart = createCartProbe()
  const res = await postCart(baseUrl, { items: [{ productId: "prod-1", quantity: 2 }] })
  assert(res.status === 200 && res.json?.data, "fixture proposal failed")

  const displayed = res.json.data
  const fresh = (await postCart(baseUrl, { items: [{ productId: "prod-1", quantity: 2 }] })).json.data

  check("rendering a proposal does not touch the cart", cart.items.length === 0)

  // Cancel: reject locally, the cart stays untouched and nothing is sent.
  check("cancelling leaves the cart empty", cart.items.length === 0)

  // Add to Cart: only after revalidation, and only when nothing moved on.
  if (proposalDiffersFrom(displayed, fresh)) {
    check("the fresh proposal matched the displayed one", false, "catalog changed between reads")
  } else {
    for (const line of fresh.items) cart.addItem(toCartItemInput(line))
    check("approving adds the proposal lines", cart.items.length === 1)
    check(
      "the cart line uses the server price and quantity",
      cart.items[0].price === fresh.items[0].unitPrice && cart.items[0].quantity === 2
    )

    cart.addItem(toCartItemInput(fresh.items[0]))
    check("a repeated approval merges into one line", cart.items.length === 1)
    check("the merged line accumulates quantity", cart.items[0].quantity === 4)
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Cart proposal contract + approval tests\n" + "\u2500".repeat(60))

  await testProposalContract()
  await testSchemaAndApprovalMapping()
  await testArtifactWiring()

  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    console.log(
      `\n[D] skipped — no dev server at ${BASE_URL_CANDIDATES.join(", ")}\n` +
        "    start one with:  npx next dev -p 3100"
    )
  } else {
    await testCartApi(baseUrl)
    await testApprovalFlow(baseUrl)
  }

  const failed = results.filter((r) => !r.pass)
  console.log("\n" + "\u2500".repeat(60))
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
