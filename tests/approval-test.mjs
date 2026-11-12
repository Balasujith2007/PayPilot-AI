// Task 19 — user approval workflow tests.
//
// Sections A/B/C are deterministic: the server modules are loaded directly
// (tests/ts-alias-loader.mjs), so they need no API key, no network and no
// running server. Section C imports the route handlers themselves and invokes
// them with a `Request`, which exercises the real HTTP mapping in the same
// process — and therefore against the same in-memory proposal registry.
//
// Section D is optional and only runs against a live server:
//   npx next dev -p 3100
//   node tests/approval-test.mjs
//
// Optional: BASE_URL=http://localhost:3100
//
// Never prints the API key and never mutates a cart.
import { register } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"

import nextEnv from "@next/env"

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
nextEnv.loadEnvConfig(PROJECT_ROOT)

register("./ts-alias-loader.mjs", import.meta.url, { data: { root: PROJECT_ROOT } })

const {
  approveProposal,
  rejectProposal,
  registerCartProposal,
  registerProposal,
  requestedLinesFromProposal,
  refusalFor,
  toApprovalDecision,
  toPublicProposal,
  getProposal,
  listProposalAuditRecords,
  resetProposalStore,
} = await import("@/lib/ai/approvals/index.ts")

const { executeAgentTool } = await import("@/lib/ai/tools/index.ts")
const { parseCartProposal } = await import("@/lib/ai/tools/propose-cart-action.ts")
const { toCartItemInput } = await import("@/lib/ai/cart-approval.ts")
const { productRepository } = await import("@/lib/repositories/index.ts")
const { proposeCartActionArgsSchema, proposalDecisionRequestSchema } = await import(
  "@/lib/validators/index.ts"
)

const approveRoute = await import("@/app/api/agent/cart/approve/route.ts")
const rejectRoute = await import("@/app/api/agent/cart/reject/route.ts")

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

/** A genuine, server-built proposal to register and decide in each test. */
async function fixtureProposal(items = [{ productId: "prod-1", quantity: 2 }]) {
  const result = await executeAgentTool("propose_cart_action", { items })
  assert(result.ok, `fixture proposal failed: ${result.ok ? "" : result.error.code}`)
  const proposal = parseCartProposal(result.data)
  assert(proposal, "fixture proposal did not validate against the published schema")
  return proposal
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

// ---------------------------------------------------------------------------
// A. Lifecycle (deterministic, no server)
// ---------------------------------------------------------------------------
async function testLifecycle() {
  console.log("\n[A] Approval lifecycle")

  const base = await fixtureProposal()

  /** Revalidator that reproduces the proposal unchanged. */
  const unchanged = async () => ({ ok: true, proposal: base })

  // --- 1. successful approval ---------------------------------------------
  resetProposalStore()
  const registered = registerCartProposal(base)

  check("registration issues a server-side proposal id", /^prop_[0-9a-f-]{36}$/.test(registered.proposalId ?? ""))
  check("registration records a creation timestamp", !Number.isNaN(Date.parse(registered.createdAt)))
  check("registration records an expiry timestamp", !Number.isNaN(Date.parse(registered.expiresAt)))
  check(
    "the expiry is after the creation time",
    Date.parse(registered.expiresAt) > Date.parse(registered.createdAt)
  )
  check("a registered proposal is still PENDING", getProposal(registered.proposalId).record.status === "PENDING")

  const approved = await approveProposal(registered.proposalId, {
    revalidate: async (items) => {
      assert.deepEqual(
        items,
        requestedLinesFromProposal(base),
        "revalidation must replay the stored server-validated lines"
      )
      return { ok: true, proposal: base }
    },
  })

  check("approval succeeds", approved.status === "APPROVED", approved.status)
  check("approval returns the revalidated proposal", approved.proposal?.items?.length === base.items.length)
  check("the approved proposal is still marked unapplied", approved.proposal.applied === false)
  check("the approved proposal still requires approval", approved.proposal.requiresApproval === true)
  check("no payment was initiated", approved.proposal.paymentInitiated === false)
  check(
    "the audit record is APPROVED / APPLIED",
    approved.record.status === "APPROVED" && approved.record.outcome === "APPLIED"
  )
  check("the audit record has a decision timestamp", !Number.isNaN(Date.parse(approved.record.decidedAt)))

  // --- 3. duplicate approval ----------------------------------------------
  const duplicate = await approveProposal(registered.proposalId, { revalidate: unchanged })
  check("a duplicate approval is refused", duplicate.status === "ALREADY_PROCESSED", duplicate.status)

  // --- 2. successful rejection --------------------------------------------
  const toReject = registerCartProposal(base)
  const rejected = rejectProposal(toReject.proposalId)
  check("rejection succeeds", rejected.status === "REJECTED", rejected.status)
  check(
    "the audit record is REJECTED / REJECTED_BY_USER",
    rejected.record.status === "REJECTED" && rejected.record.outcome === "REJECTED_BY_USER"
  )
  check("rejection records a decision timestamp", !Number.isNaN(Date.parse(rejected.record.decidedAt)))

  // --- 4. duplicate rejection ---------------------------------------------
  check(
    "a duplicate rejection is refused",
    rejectProposal(toReject.proposalId).status === "ALREADY_PROCESSED"
  )

  // --- 5. approval after rejection ----------------------------------------
  const afterReject = await approveProposal(toReject.proposalId, { revalidate: unchanged })
  check("approval after rejection is refused", afterReject.status === "ALREADY_PROCESSED", afterReject.status)

  // --- 6. approval after expiry -------------------------------------------
  const expiring = registerProposal({
    proposal: base,
    requestedItems: requestedLinesFromProposal(base),
    now: Date.now(),
    ttlMs: 1,
  })
  const expired = await approveProposal(expiring.id, { revalidate: unchanged, now: Date.now() + 5_000 })
  check("approval after expiry is refused", expired.status === "EXPIRED", expired.status)
  check(
    "an expired proposal is recorded as EXPIRED",
    expired.record.status === "EXPIRED" && expired.record.outcome === "EXPIRED"
  )
  check(
    "the expired proposal can never be approved afterwards",
    (await approveProposal(expiring.id, { revalidate: unchanged })).status === "ALREADY_PROCESSED"
  )

  // --- 7. invalid / unknown proposal id -----------------------------------
  check(
    "an unknown but well-formed proposal id is NOT_FOUND",
    (await approveProposal("prop_00000000-0000-0000-0000-000000000000", { revalidate: unchanged })).status ===
      "NOT_FOUND"
  )
  check(
    "an unknown proposal id cannot be rejected either",
    rejectProposal("prop_00000000-0000-0000-0000-000000000000").status === "NOT_FOUND"
  )
  check(
    "malformed proposal ids are rejected before any lookup",
    !proposalDecisionRequestSchema.safeParse({ proposalId: "prop_nope" }).success
  )
  check(
    "a missing proposal id is rejected before any lookup",
    !proposalDecisionRequestSchema.safeParse({}).success
  )
  check(
    "a prototype-polluting proposal id is rejected",
    !proposalDecisionRequestSchema.safeParse({ proposalId: "__proto__" }).success
  )

  // --- 8. price changed ---------------------------------------------------
  const stale = registerCartProposal(base)
  const bumped = clone(base)
  bumped.items[0].unitPrice += 250
  bumped.summary.subtotal += 250
  bumped.summary.total += 250

  const staleDecision = await approveProposal(stale.proposalId, {
    revalidate: async () => ({ ok: true, proposal: bumped }),
  })
  check("a price change is reported as STALE", staleDecision.status === "STALE", staleDecision.status)
  check(
    "the stale decision carries a replacement proposal with a new id",
    staleDecision.proposal?.proposalId &&
      staleDecision.proposal.proposalId !== stale.proposalId &&
      staleDecision.proposal.proposalId.startsWith("prop_")
  )
  check(
    "the replacement carries the new price, not the old one",
    staleDecision.proposal.items[0].unitPrice === bumped.items[0].unitPrice
  )
  check(
    "the original proposal is no longer approvable after going stale",
    (await approveProposal(stale.proposalId, { revalidate: unchanged })).status === "ALREADY_PROCESSED"
  )

  // --- 9. stock unavailable -----------------------------------------------
  const unavailable = registerCartProposal(base)
  const gone = await approveProposal(unavailable.proposalId, {
    revalidate: async () => ({ ok: false, code: "OUT_OF_STOCK", message: "Only 1 left, 2 requested." }),
  })
  check("an unorderable proposal is reported as UNAVAILABLE", gone.status === "UNAVAILABLE", gone.status)
  check("the failure reason is surfaced to the shopper", gone.reason.includes("Only 1 left"))
  check("a validation failure is recorded in the audit trail", gone.record.outcome === "VALIDATION_FAILED")

  // --- 11. concurrent approval requests -----------------------------------
  const contended = registerCartProposal(base)
  let release
  const gate = new Promise((resolve) => {
    release = resolve
  })
  const slowRevalidator = async () => {
    await gate
    return { ok: true, proposal: base }
  }

  const first = approveProposal(contended.proposalId, { revalidate: slowRevalidator })
  const second = approveProposal(contended.proposalId, { revalidate: slowRevalidator })
  release()
  const settled = [await first, await second].map((result) => result.status).sort()
  check(
    "exactly one of two concurrent approvals wins",
    settled[0] === "ALREADY_PROCESSED" && settled[1] === "APPROVED",
    settled.join(",")
  )

  // --- approval uses the *real* catalog revalidator by default ------------
  const live = registerCartProposal(base)
  const liveDecision = await approveProposal(live.proposalId)
  const catalog = await productRepository.getById("prod-1")
  check("approval with the default revalidator succeeds", liveDecision.status === "APPROVED", liveDecision.status)
  check(
    "the approved price is re-read from the server catalog",
    liveDecision.proposal.items[0].unitPrice === catalog.variants[0].price,
    `unitPrice=${liveDecision.proposal.items[0].unitPrice} catalog=${catalog.variants[0].price}`
  )
  check(
    "the approved quantity is the stored server-validated quantity",
    liveDecision.proposal.items[0].quantity === 2
  )

  // --- audit trail --------------------------------------------------------
  const trail = listProposalAuditRecords()
  const entry = trail.find((row) => row.id === approved.record.id)
  check("the audit trail keeps an entry for a decided proposal", Boolean(entry))
  check(
    "the audit entry records id, creation and expiry timestamps",
    entry.id === approved.record.id && Boolean(entry.createdAt && entry.expiresAt)
  )
  check("the audit entry records the outcome and decision timestamp", Boolean(entry.outcome && entry.decidedAt))
  check(
    "the audit trail never stores payment data",
    !/paypal|card|cvv|payment(token|id)/i.test(JSON.stringify(trail))
  )

  // --- refusals map to HTTP -----------------------------------------------
  check("NOT_FOUND maps to 404", refusalFor({ status: "NOT_FOUND", id: "x" })?.status === 404)
  check("EXPIRED maps to 410", refusalFor(expired)?.status === 410)
  check("ALREADY_PROCESSED maps to 409", refusalFor(duplicate)?.status === 409)
  check("UNAVAILABLE maps to 409", refusalFor(gone)?.status === 409)
  check("an approval is not a refusal", refusalFor(approved) === null)
  check("a stale decision is not a refusal", refusalFor(staleDecision) === null)

  const payload = toApprovalDecision(approved)
  check(
    "the approval payload identifies the proposal and the decision time",
    payload.proposalId === registered.proposalId && Boolean(payload.decidedAt)
  )
}

// ---------------------------------------------------------------------------
// B. The cart is only ever written after an explicit, server-verified approval
// ---------------------------------------------------------------------------
async function testCartIsNeverTouchedImplicitly() {
  console.log("\n[B] Cart mutation is consent-gated")

  // A stand-in for the Zustand store, mirroring addItem's merge-by-variant.
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

  const base = await fixtureProposal()
  const cart = createCartProbe()

  // --- 13. rendering / registering a proposal must not touch the cart -----
  const shown = registerCartProposal(base)
  check("showing a proposal does not touch the cart", cart.items.length === 0)
  check("the shown proposal is explicitly marked unapplied", shown.applied === false)

  // --- 14. cancel leaves the cart unchanged -------------------------------
  const cancelled = registerCartProposal(base)
  const rejection = rejectProposal(cancelled.proposalId)
  check("cancel is recorded server-side", rejection.status === "REJECTED")
  check("cancelling leaves the cart unchanged", cart.items.length === 0)
  check(
    "a cancelled proposal cannot be approved afterwards",
    (await approveProposal(cancelled.proposalId)).status === "ALREADY_PROCESSED"
  )
  check("the refused approval still left the cart unchanged", cart.items.length === 0)

  // --- 10/12. invalid quantity and client-supplied amounts cannot slip in -
  check(
    "the proposal schema refuses quantity 0",
    !proposeCartActionArgsSchema.safeParse({ items: [{ productId: "prod-1", quantity: 0 }] }).success
  )
  check(
    "the proposal schema refuses a quantity above the bound",
    !proposeCartActionArgsSchema.safeParse({ items: [{ productId: "prod-1", quantity: 99 }] }).success
  )
  check(
    "the proposal schema refuses a fractional quantity",
    !proposeCartActionArgsSchema.safeParse({ items: [{ productId: "prod-1", quantity: 1.5 }] }).success
  )

  const decisionBody = proposalDecisionRequestSchema.safeParse({
    proposalId: shown.proposalId,
    unitPrice: 1,
    total: 1,
    items: [{ productId: "prod-1", quantity: 999 }],
  })
  check("a decision request carrying extra fields parses", decisionBody.success)
  check(
    "client-supplied prices, totals and items are stripped, leaving only the id",
    decisionBody.success && Object.keys(decisionBody.data).join(",") === "proposalId"
  )

  // --- 13 (continued). only an APPROVED decision may be applied -----------
  const approved = await approveProposal(shown.proposalId, {
    revalidate: async () => ({ ok: true, proposal: base }),
  })
  check("approval was granted by the server", approved.status === "APPROVED")
  for (const line of approved.proposal.items) cart.addItem(toCartItemInput(line))
  check("the cart is written only after approval", cart.items.length === 1)

  const catalog = await productRepository.getById(base.items[0].productId)
  check(
    "the cart line carries the server price and the stored quantity",
    cart.items[0].price === base.items[0].unitPrice &&
      cart.items[0].quantity === base.items[0].quantity &&
      cart.items[0].price === catalog.variants[0].price
  )

  // --- 15. no automatic checkout or payment ------------------------------
  check(
    "no approval payload starts a payment",
    !JSON.stringify([shown, approved.proposal]).toLowerCase().includes("paypal")
  )
  check(
    "no decision response mentions checkout or a payment capture",
    !/checkout|paypal|capture/i.test(JSON.stringify(toApprovalDecision(approved)))
  )
}

// ---------------------------------------------------------------------------
// C. Route handlers (deterministic — same process, same registry)
// ---------------------------------------------------------------------------
async function postRoute(handler, bodyText) {
  const request = new Request("http://test.local/api/agent/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: bodyText,
  })
  const response = await handler(request)
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON body */
  }
  return { status: response.status, json, text }
}

async function testRoutes() {
  console.log("\n[C] Approval and rejection endpoints")

  resetProposalStore()
  const base = await fixtureProposal()

  {
    const res = await postRoute(approveRoute.POST, "{ not json")
    check(
      "approve: invalid JSON → 400 INVALID_REQUEST",
      res.status === 400 && res.json?.error?.code === "INVALID_REQUEST",
      `status ${res.status}`
    )
  }
  {
    const res = await postRoute(approveRoute.POST, JSON.stringify({}))
    check("approve: missing proposal id → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postRoute(approveRoute.POST, JSON.stringify({ proposalId: "prop_nope" }))
    check("approve: malformed proposal id → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postRoute(
      approveRoute.POST,
      JSON.stringify({ proposalId: "prop_00000000-0000-0000-0000-000000000000" })
    )
    check(
      "approve: unknown proposal id → 404 PROPOSAL_NOT_FOUND",
      res.status === 404 && res.json?.error?.code === "PROPOSAL_NOT_FOUND",
      `status ${res.status} ${res.json?.error?.code ?? ""}`
    )
  }

  // Successful approval over the endpoint.
  const toApprove = registerCartProposal(base)
  const okRes = await postRoute(approveRoute.POST, JSON.stringify({ proposalId: toApprove.proposalId }))
  check("approve: a pending proposal → 200", okRes.status === 200, `status ${okRes.status}`)
  check("approve: the decision status is APPROVED", okRes.json?.data?.status === "APPROVED")
  check(
    "approve: the response echoes the proposal id",
    okRes.json?.data?.proposalId === toApprove.proposalId
  )
  check(
    "approve: the returned lines are server-revalidated",
    okRes.json?.data?.proposal?.items?.[0]?.unitPrice === base.items[0].unitPrice
  )
  check(
    "approve: the returned proposal is still explicitly unapplied",
    okRes.json?.data?.proposal?.applied === false &&
      okRes.json?.data?.proposal?.requiresApproval === true
  )

  const replay = await postRoute(approveRoute.POST, JSON.stringify({ proposalId: toApprove.proposalId }))
  check(
    "approve: a replay → 409 PROPOSAL_ALREADY_PROCESSED",
    replay.status === 409 && replay.json?.error?.code === "PROPOSAL_ALREADY_PROCESSED",
    `status ${replay.status} ${replay.json?.error?.code ?? ""}`
  )

  // Client price manipulation over the endpoint.
  const toSpoof = registerCartProposal(base)
  const spoofRes = await postRoute(
    approveRoute.POST,
    JSON.stringify({
      proposalId: toSpoof.proposalId,
      unitPrice: 1,
      total: 1,
      items: [{ productId: "prod-1", quantity: 999 }],
    })
  )
  check("approve: client-supplied amounts are ignored (still 200)", spoofRes.status === 200, `status ${spoofRes.status}`)
  check(
    "approve: the price and quantity still come from the server",
    spoofRes.json?.data?.proposal?.items?.[0]?.unitPrice === base.items[0].unitPrice &&
      spoofRes.json?.data?.proposal?.items?.[0]?.quantity === base.items[0].quantity
  )

  // Expiry over the endpoint.
  const expiring = registerProposal({
    proposal: base,
    requestedItems: requestedLinesFromProposal(base),
    ttlMs: 1,
  })
  await new Promise((resolve) => setTimeout(resolve, 5))
  const expiredRes = await postRoute(approveRoute.POST, JSON.stringify({ proposalId: expiring.id }))
  check(
    "approve: an expired proposal → 410 PROPOSAL_EXPIRED",
    expiredRes.status === 410 && expiredRes.json?.error?.code === "PROPOSAL_EXPIRED",
    `status ${expiredRes.status} ${expiredRes.json?.error?.code ?? ""}`
  )
  check("approve: an expired proposal still requires a valid id shape", expiredRes.status !== 400)

  // Rejection over the endpoint.
  const toReject = registerCartProposal(base)
  const rejectRes = await postRoute(rejectRoute.POST, JSON.stringify({ proposalId: toReject.proposalId }))
  check("reject: a pending proposal → 200", rejectRes.status === 200, `status ${rejectRes.status}`)
  check("reject: the decision status is REJECTED", rejectRes.json?.data?.status === "REJECTED")

  const rejectAgain = await postRoute(rejectRoute.POST, JSON.stringify({ proposalId: toReject.proposalId }))
  check(
    "reject: a duplicate rejection → 409 PROPOSAL_ALREADY_PROCESSED",
    rejectAgain.status === 409 && rejectAgain.json?.error?.code === "PROPOSAL_ALREADY_PROCESSED",
    `status ${rejectAgain.status}`
  )

  const approveAfterReject = await postRoute(
    approveRoute.POST,
    JSON.stringify({ proposalId: toReject.proposalId })
  )
  check(
    "approve after rejection → 409 PROPOSAL_ALREADY_PROCESSED",
    approveAfterReject.status === 409,
    `status ${approveAfterReject.status}`
  )

  {
    const res = await postRoute(rejectRoute.POST, JSON.stringify({ proposalId: "prop_nope" }))
    check("reject: a malformed proposal id → 400", res.status === 400, `status ${res.status}`)
  }
  {
    const res = await postRoute(
      rejectRoute.POST,
      JSON.stringify({ proposalId: "prop_00000000-0000-0000-0000-000000000000" })
    )
    check(
      "reject: an unknown proposal id → 404",
      res.status === 404 && res.json?.error?.code === "PROPOSAL_NOT_FOUND",
      `status ${res.status}`
    )
  }

  check(
    "no endpoint response mentions PayPal or a payment capture",
    ![okRes.text, replay.text, rejectRes.text, spoofRes.text].some((t) =>
      /paypal|capture/i.test(t)
    )
  )
  await checkNoKeyLeak("approval routes", [okRes.text, spoofRes.text, rejectRes.text].join(" "))
}

// ---------------------------------------------------------------------------
// D. Live server (optional) — proves the routes are actually mounted
// ---------------------------------------------------------------------------
async function resolveBaseUrl() {
  for (const candidate of BASE_URL_CANDIDATES) {
    const base = candidate.replace(/\/$/, "")
    try {
      const response = await fetch(`${base}/api/agent/cart/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
      // Any HTTP answer means the route is mounted on this server.
      if (response.status < 500) return base
    } catch {
      // try the next candidate
    }
  }
  return null
}

async function testLiveServer(baseUrl) {
  console.log(`\n[D] Live server (${baseUrl})`)

  const response = await fetch(`${baseUrl}/api/agent/cart/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ proposalId: "prop_00000000-0000-0000-0000-000000000000" }),
  })
  const text = await response.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* non-JSON */
  }
  check(
    "the approve route is mounted and refuses an unknown proposal (404)",
    response.status === 404 && json?.error?.code === "PROPOSAL_NOT_FOUND",
    `status ${response.status} ${json?.error?.code ?? ""}`
  )
  await checkNoKeyLeak("live approve route", text)
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Task 19 — cart proposal approval workflow tests\n" + "\u2500".repeat(64))

  await testLifecycle()
  await testCartIsNeverTouchedImplicitly()
  await testRoutes()

  const baseUrl = await resolveBaseUrl()
  if (!baseUrl) {
    console.log(
      `\n[D] skipped — no dev server at ${BASE_URL_CANDIDATES.join(", ")}\n` +
        "    start one with:  npx next dev -p 3100"
    )
  } else {
    await testLiveServer(baseUrl)
  }

  const failed = results.filter((r) => !r.pass)
  console.log("\n" + "\u2500".repeat(64))
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
