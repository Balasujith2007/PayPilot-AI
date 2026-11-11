import { Type } from "@google/genai"

import { getBudgetRecommendations } from "@/lib/budget/service"
import type { BudgetRecommendation } from "@/lib/budget"
import { checkBudgetArgsSchema } from "@/lib/validators"
import type { CheckBudgetArgs } from "@/lib/validators"
import { siteConfig } from "@/lib/config"
import { formatPrice } from "@/lib/utils"

import {
  computeCartTotals,
  defineAgentTool,
  formatCents,
  productUrl,
  toolSuccess,
  type ProductSummary,
} from "./shared"

const NAME = "check_budget"
const TOP_PICKS = 3

interface AffordableProduct extends ProductSummary {
  remainingBudget: number
  remainingBudgetFormatted: string
  estimatedShipping: number
  estimatedTax: number
  estimatedTotal: number
  estimatedTotalFormatted: string
  qualifiesForFreeShipping: boolean
}

/**
 * Adapts a Budget Intelligence recommendation (Task 17) into the product shape
 * the model receives, quoting landed cost with the storefront's cart totals.
 */
function toAffordableProduct(recommendation: BudgetRecommendation): AffordableProduct {
  const product = recommendation.product
  const price = recommendation.price
  const currency = product.price.currency
  const totals = computeCartTotals(price)

  const summary: ProductSummary = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    url: productUrl(product.slug),
    description: product.description,
    image: product.image?.url ?? null,
    price,
    priceFormatted: formatPrice(price, currency),
    currency,
    rating: product.rating?.value ?? 0,
    reviewCount: product.rating?.reviewCount ?? 0,
    brand: product.brand,
    categories: product.categories,
    tags: product.features,
    inStock: product.availability.inStock,
  }

  if (product.price.compareAt !== null) {
    summary.compareAtPrice = product.price.compareAt
  }

  return {
    ...summary,
    remainingBudget: recommendation.remainingBudget,
    remainingBudgetFormatted: formatCents(recommendation.remainingBudget, currency),
    estimatedShipping: totals.shipping,
    estimatedTax: totals.tax,
    estimatedTotal: totals.total,
    estimatedTotalFormatted: formatCents(totals.total, currency),
    qualifiesForFreeShipping: totals.shipping === 0,
  }
}

/**
 * Find what fits a budget and what it would actually cost.
 *
 * Eligibility and ranking are owned by the Budget Intelligence engine (Task
 * 17); this tool only adapts its output. Landed cost reuses the cart totals
 * logic (siteConfig.freeShippingThreshold / taxRate) so quotes match the
 * storefront. All amounts are handled in cents.
 */
export const checkBudgetTool = defineAgentTool<CheckBudgetArgs>({
  name: NAME,
  description:
    "Find products that fit a shopper's budget and estimate the landed cost (shipping and tax included). Use this for questions about price limits or affordability. The budget is an amount in cents.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      budget: {
        type: Type.INTEGER,
        description:
          "Maximum amount the shopper wants to spend, in cents (for example 5000 means $50.00).",
      },
      category: {
        type: Type.STRING,
        description:
          'Optional category filter, for example "electronics" or "home-kitchen".',
      },
      requirements: {
        type: Type.STRING,
        description:
          'Optional keywords describing what the shopper wants, for example "headphones" or "gift".',
      },
    },
    required: ["budget"],
  },
  schema: checkBudgetArgsSchema,
  async execute(args) {
    const lookup = await getBudgetRecommendations({
      budget: args.budget,
      category: args.category ?? null,
      keywords: args.requirements ? [args.requirements] : undefined,
    })

    if (!lookup.ok) {
      return toolSuccess(NAME, {
        budget: args.budget,
        category: args.category,
        categoryMatched: false,
        eligibleCount: 0,
        eligible: [],
        recommendations: {
          topPicks: [],
          cheapest: null,
          highestRated: null,
          nextStepUp: null,
        },
        note: `No category matches "${args.category}". Retry without a category filter.`,
      })
    }

    const result = lookup.result
    const ranked = result.bestValue ? [result.bestValue, ...result.alternatives] : []
    const eligible = ranked.map(toAffordableProduct)

    const topPicks = eligible.slice(0, TOP_PICKS).map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
      priceFormatted: product.priceFormatted,
      rating: product.rating,
    }))

    const cheapest = eligible.reduce<AffordableProduct | null>(
      (best, product) => (!best || product.price < best.price ? product : best),
      null
    )
    const highestRated = eligible.reduce<AffordableProduct | null>(
      (best, product) => (!best || product.rating > best.rating ? product : best),
      null
    )

    // The cheapest product that is out of reach, so the agent can suggest a
    // small increase instead of just saying "nothing fits".
    const nextStepUp = result.closestOverBudget
      ? {
          id: result.closestOverBudget.productId,
          name: result.closestOverBudget.name,
          price: result.closestOverBudget.price,
          additionalNeeded: result.closestOverBudget.overBy,
        }
      : null

    return toolSuccess(NAME, {
      budget: result.budget.amount,
      budgetFormatted: result.budget.formatted,
      currency: result.budget.currency,
      category: result.requirements.category,
      requirements: args.requirements ?? null,
      thresholds: {
        freeShipping: siteConfig.freeShippingThreshold,
        freeShippingFormatted: formatCents(siteConfig.freeShippingThreshold, siteConfig.currency),
        taxRate: siteConfig.taxRate,
      },
      eligibleCount: eligible.length,
      totalEligible: result.counts.eligible,
      eligible,
      recommendations: {
        topPicks,
        cheapest: cheapest
          ? { id: cheapest.id, name: cheapest.name, price: cheapest.price }
          : null,
        highestRated: highestRated
          ? { id: highestRated.id, name: highestRated.name, rating: highestRated.rating }
          : null,
        nextStepUp,
      },
      note:
        eligible.length === 0
          ? `${result.message} Offer the nextStepUp option or suggest a higher budget.`
          : undefined,
    })
  },
})
