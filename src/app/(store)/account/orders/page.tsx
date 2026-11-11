"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Card, CardContent } from "@/components/ui/card"
import { Package, User as UserIcon, MapPin, Calendar, Clock } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { useAuthGuard } from "@/hooks/use-auth-guard"
import { useOrdersStore } from "@/store/orders"
import { formatPrice, formatDate } from "@/lib/utils"

export default function OrdersPage() {
  const { user, isReady } = useAuthGuard()
  const orders = useOrdersStore((s) => s.orders) || []
  const [filter, setFilter] = useState<"all" | "my">("all")

  if (!isReady) return null

  // User-specific orders (matched by userId or email case-insensitively)
  const myOrders = user
    ? orders.filter(
        (o) =>
          (o.userId && o.userId === user.id) ||
          (o.customerEmail &&
            user.email &&
            o.customerEmail.trim().toLowerCase() === user.email.trim().toLowerCase())
      )
    : orders

  // Display orders based on tab selection (defaults to all so NO placed order is hidden)
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
              : "Track and review all your placed orders"
          }
        />

        {/* Filter Tabs to switch between All Placed Orders and My Orders */}
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
              All Placed Orders ({orders.length})
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

      {displayedOrders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders found"
          description={
            filter === "my" && orders.length > 0
              ? "You haven't placed an order with this account email yet, but other orders exist."
              : "When you place an order, it will appear here."
          }
          actionLabel={
            filter === "my" && orders.length > 0
              ? "View All Placed Orders"
              : "Start Shopping"
          }
          actionHref={
            filter === "my" && orders.length > 0 ? undefined : "/shop"
          }
          onAction={
            filter === "my" && orders.length > 0
              ? () => setFilter("all")
              : undefined
          }
        />
      ) : (
        <div className="mt-8 space-y-6">
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
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm sm:text-base text-black">
                          {order.orderNumber}
                        </span>
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
                      <OrderStatusBadge status={order.status} />
                      <span className="font-bold text-base sm:text-lg text-black tabular-nums">
                        {formatPrice(order.total)}
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
                          {item.image?.url ? (
                            <div className="relative h-12 w-12 rounded-xl overflow-hidden bg-[#F0EEED] border border-black/5 shrink-0">
                              <Image
                                src={item.image.url}
                                alt={item.image.alt || item.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-12 w-12 rounded-xl bg-[#F0EEED] flex items-center justify-center text-black/40 shrink-0">
                              <Package className="h-5 w-5" />
                            </div>
                          )}
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
                          {formatPrice(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Order Footer with breakdown */}
                  <div className="mt-4 pt-4 border-t border-black/5 flex flex-wrap items-center justify-between gap-2 text-xs text-black/60">
                    <div>
                      <span>Subtotal: {formatPrice(order.subtotal)}</span>
                      {order.shipping === 0 ? (
                        <span className="ml-3 text-emerald-700 font-medium">Free Shipping</span>
                      ) : (
                        <span className="ml-3">Shipping: {formatPrice(order.shipping)}</span>
                      )}
                      <span className="ml-3">Tax: {formatPrice(order.tax)}</span>
                    </div>

                    <Link
                      href={`/checkout/success?order_id=${order.id}`}
                      className="text-xs font-semibold text-black hover:underline"
                    >
                      View Receipt &rarr;
                    </Link>
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
