import type { ComparableProduct } from "@/lib/comparison/types"

/**
 * A catalog product prepared for budget matching. Everything here is derived
 * from catalog data; nothing is estimated.
 */
export interface BudgetCandidate {
  /** Normalized product view shared with the comparison feature (Task 16) */
  product: ComparableProduct
  /** Slugs of the product's categories and their ancestors */
  categorySlugs: string[]
  variants: BudgetCandidateVariant[]
  /** Plain text of the long product description, used only for relevance matching */
  bodyText: string
}

export interface BudgetCandidateVariant {
  id: string
  name: string
  /** In cents, as stored in the catalog */
  price: number
  compareAtPrice: number | null
  currency: string
  inStock: boolean
}

export interface BudgetRequest {
  /** Maximum spend in cents (the catalog's price unit) */
  budget: number
  /** ISO currency code; defaults to the store currency */
  currency?: string
  /** Category slug or name; matches products in that category or any subcategory */
  category?: string | null
  /** Products must match at least one keyword */
  keywords?: string[]
  /** Free-text description of how the product will be used; affects ranking only */
  intendedUse?: string | null
  /** Number of alternatives to return after the best value (default 3) */
  maxAlternatives?: number
  /** Include products that are currently out of stock (default false) */
  includeOutOfStock?: boolean
}

export type BudgetCriterionKey = "price" | "rating" | "specifications" | "relevance"

export interface BudgetCriterion {
  key: BudgetCriterionKey
  label: string
  /** Normalized weight; all included criteria sum to 1 */
  weight: number
  description: string
}

export interface BudgetCriterionScore {
  criterion: BudgetCriterionKey
  /** 0–1 score on this criterion */
  score: number
  /** score × weight × 100 */
  points: number
  detail: string
}

export interface BudgetRecommendation {
  /** 1 = best value */
  rank: number
  product: ComparableProduct
  /** Cheapest purchasable variant that fits the budget */
  variant: { id: string; name: string }
  /** Price of that variant, in cents */
  price: number
  /** Budget left after buying that variant, in cents */
  remainingBudget: number
  /** 0–100 weighted score */
  score: number
  breakdown: BudgetCriterionScore[]
  /** Requirement terms found in the product's catalog data */
  matchedTerms: string[]
  /** Requirement terms not found in the product's catalog data */
  unmatchedTerms: string[]
  /** Why this product was recommended, based only on catalog data */
  reasons: string[]
  /** Missing data or limitations worth knowing about */
  caveats: string[]
}

export type BudgetExclusionReason =
  | "category"
  | "keywords"
  | "currency"
  | "invalid_price"
  | "out_of_stock"
  | "over_budget"

export interface ExcludedProduct {
  productId: string
  name: string
  reason: BudgetExclusionReason
  detail: string
}

export type BudgetResultStatus = "ok" | "no_matches" | "empty_catalog"

export interface BudgetRecommendationResult {
  status: BudgetResultStatus
  /** Human-readable summary, e.g. for display or for grounding an AI reply */
  message: string
  budget: { amount: number; currency: string; formatted: string }
  requirements: {
    category: string | null
    keywords: string[]
    intendedUse: string | null
    /** Normalized terms used for relevance matching */
    terms: string[]
  }
  /** Ranking criteria actually used, with rescaled weights */
  criteria: BudgetCriterion[]
  bestValue: BudgetRecommendation | null
  alternatives: BudgetRecommendation[]
  counts: {
    catalog: number
    eligible: number
    overBudget: number
    filteredOut: number
    unavailable: number
  }
  excluded: ExcludedProduct[]
  /** Cheapest product that met the requirements but is over budget */
  closestOverBudget: {
    productId: string
    name: string
    price: number
    overBy: number
    formatted: string
  } | null
}
