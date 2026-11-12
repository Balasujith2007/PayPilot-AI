import { Type } from "@google/genai"

import { productRepository } from "@/lib/repositories"
import { AGENT_TOOL_MAX_RESULTS, searchProductsArgsSchema } from "@/lib/validators"
import type { SearchProductsArgs } from "@/lib/validators"

import { defineAgentTool, resolveCategorySlug, toProductSummary, toolSuccess } from "./shared"

const NAME = "search_products"
const DEFAULT_LIMIT = 6

/**
 * Search the store catalog.
 *
 * Runs the same keyword matching as the storefront search page (name,
 * description and tags) and returns server-catalog products only.
 */
export const searchProductsTool = defineAgentTool<SearchProductsArgs>({
  name: NAME,
  description:
    "Search the store catalog for products. Use this whenever the shopper asks what is available, names a product type, or asks for recommendations. Returns matching products with server-verified prices, ratings and stock.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description:
          'Keywords describing what the shopper wants, for example "wireless headphones" or "coffee".',
      },
      category: {
        type: Type.STRING,
        description:
          'Optional category filter, for example "electronics", "clothing", "home-kitchen", "accessories" or "food-drink".',
      },
      limit: {
        type: Type.INTEGER,
        description: `Maximum number of products to return (1-${AGENT_TOOL_MAX_RESULTS}). Defaults to ${DEFAULT_LIMIT}.`,
      },
    },
    required: ["query"],
  },
  schema: searchProductsArgsSchema,
  async execute(args) {
    const limit = args.limit ?? DEFAULT_LIMIT
    const categorySlug = args.category ? await resolveCategorySlug(args.category) : null

    // An unrecognised category is reported back rather than ignored, so the
    // model can retry without the filter instead of silently narrowing.
    if (args.category && !categorySlug) {
      return toolSuccess(NAME, {
        query: args.query,
        category: args.category,
        categoryMatched: false,
        resultCount: 0,
        totalMatches: 0,
        products: [],
        note: `No category matches "${args.category}". Retry without a category filter.`,
      })
    }

    const { items, pagination } = await productRepository.list(
      { search: args.query, category: categorySlug ?? undefined },
      undefined,
      { page: 1, limit }
    )

    const products = await Promise.all(items.map(toProductSummary))

    return toolSuccess(NAME, {
      query: args.query,
      category: categorySlug,
      categoryMatched: true,
      resultCount: products.length,
      totalMatches: pagination.total,
      products,
      note:
        products.length === 0
          ? "No products matched those keywords. Try broader or different keywords."
          : undefined,
    })
  },
})
