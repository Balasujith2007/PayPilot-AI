"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  Package,
  Calendar,
  Truck,
  MapPin,
  Clock,
  Printer,
  Search,
  Filter,
  CheckCircle,
  Download,
  AlertCircle,
  RotateCcw,
  Send,
  ExternalLink,
  RefreshCw,
  X,
  FileText,
  Receipt,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  User,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"

export interface OrderItem {
  id: string
  productId: string
  variantId: string
  name: string
  variantName: string
  sku: string
  image: { url: string; alt?: string }
  price: number // cents/paise
  quantity: number
  total: number // cents/paise
}

export interface AuditNote {
  id: string
  author: string
  text: string
  createdAt: string
  type?: "system" | "staff" | "status" | "logistics" | "cancellation" | "audit"
}

export interface OrderAddress {
  firstName?: string
  lastName?: string
  line1?: string
  line2?: string
  city?: string
  state?: string
  postalCode?: string
  country?: string
  phone?: string
  _audit?: {
    notes?: AuditNote[]
    returnReason?: string | null
    refundStatus?: "NONE" | "REQUESTED" | "INITIATED" | "SETTLED"
    granularStatus?: string
  }
}

export interface AdminOrder {
  id: string
  orderNumber: string
  userId?: string | null
  status: "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED"
  paymentStatus: "PENDING" | "AUTHORIZED" | "CAPTURED" | "FAILED" | "REFUNDED"
  paymentMethod?: string | null
  paymentReference?: string | null
  paypalOrderId?: string | null
  subtotal: number
  tax: number
  shipping: number
  total: number
  currency: string
  customerEmail: string
  customerName: string
  shippingAddress: OrderAddress
  billingAddress?: OrderAddress | null
  carrier?: string | null
  trackingNumber?: string | null
  completedAt?: string | null
  createdAt: string
  updatedAt: string
  items: OrderItem[]
}

const CARRIER_OPTIONS = [
  "Blue Dart Express",
  "Delhivery Express",
  "DTDC Logistics",
  "Shadowfax Prime",
  "India Post Speed Post",
  "Ekart Logistics",
]

const RETURN_REASONS = [
  "Size too small / doesn't fit",
  "Size too large",
  "Damaged in transit / packaging crushed",
  "Defective / malfunction",
  "Received wrong item",
  "Delayed delivery (arrived too late)",
  "Customer changed mind",
]

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  // Multi-select Batch state
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchOperating, setBatchOperating] = useState(false)

  // Selected Order for Detail / Packing Desk Modal
  const [activeOrder, setActiveOrder] = useState<AdminOrder | null>(null)
  const [newStaffNote, setNewStaffNote] = useState("")
  const [savingNote, setSavingNote] = useState(false)

  // Selected Order for Refund / Cancellation Review Modal
  const [cancellationOrder, setCancellationOrder] = useState<AdminOrder | null>(null)
  const [selectedReason, setSelectedReason] = useState(RETURN_REASONS[0])
  const [refundStage, setRefundStage] = useState<"NONE" | "REQUESTED" | "INITIATED" | "SETTLED">("INITIATED")
  const [processingRefund, setProcessingRefund] = useState(false)

  // Inline carrier / AWB input states
  const [carrierDrafts, setCarrierDrafts] = useState<Record<string, string>>({})
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, string>>({})
  const [savingFulfillmentId, setSavingFulfillmentId] = useState<string | null>(null)

  // Fetch orders from database
  const loadOrders = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter) params.set("status", statusFilter)

      const res = await fetch(`/api/admin/orders?${params.toString()}`)
      const data = await res.json()
      if (data.success) {
        setOrders(data.orders || [])
      } else {
        toast.error("Failed to load orders from database")
      }
    } catch {
      toast.error("Network error while connecting to database")
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrders()
    }, 200)
    return () => clearTimeout(timer)
  }, [loadOrders])

  // Select all / toggle
  const handleToggleSelectAll = () => {
    if (selectedIds.length === orders.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(orders.map((o) => o.id))
    }
  }

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Single Status Update
  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          authorName: "Balaganesh (Admin)",
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Order moved to ${newStatus.toUpperCase()}!`)
        loadOrders()
        if (activeOrder?.id === orderId) {
          setActiveOrder(data.order)
        }
      } else {
        toast.error(data.error || "Failed to update status")
      }
    } catch {
      toast.error("Error updating order status in database")
    }
  }

  // Save Carrier & AWB Tracking
  const handleSaveFulfillment = async (orderId: string) => {
    const carrier = carrierDrafts[orderId] || "Blue Dart Express"
    const tracking =
      trackingDrafts[orderId] || `BLUEDART-${Math.floor(10000000 + Math.random() * 90000000)}`

    try {
      setSavingFulfillmentId(orderId)
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "SHIPPED",
          carrier,
          trackingNumber: tracking,
          authorName: "Balaganesh (Admin)",
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Fulfillment assigned: ${carrier} (AWB: ${tracking})`)
        loadOrders()
        if (activeOrder?.id === orderId) {
          setActiveOrder(data.order)
        }
      } else {
        toast.error(data.error || "Failed to save fulfillment")
      }
    } catch {
      toast.error("Error saving fulfillment")
    } finally {
      setSavingFulfillmentId(null)
    }
  }

  // Add Internal Staff Audit Note
  const handleAddStaffNote = async () => {
    if (!activeOrder || !newStaffNote.trim()) return

    try {
      setSavingNote(true)
      const res = await fetch(`/api/admin/orders/${activeOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          staffNote: newStaffNote.trim(),
          authorName: "Balaganesh (Admin)",
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Internal audit note logged!")
        setNewStaffNote("")
        setActiveOrder(data.order)
        loadOrders()
      } else {
        toast.error(data.error || "Failed to add note")
      }
    } catch {
      toast.error("Error adding audit note")
    } finally {
      setSavingNote(false)
    }
  }

  // Process Cancellation / Return Refund
  const handleProcessReturn = async () => {
    if (!cancellationOrder) return

    try {
      setProcessingRefund(true)
      const res = await fetch(`/api/admin/orders/${cancellationOrder.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "REFUNDED",
          paymentStatus: "REFUNDED",
          returnReason: selectedReason,
          refundStatus: refundStage,
          authorName: "Balaganesh (Admin)",
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Order ${cancellationOrder.orderNumber} updated: Return logged, refund ${refundStage}!`)
        setCancellationOrder(null)
        loadOrders()
      } else {
        toast.error(data.error || "Failed to process return")
      }
    } catch {
      toast.error("Error processing return in database")
    } finally {
      setProcessingRefund(false)
    }
  }

  // Batch Bulk Action
  const handleBulkAction = async (newStatus: string) => {
    if (selectedIds.length === 0) return

    try {
      setBatchOperating(true)
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderIds: selectedIds,
          status: newStatus,
          actionNote: `Bulk lifecycle advance to ${newStatus.toUpperCase()} by Balaganesh`,
        }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Batch updated ${data.count} orders to ${newStatus.toUpperCase()}!`)
        setSelectedIds([])
        loadOrders()
      } else {
        toast.error(data.error || "Batch update failed")
      }
    } catch {
      toast.error("Error processing batch update")
    } finally {
      setBatchOperating(false)
    }
  }

  // Bulk Export to CSV
  const handleExportCSV = () => {
    const listToExport =
      selectedIds.length > 0 ? orders.filter((o) => selectedIds.includes(o.id)) : orders

    if (listToExport.length === 0) {
      toast.error("No orders available to export")
      return
    }

    const headers = [
      "Order ID",
      "Order Number",
      "Customer Name",
      "Customer Email",
      "Created At",
      "Status",
      "Payment Status",
      "Payment Method",
      "Total (INR)",
      "Carrier",
      "Tracking Number (AWB)",
      "Item Count",
    ]

    const rows = listToExport.map((o) => [
      `"${o.id}"`,
      `"${o.orderNumber}"`,
      `"${o.customerName}"`,
      `"${o.customerEmail}"`,
      `"${o.createdAt}"`,
      `"${o.status}"`,
      `"${o.paymentStatus}"`,
      `"${o.paymentMethod || "Online"}"`,
      `"${(o.total / 100).toFixed(2)}"`,
      `"${o.carrier || "Unassigned"}"`,
      `"${o.trackingNumber || "N/A"}"`,
      `"${o.items?.length || 0}"`,
    ])

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n")

    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `PayPilot_Orders_Export_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Exported ${listToExport.length} orders to CSV!`)
  }

  // Print Packing Slip Trigger
  const handlePrintPackingSlip = () => {
    window.print()
  }

  // Summary Metrics
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0)
  const pendingCount = orders.filter((o) => o.status === "PENDING").length
  const processingCount = orders.filter((o) => o.status === "PROCESSING").length
  const shippedCount = orders.filter((o) => o.status === "SHIPPED").length
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length
  const returnedCount = orders.filter((o) => o.status === "REFUNDED" || o.status === "CANCELLED").length

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="Orders & Fulfillment Hub"
          description={`Real-time lifecycle queue: ${totalOrders} orders stored in Neon PostgreSQL • ${formatPrice(totalRevenue)} total sales volume.`}
        />

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer shadow-2xs"
            title="Refresh database orders"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white py-2 px-4 text-xs font-bold text-black hover:bg-black hover:text-white transition-all cursor-pointer shadow-2xs"
            title="Export to CSV spreadsheet"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Multi-Stage Lifecycle KPI Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3.5">
        <Card className="rounded-2xl border-black/10 bg-white p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-black/60">1. Received / Pending</span>
          <p className="text-xl font-black text-black mt-1 tabular-nums">{pendingCount}</p>
        </Card>
        <Card className="rounded-2xl border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-amber-900">2. Packed / Processing</span>
          <p className="text-xl font-black text-amber-900 mt-1 tabular-nums">{processingCount}</p>
        </Card>
        <Card className="rounded-2xl border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-blue-900">3. Handed / In Transit</span>
          <p className="text-xl font-black text-blue-900 mt-1 tabular-nums">{shippedCount}</p>
        </Card>
        <Card className="rounded-2xl border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-emerald-900">4. Delivered</span>
          <p className="text-xl font-black text-emerald-900 mt-1 tabular-nums">{deliveredCount}</p>
        </Card>
        <Card className="rounded-2xl border-red-200 bg-red-50/50 p-4 shadow-2xs">
          <span className="text-[11px] font-semibold text-red-900">Returns / Cancelled</span>
          <p className="text-xl font-black text-red-900 mt-1 tabular-nums">{returnedCount}</p>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-black/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by order number, customer name, email, AWB tracking..."
            className="w-full rounded-full bg-white border border-black/10 pl-10 pr-4 py-2.5 text-xs font-medium text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black shadow-2xs"
          />
        </div>

        {/* Granular Lifecycle Stages Tabs */}
        <div className="flex items-center gap-1.5 rounded-full bg-white p-1 border border-black/10 shadow-2xs w-full sm:w-auto overflow-x-auto max-w-full">
          {[
            { key: "", label: "All" },
            { key: "PENDING", label: `Pending (${pendingCount})` },
            { key: "PROCESSING", label: `Processing (${processingCount})` },
            { key: "SHIPPED", label: `Shipped (${shippedCount})` },
            { key: "DELIVERED", label: `Delivered (${deliveredCount})` },
            { key: "REFUNDED", label: `Returned (${returnedCount})` },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? "bg-black text-white shadow-xs"
                  : "text-black/60 hover:text-black hover:bg-[#F0EEED]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Action Toolbar (Appears when items are selected) */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-black text-white rounded-2xl shadow-md transition-all">
          <div className="flex items-center gap-2 text-xs font-bold">
            <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-[11px]">
              {selectedIds.length} Selected
            </span>
            <span>Bulk Batch Operations:</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={batchOperating}
              onClick={() => handleBulkAction("PROCESSING")}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white hover:text-black text-xs font-bold transition-all cursor-pointer"
            >
              Mark as Packed
            </button>
            <button
              type="button"
              disabled={batchOperating}
              onClick={() => handleBulkAction("SHIPPED")}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white hover:text-black text-xs font-bold transition-all cursor-pointer"
            >
              Mark as Shipped
            </button>
            <button
              type="button"
              disabled={batchOperating}
              onClick={() => handleBulkAction("DELIVERED")}
              className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white hover:text-black text-xs font-bold transition-all cursor-pointer"
            >
              Mark as Delivered
            </button>
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3 py-1.5 rounded-full bg-white text-black text-xs font-bold hover:bg-white/90 transition-all cursor-pointer flex items-center gap-1"
            >
              <Download className="size-3" />
              <span>Export Selected ({selectedIds.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1 rounded-full text-white/60 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Orders Table */}
      <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead>
              <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3.5 pl-5 w-8">
                  <input
                    type="checkbox"
                    checked={orders.length > 0 && selectedIds.length === orders.length}
                    onChange={handleToggleSelectAll}
                    className="rounded border-black/20 text-black focus:ring-black size-4 cursor-pointer"
                  />
                </th>
                <th className="py-3.5 pl-2">Order & Date</th>
                <th className="py-3.5">Customer</th>
                <th className="py-3.5">Items Summary</th>
                <th className="py-3.5 text-right">Total Amount</th>
                <th className="py-3.5 text-center">Operational Stage</th>
                <th className="py-3.5">Courier & AWB</th>
                <th className="py-3.5 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-black/50">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Loading orders from Neon PostgreSQL...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-black/50">
                    <p className="font-semibold text-sm">No orders found in database</p>
                    <p className="text-xs text-black/40 mt-1">
                      Orders placed on the storefront will appear here live.
                    </p>
                  </td>
                </tr>
              ) : (
                orders.map((o) => {
                  const isSelected = selectedIds.includes(o.id)
                  const address = o.shippingAddress || {}
                  const audit = o.billingAddress?._audit || {}
                  const notes = audit.notes || []

                  return (
                    <tr
                      key={o.id}
                      className={`hover:bg-[#F0EEED]/30 transition-colors ${
                        isSelected ? "bg-black/5" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(o.id)}
                          className="rounded border-black/20 text-black focus:ring-black size-4 cursor-pointer"
                        />
                      </td>

                      {/* Order Number & Date */}
                      <td className="py-3.5 pl-2">
                        <div className="space-y-0.5">
                          <button
                            type="button"
                            onClick={() => setActiveOrder(o)}
                            className="font-bold text-black hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>{o.orderNumber || o.id}</span>
                          </button>
                          <p className="text-[10px] text-black/50 flex items-center gap-1 font-mono">
                            <Clock className="size-3" />
                            <span>{formatDate(o.createdAt)}</span>
                          </p>
                          {notes.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
                              {notes.length} audit note{notes.length > 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Customer Info */}
                      <td className="py-3.5">
                        <div className="space-y-0.5 max-w-[160px]">
                          <p className="font-bold text-black line-clamp-1">
                            {o.customerName || "Customer"}
                          </p>
                          <p className="text-[10px] text-black/60 truncate">{o.customerEmail}</p>
                          <p className="text-[10px] text-black/40 truncate">
                            {address.city ? `${address.city}, ${address.state || ""}` : "India"}
                          </p>
                        </div>
                      </td>

                      {/* Items Summary */}
                      <td className="py-3.5">
                        <div className="space-y-1">
                          <p className="font-semibold text-black">
                            {o.items?.length || 0} item{o.items?.length > 1 ? "s" : ""}
                          </p>
                          <div className="flex items-center gap-1">
                            {o.items?.slice(0, 3).map((it, idx) => {
                              const imgUrl = typeof it.image === "string" ? it.image : it.image?.url
                              return (
                                <div
                                  key={idx}
                                  className="relative size-7 rounded-md overflow-hidden bg-[#F0EEED] border border-black/10 shrink-0"
                                  title={`${it.name} (${it.quantity}x)`}
                                >
                                  {imgUrl ? (
                                    <Image
                                      src={imgUrl}
                                      alt={it.name}
                                      fill
                                      unoptimized={Boolean(imgUrl.startsWith("data:") || imgUrl.startsWith("http"))}
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex size-full items-center justify-center bg-[#F0EEED] text-black/40">
                                      <Package className="size-3.5" />
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {o.items?.length > 3 && (
                              <span className="text-[9px] font-bold text-black/50">
                                +{o.items.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 text-right font-black text-black tabular-nums">
                        <div>{formatPrice(o.total)}</div>
                        <span className="text-[9px] font-bold text-black/50 uppercase">
                          {o.paymentMethod || "Online"}
                        </span>
                      </td>

                      {/* Granular Operational Stage */}
                      <td className="py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-tight ${
                              o.status === "DELIVERED"
                                ? "bg-emerald-100 text-emerald-800"
                                : o.status === "SHIPPED"
                                ? "bg-blue-100 text-blue-900"
                                : o.status === "PROCESSING"
                                ? "bg-amber-100 text-amber-900"
                                : o.status === "CANCELLED" || o.status === "REFUNDED"
                                ? "bg-red-100 text-red-900"
                                : "bg-black/10 text-black"
                            }`}
                          >
                            {o.status}
                          </span>

                          {/* Quick Lifecycle Stage Advance Dropdown */}
                          <select
                            value={o.status}
                            onChange={(e) => handleUpdateStatus(o.id, e.target.value)}
                            className="text-[10px] font-semibold text-black/60 bg-transparent hover:text-black border-none focus:outline-none cursor-pointer"
                          >
                            <option value="PENDING">1. Received</option>
                            <option value="PROCESSING">2. Packed</option>
                            <option value="SHIPPED">3. In Transit</option>
                            <option value="DELIVERED">4. Delivered</option>
                            <option value="REFUNDED">Returned</option>
                            <option value="CANCELLED">Cancelled</option>
                          </select>
                        </div>
                      </td>

                      {/* Courier & AWB Tracking */}
                      <td className="py-3.5">
                        <div className="space-y-1">
                          <select
                            value={carrierDrafts[o.id] ?? (o.carrier || "Blue Dart Express")}
                            onChange={(e) =>
                              setCarrierDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))
                            }
                            className="rounded-lg border border-black/10 bg-[#F0EEED]/40 px-2 py-1 text-[11px] font-semibold text-black focus:outline-none focus:ring-1 focus:ring-black cursor-pointer w-full max-w-[150px]"
                          >
                            {CARRIER_OPTIONS.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={
                                trackingDrafts[o.id] ?? (o.trackingNumber || "BLUEDART-98471209")
                              }
                              onChange={(e) =>
                                setTrackingDrafts((prev) => ({ ...prev, [o.id]: e.target.value }))
                              }
                              placeholder="AWB Tracking"
                              className="w-28 rounded-lg border border-black/10 bg-[#F0EEED]/40 px-2 py-0.5 text-[10px] font-mono text-black focus:outline-none uppercase"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveFulfillment(o.id)}
                              disabled={savingFulfillmentId === o.id}
                              className="rounded-md bg-black px-2 py-1 text-[9px] font-bold text-white hover:bg-black/85 cursor-pointer shadow-2xs shrink-0"
                            >
                              {savingFulfillmentId === o.id ? "..." : "Save"}
                            </button>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Packing Desk / Details Button */}
                          <button
                            type="button"
                            onClick={() => setActiveOrder(o)}
                            className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-white py-1 px-2.5 text-xs font-bold text-black hover:bg-black hover:text-white transition-all cursor-pointer shadow-2xs"
                            title="Packing Desk & Printable Slip"
                          >
                            <FileText className="size-3" />
                            <span>Slip</span>
                          </button>

                          {/* Indian GST Tax Invoice */}
                          <Link
                            href={`/admin/billing?search=${o.orderNumber || o.id}`}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-600/30 bg-emerald-50/50 py-1 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-2xs"
                            title="Indian GST Tax Invoice & Settlement"
                          >
                            <Receipt className="size-3" />
                            <span>Invoice</span>
                          </Link>

                          {/* Returns / Refund Button */}
                          <button
                            type="button"
                            onClick={() => setCancellationOrder(o)}
                            className="p-1.5 rounded-lg text-amber-800 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Review Returns & Refunds"
                          >
                            <RotateCcw className="size-3.5" />
                          </button>

                          {/* Customer Storefront Link */}
                          <Link
                            href={`/orders/${o.id}`}
                            target="_blank"
                            title="View customer order page"
                            className="p-1.5 rounded-lg text-black/50 hover:text-black hover:bg-[#F0EEED] transition-colors"
                          >
                            <ExternalLink className="size-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── 1. ORDER DETAIL & PRINTABLE PACKING DESK MODAL ───────────────────── */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-[20px] sm:rounded-[24px] border border-black/10 bg-white p-4 sm:p-8 shadow-2xl text-left">
            {/* Modal Controls Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/10 pb-4 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <span className="font-display font-black text-base sm:text-lg text-black">
                  PACKING DESK & INVOICE
                </span>
                <span className="bg-black text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {activeOrder.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/billing?search=${activeOrder.orderNumber || activeOrder.id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-600/30 bg-emerald-50 py-1.5 px-3 sm:py-2 sm:px-4 text-xs font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition-all cursor-pointer shadow-xs"
                >
                  <Receipt className="size-3.5" />
                  <span>GST Tax Invoice</span>
                </Link>
                <button
                  type="button"
                  onClick={handlePrintPackingSlip}
                  className="inline-flex items-center gap-1.5 rounded-full bg-black py-1.5 px-3 sm:py-2 sm:px-4 text-xs font-bold text-white shadow-xs hover:bg-black/85 cursor-pointer"
                >
                  <Printer className="size-3.5" />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveOrder(null)}
                  className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] hover:text-black cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* ── PRINTABLE PACKING SLIP CONTENT ───────────────────────────── */}
            <div className="print:m-0 space-y-6">
              {/* Header with Store Branding & Order Reference */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-3 border-b border-black/10 pb-5">
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-black uppercase text-black tracking-tight">
                    PAYPILOT AI
                  </h2>
                  <p className="text-xs text-black/60">Official Packing Slip & Pick-List</p>
                  <p className="text-[11px] text-black/40 mt-1">support@paypilot-ai.com</p>
                </div>
                <div className="text-left sm:text-right space-y-1">
                  <p className="text-xs font-mono font-bold text-black">
                    ORDER #{activeOrder.orderNumber}
                  </p>
                  <p className="text-[11px] text-black/50">Date: {formatDate(activeOrder.createdAt)}</p>
                  <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-sm inline-block">
                    Payment: {activeOrder.paymentStatus} ({activeOrder.paymentMethod || "Online"})
                  </p>
                </div>
              </div>

              {/* Shipping & Courier Logistics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-[#F0EEED]/40 p-4 rounded-2xl border border-black/10">
                <div>
                  <span className="text-[10px] font-bold text-black/60 uppercase">Ship To:</span>
                  <p className="font-bold text-xs text-black mt-1">
                    {activeOrder.customerName || "Customer"}
                  </p>
                  <p className="text-xs text-black/70 mt-0.5">
                    {activeOrder.shippingAddress?.line1 || "123 Commercial Street"}
                  </p>
                  <p className="text-xs text-black/70">
                    {activeOrder.shippingAddress?.city || "Bengaluru"},{" "}
                    {activeOrder.shippingAddress?.state || "Karnataka"} -{" "}
                    {activeOrder.shippingAddress?.postalCode || "560001"}
                  </p>
                  <p className="text-[11px] text-black/50 mt-1 font-mono">{activeOrder.customerEmail}</p>
                </div>

                <div>
                  <span className="text-[10px] font-bold text-black/60 uppercase">
                    Assigned Courier Partner:
                  </span>
                  <p className="font-bold text-xs text-black mt-1">
                    {activeOrder.carrier || "Blue Dart Express"}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-black/50">AWB Tracking:</span>
                    <span className="text-xs font-mono font-bold text-black">
                      {activeOrder.trackingNumber || "BLUEDART-98471209"}
                    </span>
                  </div>
                  <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-full">
                    <ShieldCheck className="size-3" />
                    <span>Package Verified for Dispatch</span>
                  </span>
                </div>
              </div>

              {/* Items Pick-List Table */}
              <div>
                <span className="text-[11px] font-bold text-black uppercase tracking-wider block mb-2">
                  Items to Pack ({activeOrder.items?.length || 0})
                </span>
                <div className="border border-black/10 rounded-xl overflow-x-auto">
                  <table className="w-full min-w-[460px] text-xs">
                    <thead>
                      <tr className="bg-[#F0EEED]/50 border-b border-black/10 text-black/60 text-[10px] font-bold uppercase">
                        <th className="py-2.5 pl-4 text-left">Item Description</th>
                        <th className="py-2.5 text-left">SKU Code</th>
                        <th className="py-2.5 text-center">Qty</th>
                        <th className="py-2.5 text-right pr-4">Total (INR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {activeOrder.items?.map((it, idx) => {
                        const imgUrl = typeof it.image === "string" ? it.image : it.image?.url
                        return (
                        <tr key={idx}>
                          <td className="py-3 pl-4">
                            <div className="flex items-center gap-2.5">
                              <div className="relative size-9 rounded-md overflow-hidden bg-[#F0EEED] border border-black/10 shrink-0">
                                {imgUrl ? (
                                  <Image
                                    src={imgUrl}
                                    alt={it.name}
                                    fill
                                    unoptimized={Boolean(imgUrl.startsWith("data:") || imgUrl.startsWith("http"))}
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center bg-[#F0EEED] text-black/40">
                                    <Package className="size-4" />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-black">{it.name}</p>
                                <p className="text-[10px] text-black/50">{it.variantName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 font-mono text-[11px] text-black/70">{it.sku}</td>
                          <td className="py-3 text-center font-bold text-black">{it.quantity}</td>
                          <td className="py-3 text-right pr-4 font-bold text-black tabular-nums">
                            {formatPrice(it.total || it.price * it.quantity)}
                          </td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Summary */}
              <div className="flex justify-end pt-2">
                <div className="w-64 space-y-1.5 text-xs text-black/70">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-black">{formatPrice(activeOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span>{activeOrder.shipping === 0 ? "FREE" : formatPrice(activeOrder.shipping)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Estimated Tax:</span>
                    <span>{formatPrice(activeOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-black/10 text-sm font-black text-black">
                    <span>Total Amount:</span>
                    <span>{formatPrice(activeOrder.total)}</span>
                  </div>
                </div>
              </div>

              {/* Staff Signature Box for Packing Desk */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-4 border-t border-black/10 text-[11px]">
                <div className="border border-dashed border-black/20 p-3 rounded-xl">
                  <span className="text-[10px] text-black/50 block mb-3">
                    Packed & Quality Checked By:
                  </span>
                  <p className="font-bold text-black">Balaganesh (Admin)</p>
                  <p className="text-[10px] text-black/40">PayPilot AI Dispatch Desk</p>
                </div>
                <div className="border border-dashed border-black/20 p-3 rounded-xl">
                  <span className="text-[10px] text-black/50 block mb-3">
                    Courier Partner Handover Signature:
                  </span>
                  <p className="text-[10px] text-black/40">Signature / Dispatch Stamp</p>
                </div>
              </div>

              {/* ── INTERNAL AUDIT TRAIL & STAFF NOTES ───────────────────────── */}
              <div className="pt-6 border-t border-black/10 space-y-4 print:hidden">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-black flex items-center gap-1.5">
                    <Clock className="size-4" />
                    <span>Internal Audit Trail & Activity Timeline</span>
                  </h4>
                  <span className="text-[11px] text-black/50">
                    {(activeOrder.billingAddress?._audit?.notes || []).length} events logged
                  </span>
                </div>

                {/* Timeline Events */}
                <div className="space-y-2.5 max-h-56 overflow-y-auto p-1">
                  {(activeOrder.billingAddress?._audit?.notes || []).length === 0 ? (
                    <p className="text-xs text-black/40 italic">No notes logged yet.</p>
                  ) : (
                    (activeOrder.billingAddress?._audit?.notes || []).map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-[#F0EEED]/50 rounded-xl border border-black/5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-black">{note.author}</span>
                          <span className="text-[10px] text-black/40 font-mono">
                            {formatDate(note.createdAt)}
                          </span>
                        </div>
                        <p className="text-xs text-black/80">{note.text}</p>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Note Input */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newStaffNote}
                    onChange={(e) => setNewStaffNote(e.target.value)}
                    placeholder='Add staff audit note (e.g. "Package verified and sealed by Balaganesh on Nov 12, 10:15 PM")...'
                    className="flex-1 rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <button
                    type="button"
                    onClick={handleAddStaffNote}
                    disabled={savingNote || !newStaffNote.trim()}
                    className="rounded-xl bg-black py-2.5 px-4 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Send className="size-3" />
                    <span>Log Note</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. RETURNS, CANCELLATION & REFUND PROCESSING MODAL ──────────────── */}
      {cancellationOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-[20px] sm:rounded-[24px] border border-black/10 bg-white p-4 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-black/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-black flex items-center gap-2">
                <RotateCcw className="size-5 text-amber-600" />
                <span>Return & Refund Desk</span>
              </h3>
              <button
                type="button"
                onClick={() => setCancellationOrder(null)}
                className="rounded-full p-2 text-black/60 hover:bg-[#F0EEED]"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                <p className="font-bold text-amber-950">
                  Order #{cancellationOrder.orderNumber} • Total: {formatPrice(cancellationOrder.total)}
                </p>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  Customer: {cancellationOrder.customerName} ({cancellationOrder.customerEmail})
                </p>
              </div>

              {/* Return Reason Selector */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Return / Cancellation Reason:
                </label>
                <select
                  value={selectedReason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs text-black font-semibold focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                >
                  {RETURN_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-black/50 mt-1">
                  Logged in staff audit trail to identify recurring product defects and sizing trends.
                </p>
              </div>

              {/* Refund Status Selector */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">Refund Status:</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: "REQUESTED", label: "Requested" },
                    { key: "INITIATED", label: "Initiated" },
                    { key: "SETTLED", label: "Settled in Bank" },
                  ].map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() =>
                        setRefundStage(s.key as "NONE" | "REQUESTED" | "INITIATED" | "SETTLED")
                      }
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        refundStage === s.key
                          ? "bg-black text-white border-black"
                          : "bg-white text-black/70 border-black/10 hover:border-black/30"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-black/10 mt-6">
                <button
                  type="button"
                  onClick={() => setCancellationOrder(null)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleProcessReturn}
                  disabled={processingRefund}
                  className="rounded-full bg-red-600 py-2 px-5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer shadow-xs"
                >
                  {processingRefund ? "Processing..." : "Process Refund in DB"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
