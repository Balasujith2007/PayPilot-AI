import type { Category, Product } from "@/types"
import { brandRepository, categoryRepository, productRepository } from "@/lib/repositories"
import { recommendWithinBudget, slugify, toBudgetCandidate } from "./budget-engine"
import type { BudgetCandidate, BudgetRecommendationResult, BudgetRequest } from "./types"

async function listActiveProducts(): Promise<Product[]> {
  const products: Product[] = []
  for (let page = 1; ; page += 1) {
    const result = await productRepository.list(
      {},
      { field: "name", order: "asc" },
      { page, limit: 100 }
    )
    products.push(...result.items)
    if (!result.pagination.hasNext) break
  }
  return products
}

function withAncestors(ids: string[], byId: Map<string, Category>): Category[] {
  const seen = new Map<string, Category>()
  for (const id of ids) {
    let current = byId.get(id)
    while (current && !seen.has(current.id)) {
      seen.set(current.id, current)
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }
  return [...seen.values()]
}

/** Loads every active catalog product through the repositories as budget candidates. */
export async function loadBudgetCandidates(): Promise<BudgetCandidate[]> {
  const [products, categories] = await Promise.all([
    listActiveProducts(),
    categoryRepository.list(),
  ])
  const byId = new Map(categories.map((c) => [c.id, c]))

  return Promise.all(
    products.map(async (product) => {
      const direct = product.categoryIds
        .map((id) => byId.get(id))
        .filter((c): c is Category => c !== undefined)
      return toBudgetCandidate(product, {
        brand: await brandRepository.getById(product.brandId),
        categories: direct,
        categorySlugs: withAncestors(product.categoryIds, byId).map((c) => c.slug),
      })
    })
  )
}

/** Finds a catalog category by slug or (case-insensitive) name. */
export async function resolveCategory(input: string): Promise<Category | null> {
  const slug = slugify(input)
  const categories = await categoryRepository.list()
  return (
    categories.find((c) => c.slug === slug) ??
    categories.find((c) => c.name.toLowerCase() === input.trim().toLowerCase()) ??
    null
  )
}

export type BudgetLookup =
  | { ok: true; result: BudgetRecommendationResult }
  | { ok: false; code: "UNKNOWN_CATEGORY"; message: string; availableCategories: string[] }

/** Server entry point: validates the category against the catalog, then ranks. */
export async function getBudgetRecommendations(request: BudgetRequest): Promise<BudgetLookup> {
  let category: string | null = null
  if (request.category) {
    const match = await resolveCategory(request.category)
    if (!match) {
      const categories = await categoryRepository.list()
      return {
        ok: false,
        code: "UNKNOWN_CATEGORY",
        message: `Unknown category: ${request.category}`,
        availableCategories: categories.map((c) => c.slug),
      }
    }
    category = match.slug
  }

  const candidates = await loadBudgetCandidates()
  return { ok: true, result: recommendWithinBudget(candidates, { ...request, category }) }
}
