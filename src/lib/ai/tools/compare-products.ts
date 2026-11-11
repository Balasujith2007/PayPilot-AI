import { Type } from "@google/genai"

import { productRepository } from "@/lib/repositories"
import { MAX_COMPARE_PRODUCTS, MIN_COMPARE_PRODUCTS } from "@/lib/comparison"
import { getProductComparison } from "@/lib/comparison/service"
import { compareProductsArgsSchema } from "@/lib/validators"
import type { CompareProductsArgs } from "@/lib/validators"
import { siteConfig } from "@/lib/config"
import type { Product } from "@/types"

import {
  defineAgentTool,
  formatCents,
  isPurchasable,
  toProductSummary,
  toolFailure,
  toolSuccess,
  type ProductSummary,
} from "./shared"

const NAME = "compare_products"

interface ComparedProduct extends ProductSummary {
  variantCount: number
  availableVariantCount: number
  variantNames: string[]
  compareAtPriceFormatted?: string
}

interface ComparisonRow {
  attribute: string
  same: boolean
  values: Record<string, string>
}

/**
 * Compare 2-4 products side by side.
 *
 * Product resolution and the comparison itself are owned by the Smart Product
 * Comparison engine (Task 16); this tool only adapts its output to the shape
 * the model receives. The model only supplies the ids.
 */
export const compareProductsTool = defineAgentTool<CompareProductsArgs>({
  name: NAME,
  description:
    "Compare two to four products side by side. Use this when the shopper asks how options differ or wants a recommendation between specific products. Supply the product ids returned by search_products.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      productIds: {
        type: Type.ARRAY,
        description: `Product ids to compare (${MIN_COMPARE_PRODUCTS}-${MAX_COMPARE_PRODUCTS}).`,
        items: { type: Type.STRING, description: 'A product id such as "prod-1".' },
      },
    },
    required: ["productIds"],
  },
  schema: compareProductsArgsSchema,
  async execute(args) {
    // De-duplicate while preserving the order the model asked for.
    const requestedIds = Array.from(new Set(args.productIds))

    const { comparison, products: compared, invalidIds } =
      await getProductComparison(requestedIds)

    if (!comparison || compared.length < MIN_COMPARE_PRODUCTS) {
      return toolFailure(
        NAME,
        "NOT_FOUND",
        `Need at least ${MIN_COMPARE_PRODUCTS} valid products to compare. Unknown or unavailable ids: ${
          invalidIds.join(", ") || "(none)"
        }.`
      )
    }

    // Catalog records for the compact product list the model receives.
    const catalog = await Promise.all(
      compared.map((product) => productRepository.getById(product.id))
    )

    const products: ComparedProduct[] = await Promise.all(
      catalog
        .filter((product): product is Product => Boolean(product))
        .map(async (product) => {
          const summary = await toProductSummary(product)
          const comparedProduct: ComparedProduct = {
            ...summary,
            variantCount: product.variants.length,
            availableVariantCount: product.variants.filter(isPurchasable).length,
            variantNames: product.variants.map((variant) => variant.name),
          }
          const variant = product.variants[0]
          if (variant?.compareAtPrice !== undefined) {
            comparedProduct.compareAtPriceFormatted = formatCents(
              variant.compareAtPrice,
              variant.currency
            )
          }
          return comparedProduct
        })
    )

    const cheapest = products.reduce((best, p) => (p.price < best.price ? p : best), products[0])
    const highestRated = products.reduce(
      (best, p) => (p.rating > best.rating ? p : best),
      products[0]
    )

    const comparedIds = comparison.products.map((product) => product.id)

    return toolSuccess(NAME, {
      currency: siteConfig.currency,
      comparedCount: products.length,
      notFound: invalidIds,
      products,
      rows: comparison.rows.map((row) => buildRow(comparedIds, row)),
      highlights: {
        cheapest: { id: cheapest.id, name: cheapest.name, price: cheapest.price },
        highestRated: { id: highestRated.id, name: highestRated.name, rating: highestRated.rating },
      },
    })
  },
})

/**
 * Adapts a Task 16 row (positional values) to the id-keyed row shape the
 * agent contract has always returned.
 */
function buildRow(
  productIds: string[],
  row: { label: string; values: (string | null)[]; differs: boolean }
): ComparisonRow {
  const values: Record<string, string> = {}
  productIds.forEach((id, index) => {
    values[id] = row.values[index] ?? "—"
  })
  return { attribute: row.label, same: !row.differs, values }
}
