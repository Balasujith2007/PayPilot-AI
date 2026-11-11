// Budget intelligence engine tests (no server needed):
//   node tests/budget-engine-test.mjs
// Loads the TypeScript engine with jiti (already installed via the toolchain).
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import assert from "node:assert/strict"
import { createJiti } from "jiti"

const jiti = createJiti(import.meta.url, {
  alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) },
})
const engine = await jiti.import("../src/lib/budget/budget-engine.ts")
const service = await jiti.import("../src/lib/budget/service.ts")
const { budgetRequestSchema } = await jiti.import("../src/lib/validators/index.ts")
const { recommendWithinBudget, toBudgetCandidate, formatBudgetResultAsText } = engine

// Fixtures come from the real catalog; missing-data cases are derived copies.
const catalog = JSON.parse(readFileSync(new URL("../src/data/products.json", import.meta.url)))
const active = catalog.products.filter((p) => p.status === "active")
const inStock = (v) => !v.inventory.trackInventory || v.inventory.quantity > 0 || v.inventory.allowBackorder
const minPrice = (p) => Math.min(...p.variants.filter(inStock).map((v) => v.price))
const prices = [...new Set(active.map(minPrice))].sort((a, b) => a - b)
const clone = (p, patch = {}) => ({ ...structuredClone(p), ...patch })

const candidates = await service.loadBudgetCandidates()

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    results.push({ name, ok: false, err })
    console.log(`  ✗ ${name}\n    ${err.stack?.split("\n").slice(0, 3).join("\n    ")}`)
  }
}
const allRecs = (r) => (r.bestValue ? [r.bestValue, ...r.alternatives] : [])

console.log("\nBudget filtering")
await test("loads every active catalog product through the repository", async () => {
  assert.equal(candidates.length, active.length)
  for (const c of candidates) {
    const source = active.find((p) => p.id === c.product.id)
    assert.equal(c.product.price.min, Math.min(...source.variants.map((v) => v.price)))
  }
})

await test("products within budget are all eligible and priced in cents", async () => {
  const budget = prices.at(-1)
  const r = recommendWithinBudget(candidates, { budget, maxAlternatives: 10 })
  assert.equal(r.status, "ok")
  assert.equal(r.counts.eligible, active.length)
  assert.equal(r.budget.amount, budget)
  assert.match(r.budget.formatted, /^\$\d/)
  for (const rec of allRecs(r)) {
    assert(rec.price <= budget)
    assert.equal(rec.remainingBudget, budget - rec.price)
    const source = active.find((p) => p.id === rec.product.id)
    assert(source.variants.some((v) => v.id === rec.variant.id && v.price === rec.price))
  }
})

await test("products exceeding the budget are excluded with a reason", async () => {
  const budget = prices[Math.floor(prices.length / 2)]
  const r = recommendWithinBudget(candidates, { budget, maxAlternatives: 10 })
  const over = active.filter((p) => minPrice(p) > budget)
  assert(over.length > 0)
  assert.equal(r.counts.overBudget, over.length)
  assert.equal(r.counts.eligible, active.length - over.length)
  for (const p of over) {
    const ex = r.excluded.find((e) => e.productId === p.id)
    assert.equal(ex?.reason, "over_budget")
    assert(!allRecs(r).some((rec) => rec.product.id === p.id))
  }
})

await test("no products within budget is reported clearly", async () => {
  const budget = prices[0] - 1
  const r = recommendWithinBudget(candidates, { budget })
  assert.equal(r.status, "no_matches")
  assert.equal(r.bestValue, null)
  assert.deepEqual(r.alternatives, [])
  const cheapest = active.find((p) => minPrice(p) === prices[0])
  assert.equal(r.closestOverBudget.price, prices[0])
  assert.equal(r.closestOverBudget.overBy, 1)
  assert.match(r.message, /No products are available within/)
  assert(r.message.includes(cheapest.name) || active.filter((p) => minPrice(p) === prices[0]).some((p) => r.message.includes(p.name)))
})

await test("picks the cheapest variant that fits when only some options fit", async () => {
  const multi = active.find((p) => new Set(p.variants.map((v) => v.price)).size > 1)
  if (!multi) return console.log("    (skipped: no multi-price product in catalog)")
  const sorted = [...multi.variants].sort((a, b) => a.price - b.price)
  const budget = sorted[0].price
  const r = recommendWithinBudget(candidates, { budget, keywords: [multi.name], maxAlternatives: 10 })
  const rec = allRecs(r).find((x) => x.product.id === multi.id)
  assert(rec, "expected product to be eligible")
  assert.equal(rec.variant.id, sorted[0].id)
  assert(rec.caveats.some((c) => /options fit the budget/.test(c)))
})

console.log("\nRanking")
await test("multiple eligible products are ranked by transparent weighted score", async () => {
  const r = recommendWithinBudget(candidates, { budget: prices.at(-1), maxAlternatives: 10 })
  const recs = allRecs(r)
  assert.equal(r.counts.eligible, active.length)
  assert.equal(recs.length, Math.min(active.length, 1 + engine.MAX_ALTERNATIVES_LIMIT))
  recs.forEach((rec, i) => assert.equal(rec.rank, i + 1))
  for (let i = 1; i < recs.length; i++) assert(recs[i - 1].score >= recs[i].score)
  const weightSum = r.criteria.reduce((s, c) => s + c.weight, 0)
  assert(Math.abs(weightSum - 1) < 0.001)
  assert.deepEqual(r.criteria.map((c) => c.key).sort(), ["price", "rating", "specifications"])
  const cheapest = Math.min(...recs.map((x) => x.price))
  for (const rec of recs) {
    const priceScore = rec.breakdown.find((b) => b.criterion === "price").score
    assert(Math.abs(priceScore - cheapest / rec.price) < 0.001)
    const total = rec.breakdown.reduce((s, b) => s + b.points, 0)
    assert(Math.abs(total - rec.score) < 0.15)
    assert(rec.reasons.length >= 2)
  }
  assert.match(r.bestValue.reasons[0], /Highest overall score/)
})

await test("returns the best value plus the requested number of alternatives", async () => {
  const budget = prices.at(-1)
  assert.equal(recommendWithinBudget(candidates, { budget }).alternatives.length, 3)
  assert.equal(recommendWithinBudget(candidates, { budget, maxAlternatives: 1 }).alternatives.length, 1)
  assert.equal(recommendWithinBudget(candidates, { budget, maxAlternatives: 0 }).alternatives.length, 0)
})

await test("intended use adds a relevance criterion based on catalog text", async () => {
  const target = active.find((p) => p.tags.length > 0)
  const tag = target.tags[0]
  const r = recommendWithinBudget(candidates, { budget: prices.at(-1), intendedUse: `for ${tag}`, maxAlternatives: 10 })
  assert(r.criteria.some((c) => c.key === "relevance"))
  const rec = allRecs(r).find((x) => x.product.id === target.id)
  assert(rec.matchedTerms.length > 0)
  assert(rec.reasons.some((x) => x.startsWith("Matches your requirements")))
  const nonMatch = allRecs(r).find((x) => x.matchedTerms.length === 0)
  if (nonMatch) {
    assert.equal(nonMatch.breakdown.find((b) => b.criterion === "relevance").score, 0)
    assert(nonMatch.caveats.some((c) => c.startsWith("Catalog data doesn't mention")))
  }
})

await test("relevance is dropped when no eligible product matches the intended use", async () => {
  const r = recommendWithinBudget(candidates, { budget: prices.at(-1), intendedUse: "zzqx-unmatched" })
  assert.equal(r.status, "ok")
  assert(!r.criteria.some((c) => c.key === "relevance"))
  assert.match(r.message, /relevance was not scored/)
  assert(r.bestValue.caveats.some((c) => c.includes("zzqx")))
})

console.log("\nCategory and keyword filtering")
await test("category filter by slug includes subcategory products", async () => {
  const parent = catalog.categories.find((c) => catalog.categories.some((x) => x.parentId === c.id))
  const lookup = await service.getBudgetRecommendations({ budget: prices.at(-1), category: parent.slug, maxAlternatives: 10 })
  assert(lookup.ok)
  const childIds = catalog.categories.filter((c) => c.parentId === parent.id).map((c) => c.id)
  const expected = active.filter((p) => p.categoryIds.some((id) => id === parent.id || childIds.includes(id)))
  assert.equal(lookup.result.counts.eligible, expected.length)
  assert.deepEqual(allRecs(lookup.result).map((r) => r.product.id).sort(), expected.map((p) => p.id).sort())
  assert.equal(lookup.result.counts.filteredOut, active.length - expected.length)
})

await test("category filter accepts the category name and rejects unknown categories", async () => {
  const cat = catalog.categories.find((c) => /[^a-z]/i.test(c.name)) ?? catalog.categories[0]
  const byName = await service.getBudgetRecommendations({ budget: prices.at(-1), category: cat.name.toUpperCase() })
  assert(byName.ok)
  assert.equal(byName.result.requirements.category, cat.slug)
  const unknown = await service.getBudgetRecommendations({ budget: prices.at(-1), category: "not-a-category" })
  assert.equal(unknown.ok, false)
  assert.equal(unknown.code, "UNKNOWN_CATEGORY")
  assert(unknown.availableCategories.includes(cat.slug))
})

await test("keyword filter keeps only products that mention a keyword", async () => {
  const tagCounts = new Map()
  for (const p of active) for (const t of p.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)
  const [tag] = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]
  const r = recommendWithinBudget(candidates, { budget: prices.at(-1), keywords: [tag], maxAlternatives: 10 })
  const ids = allRecs(r).map((x) => x.product.id)
  for (const p of active.filter((p) => p.tags.includes(tag))) assert(ids.includes(p.id), `${p.id} should match ${tag}`)
  for (const id of ids) assert(allRecs(r).find((x) => x.product.id === id).matchedTerms.includes(tag.replace(/-/g, " ")))
  assert(r.excluded.every((e) => e.reason === "keywords"))
  const none = recommendWithinBudget(candidates, { budget: prices.at(-1), keywords: ["zzqx-unmatched"] })
  assert.equal(none.status, "no_matches")
  assert.match(none.message, /No products match/)
})

await test("category, keyword and budget combine", async () => {
  const p = active.find((x) => x.tags.length > 0)
  const cat = catalog.categories.find((c) => c.id === p.categoryIds[0])
  const r = recommendWithinBudget(candidates, { budget: minPrice(p), category: cat.slug, keywords: [p.tags[0]], maxAlternatives: 10 })
  assert(allRecs(r).some((x) => x.product.id === p.id))
  for (const rec of allRecs(r)) assert(rec.price <= minPrice(p))
})

console.log("\nMissing data")
await test("missing ratings and specifications are never invented", async () => {
  const [a, b] = active.filter((p) => p.variants.some((v) => v.options.length > 0))
  const noRating = toBudgetCandidate(clone(a, { id: "test-no-rating", rating: 0, reviewCount: 0 }))
  const noSpecs = toBudgetCandidate(
    clone(b, { id: "test-no-specs", variants: b.variants.map((v) => ({ ...v, options: [] })) })
  )
  assert.equal(noRating.product.rating, null)
  assert.deepEqual(noSpecs.product.specifications, {})
  const r = recommendWithinBudget([noRating, noSpecs], { budget: prices.at(-1) })
  const recA = allRecs(r).find((x) => x.product.id === "test-no-rating")
  const recB = allRecs(r).find((x) => x.product.id === "test-no-specs")
  const ratingA = recA.breakdown.find((x) => x.criterion === "rating")
  assert.equal(ratingA.score, 0)
  assert.equal(ratingA.detail, "No rating available")
  assert(recA.caveats.some((c) => c.includes("No rating in the catalog")))
  assert(!recA.reasons.some((x) => x.startsWith("Rated")))
  assert.equal(recB.breakdown.find((x) => x.criterion === "specifications").score, 0)
  assert(recB.caveats.includes("No specifications listed in the catalog."))
  assert(!recB.reasons.some((x) => x.startsWith("Lists")))
})

await test("criteria with no data for any product are dropped and weights rescaled", async () => {
  const bare = active.slice(0, 3).map((p, i) =>
    toBudgetCandidate(clone(p, { id: `bare-${i}`, rating: 0, variants: p.variants.map((v) => ({ ...v, options: [] })) }))
  )
  const r = recommendWithinBudget(bare, { budget: prices.at(-1) })
  assert.deepEqual(r.criteria.map((c) => c.key), ["price"])
  assert.equal(r.criteria[0].weight, 1)
  assert.equal(r.bestValue.price, Math.min(...allRecs(r).map((x) => x.price)))
})

await test("invalid prices, stock, and currency are excluded rather than guessed", async () => {
  const [a, b, c] = active
  const badPrice = toBudgetCandidate(clone(a, { id: "bad-price", variants: a.variants.map((v) => ({ ...v, price: 0 })) }))
  const soldOut = toBudgetCandidate(
    clone(b, { id: "sold-out", variants: b.variants.map((v) => ({ ...v, inventory: { quantity: 0, trackInventory: true, allowBackorder: false } })) })
  )
  const euro = toBudgetCandidate(clone(c, { id: "euro", variants: c.variants.map((v) => ({ ...v, currency: "EUR" })) }))
  const r = recommendWithinBudget([badPrice, soldOut, euro], { budget: prices.at(-1) })
  assert.equal(r.status, "no_matches")
  assert.deepEqual(r.excluded.map((e) => e.reason).sort(), ["currency", "invalid_price", "out_of_stock"])
  assert.equal(r.counts.unavailable, 3)
  const withStock = recommendWithinBudget([soldOut], { budget: prices.at(-1), includeOutOfStock: true })
  assert.equal(withStock.status, "ok")
  assert(withStock.bestValue.caveats.includes("Currently out of stock."))
})

await test("empty catalog is handled", async () => {
  const r = recommendWithinBudget([], { budget: 5000 })
  assert.equal(r.status, "empty_catalog")
  assert.equal(r.bestValue, null)
  assert.match(r.message, /no active products/)
})

await test("text summary is ready for AI grounding", async () => {
  const r = recommendWithinBudget(candidates, { budget: prices.at(-1) })
  const text = formatBudgetResultAsText(r)
  assert(text.includes(`Best value: ${r.bestValue.product.name}`))
  assert(text.includes("Ranking criteria:"))
  assert.equal(text.split("Alternative #").length - 1, r.alternatives.length)
})

console.log("\nValidation")
await test("invalid budget values are rejected", async () => {
  const bad = [undefined, null, "5000", -100, 0, 12.5, Number.NaN, Number.POSITIVE_INFINITY, 100_000_001]
  for (const budget of bad) {
    assert.equal(budgetRequestSchema.safeParse({ budget }).success, false, `budget ${String(budget)} should fail`)
  }
  assert.equal(budgetRequestSchema.safeParse({ budget: 5000 }).success, true)
})

await test("invalid optional fields are rejected", async () => {
  const cases = [
    { keywords: Array.from({ length: 11 }, (_, i) => `k${i}`) },
    { keywords: ["x".repeat(51)] },
    { maxAlternatives: 11 },
    { maxAlternatives: -1 },
    { currency: "dollars" },
    { intendedUse: "x".repeat(201) },
    { includeOutOfStock: "yes" },
    { category: "" },
  ]
  for (const extra of cases) {
    assert.equal(budgetRequestSchema.safeParse({ budget: 5000, ...extra }).success, false, JSON.stringify(extra).slice(0, 60))
  }
  const ok = budgetRequestSchema.parse({ budget: 5000, keywords: "wireless, , bluetooth", currency: "usd" })
  assert.deepEqual(ok.keywords, ["wireless", "bluetooth"])
  assert.equal(ok.currency, "USD")
})

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length > 0 ? 1 : 0)
