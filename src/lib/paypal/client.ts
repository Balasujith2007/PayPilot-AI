import { z } from "zod"

import { siteConfig } from "@/lib/config"
import type { PaypalConfig } from "./config"

/**
 * Error raised for anything the PayPal API itself refuses.
 *
 * `code` carries PayPal's own error name (e.g. `ORDER_ALREADY_CAPTURED`) so
 * callers can branch on it without parsing messages. `status` is 0 for
 * transport-level failures (network down, timeout) that never reached PayPal.
 */
export class PaypalApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = "PaypalApiError"
    this.status = status
    this.code = code
  }
}

// --- Response contracts -----------------------------------------------------
//
// Only the fields the checkout depends on are declared. Everything here is an
// external, untrusted response, so it is parsed rather than cast.

const amountSchema = z.object({
  currency_code: z.string(),
  value: z.string(),
})

const captureSchema = z.object({
  id: z.string(),
  status: z.string(),
  amount: amountSchema.optional(),
})

const purchaseUnitSchema = z.object({
  reference_id: z.string().optional(),
  amount: amountSchema.optional(),
  payments: z
    .object({ captures: z.array(captureSchema).optional() })
    .optional(),
})

const linkSchema = z.object({
  href: z.string(),
  rel: z.string(),
  method: z.string().optional(),
})

const orderSchema = z.object({
  id: z.string(),
  status: z.string(),
  purchase_units: z.array(purchaseUnitSchema).optional(),
  links: z.array(linkSchema).optional(),
})

const tokenSchema = z.object({
  access_token: z.string(),
  expires_in: z.number().optional(),
})

export type PaypalOrder = z.infer<typeof orderSchema>
export type PaypalCapture = z.infer<typeof captureSchema>

/** A purchase unit as sent to PayPal. */
export interface PaypalPurchaseUnitInput {
  referenceId: string
  currency: string
  /** Decimal string, e.g. "123.45". */
  value: string
  breakdown: {
    itemTotal: string
    shipping: string
    taxTotal: string
  }
  items: Array<{
    name: string
    sku: string
    quantity: string
    unitAmount: string
    currency: string
  }>
}

/** Providers are injected so tests can drive the client without the network. */
export interface PaypalClientDeps {
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

export const PAYPAL_REQUEST_TIMEOUT_MS = 15_000

interface TokenCacheEntry {
  token: string
  expiresAt: number
}

/** Keyed by `baseUrl|clientId`, so switching apps never reuses a token. */
const tokenCache = new Map<string, TokenCacheEntry>()

/** Test-only: drop cached OAuth tokens. */
export function resetPaypalTokenCache(): void {
  tokenCache.clear()
}

function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2)
}

/** Convert a stored, server-calculated cents amount into PayPal's format. */
export { centsToDecimalString }

async function readError(response: Response): Promise<{ code: string; message: string }> {
  try {
    const body: unknown = await response.json()
    const parsed = z
      .object({
        name: z.string().optional(),
        error: z.string().optional(),
        error_description: z.string().optional(),
        message: z.string().optional(),
      })
      .safeParse(body)
    if (parsed.success) {
      const code = parsed.data.name ?? parsed.data.error ?? `HTTP_${response.status}`
      const message =
        parsed.data.message ??
        parsed.data.error_description ??
        `PayPal rejected the request (${response.status}).`
      return { code, message }
    }
  } catch {
    // Fall through to the generic message below.
  }
  return { code: `HTTP_${response.status}`, message: `PayPal rejected the request (${response.status}).` }
}

export interface PaypalClient {
  getAccessToken(): Promise<string>
  createOrder(purchaseUnit: PaypalPurchaseUnitInput): Promise<PaypalOrder>
  captureOrder(orderId: string): Promise<PaypalOrder>
  getOrder(orderId: string): Promise<PaypalOrder>
}

/**
 * Request options for our own calls only.
 *
 * Narrowing `headers` to a plain record keeps every outgoing header a string,
 * so the OAuth secret can never leak through a structured `Headers` object.
 */
type PaypalRequestInit = Omit<RequestInit, "headers"> & {
  headers?: Record<string, string>
}

/**
 * Build a client bound to one set of credentials.
 *
 * The client secret is used only to mint the OAuth token and is never put on
 * an outgoing payload or returned to a caller.
 */
export function createPaypalClient(
  config: PaypalConfig,
  deps: PaypalClientDeps = {}
): PaypalClient {
  const fetchImpl = deps.fetchImpl ?? fetch
  const timeoutMs = deps.timeoutMs ?? PAYPAL_REQUEST_TIMEOUT_MS
  const cacheKey = `${config.baseUrl}|${config.clientId}`

  async function request(
    path: string,
    init: PaypalRequestInit
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      })
    } catch (error) {
      const aborted = error instanceof Error && error.name === "TimeoutError"
      throw new PaypalApiError(
        aborted
          ? "The payment provider did not respond in time."
          : "The payment provider could not be reached.",
        0,
        aborted ? "TIMEOUT" : "NETWORK_ERROR"
      )
    }

    if (!response.ok) {
      const { code, message } = await readError(response)
      throw new PaypalApiError(message, response.status, code)
    }

    if (response.status === 204) return {}
    try {
      return await response.json()
    } catch {
      throw new PaypalApiError(
        "The payment provider returned an unreadable response.",
        response.status,
        "INVALID_RESPONSE"
      )
    }
  }

  async function getAccessToken(): Promise<string> {
    const cached = tokenCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) return cached.token

    const credentials = Buffer.from(
      `${config.clientId}:${config.clientSecret}`
    ).toString("base64")

    const body = await request("/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    })

    const parsed = tokenSchema.safeParse(body)
    if (!parsed.success) {
      throw new PaypalApiError(
        "The payment provider returned an unusable token.",
        0,
        "INVALID_TOKEN"
      )
    }

    // Refresh a minute early so an in-flight capture never races expiry.
    const ttlMs = (parsed.data.expires_in ?? 3200) * 1000 - 60_000
    tokenCache.set(cacheKey, {
      token: parsed.data.access_token,
      expiresAt: Date.now() + Math.max(ttlMs, 30_000),
    })
    return parsed.data.access_token
  }

  async function authorized(
    path: string,
    init: PaypalRequestInit
  ): Promise<PaypalOrder> {
    const token = await getAccessToken()
    const body = await request(path, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    })
    const parsed = orderSchema.safeParse(body)
    if (!parsed.success) {
      throw new PaypalApiError(
        "The payment provider returned an unexpected order shape.",
        0,
        "INVALID_RESPONSE"
      )
    }
    return parsed.data
  }

  return {
    getAccessToken,

    async createOrder(purchaseUnit) {
      const appUrl = (siteConfig.url || "http://localhost:3000").replace(/\/+$/, "")
      const order = await authorized("/v2/checkout/orders", {
        method: "POST",
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: purchaseUnit.referenceId,
              amount: {
                currency_code: purchaseUnit.currency,
                value: purchaseUnit.value,
                breakdown: {
                  item_total: {
                    currency_code: purchaseUnit.currency,
                    value: purchaseUnit.breakdown.itemTotal,
                  },
                  shipping: {
                    currency_code: purchaseUnit.currency,
                    value: purchaseUnit.breakdown.shipping,
                  },
                  tax_total: {
                    currency_code: purchaseUnit.currency,
                    value: purchaseUnit.breakdown.taxTotal,
                  },
                },
              },
              items: purchaseUnit.items.map((item) => ({
                name: item.name,
                sku: item.sku,
                quantity: item.quantity,
                unit_amount: {
                  currency_code: item.currency,
                  value: item.unitAmount,
                },
              })),
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                brand_name: "PayPilot Store",
                locale: "en-US",
                landing_page: "LOGIN",
                shipping_preference: "GET_FROM_FILE",
                user_action: "PAY_NOW",
                return_url: `${appUrl}/checkout/success`,
                cancel_url: `${appUrl}/checkout`,
              },
            },
          },
        }),
      })

      // When payment_source is specified, PayPal Orders v2 sets status to
      // PAYER_ACTION_REQUIRED to signify the order is successfully created and
      // awaiting buyer approval. Normalise this to CREATED for caller consistency.
      if (order.status === "PAYER_ACTION_REQUIRED") {
        return { ...order, status: "CREATED" }
      }
      return order
    },

    async captureOrder(orderId) {
      // A deterministic PayPal-Request-Id makes PayPal itself idempotent: a
      // retried capture of the same order returns the original response rather
      // than capturing twice.
      return authorized(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
        method: "POST",
        headers: { "PayPal-Request-Id": `capture-${orderId}` },
        body: JSON.stringify({}),
      })
    },

    async getOrder(orderId) {
      return authorized(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
        method: "GET",
      })
    },
  }
}
