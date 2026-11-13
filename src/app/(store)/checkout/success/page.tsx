"use client"

import { Suspense, useState, useEffect } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, CheckCircle, Clock } from "lucide-react"
import { useOrdersStore } from "@/store/orders"
import { useHydrated } from "@/hooks/use-hydrated"
import { formatPrice, formatDate } from "@/lib/utils"
import type { ApiResponse, Order, PaypalOrderLookup } from "@/types"

/** Server-issued PayPal checkout references start with this prefix. */
const CHECKOUT_REF_PREFIX = "chk_"

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <CheckoutSuccessContent />
    </Suspense>
  )
}

function CheckoutSuccessContent() {
  const searchParams = useSearchParams()
  const orderId = searchParams.get("order_id")
  const mounted = useHydrated()

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Loading...</h1>
        </div>
      </div>
    )
  }

  // A PayPal checkout is only ever confirmed from the server's record of a
  // verified capture; the client store is never trusted on its own.
  if (orderId?.startsWith(CHECKOUT_REF_PREFIX)) {
    return <PaypalConfirmation checkoutRef={orderId} />
  }

  return <DemoConfirmation orderId={orderId} />
}

// ---------------------------------------------------------------------------
// PayPal confirmation (server-verified)
// ---------------------------------------------------------------------------

type LookupState =
  | { phase: "loading" }
  | { phase: "confirmed"; lookup: PaypalOrderLookup; order: Order }
  | { phase: "pending"; lookup: PaypalOrderLookup }
  | { phase: "error"; message: string }

function PaypalConfirmation({ checkoutRef }: { checkoutRef: string }) {
  const [state, setState] = useState<LookupState>({ phase: "loading" })

  useEffect(() => {
    let cancelled = false

    fetch(`/api/paypal/orders?ref=${encodeURIComponent(checkoutRef)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ApiResponse<PaypalOrderLookup> | null

        if (!response.ok || !payload || "error" in payload) {
          const message =
            (payload && "error" in payload ? payload.error?.message : undefined) ??
            "We could not confirm this payment."
          throw new Error(message)
        }

        return payload.data
      })
      .then((lookup) => {
        if (cancelled) return
        if (lookup.status === "COMPLETED" && lookup.order) {
          setState({ phase: "confirmed", lookup, order: lookup.order })
        } else {
          setState({ phase: "pending", lookup })
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setState({
          phase: "error",
          message:
            cause instanceof Error ? cause.message : "We could not confirm this payment.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [checkoutRef])

  if (state.phase === "loading") {
    return (
      <Shell icon={<Clock className="h-16 w-16 text-muted-foreground" />} title="Confirming your payment…">
        <p className="mt-4 text-muted-foreground">
          Please wait while we verify the payment with PayPal.
        </p>
      </Shell>
    )
  }

  if (state.phase === "error") {
    return (
      <Shell icon={<AlertTriangle className="h-16 w-16 text-destructive" />} title="Payment not confirmed">
        <p className="mt-4 text-muted-foreground">{state.message}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing has been charged. If you were charged, please contact support with
          your checkout reference.
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild>
            <Link href="/checkout">Back to checkout</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  if (state.phase === "pending") {
    return (
      <Shell icon={<Clock className="h-16 w-16 text-muted-foreground" />} title="Payment not completed">
        <p className="mt-4 text-muted-foreground">
          We could not confirm a completed payment for this checkout
          {state.lookup.status === "PENDING" ? " yet" : ""}. Nothing has been charged.
        </p>
        <div className="mt-8 flex gap-4">
          <Button asChild>
            <Link href="/checkout">Back to checkout</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/shop">Continue Shopping</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  const { order, lookup } = state

  return (
    <Shell
      icon={<CheckCircle className="h-16 w-16 text-success" />}
      title="Thank you for your order!"
      description="Your payment was verified with PayPal and your order is confirmed."
    >
      <Card className="mt-8 w-full text-left">
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Order reference</span>
            <span className="font-medium">{order.orderNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment status</span>
            <Badge variant="secondary">Captured</Badge>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment method</span>
            <span>PayPal</span>
          </div>
          <div className="flex justify-between gap-4 text-sm">
            <span className="text-muted-foreground">PayPal capture reference</span>
            <span className="break-all text-right font-mono text-xs">
              {lookup.captureId ?? "—"}
            </span>
          </div>

          <Separator />

          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                {item.name}
                {item.variantName ? ` — ${item.variantName}` : ""} &times; {item.quantity}
              </span>
              <span>{formatPrice(item.total)}</span>
            </div>
          ))}

          <Separator />

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatPrice(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Shipping</span>
            <span>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tax</span>
            <span>{formatPrice(order.tax)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-medium">
            <span>Total paid</span>
            <span>
              {formatPrice(order.total)} {order.currency}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8 flex gap-4">
        <Button asChild>
          <Link href="/account/orders">View Orders</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/shop">Continue Shopping</Link>
        </Button>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------
// Order confirmation (Direct DB / UPI / Card / Net Banking / COD)
// ---------------------------------------------------------------------------

function DemoConfirmation({ orderId }: { orderId: string | null }) {
  const getOrderById = useOrdersStore((s) => s.getOrderById)
  const storeOrder = orderId ? getOrderById(orderId) : undefined
  const [dbOrder, setDbOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(Boolean(!storeOrder && orderId))

  useEffect(() => {
    if (!storeOrder && orderId) {
      let ignore = false
      fetch(`/api/admin/orders/${orderId}`)
        .then((res) => res.json())
        .then((data) => {
          if (ignore) return
          if (data.success && data.order) {
            setDbOrder({
              id: data.order.id,
              orderNumber: data.order.orderNumber,
              userId: data.order.userId,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              items: (data.order.items || []).map((it: any) => ({
                id: it.id,
                productId: it.productId,
                variantId: it.variantId,
                name: it.name,
                variantName: it.variantName,
                sku: it.sku,
                image: it.image,
                price: it.price,
                quantity: it.quantity,
                total: it.total,
              })),
              status: data.order.status.toLowerCase(),
              paymentStatus: data.order.paymentStatus.toLowerCase(),
              paymentMethod: (data.order.paymentMethod === "CARD"
                ? "card"
                : data.order.paymentMethod === "BANK_TRANSFER"
                ? "bank_transfer"
                : data.order.paymentMethod === "OTHER"
                ? "other"
                : "wallet") as Order["paymentMethod"],
              subtotal: data.order.subtotal,
              tax: data.order.tax,
              shipping: data.order.shipping,
              total: data.order.total,
              currency: data.order.currency,
              shippingAddress: data.order.shippingAddress,
              customerEmail: data.order.customerEmail,
              customerName: data.order.customerName,
              createdAt: data.order.createdAt,
              updatedAt: data.order.updatedAt,
            })
          }
        })
        .catch(console.error)
        .finally(() => {
          if (!ignore) setLoading(false)
        })
      return () => {
        ignore = true
      }
    }
  }, [storeOrder, orderId])

  const order = storeOrder || dbOrder

  const isPaid = order?.paymentStatus === "captured"
  const isCod = order?.paymentStatus === "pending" || order?.paymentMethod === "other"

  return (
    <Shell
      icon={<CheckCircle className="h-16 w-16 text-emerald-600" />}
      title="Thank you for your order!"
      description={
        isCod
          ? "Your Cash on Delivery order is confirmed and queued for fulfillment."
          : isPaid
          ? "Payment confirmed! Your order has been placed and is being packed."
          : "Your order has been recorded successfully."
      }
    >
      {loading && !order && (
        <p className="mt-4 text-sm text-muted-foreground">Loading order details...</p>
      )}

      {order && (
        <Card className="mt-8 w-full text-left rounded-[20px] shadow-sm border-black/10">
          <CardContent className="pt-6 space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Order number</span>
              <span className="font-semibold text-black">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Date</span>
              <span>{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment method</span>
              <span className="font-medium uppercase">{order.paymentMethod || "UPI"}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Payment status</span>
              <Badge
                className={
                  isPaid
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300 font-semibold"
                    : "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                }
              >
                {order.paymentStatus.toUpperCase()}
              </Badge>
            </div>
            <Separator />
            {order.items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.name} &times; {item.quantity}
                </span>
                <span className="font-medium text-black tabular-nums">{formatPrice(item.total)}</span>
              </div>
            ))}
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping (India Delivery)</span>
              <span>{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">GST Tax</span>
              <span>{formatPrice(order.tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base text-black">
              <span>Total Paid</span>
              <span>{formatPrice(order.total)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="mt-8 flex gap-4">
        <Button asChild className="rounded-full">
          <Link href="/account/orders">View My Orders</Link>
        </Button>
        <Button variant="outline" asChild className="rounded-full">
          <Link href="/shop">Continue Shopping</Link>
        </Button>
      </div>
    </Shell>
  )
}

// ---------------------------------------------------------------------------

interface ShellProps {
  icon: React.ReactNode
  title: string
  description?: string
  children?: React.ReactNode
}

function Shell({ icon, title, description, children }: ShellProps) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center">
        {icon}
        <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-4 text-muted-foreground">{description}</p>}
        {children}
      </div>
    </div>
  )
}
