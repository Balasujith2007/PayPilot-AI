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
  const waitTime = trimmed === "__slow__" ? 4000 : 800
  await delay(waitTime, signal)

  // Test Hook: __empty__ returns zero recommendations
  const returnZeroProducts = trimmed === "__empty__"

  let recommendedProducts: RecommendedProduct[] = []

  if (!returnZeroProducts && catalogProducts.length > 0) {
    // Pick up to 3 products from real catalog
    const count = Math.min(3, catalogProducts.length)
    recommendedProducts = catalogProducts.slice(0, count).map((product, index) => {
      const reasons = [
        `Demo reason: Best overall match for your style and budget preferences.`,
        `Demo reason: Highly rated by verified customers with great quality.`,
        `Demo reason: Excellent value with premium materials and fast shipping.`,
      ]
      return {
        productId: product.id,
        reason: reasons[index] || `Demo reason: Great pick based on your search query.`,
      }
    })
  }

  const conversationId = req.conversationId || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  // Multi-paragraph reply with bold text, bullet list, and auto-link for rich display testing
  const reply = `I found some **curated options** in our catalog that match your search!

Here is what makes these recommendations stand out:
- Handcrafted with **verified premium materials**
- Backed by transparent customer reviews and solid warranties
- Ships quickly with hassle-free **30-day returns**

You can learn more about our store policies at https://paypilot-ai.com/policies or let me know if you would like to compare them!`

  return {
    conversationId,
    reply,
    recommendedProducts,
    isMock: true,
  }
}

