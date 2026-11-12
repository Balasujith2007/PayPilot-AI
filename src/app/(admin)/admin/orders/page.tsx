"use client"

import Link from "next/link"
import { Package, User, Calendar } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { EmptyState } from "@/components/ui/empty-state"
import { Card, CardContent } from "@/components/ui/card"
import { OrderStatusBadge } from "@/components/ui/order-status-badge"
import { useOrdersStore } from "@/store/orders"
import { useHydrated } from "@/hooks/use-hydrated"
import { formatPrice, formatDate } from "@/lib/utils"
import type { OrderStatus } from "@/types"
import { toast } from "sonner"

export default function AdminOrdersPage() {
  const mounted = useHydrated()
  const orders = useOrdersStore((s) => s.orders) || []
  const updateOrderStatus = useOrdersStore((s) => s.updateOrderStatus)

  if (!mounted) {
    return (
      <div className="space-y-6">
        <PageHeader title="Orders" description="Manage and track customer orders." />
        <div className="h-40 rounded-2xl bg-muted/20 animate-pulse" />
      </div>
    )
  }

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    updateOrderStatus(orderId, newStatus)
    toast.success(`Order ${orderId} updated to ${newStatus}`)
  }

  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Orders"
          description={
            orders.length > 0
              ? `${orders.length} total orders placed • ${formatPrice(totalRevenue)} total sales`
              : "Manage and track customer orders."
          }
        />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No orders yet"
          description="Orders will appear here in real time as customers place them."
          actionLabel="Place a Test Order"
          actionHref="/shop"
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id} className="overflow-hidden rounded-2xl border">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-foreground">
                        {order.orderNumber}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {formatDate(order.createdAt)}
                      </span>
                      <span>&bull;</span>
                      <span className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {order.customerName} ({order.customerEmail})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-bold text-lg text-foreground tabular-nums">
                      {formatPrice(order.total)}
                    </span>
                    <select
                      value={order.status}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value as OrderStatus)
                      }
                      className="rounded-lg border bg-background px-2.5 py-1.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="processing">Processing</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p className="font-semibold text-foreground">
                    Items ({order.items.reduce((acc, i) => acc + i.quantity, 0)}):
                  </p>
                  <div className="space-y-1">
                    {order.items.map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="flex justify-between items-center"
                      >
                        <span>
                          {item.name} &times; {item.quantity}{" "}
                          {item.variantName && item.variantName !== "Default"
                            ? `(${item.variantName})`
                            : ""}
                        </span>
                        <span className="font-medium text-foreground">
                          {formatPrice(item.total)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs text-muted-foreground pt-2 border-t">
                  <span>
                    Ship to: {order.shippingAddress.line1}, {order.shippingAddress.city},{" "}
                    {order.shippingAddress.state} {order.shippingAddress.postalCode}
                  </span>
                  <Link
                    href={`/checkout/success?order_id=${order.id}`}
                    className="font-medium text-foreground hover:underline"
                  >
                    View Receipt &rarr;
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
