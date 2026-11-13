"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { useCartStore } from "@/store/cart"
import { useOrdersStore } from "@/store/orders"
import type {
  ApiResponse,
  PaypalCaptureResponse,
  PaypalClientConfig,
  PaypalOrderResponse,
} from "@/types"

// ---------------------------------------------------------------------------
// PayPal JS SDK (loaded from paypal.com at runtime — no bundled dependency)
// ---------------------------------------------------------------------------

const SDK_SRC = "https://www.paypal.com/sdk/js"

interface PaypalButtonsInstance {
  render(container: HTMLElement): Promise<void>
  close?(): void
}

interface PaypalButtonsOptions {
  style?: Record<string, string | number>
  createOrder: () => Promise<string>
  onApprove: (data: { orderID: string }) => Promise<void>
  onCancel?: () => void
  onError?: (error: unknown) => void
}

interface PaypalSdk {
  Buttons: (options: PaypalButtonsOptions) => PaypalButtonsInstance
}

declare global {
  interface Window {
    paypal?: PaypalSdk
  }
}

let sdkPromise: Promise<PaypalSdk> | null = null

/**
 * Inject the official PayPal JS SDK.
 *
 * The SDK only ever receives the *client id*, which is public. It cannot move
 * money on its own: every order is created and captured by our server through
 * the Orders API, and the shopper's approval in the PayPal window is only
 * turned into a paid order after server-side verification.
 */
function loadPaypalSdk(clientId: string, currency: string): Promise<PaypalSdk> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("PayPal checkout requires a browser."))
  }
  if (window.paypal) return Promise.resolve(window.paypal)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<PaypalSdk>((resolve, reject) => {
    const params = new URLSearchParams({
      "client-id": clientId,
      currency,
      intent: "capture",
      components: "buttons",
    })

    const script = document.createElement("script")
    script.src = `${SDK_SRC}?${params.toString()}`
    script.async = true
    script.onload = () => {
      if (window.paypal) resolve(window.paypal)
      else reject(new Error("The PayPal SDK did not initialise."))
    }
    script.onerror = () => {
      sdkPromise = null
      reject(new Error("The PayPal SDK could not be loaded."))
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}

/** Minimal typed wrapper over our `ApiResponse` envelope. */
async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null

  if (!response.ok || !payload || "error" in payload) {
    const message =
      (payload && "error" in payload ? payload.error?.message : undefined) ??
      `The request failed (${response.status}).`
    throw new Error(message)
  }

  return (payload as { data: T }).data
}

// ---------------------------------------------------------------------------
// Config hook
// ---------------------------------------------------------------------------

/**
 * Read the client-safe PayPal settings from the server.
 *
 * `null` means "still loading" — the caller must not assume PayPal is off until
 * this resolves, otherwise the demo button would flash on a real store.
 */
export function usePaypalConfig(): PaypalClientConfig | null {
  const [config, setConfig] = useState<PaypalClientConfig | null>(null)

  useEffect(() => {
    let cancelled = false

    fetch("/api/paypal/config", { cache: "no-store" })
      .then((response) => response.json() as Promise<ApiResponse<PaypalClientConfig>>)
      .then((payload) => {
        if (cancelled || !payload || "error" in payload) return
        setConfig(payload.data)
      })
      .catch(() => {
        if (cancelled) return
        setConfig({
          enabled: false,
          clientId: null,
          currency: "USD",
          mode: "sandbox",
          reason: "PayPal settings could not be loaded.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return config
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export interface PaypalCustomer {
  customerEmail?: string
  customerName?: string
  userId?: string
  shippingAddress?: {
    firstName: string
    lastName: string
    line1: string
    line2?: string
    city: string
    state: string
    postalCode: string
    country: string
  }
}

interface PaypalCheckoutButtonProps {
  config: PaypalClientConfig
  customer: PaypalCustomer
}

/**
 * The only path from the checkout page to a payment.
 *
 * Nothing here runs on render: an order is created when the shopper clicks the
 * PayPal button, and the cart is cleared only after the server has verified the
 * capture. Cancelling or failing leaves the cart exactly as it was.
 */
export function PaypalCheckoutButton({ config, customer }: PaypalCheckoutButtonProps) {
  const router = useRouter()
  const items = useCartStore((state) => state.items)
  const clearCart = useCartStore((state) => state.clearCart)
  const addOrder = useOrdersStore((state) => state.addOrder)

  const containerRef = useRef<HTMLDivElement>(null)
  const checkoutRef = useRef<string | null>(null)
  const busyRef = useRef(false)

  // The SDK callbacks are created once; these refs keep them reading the
  // latest cart and customer without re-rendering the buttons.
  const itemsRef = useRef(items)
  const customerRef = useRef(customer)

  useEffect(() => {
    itemsRef.current = items
  }, [items])
  useEffect(() => {
    customerRef.current = customer
  }, [customer])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const clientId = config.clientId
    if (!config.enabled || !clientId) return

    let cancelled = false

    loadPaypalSdk(clientId, config.currency)
      .then((sdk) => {
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = ""
        const buttons = sdk.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },

          // Step 1 — ask our server (never the browser) to open the order.
          createOrder: async () => {
            const current = itemsRef.current
            if (current.length === 0) {
              throw new Error("Your cart is empty.")
            }

            try {
              const data = await postJson<PaypalOrderResponse>("/api/paypal/orders", {
                items: current.map((item) => ({
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                })),
                ...customerRef.current,
              })
              checkoutRef.current = data.checkoutRef
              return data.paypalOrderId
            } catch (cause) {
              const message =
                cause instanceof Error ? cause.message : "Checkout could not be started."
              toast.error(message)
              throw cause
            }
          },

          onCancel: () => {
            // The shopper closed the PayPal window: nothing was charged and
            // the cart is untouched.
            toast.message("Payment cancelled", {
              description: "Nothing was charged and your cart is unchanged.",
            })
          },

          onError: (err: unknown) => {
            const safeErrorMessage =
              err instanceof Error
                ? err.message
                : typeof err === "object" && err !== null
                  ? JSON.stringify(err)
                  : String(err ?? "Unknown PayPal SDK error")
            console.error("[PayPal SDK] Checkout error:", safeErrorMessage)
            setError(
              "The PayPal window could not be completed. Nothing was charged — please try again."
            )
          },

          // Step 2 — the shopper approved. Only the server can decide whether
          // that approval is a real, verified payment.
          onApprove: async (data) => {
            if (busyRef.current) return
            busyRef.current = true

            try {
              const reference = checkoutRef.current
              if (!reference) {
                throw new Error("This checkout session is no longer available.")
              }

              const result = await postJson<PaypalCaptureResponse>("/api/paypal/capture", {
                checkoutRef: reference,
                paypalOrderId: data.orderID,
              })

              if (result.status !== "COMPLETED" || !result.order) {
                throw new Error(result.reason ?? "The payment could not be confirmed.")
              }

              // Verified by the server: safe to record and empty the cart.
              addOrder(result.order)
              clearCart()
              toast.success("Payment confirmed")

              // The confirmation page re-reads the order from the server, so a
              // payment is never presented as successful on the client's word.
              router.push(
                `/checkout/success?order_id=${encodeURIComponent(result.order.id)}`
              )
            } catch (cause) {
              const message =
                cause instanceof Error
                  ? cause.message
                  : "The payment could not be confirmed."
              setError(message)
              toast.error(message)
            } finally {
              busyRef.current = false
            }
          },
        })

        void buttons.render(containerRef.current)
      })
      .then(() => {
        if (!cancelled) setLoading(false)
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : "PayPal could not be loaded.")
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [config.enabled, config.clientId, config.currency, router, addOrder, clearCart])

  return (
    <div className="space-y-3">
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading PayPal…
        </div>
      )}

      <div ref={containerRef} data-testid="paypal-buttons" />

      {error && (
        <p
          data-testid="paypal-error"
          className="flex items-start gap-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        {config.mode === "live"
          ? "You will be redirected to PayPal to approve the payment."
          : "Sandbox mode — use a PayPal sandbox buyer account. No real money moves."}
      </p>
    </div>
  )
}
