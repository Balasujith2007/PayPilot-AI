import type { Brand, Category, Product } from "@/types"
import { siteConfig } from "@/lib/config"
import { formatPrice } from "@/lib/utils"
import { toComparableProduct } from "@/lib/comparison/compare-products"
import type {
  BudgetCandidate,
  BudgetCriterion,
  BudgetCriterionScore,
  BudgetRecommendation,
  BudgetRecommendationResult,
  BudgetRequest,
  ExcludedProduct,
} from "./types"

export const DEFAULT_MAX_ALTERNATIVES = 3
export const MAX_ALTERNATIVES_LIMIT = 10

const RATING_SCALE = 5

const BASE_CRITERIA: BudgetCriterion[] = [
  {
    key: "price",
    label: "Price",
    weight: 0.35,
    description:
      "Cheapest product within budget scores 100%; others score cheapest price ÷ their price.",
  },
  {
    key: "rating",
    label: "Customer rating",
    weight: 0.25,
    description: "Catalog rating out of 5. Products without a rating score 0.",
  },
  {
    key: "specifications",
    label: "Listed specifications",
    weight: 0.15,
    description:
      "Number of specification fields listed, relative to the most complete eligible product.",
  },
  {
    key: "relevance",
    label: "Relevance",
    weight: 0.25,
    description:
      "Share of your keywords and intended-use terms found in the product's catalog data (name, tags and category count most; description and specs less; long description least).",
  },
]

/** Where a requirement term was found, and how strongly that counts. */
const FIELD_WEIGHTS = {
  name: 1,
  tags: 1,
  categories: 1,
  brand: 0.8,
  specifications: 0.8,
  description: 0.7,
  body: 0.4,
} as const

const STOPWORDS = new Set(
  (
    "a an and any are as at be best but by can for from get good great have i in into is it " +
    "its looking me my need needs of on or our some something that the their them this to " +
    "use used using want wants was we will with would you your mostly also very just like " +
    "buy buying gift"
  ).split(" ")
)

// ---------------------------------------------------------------------------
// Candidate preparation
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Builds a BudgetCandidate from a catalog product. `categorySlugs` should
 * include ancestor categories so a request for a parent category also
 * matches products in its subcategories.
 */
export function toBudgetCandidate(
  product: Product,
  context: { brand?: Brand | null; categories?: Category[]; categorySlugs?: string[] } = {}
): BudgetCandidate {
  return {
    product: toComparableProduct(product, context),
    categorySlugs: [
      ...new Set(context.categorySlugs ?? (context.categories ?? []).map((c) => c.slug)),
    ],
    variants: product.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      compareAtPrice:
        typeof v.compareAtPrice === "number" && v.compareAtPrice > v.price
          ? v.compareAtPrice
          : null,
      currency: v.currency,
      inStock:
        !v.inventory.trackInventory || v.inventory.quantity > 0 || v.inventory.allowBackorder,
    })),
    bodyText: product.body ? stripHtml(product.body) : "",
  }
}

// ---------------------------------------------------------------------------
// Requirement matching
// ---------------------------------------------------------------------------

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function slugify(value: string): string {
  return normalizeText(value)
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Normalized keyword phrases, de-duplicated, order kept. */
export function normalizeKeywords(keywords: string[] = []): string[] {
  return [...new Set(keywords.map(normalizeText).filter(Boolean))]
}

/** Meaningful words from a free-text intended use, e.g. "for daily travel" → ["daily", "travel"]. */
export function intendedUseTerms(text: string | null | undefined): string[] {
  if (!text) return []
  return [
    ...new Set(
      normalizeText(text)
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
    ),
  ]
}

function stem(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3) + "y"
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1)
  return word
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Word-prefix match, so "travel" matches "traveling" and "bags" matches "bag". */
function termPattern(term: string): RegExp {
  const words = term.split(" ")
  const last = stem(words.pop()!)
  const phrase = [...words.map(escapeRegExp), escapeRegExp(last)].join(" ")
  return new RegExp(`(^|[^a-z0-9])${phrase}`)
}

type SearchFields = Record<keyof typeof FIELD_WEIGHTS, string>

function searchFields(c: BudgetCandidate): SearchFields {
  const p = c.product
  return {
    name: normalizeText(p.name),
    tags: normalizeText(p.features.join(" | ")),
    categories: normalizeText(p.categories.join(" | ")),
    brand: normalizeText(p.brand ?? ""),
    specifications: normalizeText(
      Object.entries(p.specifications)
        .map(([k, v]) => `${k} ${v.join(" ")}`)
        .join(" | ")
    ),
    description: normalizeText(p.description),
    body: normalizeText(c.bodyText),
  }
}

/** 0–1 strength of the best field that contains the term (0 = not found). */
function termStrength(fields: SearchFields, term: string): number {
  const pattern = termPattern(term)
  let best = 0
  for (const key of Object.keys(FIELD_WEIGHTS) as (keyof SearchFields)[]) {
    if (FIELD_WEIGHTS[key] > best && pattern.test(fields[key])) best = FIELD_WEIGHTS[key]
  }
  return best
}

function matchesCategory(c: BudgetCandidate, category: string): boolean {
  const slug = slugify(category)
  const name = normalizeText(category)
  return (
    c.categorySlugs.includes(slug) ||
    c.product.categories.some((n) => normalizeText(n) === name)
  )
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function round(n: number, digits = 1) {
  const f = 10 ** digits
  return Math.round(n * f) / f
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

function quoteList(values: string[]) {
  return values.map((v) => `"${v}"`).join(", ")
}

interface Eligible {
  candidate: BudgetCandidate
  variant: BudgetCandidate["variants"][number]
  fittingCount: number
  purchasableCount: number
  termStrengths: number[]
}

/**
 * Recommends products within a budget. Pure and deterministic: it only uses
 * the candidates passed in, so it can run on the server, in tests, or behind
 * an AI agent tool without network access.
 */
export function recommendWithinBudget(
  candidates: BudgetCandidate[],
  request: BudgetRequest
): BudgetRecommendationResult {
  const budget = request.budget
  const currency = (request.currency ?? siteConfig.currency).toUpperCase()
  const fmt = (cents: number) => formatPrice(cents, currency)
  const category = request.category?.trim() || null
  const keywords = normalizeKeywords(request.keywords)
  const intendedUse = request.intendedUse?.trim() || null
  const terms = [...new Set([...keywords, ...intendedUseTerms(intendedUse)])]
  const maxAlternatives = Math.min(
    Math.max(0, Math.floor(request.maxAlternatives ?? DEFAULT_MAX_ALTERNATIVES)),
    MAX_ALTERNATIVES_LIMIT
  )

  const excluded: ExcludedProduct[] = []
  const eligible: Eligible[] = []
  let closest: { c: BudgetCandidate; price: number } | null = null

  for (const c of candidates) {
    const exclude = (reason: ExcludedProduct["reason"], detail: string) =>
      excluded.push({ productId: c.product.id, name: c.product.name, reason, detail })

    if (category && !matchesCategory(c, category)) {
      exclude("category", `Not in the "${category}" category`)
      continue
    }

    const fields = searchFields(c)
    const termStrengths = terms.map((t) => termStrength(fields, t))
    if (keywords.length > 0 && !keywords.some((k) => termStrengths[terms.indexOf(k)] > 0)) {
      exclude("keywords", `Catalog data doesn't mention ${quoteList(keywords)}`)
      continue
    }

    const sameCurrency = c.variants.filter((v) => v.currency.toUpperCase() === currency)
    if (sameCurrency.length === 0) {
      exclude("currency", `Not priced in ${currency}`)
      continue
    }
    const priced = sameCurrency.filter((v) => Number.isFinite(v.price) && v.price > 0)
    if (priced.length === 0) {
      exclude("invalid_price", "No valid price in the catalog")
      continue
    }
    const purchasable = request.includeOutOfStock ? priced : priced.filter((v) => v.inStock)
    if (purchasable.length === 0) {
      exclude("out_of_stock", "Out of stock")
      continue
    }
    const fitting = purchasable.filter((v) => v.price <= budget)
    if (fitting.length === 0) {
      const cheapest = Math.min(...purchasable.map((v) => v.price))
      exclude("over_budget", `Cheapest option is ${fmt(cheapest)}, ${fmt(cheapest - budget)} over budget`)
      if (!closest || cheapest < closest.price) closest = { c, price: cheapest }
      continue
    }

    const variant = [...fitting].sort(
      (a, b) => a.price - b.price || Number(b.inStock) - Number(a.inStock)
    )[0]
    eligible.push({
      candidate: c,
      variant,
      fittingCount: fitting.length,
      purchasableCount: purchasable.length,
      termStrengths,
    })
  }

  const count = (...reasons: ExcludedProduct["reason"][]) =>
    excluded.filter((e) => reasons.includes(e.reason)).length

  const base = {
    budget: { amount: budget, currency, formatted: fmt(budget) },
    requirements: { category, keywords, intendedUse, terms },
    counts: {
      catalog: candidates.length,
      eligible: eligible.length,
      overBudget: count("over_budget"),
      filteredOut: count("category", "keywords"),
      unavailable: count("currency", "invalid_price", "out_of_stock"),
    },
    excluded,
    closestOverBudget: closest
      ? {
          productId: closest.c.product.id,
          name: closest.c.product.name,
          price: closest.price,
          overBy: closest.price - budget,
          formatted: fmt(closest.price),
        }
      : null,
  }

  const requirementText = describeRequirements(category, keywords)

  if (candidates.length === 0) {
    return {
      ...base,
      status: "empty_catalog",
      message: "The catalog has no active products, so there is nothing to recommend.",
      criteria: [],
      bestValue: null,
      alternatives: [],
    }
  }

  if (eligible.length === 0) {
    let message: string
    if (base.counts.filteredOut === candidates.length) {
      message = `No products match${requirementText}.`
    } else if (closest) {
      message =
        `No products${requirementText} are available within ${fmt(budget)}. ` +
        `The cheapest option is ${closest.c.product.name} at ${fmt(closest.price)} ` +
        `(${fmt(closest.price - budget)} over budget).`
    } else {
      message = `No products${requirementText} are currently available to buy in ${currency}.`
    }
    return {
      ...base,
      status: "no_matches",
      message,
      criteria: [],
      bestValue: null,
      alternatives: [],
    }
  }

  const ranked = rank(eligible, terms, budget, fmt)
  const best = ranked[0]
  const recommendations = ranked.slice(0, 1 + maxAlternatives)

  return {
    ...base,
    status: "ok",
    message:
      `Found ${plural(eligible.length, "product")}${requirementText} within ${fmt(budget)}. ` +
      `Best value: ${best.product.name} at ${fmt(best.price)} (score ${best.score}/100).` +
      (terms.length > 0 && !ranked.criteria.some((c) => c.key === "relevance")
        ? ` None of them mention ${quoteList(terms)}, so relevance was not scored.`
        : ""),
    criteria: ranked.criteria,
    bestValue: best,
    alternatives: recommendations.slice(1),
  }
}

function describeRequirements(category: string | null, keywords: string[]): string {
  const parts: string[] = []
  if (category) parts.push(` in "${category}"`)
  if (keywords.length > 0) parts.push(` matching ${quoteList(keywords)}`)
  return parts.join(" and")
}

function rank(
  eligible: Eligible[],
  terms: string[],
  budget: number,
  fmt: (cents: number) => string
): BudgetRecommendation[] & { criteria: BudgetCriterion[] } {
  const ratedCount = eligible.filter((e) => e.candidate.product.rating).length
  const specCounts = eligible.map((e) => Object.keys(e.candidate.product.specifications).length)
  const maxSpecs = Math.max(...specCounts)

  const relevances = eligible.map((e) =>
    terms.length > 0 ? e.termStrengths.reduce((s, v) => s + v, 0) / terms.length : 0
  )

  const included = BASE_CRITERIA.filter((c) => {
    if (c.key === "rating") return ratedCount > 0
    if (c.key === "specifications") return maxSpecs > 0
    if (c.key === "relevance") return relevances.some((r) => r > 0)
    return true
  })
  const weightSum = included.reduce((s, c) => s + c.weight, 0)
  const criteria = included.map((c) => ({ ...c, weight: round(c.weight / weightSum, 4) }))

  const minPrice = Math.min(...eligible.map((e) => e.variant.price))
  const maxRating = Math.max(...eligible.map((e) => e.candidate.product.rating?.value ?? 0))
  const scored = eligible.map((e, i) => {
    const p = e.candidate.product
    const breakdown: BudgetCriterionScore[] = criteria.map((c) => {
      let score = 0
      let detail = ""
      switch (c.key) {
        case "price":
          score = minPrice / e.variant.price
          detail = fmt(e.variant.price)
          break
        case "rating":
          score = p.rating ? p.rating.value / RATING_SCALE : 0
          detail = p.rating ? `${p.rating.value.toFixed(1)}/5` : "No rating available"
          break
        case "specifications":
          score = specCounts[i] / maxSpecs
          detail = `${specCounts[i]} of ${maxSpecs} fields listed`
          break
        case "relevance": {
          const matched = e.termStrengths.filter((s) => s > 0).length
          score = relevances[i]
          detail = `${matched} of ${terms.length} terms matched`
          break
        }
      }
      return { criterion: c.key, score: round(score, 3), points: round(score * c.weight * 100), detail }
    })
    return { e, i, breakdown, total: round(breakdown.reduce((s, b) => s + b.points, 0)) }
  })

  scored.sort(
    (a, b) =>
      b.total - a.total ||
      a.e.variant.price - b.e.variant.price ||
      (b.e.candidate.product.rating?.value ?? 0) - (a.e.candidate.product.rating?.value ?? 0) ||
      a.e.candidate.product.name.localeCompare(b.e.candidate.product.name)
  )

  const bestScored = scored[0]
  const hasRatingCriterion = criteria.some((c) => c.key === "rating")

  const recommendations = scored.map((s, index) => {
    const { e, i } = s
    const p = e.candidate.product
    const price = e.variant.price
    const matchedTerms = terms.filter((_, t) => e.termStrengths[t] > 0)
    const unmatchedTerms = terms.filter((_, t) => e.termStrengths[t] === 0)
    const reasons: string[] = []
    const caveats: string[] = []

    if (index === 0) {
      reasons.push(
        eligible.length === 1
          ? `Only product that fits your budget and requirements (score ${s.total}/100).`
          : `Highest overall score among ${plural(eligible.length, "product")} within budget (${s.total}/100).`
      )
    } else {
      reasons.push(`Ranked #${index + 1} of ${eligible.length} with a score of ${s.total}/100.`)
      const bestPrice = bestScored.e.variant.price
      const bestRating = bestScored.e.candidate.product.rating?.value ?? null
      if (price < bestPrice) {
        reasons.push(`Saves ${fmt(bestPrice - price)} compared with the best value.`)
      }
      if (p.rating && (bestRating === null || p.rating.value > bestRating)) {
        reasons.push(
          `Higher rated than the best value (${p.rating.value.toFixed(1)}/5${bestRating !== null ? ` vs ${bestRating.toFixed(1)}/5` : ""}).`
        )
      }
      if (terms.length > 0 && relevances[i] > relevances[bestScored.i]) {
        reasons.push("Closer match to your requirements than the best value.")
      }
    }

    reasons.push(`Costs ${fmt(price)}, leaving ${fmt(budget - price)} of your ${fmt(budget)} budget.`)
    if (eligible.length > 1 && price === minPrice) reasons.push("Lowest price among matching products.")
    if (e.variant.compareAtPrice) {
      const off = Math.round((1 - price / e.variant.compareAtPrice) * 100)
      reasons.push(`On sale: ${off}% off the original ${fmt(e.variant.compareAtPrice)}.`)
    }
    if (p.rating) {
      const reviews = p.rating.reviewCount !== null ? ` from ${plural(p.rating.reviewCount, "review")}` : ""
      const top = eligible.length > 1 && p.rating.value === maxRating ? ", the highest among matches" : ""
      reasons.push(`Rated ${p.rating.value.toFixed(1)}/5${reviews}${top}.`)
    }
    if (matchedTerms.length > 0) reasons.push(`Matches your requirements: ${matchedTerms.join(", ")}.`)
    const specEntries = Object.entries(p.specifications)
    if (specEntries.length > 0) {
      reasons.push(
        `Lists ${plural(specEntries.length, "specification")}: ` +
          specEntries.map(([k, v]) => `${k} (${v.join(", ")})`).join("; ") +
          "."
      )
    }

    if (!p.rating) {
      caveats.push(
        hasRatingCriterion
          ? "No rating in the catalog; scored 0 on rating instead of guessing."
          : "No rating in the catalog."
      )
    }
    if (specEntries.length === 0) caveats.push("No specifications listed in the catalog.")
    if (unmatchedTerms.length > 0) caveats.push(`Catalog data doesn't mention: ${unmatchedTerms.join(", ")}.`)
    if (e.fittingCount < e.purchasableCount) {
      caveats.push(`Only ${e.fittingCount} of ${e.purchasableCount} options fit the budget; the price shown is for "${e.variant.name}".`)
    }
    if (!e.variant.inStock) caveats.push("Currently out of stock.")

    return {
      rank: index + 1,
      product: p,
      variant: { id: e.variant.id, name: e.variant.name },
      price,
      remainingBudget: budget - price,
      score: s.total,
      breakdown: s.breakdown,
      matchedTerms,
      unmatchedTerms,
      reasons,
      caveats,
    }
  })

  return Object.assign(recommendations, { criteria })
}

/** Plain-text summary, suitable for grounding an AI agent's reply. */
export function formatBudgetResultAsText(result: BudgetRecommendationResult): string {
  const lines = [result.message]
  if (result.criteria.length > 0) {
    lines.push(
      "Ranking criteria: " +
        result.criteria.map((c) => `${c.label} ${Math.round(c.weight * 100)}%`).join(", ") +
        "."
    )
  }
  const all = result.bestValue ? [result.bestValue, ...result.alternatives] : []
  for (const r of all) {
    lines.push(
      `${r.rank === 1 ? "Best value" : `Alternative #${r.rank - 1}`}: ${r.product.name} ` +
        `(${r.product.id}) at ${formatPrice(r.price, result.budget.currency)}, score ${r.score}/100.`
    )
    for (const reason of r.reasons) lines.push(`  - ${reason}`)
    for (const caveat of r.caveats) lines.push(`  - Note: ${caveat}`)
  }
  return lines.join("\n")
}
