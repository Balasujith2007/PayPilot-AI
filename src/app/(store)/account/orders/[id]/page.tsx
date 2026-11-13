"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  CreditCard,
  MapPin,
  Package,
  RefreshCw,
  ShieldCheck,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { ProductImage } from "@/components/ui/product-image"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { formatDate, formatPrice } from "@/lib/utils"
import { useOrdersStore } from "@/store/orders"
import type { ApiResponse, Order } from "@/types"

export default function OrderDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { user, isReady } = useAuthGuard()
  const localGetOrder = useOrdersStore((s) => s.getOrderById)

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // loadOrder is kept as a ref-stable callback for the retry button
  const loadOrder = useCallback(async () => {
    if (!user || !id) return
    setError(null)

    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        headers: {
          "x-user-id": user.id,
          "x-user-email": user.email,
        },
        cache: "no-store",
      })

      const payload = (await response.json().catch(() => null)) as
        | ApiResponse<Order>
        | null

      if (response.ok && payload && "data" in payload && payload.data) {
        setOrder(payload.data)
        return
      }

      // Fallback to local store if server doesn't have it (e.g. demo checkout)
      const local = localGetOrder(id)
      if (
        local &&
        (local.customerEmail === user.email || (local.userId && local.userId === user.id))
      ) {
        setOrder(local)
        return
      }

      const errorMsg =
        (payload && "error" in payload ? payload.error?.message : undefined) ??
        "Order could not be found."
      throw new Error(errorMsg)
    } catch (err) {
      console.error("Failed to load order details:", err)
      setError(err instanceof Error ? err.message : "Failed to load order details.")
    } finally {
      setLoading(false)
    }
  }, [id, user, localGetOrder])

  useEffect(() => {
    if (isReady && user) {
      loadOrder().catch(() => {})
    }
  }, [isReady, user, loadOrder])

  if (!isReady || loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Skeleton className="h-5 w-36" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8" data-testid="order-details-error">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Order History
        </Link>
        <div className="mt-8 rounded-lg border border-destructive/20 bg-destructive/5 p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-4 text-base font-semibold text-destructive">
            Order Not Available
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {error ?? "We could not find the requested order."}
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true)
                void loadOrder()
              }}
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Try again
            </Button>
            <Button size="sm" asChild>
              <Link href="/account/orders">View All Orders</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8" data-testid="order-details">
      <div className="mb-6">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Order History
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Order {order.orderNumber}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed on {formatDate(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={order.status} />
          <PaymentStatusBadge status={order.paymentStatus} />
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Items & Pricing Breakdown (2 cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Purchased Items Card */}
          <Card>
            <CardHeader className="border-b bg-neutral-50/50 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Package className="h-4 w-4" />
                Purchased Items ({order.items.reduce((s, i) => s + i.quantity, 0)})
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ul className="divide-y divide-border/60">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border bg-neutral-100">
                      <ProductImage
                        src={item.image?.url}
                        alt={item.name}
                        sizes="64px"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium leading-snug text-foreground">
                        {item.name}
                      </p>
                      {item.variantName && (
                        <p className="text-xs text-muted-foreground">
                          Option: {item.variantName}
                        </p>
                      )}
                      {item.sku && (
                        <p className="font-mono text-[11px] text-muted-foreground">
                          SKU: {item.sku}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} · {formatPrice(item.price, order.currency)} each
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(item.total, order.currency)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Price Breakdown Card */}
          <Card>
            <CardHeader className="border-b bg-neutral-50/50 pb-3 pt-4">
              <CardTitle className="text-base font-semibold">Price Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatPrice(order.subtotal, order.currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Shipping</span>
                <span>
                  {order.shipping === 0
                    ? "Free"
                    : formatPrice(order.shipping, order.currency)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Tax</span>
                <span>{formatPrice(order.tax, order.currency)}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total Paid</span>
                <span>
                  {formatPrice(order.total, order.currency)} {order.currency}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Payment & Shipping Info (1 col) */}
        <div className="space-y-6">
          {/* Payment Details Card */}
          <Card>
            <CardHeader className="border-b bg-neutral-50/50 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <CreditCard className="h-4 w-4" />
                Payment Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Payment Method</p>
                <p className="font-medium capitalize text-foreground">
                  {order.paymentMethod === "paypal" ? "PayPal Express Checkout" : order.paymentMethod ?? "Standard"}
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground">Payment Status</p>
                <div className="mt-1">
                  <PaymentStatusBadge status={order.paymentStatus} />
                </div>
              </div>

              {order.paymentReference && (
                <div>
                  <p className="text-xs text-muted-foreground">PayPal Capture ID</p>
                  <p className="mt-0.5 break-all font-mono text-xs text-foreground">
                    {order.paymentReference}
                  </p>
                </div>
              )}

              {order.paypalOrderId && (
                <div>
                  <p className="text-xs text-muted-foreground">PayPal Order ID</p>
                  <p className="mt-0.5 break-all font-mono text-xs text-foreground">
                    {order.paypalOrderId}
                  </p>
                </div>
              )}

              {order.completedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Confirmed At</p>
                  <p className="text-xs text-foreground">
                    {formatDate(order.completedAt)}
                  </p>
                </div>
              )}

              <div className="rounded-md bg-neutral-50 p-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="mb-1 inline-block h-4 w-4 text-foreground" />
                <p>
                  Payment was verified directly by the server against PayPal. Client-side amounts
                  are never accepted.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Shipping Address Card */}
          <Card>
            <CardHeader className="border-b bg-neutral-50/50 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="h-4 w-4" />
                Shipping Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pt-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Customer</p>
                <p className="font-medium text-foreground">{order.customerName || "Customer"}</p>
                {order.customerEmail && (
                  <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                )}
              </div>

              {order.shippingAddress && (
                <div>
                  <p className="text-xs text-muted-foreground">Delivery Address</p>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">
                      {order.shippingAddress.firstName} {order.shippingAddress.lastName}
                    </p>
                    <p>{order.shippingAddress.line1}</p>
                    {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                    <p>
                      {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
                      {order.shippingAddress.postalCode}
                    </p>
                    <p>{order.shippingAddress.country}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function PaymentStatusBadge({ status }: { status: Order["paymentStatus"] }) {
  if (status === "captured") {
    return (
      <Badge
        variant="secondary"
        className="border-emerald-200 bg-emerald-50 text-[11px] font-medium text-emerald-800"
      >
        <CheckCircle className="mr-1 h-3 w-3 inline" />
        Captured
      </Badge>
    )
  }
  if (status === "authorized") {
    return (
      <Badge
        variant="secondary"
        className="border-amber-200 bg-amber-50 text-[11px] font-medium text-amber-800"
      >
        Authorized
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge
        variant="secondary"
        className="border-destructive/20 bg-destructive/10 text-[11px] font-medium text-destructive"
      >
        Failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-[11px] font-normal text-muted-foreground">
      Pending
    </Badge>
  )
}

