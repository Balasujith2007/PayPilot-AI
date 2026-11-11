// Budget recommendation API tests. Requires a running server:
//   npm run build && npx next start -p 3100
//   node tests/budget-api-test.mjs
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100"
const catalog = JSON.parse(readFileSync(new URL("../src/data/products.json", import.meta.url)))
const active = catalog.products.filter((p) => p.status === "active")
const minPrice = (p) => Math.min(...p.variants.map((v) => v.price))
const prices = [...new Set(active.map(minPrice))].sort((a, b) => a - b)

const results = []
async function test(name, fn) {
  try {
    await fn()
    results.push({ name, ok: true })
    console.log(`  ✓ ${name}`)
  } catch (err) {
    results.push({ name, ok: false, err })
    console.log(`  ✗ ${name}\n    ${err.message}`)
  }
}
async function get(query) {
  const res = await fetch(`${BASE_URL}/api/products/budget${query}`)
  return { status: res.status, body: await res.json() }
}
async function post(body) {
  const res = await fetch(`${BASE_URL}/api/products/budget`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

console.log("\nBudget API")
await test("GET returns ranked recommendations within budget", async () => {
  const budget = prices[Math.floor(prices.length / 2)]
  const { status, body } = await get(`?budget=${budget}`)
  assert.equal(status, 200)
  const r = body.data
  assert.equal(r.status, "ok")
  assert.equal(r.counts.eligible, active.filter((p) => minPrice(p) <= budget).length)
  for (const rec of [r.bestValue, ...r.alternatives]) assert(rec.price <= budget)
  assert(r.bestValue.reasons.length > 0)
})

await test("POST supports category, keywords and intended use", async () => {
  const p = active.find((x) => x.tags.length > 1)
  const cat = catalog.categories.find((c) => c.id === p.categoryIds[0])
  const { status, body } = await post({
    budget: prices.at(-1),
    category: cat.slug,
    keywords: [p.tags[0]],
    intendedUse: `something for ${p.tags[1]}`,
    maxAlternatives: 2,
  })
  assert.equal(status, 200)
  const r = body.data
  assert.equal(r.requirements.category, cat.slug)
  assert(r.criteria.some((c) => c.key === "relevance"))
  assert([r.bestValue, ...r.alternatives].some((x) => x.product.id === p.id))
  assert(r.alternatives.length <= 2)
})

await test("no products within budget returns 200 with no_matches", async () => {
  const { status, body } = await get(`?budget=${prices[0] - 1}`)
  assert.equal(status, 200)
  assert.equal(body.data.status, "no_matches")
  assert.equal(body.data.bestValue, null)
  assert.equal(body.data.closestOverBudget.price, prices[0])
  assert.match(body.data.message, /No products are available within/)
})

await test("invalid budgets are rejected with 400", async () => {
  for (const q of ["", "?budget=", "?budget=abc", "?budget=-5", "?budget=0", "?budget=12.5", "?budget=1e3x"]) {
    const { status, body } = await get(q)
    assert.equal(status, 400, `GET ${q || "(none)"}`)
    assert.equal(body.error.code, "INVALID_REQUEST")
    assert(body.error.details.budget?.length > 0, `details for ${q}`)
  }
  for (const budget of ["5000", null, -1, 0.5]) {
    const { status } = await post({ budget })
    assert.equal(status, 400, `POST ${JSON.stringify(budget)}`)
  }
})

await test("other invalid input is rejected", async () => {
  const bad = await post("{not json")
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error.code, "INVALID_JSON")
  const unknown = await get(`?budget=5000&category=not-a-category`)
  assert.equal(unknown.status, 400)
  assert.equal(unknown.body.error.code, "UNKNOWN_CATEGORY")
  assert(unknown.body.error.details.category.length > 0)
  const tooMany = await get(`?budget=5000&maxAlternatives=99`)
  assert.equal(tooMany.status, 400)
  const flag = await get(`?budget=5000&includeOutOfStock=maybe`)
  assert.equal(flag.status, 400)
})

await test("unmatched keyword returns no_matches", async () => {
  const { status, body } = await get(`?budget=${prices.at(-1)}&keywords=zzqx-unmatched`)
  assert.equal(status, 200)
  assert.equal(body.data.status, "no_matches")
  assert.match(body.data.message, /No products match/)
})

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length > 0 ? 1 : 0)
