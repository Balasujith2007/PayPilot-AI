"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowRight, Package, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { PageHeader } from "@/components/ui/page-header"
import { ProductImage } from "@/components/ui/product-image"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { formatDate, formatPrice } from "@/lib/utils"
import { useOrdersStore } from "@/store/orders"
import type { ApiResponse, Order, PaginatedResult } from "@/types"

export default function OrdersPage() {
  const { user, isReady } = useAuthGuard()
  const localOrders = useOrdersStore((s) => s.orders)

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/orders", {
        headers: {
          "x-user-id": user.id,
          "x-user-email": user.email,
        },
        cache: "no-store",
      })

      const payload = (await response.json().catch(() => null)) as ApiResponse<
        PaginatedResult<Order>
      > | null

      if (!response.ok || !payload || "error" in payload) {
        throw new Error(
          (payload && "error" in payload ? payload.error?.message : undefined) ??
            "Failed to load your orders."
        )
      }

      const serverOrders = payload.data.items ?? []

      // Merge server orders with local demo orders that match this customer
      const matchingLocal = localOrders.filter(
        (lo) =>
          lo.customerEmail === user.email || (lo.userId && lo.userId === user.id)
      )

      const mergedMap = new Map<string, Order>()
      for (const order of serverOrders) {
        mergedMap.set(order.id, order)
      }
      for (const order of matchingLocal) {
        if (!mergedMap.has(order.id)) {
          mergedMap.set(order.id, order)
        }
      }

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      )

      setOrders(combined)
    } catch (err) {
      console.error("Failed to load orders:", err)
      setError(err instanceof Error ? err.message : "Failed to load order history.")
    } finally {
      setLoading(false)
    }
  }, [user, localOrders])

  useEffect(() => {
    if (isReady && user) {
      void fetchOrders()
    }
  }, [isReady, user, fetchOrders])

  if (!isReady) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
        <PageHeader title="Order History" description="Loading your orders..." />
        <div className="mt-8 space-y-4">
          <OrderSkeleton />
          <OrderSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <PageHeader
        title="Order History"
        description={
          orders.length > 0
            ? `${orders.length} ${orders.length === 1 ? "order" : "orders"} placed`
            : "Review and track your past purchases."
        }
      />

      {loading && (
        <div className="mt-8 space-y-4" data-testid="orders-loading">
          <OrderSkeleton />
          <OrderSkeleton />
          <OrderSkeleton />
        </div>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="mt-8 rounded-lg border border-destructive/20 bg-destructive/5 p-6 text-center"
          data-testid="orders-error"
        >
          <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
          <h2 className="mt-2 text-sm font-semibold text-destructive">
            Could not load order history
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchOrders()}
            className="mt-4 gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="mt-8" data-testid="orders-empty">
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="When you complete a purchase, your order and payment details will appear here."
            actionLabel="Start Shopping"
            actionHref="/shop"
          />
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="mt-8 space-y-4" data-testid="orders-list">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden">
              <CardHeader className="bg-neutral-50/60 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tracking-tight text-foreground">
                      {order.orderNumber}
                    </span>
                    <OrderStatusBadge status={order.status} />
                    <PaymentStatusBadge status={order.paymentStatus} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Placed on {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-base font-semibold text-foreground">
                    {formatPrice(order.total, order.currency)}
                  </span>
                  {order.paymentMethod && (
                    <p className="text-[11px] capitalize text-muted-foreground">
                      Via {order.paymentMethod}
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4">
                <ul className="divide-y divide-border/60">
                  {order.items.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border bg-neutral-100">
                        <ProductImage
                          src={item.image?.url}
                          alt={item.name}
                          sizes="56px"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.variantName ? `${item.variantName} · ` : ""}
                          Qty: {item.quantity} ·{" "}
                          {formatPrice(item.price, order.currency)} each
                        </p>
                      </div>
                      <span className="text-sm font-medium text-foreground">
                        {formatPrice(item.total, order.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="flex items-center justify-between border-t bg-neutral-50/30 py-3">
                <span className="text-xs text-muted-foreground">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                  {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1
                    ? "item"
                    : "items"}
                </span>
                <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs">
                  <Link href={`/account/orders/${encodeURIComponent(order.id)}`}>
                    View Order Details
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
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
      Pending Payment
    </Badge>
  )
}

function OrderSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-neutral-50/60 pb-3 pt-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
        <Skeleton className="h-5 w-20" />
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between border-t py-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-28" />
      </CardFooter>
    </Card>
  )
}
