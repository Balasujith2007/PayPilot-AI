// UI stub. Backend dev replaces the body with a real fetch; keep the signature.

import type {
  AssistantRequest,
  AssistantResponse,
  CatalogProduct,
  RecommendedProduct,
} from "@/types/ai-assistant"

export class AssistantError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = "AssistantError"
    this.code = code
  }
}

export interface SendMessageOptions {
  signal?: AbortSignal
  catalogProducts?: CatalogProduct[]
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }

    const timer = setTimeout(() => {
      resolve()
    }, ms)

    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        reject(new DOMException("Aborted", "AbortError"))
      },
      { once: true }
    )
  })
}

export async function sendMessage(
  req: AssistantRequest,
  options: SendMessageOptions = {}
): Promise<AssistantResponse> {
  const { signal, catalogProducts = [] } = options
  const trimmed = req.message.trim().toLowerCase()

  // Test Hook: __error__ throws AssistantError
  if (trimmed === "__error__") {
    await delay(300, signal)
    throw new AssistantError("Simulated assistant error for testing", "SIMULATED_ERROR")
  }

  // Test Hook: __slow__ delays ~4 seconds
  const waitTime = trimmed === "__slow__" ? 4000 : 600
  await delay(waitTime, signal)

  // Test Hook: __empty__ returns zero recommendations
  const returnZeroProducts = trimmed === "__empty__"

  let recommendedProducts: RecommendedProduct[] = []
  let reply = ""

  if (!returnZeroProducts && catalogProducts.length > 0) {
    // Dynamic matching engine: extract terms, price, and category cues
    const searchTerms = trimmed
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !["the", "and", "for", "with", "show", "what", "find", "some", "best", "need"].includes(w))

    // Parse potential budget limit: e.g. "under 1000", "< 2000", "below 500"
    const budgetMatch = trimmed.match(/(?:under|below|less than|max|budget of)\s*(?:₹|\$)?\s*(\d+)/i)
    const maxBudget = budgetMatch ? parseInt(budgetMatch[1], 10) * 100 : null

    // Score catalog products dynamically
    const scoredProducts = catalogProducts.map((product) => {
      let score = 0
      const matchedReasons: string[] = []
      const minPrice = Math.min(...product.variants.map((v) => v.price))

      // Check budget
      if (maxBudget !== null) {
        if (minPrice <= maxBudget) {
          score += 15
          matchedReasons.push(`Fits within your budget at ${(minPrice / 100).toLocaleString()}`)
        } else {
          score -= 20
        }
      }

      const prodName = product.name.toLowerCase()
      const brand = (product.brandName || "").toLowerCase()
      const categories = product.categoryNames.map((c) => c.toLowerCase())
      const tags = product.tags.map((t) => t.toLowerCase())

      for (const term of searchTerms) {
        if (prodName.includes(term)) {
          score += 10
          matchedReasons.push(`Matches "${term}" in product name`)
        }
        if (tags.some((t) => t.includes(term))) {
          score += 6
          matchedReasons.push(`Tagged with #${term}`)
        }
        if (categories.some((c) => c.includes(term))) {
          score += 5
          matchedReasons.push(`In category "${categories.join(", ")}"`)
        }
        if (brand.includes(term)) {
          score += 4
          matchedReasons.push(`From brand ${product.brandName}`)
        }
      }

      // Bonus for customer ratings
      if (product.rating >= 4.5) {
        score += 2
        matchedReasons.push(`Top-rated (${product.rating}★ with ${product.reviewCount} reviews)`)
      }

      return { product, score, reasons: matchedReasons }
    })

    // Sort by score descending
    scoredProducts.sort((a, b) => b.score - a.score)

    // Select top matching products (up to 3)
    const topMatches = (searchTerms.length > 0 || maxBudget !== null)
      ? scoredProducts.filter((p) => p.score > 0).slice(0, 3)
      : scoredProducts.slice(0, 3)

    if (topMatches.length > 0) {
      recommendedProducts = topMatches.map(({ product, reasons }) => {
        const topReason = reasons.length > 0
          ? reasons.slice(0, 2).join(". ") + "."
          : `Popular choice with ${product.rating}★ rating from verified shoppers.`

        return {
          productId: product.id,
          reason: topReason,
        }
      })

      const productNames = topMatches.map((m) => `**${m.product.name}**`).join(", ")
      reply = `Based on your request, I found these top recommendations: ${productNames}.

Here is why these fit your needs:
${topMatches.map((m) => `- **${m.product.name}**: ${m.reasons[0] || `Rated ${m.product.rating}★ by shoppers`}`).join("\n")}

You can click any item below to inspect details or tap **Compare** to analyze them side-by-side!`
    } else {
      reply = `I searched our catalog for "${req.message}", but couldn't find an exact match.

Here are some popular categories you might like:
- **Casual & Formal Wear**
- **Trending New Arrivals**
- **Top Customer Favorites**

Feel free to refine your search or ask for products in a specific price range!`
    }
  } else {
    reply = "I am ready to help you find anything in our store! Tell me what style, item, or budget you are looking for."
  }

  const conversationId = req.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  return {
    conversationId,
    reply,
    recommendedProducts,
    isMock: false,
  }
}

