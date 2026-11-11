// Product comparison tests (API + UI). Requires a running server:
//   npm run build && npx next start -p 3100
//   node tests/compare-test.mjs
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { chromium } from "playwright"

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3100"

// Pick fixtures from the real catalog rather than hardcoding sample data.
const catalog = JSON.parse(readFileSync(new URL("../src/data/products.json", import.meta.url)))
const active = catalog.products.filter((p) => p.status === "active")
const hasOptions = (p) => p.variants.some((v) => v.options.length > 0)
const withOptions = active.filter(hasOptions)
const withoutOptions = active.filter((p) => !hasOptions(p))
const minPrice = (p) => Math.min(...p.variants.map((v) => v.price))
assert(withOptions.length >= 3 && withoutOptions.length >= 1, "catalog lacks fixtures")
const [a, b, c] = withOptions
const bare = withoutOptions[0]

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

async function getCompare(query) {
  const res = await fetch(`${BASE_URL}/api/products/compare${query}`)
  return { status: res.status, body: await res.json() }
}
async function postCompare(body) {
  const res = await fetch(`${BASE_URL}/api/products/compare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

console.log("\nAPI")
await test("compares two products (GET)", async () => {
  const { status, body } = await getCompare(`?ids=${a.id},${b.id}`)
  assert.equal(status, 200)
  assert.deepEqual(body.data.products.map((p) => p.id), [a.id, b.id])
  const nameRow = body.data.products.map((p) => p.name)
  assert.deepEqual(nameRow, [a.name, b.name])
  for (const key of ["price", "category", "rating", "description"]) {
    assert(body.data.rows.some((r) => r.key === key), `missing row ${key}`)
  }
  assert.equal(body.data.insights.length, 2)
  assert(body.data.recommendation, "expected a recommendation")
  assert([a.id, b.id].includes(body.data.recommendation.productId))
})

await test("compares multiple products (POST, 4 products)", async () => {
  const ids = [a.id, b.id, c.id, bare.id]
  const { status, body } = await postCompare({ productIds: ids })
  assert.equal(status, 200)
  assert.deepEqual(body.data.products.map((p) => p.id), ids)
  const priceRow = body.data.rows.find((r) => r.key === "price")
  const cheapest = Math.min(...ids.map((id) => minPrice(active.find((p) => p.id === id))))
  const expected = ids.flatMap((id, i) =>
    minPrice(active.find((p) => p.id === id)) === cheapest ? [i] : []
  )
  if (new Set(ids.map((id) => minPrice(active.find((p) => p.id === id)))).size > 1) {
    assert.deepEqual(priceRow.bestIndexes, expected)
  }
  const rec = body.data.recommendation
  const weightSum = rec.criteria.reduce((s, cr) => s + cr.weight, 0)
  assert(Math.abs(weightSum - 1) < 0.01, `weights sum to ${weightSum}`)
  const top = Math.max(...rec.scores.map((s) => s.total))
  assert.equal(rec.scores.find((s) => s.productId === rec.productId).total, top)
})

await test("rejects unknown product IDs with 404", async () => {
  const { status, body } = await getCompare(`?ids=${a.id},does-not-exist`)
  assert.equal(status, 404)
  assert.equal(body.error.code, "PRODUCT_NOT_FOUND")
  assert.deepEqual(body.error.details.productIds, ["does-not-exist"])
})

await test("rejects malformed product IDs with 400", async () => {
  const { status, body } = await postCompare({ productIds: [a.id, "<script>"] })
  assert.equal(status, 400)
  assert.equal(body.error.code, "INVALID_REQUEST")
})

await test("rejects fewer than 2 products", async () => {
  const { status, body } = await getCompare(`?ids=${a.id}`)
  assert.equal(status, 400)
  assert.match(body.error.message, /at least 2/)
})

await test("rejects more than 4 products", async () => {
  const ids = active.slice(0, 5).map((p) => p.id)
  const { status, body } = await postCompare({ productIds: ids })
  assert.equal(status, 400)
  assert.match(body.error.message, /up to 4/)
})

await test("rejects duplicate IDs and invalid JSON", async () => {
  const dup = await postCompare({ productIds: [a.id, a.id] })
  assert.equal(dup.status, 400)
  const bad = await postCompare("{not json")
  assert.equal(bad.status, 400)
  assert.equal(bad.body.error.code, "INVALID_JSON")
})

await test("missing specifications are null, never invented", async () => {
  const { status, body } = await getCompare(`?ids=${a.id},${bare.id}`)
  assert.equal(status, 200)
  const specRows = body.data.rows.filter((r) => r.group === "specifications")
  assert(specRows.length > 0, "expected specification rows")
  for (const r of specRows) {
    assert.equal(r.values[1], null, `${bare.id} should have no value for ${r.label}`)
    assert.equal(r.differs, true)
  }
  const bareProduct = body.data.products[1]
  assert.deepEqual(bareProduct.specifications, {})
  const insight = body.data.insights.find((i) => i.productId === bare.id)
  assert(insight.disadvantages.some((d) => d.startsWith("Does not list:")))
  // Ratings come straight from the catalog
  assert.equal(body.data.products[0].rating?.value ?? null, a.rating > 0 ? a.rating : null)
})

console.log("\nUI")
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(e.message))

const columns = () => page.locator('[data-testid^="compare-column-"]')
const columnIds = async () =>
  (await columns().evaluateAll((els) => els.map((e) => e.dataset.testid))).map((t) =>
    t.replace("compare-column-", "")
  )

await test("renders side-by-side comparison with best value and differences", async () => {
  await page.goto(`${BASE_URL}/compare?ids=${a.id},${b.id},${bare.id}`)
  await page.getByRole("heading", { name: /Best value:/ }).waitFor()
  assert.deepEqual(await columnIds(), [a.id, b.id, bare.id])
  assert((await page.locator("tr[data-differs]").count()) > 0, "no differing rows highlighted")
  assert((await page.getByText("Not specified").count()) > 0, "missing specs not shown")
  await page.getByRole("heading", { name: "Advantages & disadvantages" }).waitFor()
})

await test("shows differences only toggle", async () => {
  const before = await page.locator("tbody tr").count()
  await page.getByLabel("Show differences only").check()
  const after = await page.locator("tbody tr").count()
  assert(after <= before)
  assert.equal(await page.locator("tbody tr:not([data-differs]) th[scope=row]").count(), 0)
  await page.getByLabel("Show differences only").uncheck()
})

await test("removes a product", async () => {
  await page.getByRole("button", { name: `Remove ${b.name} from comparison` }).click()
  await page.waitForURL((u) => !u.search.includes(b.id))
  await page.waitForFunction((id) => !document.querySelector(`[data-testid="compare-column-${id}"]`), b.id)
  assert.deepEqual(await columnIds(), [a.id, bare.id])
})

await test("adds a product", async () => {
  await page.getByLabel("Add a product to compare").selectOption(c.id)
  await page.waitForURL((u) => u.search.includes(c.id))
  await page.locator(`[data-testid="compare-column-${c.id}"]`).waitFor()
  assert.deepEqual(await columnIds(), [a.id, bare.id, c.id])
})

await test("replaces a product in place", async () => {
  await page.getByLabel(`Replace ${bare.name} with another product`).selectOption(b.id)
  await page.waitForURL((u) => u.search.includes(b.id) && !u.search.includes(bare.id))
  await page.locator(`[data-testid="compare-column-${b.id}"]`).waitFor()
  assert.deepEqual(await columnIds(), [a.id, b.id, c.id])
})

await test("invalid IDs show a notice and valid products are still compared", async () => {
  await page.goto(`${BASE_URL}/compare?ids=${a.id},nope-123,${b.id}`)
  await page.getByText("nope-123").waitFor()
  assert.deepEqual(await columnIds(), [a.id, b.id])
})

await test("single product prompts to add more", async () => {
  await page.goto(`${BASE_URL}/compare?ids=${a.id}`)
  await page.getByRole("heading", { name: /Add 1 more product to compare/ }).waitFor()
})

await test("select from product cards, tray, and restore saved selection", async () => {
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await fresh.newPage()
  await p.goto(`${BASE_URL}/shop`)
  await p.getByRole("button", { name: "Add to comparison" }).first().click()
  await p.getByRole("button", { name: "Add to comparison" }).first().click()
  const tray = p.getByRole("region", { name: "Product comparison" })
  await tray.getByText("Compare (2/4)").waitFor()
  await tray.getByRole("link", { name: "Compare now" }).click()
  await p.waitForURL(/\/compare\?ids=/)
  await p.getByRole("heading", { name: /Best value:/ }).waitFor()
  assert.equal(await p.locator('[data-testid^="compare-column-"]').count(), 2)
  // Visiting /compare without IDs restores the saved selection
  await p.goto(`${BASE_URL}/compare`)
  await p.waitForURL(/\/compare\?ids=/)
  await p.getByRole("heading", { name: /Best value:/ }).waitFor()
  await fresh.close()
})

await test("cart still works from product detail page", async () => {
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await fresh.newPage()
  await p.goto(`${BASE_URL}/${a.slug}`)
  await p.getByRole("button", { name: "Add to comparison" }).click()
  await p.getByRole("button", { name: "Add to Cart" }).click()
  await p.getByRole("dialog").getByText(a.name).first().waitFor()
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem("cart-storage")))
  assert.equal(stored.state.items.length, 1)
  assert.equal(stored.state.items[0].productId, a.id)
  const compared = await p.evaluate(() => JSON.parse(localStorage.getItem("compare-storage")))
  assert.deepEqual(compared.state.items.map((i) => i.productId), [a.id])
  await fresh.close()
})

await test("no runtime errors", async () => {
  assert.deepEqual(pageErrors, [])
})

await browser.close()

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length > 0 ? 1 : 0)
