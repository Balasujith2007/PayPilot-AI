import type { ProductImage } from "@/types"

/** Normalized, catalog-derived view of a product used for comparisons. */
export interface ComparableProduct {
  id: string
  name: string
  slug: string
  description: string
  image: ProductImage | null
  brand: string | null
  categories: string[]
  price: {
    /** Lowest variant price, in cents */
    min: number
    /** Highest variant price, in cents */
    max: number
    currency: string
    /** Original price of the lowest-priced variant, when it is on sale */
    compareAt: number | null
    discountPercent: number | null
  }
  /** null when the catalog has no rating for the product */
  rating: { value: number; reviewCount: number | null } | null
  availability: { inStock: boolean }
  variantCount: number
  /**
   * Specifications derived from catalog data only (variant options, weight,
   * dimensions). Keys missing here are "not specified" — never inferred.
   */
  specifications: Record<string, string[]>
  /** Catalog tags, used as the product's listed features */
  features: string[]
}

export type ComparisonRowGroup =
  | "overview"
  | "pricing"
  | "availability"
  | "specifications"
  | "details"

export interface ComparisonRow {
  key: string
  label: string
  group: ComparisonRowGroup
  /** One display value per product (same order as `products`); null = not specified */
  values: (string | null)[]
  /** True when the products do not all share the same value */
  differs: boolean
  /** Indexes of the products that are best on this row (empty when not applicable) */
  bestIndexes: number[]
  bestLabel?: string
}

export interface ProductInsights {
  productId: string
  advantages: string[]
  disadvantages: string[]
}

export interface RecommendationCriterion {
  key: "price" | "rating" | "specifications" | "availability"
  label: string
  /** Normalized weight (all included criteria sum to 1) */
  weight: number
  description: string
}

export interface CriterionScore {
  criterion: RecommendationCriterion["key"]
  /** 0–1 score on this criterion */
  score: number
  /** score × weight × 100 */
  points: number
  detail: string
}

export interface ProductScore {
  productId: string
  /** 0–100 */
  total: number
  breakdown: CriterionScore[]
}

export interface BestValueRecommendation {
  productId: string
  productName: string
  score: number
  summary: string
  criteria: RecommendationCriterion[]
  scores: ProductScore[]
  caveats: string[]
}

export interface ProductComparison {
  products: ComparableProduct[]
  rows: ComparisonRow[]
  insights: ProductInsights[]
  recommendation: BestValueRecommendation | null
}
