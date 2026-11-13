"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Clock,
  MapPin,
  Package,
  RefreshCw,
  User as UserIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { formatDate, formatPrice } from "@/lib/utils"
import { useOrdersStore } from "@/store/orders"
import type { ApiResponse, Order, PaginatedResult } from "@/types"

export default function OrdersPage() {
  const { user, isReady } = useAuthGuard()
  const [filter, setFilter] = useState<"all" | "my">("all")

  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    const storeOrders = useOrdersStore.getState().orders || []
    if (!user) {
      setOrders(storeOrders)
      return
    }
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

      const serverOrders =
        response.ok && payload && "data" in payload && payload.data?.items
          ? payload.data.items
          : []

      // Merge server orders with local demo orders
      const mergedMap = new Map<string, Order>()
      for (const order of serverOrders) {
        mergedMap.set(order.id, order)
      }
      for (const order of storeOrders) {
        if (!mergedMap.has(order.id)) {
          mergedMap.set(order.id, order)
        }
      }

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      )

      setOrders(combined)
    } catch (err) {
      console.error("Failed to load server orders:", err)
      // Fallback to local orders
      const combined = [...storeOrders].sort(
        (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0)
      )
      setOrders(combined)
      if (storeOrders.length === 0) {
        setError(err instanceof Error ? err.message : "Failed to load order history.")
      }
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (isReady) {
      fetchOrders().catch(() => {})
    }
  }, [isReady, fetchOrders])

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

  // Filter orders
  const myOrders = user
    ? orders.filter(
        (o) =>
          (o.userId && o.userId === user.id) ||
          (o.customerEmail &&
            user.email &&
            o.customerEmail.trim().toLowerCase() === user.email.trim().toLowerCase())
      )
    : orders

  const displayedOrders = filter === "my" ? myOrders : orders

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Order History"
          description={
            displayedOrders.length > 0
              ? `${displayedOrders.length} ${
                  displayedOrders.length === 1 ? "order" : "orders"
                } placed`
              : "Review and track your past purchases."
          }
        />

        {/* Filter Tabs */}
        {orders.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-[#F0EEED] p-1 self-start sm:self-center">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                filter === "all"
                  ? "bg-black text-white shadow-xs"
                  : "text-black/60 hover:text-black"
              }`}
            >
              All Orders ({orders.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("my")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                filter === "my"
                  ? "bg-black text-white shadow-xs"
                  : "text-black/60 hover:text-black"
              }`}
            >
              My Account ({myOrders.length})
            </button>
          </div>
        )}
      </div>

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

      {!loading && !error && displayedOrders.length === 0 && (
        <div className="mt-8" data-testid="orders-empty">
          <EmptyState
            icon={Package}
            title="No orders found"
            description={
              filter === "my" && orders.length > 0
                ? "You haven't placed an order with this account email yet, but other orders exist."
                : "When you complete a purchase, your order and payment details will appear here."
            }
            actionLabel={
              filter === "my" && orders.length > 0
                ? "View All Orders"
                : "Start Shopping"
            }
            actionHref={filter === "my" && orders.length > 0 ? undefined : "/shop"}
            onAction={
              filter === "my" && orders.length > 0 ? () => setFilter("all") : undefined
            }
          />
        </div>
      )}

      {!loading && !error && displayedOrders.length > 0 && (
        <div className="mt-8 space-y-6" data-testid="orders-list">
          {displayedOrders.map((order) => {
            const isMyOrder =
              user &&
              ((order.userId && order.userId === user.id) ||
                (order.customerEmail &&
                  order.customerEmail.trim().toLowerCase() ===
                    user.email.trim().toLowerCase()))

            return (
              <Card
                key={order.id}
                className="overflow-hidden rounded-[20px] border border-black/10 shadow-xs"
              >
                {/* Header bar of order card */}
                <div className="border-b border-black/5 bg-[#F0EEED]/40 px-5 py-4 sm:px-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-black">
                          {order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status} />
                        <PaymentStatusBadge status={order.paymentStatus} />
                        {isMyOrder ? (
                          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Your Order
                          </span>
                        ) : (
                          <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium text-black/70">
                            Customer Order
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-black/60">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(order.createdAt)}
                        </span>
                        <span>&bull;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {new Date(order.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <span className="font-bold text-base sm:text-lg text-black tabular-nums">
                        {formatPrice(order.total, order.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Customer info pill */}
                  <div className="mt-2.5 pt-2.5 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-xs text-black/70">
                    <div className="flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-black/50" />
                      <span>
                        <strong className="font-semibold text-black">
                          {order.customerName || "Customer"}
                        </strong>{" "}
                        ({order.customerEmail})
                      </span>
                    </div>
                    {order.shippingAddress && (
                      <div className="flex items-center gap-1.5 text-black/60 truncate">
                        <MapPin className="h-3.5 w-3.5 text-black/50 shrink-0" />
                        <span className="truncate">
                          {order.shippingAddress.city}, {order.shippingAddress.state}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items in order */}
                <CardContent className="p-5 sm:p-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-black/50">
                    Items ({order.items.reduce((acc, i) => acc + i.quantity, 0)})
                  </p>
                  <div className="divide-y divide-black/5">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          {(() => {
                            const imgUrl = typeof item.image === "string" ? item.image : item.image?.url
                            return imgUrl ? (
                              <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-[#F0EEED] border border-black/5 shrink-0">
                                <Image
                                  src={imgUrl}
                                  alt={(typeof item.image === "object" && item.image?.alt) || item.name}
                                  fill
                                  unoptimized={Boolean(imgUrl.startsWith("data:") || imgUrl.startsWith("http"))}
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="h-12 w-12 rounded-xl bg-[#F0EEED] flex items-center justify-center text-black/40 shrink-0">
                                <Package className="h-5 w-5" />
                              </div>
                            )
                          })()}
                          <div>
                            <p className="text-sm font-semibold text-black line-clamp-1">
                              {item.name}
                            </p>
                            <p className="text-xs text-black/60">
                              Qty: {item.quantity}{" "}
                              {item.variantName && item.variantName !== "Default"
                                ? `• ${item.variantName}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <span className="font-semibold text-sm text-black tabular-nums shrink-0">
                          {formatPrice(item.total, order.currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer with breakdown */}
                  <div className="mt-4 pt-4 border-t border-black/5 flex flex-wrap items-center justify-between gap-3 text-xs text-black/60">
                    <div className="flex flex-wrap items-center gap-3">
                      <span>Subtotal: {formatPrice(order.subtotal, order.currency)}</span>
                      {order.shipping === 0 ? (
                        <span className="text-emerald-700 font-medium">Free Shipping</span>
                      ) : (
                        <span>Shipping: {formatPrice(order.shipping, order.currency)}</span>
                      )}
                      <span>Tax: {formatPrice(order.tax, order.currency)}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <Button variant="outline" size="sm" asChild className="gap-1.5 text-xs rounded-full">
                        <Link href={`/account/orders/${encodeURIComponent(order.id)}`}>
                          View Details
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </Button>
                      <Link
                        href={`/checkout/success?order_id=${encodeURIComponent(order.id)}`}
                        className="text-xs font-semibold text-black hover:underline"
                      >
                        Receipt &rarr;
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
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
    <Card className="overflow-hidden rounded-[20px]">
      <div className="bg-neutral-50/60 p-5 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-28" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      </CardContent>
    </Card>
  )
}
