import type { Brand, Category, Product } from "@/types"
import { formatPrice } from "@/lib/utils"
import type {
  BestValueRecommendation,
  ComparableProduct,
  ComparisonRow,
  CriterionScore,
  ProductComparison,
  ProductInsights,
  ProductScore,
  RecommendationCriterion,
} from "./types"

export const MIN_COMPARE_PRODUCTS = 2
export const MAX_COMPARE_PRODUCTS = 4

const RATING_SCALE = 5

const BASE_CRITERIA: RecommendationCriterion[] = [
  {
    key: "price",
    label: "Price",
    weight: 0.4,
    description: "Lowest price scores 100%; others score lowest price ÷ their price.",
  },
  {
    key: "rating",
    label: "Customer rating",
    weight: 0.3,
    description: "Catalog rating out of 5. Products without a rating score 0.",
  },
  {
    key: "specifications",
    label: "Listed specifications",
    weight: 0.15,
    description:
      "Number of specification fields listed, relative to the most complete product.",
  },
  {
    key: "availability",
    label: "Availability",
    weight: 0.15,
    description: "In stock scores 100%; out of stock scores 0.",
  },
]

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function formatDimensions(d: { length: number; width: number; height: number }) {
  return `${d.length} × ${d.width} × ${d.height}`
}

/** Builds a ComparableProduct from catalog data without inventing values. */
export function toComparableProduct(
  product: Product,
  context: { brand?: Brand | null; categories?: Category[] } = {}
): ComparableProduct {
  const variants = product.variants
  const prices = variants.map((v) => v.price)
  const min = prices.length > 0 ? Math.min(...prices) : 0
  const max = prices.length > 0 ? Math.max(...prices) : 0
  const cheapest = variants.find((v) => v.price === min)
  const compareAt =
    cheapest?.compareAtPrice && cheapest.compareAtPrice > cheapest.price
      ? cheapest.compareAtPrice
      : null

  const specifications: Record<string, string[]> = {}
  for (const variant of variants) {
    for (const option of variant.options) {
      const name = option.name.trim()
      const value = option.value.trim()
      if (!name || !value) continue
      specifications[name] = unique([...(specifications[name] ?? []), value])
    }
  }
  const weights = unique(
    variants.flatMap((v) => (typeof v.weight === "number" ? [String(v.weight)] : []))
  )
  if (weights.length > 0) specifications.Weight = weights
  const dimensions = unique(
    variants.flatMap((v) => (v.dimensions ? [formatDimensions(v.dimensions)] : []))
  )
  if (dimensions.length > 0) specifications.Dimensions = dimensions

  const hasRating =
    typeof product.rating === "number" &&
    Number.isFinite(product.rating) &&
    product.rating > 0
  const reviewCount =
    typeof product.reviewCount === "number" && Number.isFinite(product.reviewCount)
      ? product.reviewCount
      : null

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    image: product.images[0] ?? null,
    brand: context.brand?.name ?? null,
    categories: (context.categories ?? []).map((c) => c.name),
    price: {
      min,
      max,
      currency: cheapest?.currency ?? variants[0]?.currency ?? "USD",
      compareAt,
      discountPercent: compareAt ? Math.round((1 - min / compareAt) * 100) : null,
    },
    rating: hasRating ? { value: product.rating, reviewCount } : null,
    availability: {
      inStock: variants.some(
        (v) =>
          !v.inventory.trackInventory ||
          v.inventory.quantity > 0 ||
          v.inventory.allowBackorder
      ),
    },
    variantCount: variants.length,
    specifications,
    features: unique(product.tags),
  }
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function formatPriceRange(p: ComparableProduct["price"]): string {
  return p.min === p.max
    ? formatPrice(p.min, p.currency)
    : `${formatPrice(p.min, p.currency)} – ${formatPrice(p.max, p.currency)}`
}

function indexesOf(values: (number | null)[], pick: "min" | "max"): number[] {
  const present = values.filter((v): v is number => v !== null)
  if (present.length < 2) return []
  const target = pick === "min" ? Math.min(...present) : Math.max(...present)
  if (present.every((v) => v === target)) return []
  return values.flatMap((v, i) => (v === target ? [i] : []))
}

function allSame(values: (string | null)[]): boolean {
  return values.every((v) => v === values[0])
}

/** Order-insensitive key for list values, so "Black, White" equals "White, Black". */
function listKey(list: string[] | undefined): string | null {
  return list && list.length > 0 ? [...list].sort().join("\u0000") : null
}

function joinList(list: string[] | undefined): string | null {
  return list && list.length > 0 ? list.join(", ") : null
}

function row(
  key: string,
  label: string,
  group: ComparisonRow["group"],
  values: (string | null)[],
  best: { indexes: number[]; label?: string } = { indexes: [] },
  equalityKeys: (string | null)[] = values
): ComparisonRow {
  return {
    key,
    label,
    group,
    values,
    differs: !allSame(equalityKeys),
    bestIndexes: best.indexes,
    bestLabel: best.indexes.length > 0 ? best.label : undefined,
  }
}

/** Ordered union of specification names across products. */
export function specificationKeys(products: ComparableProduct[]): string[] {
  return unique(products.flatMap((p) => Object.keys(p.specifications)))
}

function buildRows(products: ComparableProduct[]): ComparisonRow[] {
  const rows: ComparisonRow[] = []

  rows.push(
    row(
      "price",
      "Price",
      "pricing",
      products.map((p) => formatPriceRange(p.price)),
      { indexes: indexesOf(products.map((p) => p.price.min), "min"), label: "Lowest price" }
    ),
    row(
      "sale",
      "Sale",
      "pricing",
      products.map((p) =>
        p.price.compareAt
          ? `${p.price.discountPercent}% off (was ${formatPrice(p.price.compareAt, p.price.currency)})`
          : "Not on sale"
      ),
      {
        indexes: indexesOf(
          products.map((p) => p.price.discountPercent ?? 0),
          "max"
        ),
        label: "Biggest discount",
      }
    ),
    row("brand", "Brand", "overview", products.map((p) => p.brand)),
    row(
      "category",
      "Category",
      "overview",
      products.map((p) => joinList(p.categories)),
      undefined,
      products.map((p) => listKey(p.categories))
    ),
    row(
      "rating",
      "Rating",
      "overview",
      products.map((p) => (p.rating ? `${p.rating.value.toFixed(1)} / ${RATING_SCALE}` : null)),
      {
        indexes: indexesOf(products.map((p) => p.rating?.value ?? null), "max"),
        label: "Highest rated",
      }
    ),
    row(
      "reviews",
      "Reviews",
      "overview",
      products.map((p) =>
        p.rating?.reviewCount !== undefined && p.rating?.reviewCount !== null
          ? `${p.rating.reviewCount} ${p.rating.reviewCount === 1 ? "review" : "reviews"}`
          : null
      ),
      {
        indexes: indexesOf(products.map((p) => p.rating?.reviewCount ?? null), "max"),
        label: "Most reviewed",
      }
    ),
    row(
      "availability",
      "Availability",
      "availability",
      products.map((p) => (p.availability.inStock ? "In stock" : "Out of stock")),
      {
        indexes: products.some((p) => !p.availability.inStock)
          ? products.flatMap((p, i) => (p.availability.inStock ? [i] : []))
          : [],
        label: "In stock",
      }
    ),
    row(
      "variants",
      "Purchase options",
      "availability",
      products.map((p) => `${p.variantCount} ${p.variantCount === 1 ? "option" : "options"}`),
      {
        indexes: indexesOf(products.map((p) => p.variantCount), "max"),
        label: "Most options",
      }
    )
  )

  for (const key of specificationKeys(products)) {
    rows.push(
      row(
        `spec:${key}`,
        key,
        "specifications",
        products.map((p) => joinList(p.specifications[key])),
        undefined,
        products.map((p) => listKey(p.specifications[key]))
      )
    )
  }

  rows.push(
    row(
      "features",
      "Listed features",
      "details",
      products.map((p) => joinList(p.features)),
      undefined,
      products.map((p) => listKey(p.features))
    ),
    row(
      "description",
      "Description",
      "details",
      products.map((p) => p.description || null)
    )
  )

  return rows
}

// ---------------------------------------------------------------------------
// Advantages / disadvantages
// ---------------------------------------------------------------------------

function buildInsights(products: ComparableProduct[]): ProductInsights[] {
  const minPrices = products.map((p) => p.price.min)
  const cheapest = indexesOf(minPrices, "min")
  const priciest = indexesOf(minPrices, "max")

  const ratings = products.map((p) => p.rating?.value ?? null)
  const topRated = indexesOf(ratings, "max")
  const lowRated = indexesOf(ratings, "min")
  const ratedCount = ratings.filter((r) => r !== null).length

  const reviews = products.map((p) => p.rating?.reviewCount ?? null)
  const mostReviewed = indexesOf(reviews, "max")

  const variantCounts = products.map((p) => p.variantCount)
  const mostOptions = indexesOf(variantCounts, "max")

  const anyOutOfStock = products.some((p) => !p.availability.inStock)
  const specKeys = specificationKeys(products)

  return products.map((p, i) => {
    const advantages: string[] = []
    const disadvantages: string[] = []
    const price = formatPrice(p.price.min, p.price.currency)

    if (cheapest.includes(i)) advantages.push(`Lowest price in this comparison (${price})`)
    if (priciest.includes(i)) disadvantages.push(`Highest price in this comparison (${price})`)

    if (p.price.compareAt && p.price.discountPercent) {
      advantages.push(
        `On sale: ${p.price.discountPercent}% off the original ${formatPrice(p.price.compareAt, p.price.currency)}`
      )
    }

    if (p.rating) {
      const reviewText =
        p.rating.reviewCount !== null ? ` from ${p.rating.reviewCount} reviews` : ""
      if (topRated.includes(i)) {
        advantages.push(`Highest customer rating (${p.rating.value.toFixed(1)}/5${reviewText})`)
      }
      if (lowRated.includes(i)) {
        disadvantages.push(`Lowest customer rating (${p.rating.value.toFixed(1)}/5${reviewText})`)
      }
    } else if (ratedCount > 0) {
      disadvantages.push("No customer rating available")
    }

    if (mostReviewed.includes(i) && p.rating?.reviewCount) {
      advantages.push(`Most reviewed (${p.rating.reviewCount} reviews)`)
    }

    if (anyOutOfStock) {
      if (p.availability.inStock) advantages.push("In stock")
      else disadvantages.push("Currently out of stock")
    }

    if (mostOptions.includes(i)) {
      advantages.push(`Most purchase options (${p.variantCount})`)
    }

    const missing = specKeys.filter((k) => !p.specifications[k])
    if (missing.length > 0) {
      disadvantages.push(`Does not list: ${missing.join(", ")}`)
    }

    const otherFeatures = new Set(
      products.filter((_, j) => j !== i).flatMap((o) => o.features)
    )
    const uniqueFeatures = p.features.filter((f) => !otherFeatures.has(f))
    if (uniqueFeatures.length > 0 && otherFeatures.size > 0) {
      advantages.push(`Lists features the others don't: ${uniqueFeatures.join(", ")}`)
    }

    return { productId: p.id, advantages, disadvantages }
  })
}

// ---------------------------------------------------------------------------
// Best-value recommendation
// ---------------------------------------------------------------------------

function round(n: number, digits = 1) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function buildRecommendation(products: ComparableProduct[]): BestValueRecommendation | null {
  if (products.length < MIN_COMPARE_PRODUCTS) return null

  const ratedCount = products.filter((p) => p.rating).length
  const specCounts = products.map((p) => Object.keys(p.specifications).length)
  const maxSpecs = Math.max(...specCounts)

  const included = BASE_CRITERIA.filter((c) => {
    if (c.key === "rating") return ratedCount > 0
    if (c.key === "specifications") return maxSpecs > 0
    return true
  })
  const weightSum = included.reduce((s, c) => s + c.weight, 0)
  const criteria = included.map((c) => ({ ...c, weight: round(c.weight / weightSum, 4) }))

  const minPrice = Math.min(...products.map((p) => p.price.min))

  const scores: ProductScore[] = products.map((p, i) => {
    const breakdown: CriterionScore[] = criteria.map((c) => {
      let score = 0
      let detail = ""
      switch (c.key) {
        case "price":
          score = p.price.min > 0 ? minPrice / p.price.min : 1
          detail = formatPrice(p.price.min, p.price.currency)
          break
        case "rating":
          score = p.rating ? p.rating.value / RATING_SCALE : 0
          detail = p.rating ? `${p.rating.value.toFixed(1)}/5` : "No rating available"
          break
        case "specifications":
          score = maxSpecs > 0 ? specCounts[i] / maxSpecs : 0
          detail = `${specCounts[i]} of ${maxSpecs} fields listed`
          break
        case "availability":
          score = p.availability.inStock ? 1 : 0
          detail = p.availability.inStock ? "In stock" : "Out of stock"
          break
      }
      return {
        criterion: c.key,
        score: round(score, 3),
        points: round(score * c.weight * 100),
        detail,
      }
    })
    const total = round(breakdown.reduce((s, b) => s + b.points, 0))
    return { productId: p.id, total, breakdown }
  })

  const ranked = products
    .map((p, i) => ({ p, s: scores[i] }))
    .sort(
      (a, b) =>
        b.s.total - a.s.total ||
        a.p.price.min - b.p.price.min ||
        (b.p.rating?.value ?? 0) - (a.p.rating?.value ?? 0)
    )
  const winner = ranked[0]
  const runnerUp = ranked[1]

  const strengths = winner.s.breakdown
    .filter((b) => b.score >= 0.999)
    .map((b) => criteria.find((c) => c.key === b.criterion)!.label.toLowerCase())
  const weights = criteria
    .map((c) => `${c.label.toLowerCase()} ${Math.round(c.weight * 100)}%`)
    .join(", ")

  let summary =
    `${winner.p.name} is the best value of the ${products.length} products compared, ` +
    `scoring ${winner.s.total}/100 (weighted: ${weights}).`
  if (strengths.length > 0) summary += ` It leads on ${strengths.join(", ")}.`
  if (runnerUp && runnerUp.s.total === winner.s.total) {
    summary += ` It ties with ${runnerUp.p.name} on score and wins on lower price.`
  }

  const caveats: string[] = []
  const categorySets = unique(products.map((p) => p.categories[0] ?? ""))
  if (categorySets.length > 1) {
    caveats.push(
      "These products are in different categories, so the score only reflects shared data (price, rating, availability, listed specs), not suitability for a specific need."
    )
  }
  if (ratedCount > 0 && ratedCount < products.length) {
    caveats.push("Some products have no rating in the catalog and score 0 on rating.")
  }
  if (ratedCount === 0) {
    caveats.push("No products have ratings in the catalog, so rating was excluded.")
  }
  if (maxSpecs === 0) {
    caveats.push("No products list specifications, so specifications were excluded.")
  }
  caveats.push(
    "Specifications are limited to what the catalog lists (variant options, weight, dimensions); nothing is inferred."
  )

  return {
    productId: winner.p.id,
    productName: winner.p.name,
    score: winner.s.total,
    summary,
    criteria,
    scores,
    caveats,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pure, deterministic comparison of already-resolved products. Has no I/O
 * so it can run on the server, the client, or inside an AI agent tool.
 */
export function compareProducts(products: ComparableProduct[]): ProductComparison {
  return {
    products,
    rows: buildRows(products),
    insights: buildInsights(products),
    recommendation: buildRecommendation(products),
  }
}

/** Plain-text summary of a comparison, e.g. for grounding an AI agent reply. */
export function formatComparisonAsText(comparison: ProductComparison): string {
  const lines: string[] = []
  lines.push(`Comparing: ${comparison.products.map((p) => p.name).join(" vs ")}`)
  for (const r of comparison.rows) {
    if (r.key === "description") continue
    const cells = comparison.products.map(
      (p, i) => `${p.name}: ${r.values[i] ?? "Not specified"}`
    )
    lines.push(`- ${r.label}${r.differs ? " (differs)" : ""}: ${cells.join("; ")}`)
  }
  for (const insight of comparison.insights) {
    const name = comparison.products.find((p) => p.id === insight.productId)?.name
    if (insight.advantages.length) lines.push(`${name} pros: ${insight.advantages.join("; ")}`)
    if (insight.disadvantages.length) lines.push(`${name} cons: ${insight.disadvantages.join("; ")}`)
  }
  if (comparison.recommendation) {
    lines.push(`Best value: ${comparison.recommendation.summary}`)
  }
  return lines.join("\n")
}
