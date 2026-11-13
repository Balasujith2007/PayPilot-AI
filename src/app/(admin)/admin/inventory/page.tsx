"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  Edit2,
  FileText,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  XCircle,
  Package,
  Layers,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react"

type ActiveTab = "radar" | "variants" | "forecast" | "audit"

function formatInr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface InventoryItem {
  id: string
  productId: string
  productTitle: string
  productSlug: string
  productStatus: string
  name: string
  sku: string
  price: number
  compareAtPrice?: number | null
  quantity: number
  safetyStock: number
  reorderQuantity: number
  supplierCost: number
  supplierName: string
  options: Record<string, string>
  images: Array<{ url: string; alt?: string }>
  healthStatus: "OUT_OF_STOCK" | "LOW_STOCK" | "HEALTHY"
  velocityPerWeek: number
  velocityPerDay: number
  runoutDays: number
  suggestedReorder: number
}

interface AuditLog {
  id: string
  variantId: string
  sku: string
  productTitle: string
  variantName: string
  previousQuantity: number
  newQuantity: number
  changeAmount: number
  reason: string
  notes?: string | null
  staffAuthor: string
  createdAt: string
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplierName: string
  status: string
  items: Array<{
    variantId: string
    sku: string
    name: string
    productTitle: string
    currentStock: number
    suggestedQuantity: number
    unitCost: number
    totalCost: number
  }>
  totalItems: number
  totalCost: number
  expectedDeliveryDate?: string | null
  notes?: string | null
  createdAt: string
}

export default function AdminInventoryPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("radar")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [items, setItems] = useState<InventoryItem[]>([])
  const [metrics, setMetrics] = useState({
    totalVariants: 0,
    outOfStockCount: 0,
    lowStockCount: 0,
    healthyCount: 0,
    totalUnits: 0,
    totalValuation: 0,
  })
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])

  const [statusFilter, setStatusFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")

  // Quick Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState(false)
  const [adjustTarget, setAdjustTarget] = useState<InventoryItem | null>(null)
  const [adjustForm, setAdjustForm] = useState({
    action: "SET", // "SET" | "INCREMENT" | "DECREMENT"
    amount: 0,
    reason: "MANUAL_RECONCILIATION",
    notes: "",
  })

  // Selected items for PO generation
  const [selectedPoVariantIds, setSelectedPoVariantIds] = useState<string[]>([])
  const [generatingPo, setGeneratingPo] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "ALL") params.set("filter", statusFilter)
      if (searchQuery) params.set("search", searchQuery)

      const res = await fetch(`/api/admin/inventory?${params.toString()}`)
      const data = await res.json()
      if (data.items) {
        setItems(data.items)
        setMetrics(data.metrics)
        setAuditLogs(data.auditLogs || [])
        setPurchaseOrders(data.purchaseOrders || [])
      }
    } catch (err) {
      console.error("Failed to load inventory data", err)
    }
  }, [statusFilter, searchQuery])

  useEffect(() => {
    setLoading(true)
    fetchData().finally(() => setLoading(false))
  }, [fetchData])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  // Quick Inline Quantity Change (+1 or -1)
  const handleQuickAdjust = async (variantId: string, action: "INCREMENT" | "DECREMENT", amount = 1) => {
    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId,
          action,
          amount,
          reason: action === "INCREMENT" ? "RECEIVED_SHIPMENT" : "ORDER_FULFILLMENT",
          notes: `Quick 1-click ${action.toLowerCase()} adjustment`,
        }),
      })
      if (res.ok) {
        await fetchData()
      }
    } catch (err) {
      console.error("Failed to adjust quantity", err)
    }
  }

  // Submit Detailed Adjustment
  const handleSubmitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustTarget) return

    try {
      const res = await fetch("/api/admin/inventory/adjust", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          variantId: adjustTarget.id,
          action: adjustForm.action,
          amount: adjustForm.amount,
          reason: adjustForm.reason,
          notes: adjustForm.notes,
        }),
      })

      if (res.ok) {
        setShowAdjustModal(false)
        setAdjustTarget(null)
        await fetchData()
      }
    } catch (err) {
      console.error("Failed to submit adjustment", err)
    }
  }

  // Generate Purchase Order from Selected / Low Stock Items
  const handleGeneratePO = async () => {
    try {
      setGeneratingPo(true)
      const targets = items.filter(
        (it) =>
          selectedPoVariantIds.includes(it.id) ||
          (selectedPoVariantIds.length === 0 && (it.healthStatus === "OUT_OF_STOCK" || it.healthStatus === "LOW_STOCK"))
      )

      if (targets.length === 0) return

      const poItems = targets.map((t) => ({
        variantId: t.id,
        sku: t.sku,
        name: t.name,
        productTitle: t.productTitle,
        currentStock: t.quantity,
        suggestedQuantity: t.suggestedReorder,
        unitCost: t.supplierCost,
        totalCost: t.supplierCost * t.suggestedReorder,
      }))

      const res = await fetch("/api/admin/inventory/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierName: targets[0]?.supplierName || "Apex Garments & Electronics Supply Hub",
          items: poItems,
          notes: "Generated from 30-day velocity forecast in Stock Health Desk.",
        }),
      })

      if (res.ok) {
        setSelectedPoVariantIds([])
        await fetchData()
        setActiveTab("forecast")
      }
    } catch (err) {
      console.error("Failed to generate PO", err)
    } finally {
      setGeneratingPo(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Inventory & Stock Health Monitoring
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Low stock safety alerts, variant-level auditing, 30-day velocity forecasting & purchase orders
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
            Sync Stock
          </button>
        </div>
      </div>

      {/* Critical Stock Alert Banner */}
      {(metrics.outOfStockCount > 0 || metrics.lowStockCount > 0) && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {metrics.outOfStockCount} Out-of-Stock &middot; {metrics.lowStockCount} Critical Safety Stock Warning
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Variants below safety threshold (≤5 units). Storefront badges updated automatically to prevent overselling.
              </p>
            </div>
          </div>
          <button
            onClick={handleGeneratePO}
            disabled={generatingPo}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
          >
            {generatingPo ? "Generating..." : "Generate Restock PO Draft"}
          </button>
        </div>
      )}

      {/* High-Level Stock Health KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* Total Units */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <span className="text-[11px] font-semibold text-zinc-500">Warehouse Inventory</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
            {metrics.totalUnits} Units
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">{metrics.totalVariants} active SKUs</p>
        </div>

        {/* Valuation */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <span className="text-[11px] font-semibold text-zinc-500">Inventory Valuation</span>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
            {formatInr(metrics.totalValuation)}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">Retail stock value</p>
        </div>

        {/* Critical Out of Stock */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-400">Out of Stock</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-900 dark:text-rose-300 mt-2">
            {metrics.outOfStockCount}
          </p>
          <p className="text-[10px] sm:text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1 truncate">0 units remaining</p>
        </div>

        {/* Low Stock (<=5) */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Low Stock</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-900 dark:text-amber-300 mt-2">
            {metrics.lowStockCount}
          </p>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 truncate">Below safety (≤5)</p>
        </div>

        {/* Healthy Stock */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">Healthy Stock</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
            {metrics.healthyCount}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">Adequate inventory</p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          onClick={() => setActiveTab("radar")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "radar"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          Stock Health & Alerts ({items.length})
        </button>

        <button
          onClick={() => setActiveTab("variants")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "variants"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Layers className="w-4 h-4" />
          Variant Auditing (Sizes & Colors)
        </button>

        <button
          onClick={() => setActiveTab("forecast")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "forecast"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Restock Forecasting & POs ({purchaseOrders.length})
        </button>

        <button
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "audit"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Clock className="w-4 h-4" />
          Stock Adjustment Ledger ({auditLogs.length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STOCK HEALTH & LOW STOCK RADAR                                     */}
      {/* ========================================================================= */}
      {activeTab === "radar" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search SKU, product title, or variant name..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Health Statuses</option>
                <option value="OUT_OF_STOCK">Out of Stock (0)</option>
                <option value="LOW_STOCK">Low Stock (≤5)</option>
                <option value="HEALTHY">Healthy Stock (&gt;5)</option>
              </select>
            </div>
          </div>

          {/* Radar Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">Product & SKU</th>
                    <th className="py-3 px-4">Variant Options</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Safety Stock</th>
                    <th className="py-3 px-4">Stock Health Status</th>
                    <th className="py-3 px-4 text-right">30d Velocity</th>
                    <th className="py-3 px-4 text-right">Quick Adjust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Scanning inventory levels...
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        No items match your filter.
                      </td>
                    </tr>
                  ) : (
                    items.map((it) => (
                      <tr key={it.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <Link
                            href={`/${it.productSlug}`}
                            target="_blank"
                            className="font-bold text-zinc-950 dark:text-zinc-50 hover:underline flex items-center gap-1"
                          >
                            <span>{it.productTitle}</span>
                          </Link>
                          <div className="text-xs text-zinc-500 font-mono mt-0.5">
                            SKU: {it.sku} &middot; Retail: {formatInr(it.price)}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{it.name}</span>
                          <div className="text-[11px] text-zinc-500">
                            {Object.entries(it.options || {})
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(", ") || "Standard"}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
                              it.quantity === 0
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                                : it.quantity <= it.safetyStock
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                            }`}
                          >
                            {it.quantity} units
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-600 dark:text-zinc-400">
                          {it.safetyStock} units
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              it.healthStatus === "OUT_OF_STOCK"
                                ? "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                                : it.healthStatus === "LOW_STOCK"
                                ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                            }`}
                          >
                            {it.healthStatus === "OUT_OF_STOCK" && <XCircle className="w-3.5 h-3.5" />}
                            {it.healthStatus === "LOW_STOCK" && <AlertTriangle className="w-3.5 h-3.5" />}
                            {it.healthStatus === "HEALTHY" && <CheckCircle2 className="w-3.5 h-3.5" />}
                            {it.healthStatus.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-xs">
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                            ~{it.velocityPerWeek} / wk
                          </span>
                          <div className="text-[10px] text-zinc-400">
                            {it.quantity === 0
                              ? "Stockout now"
                              : it.runoutDays <= 7
                              ? `Runs out in ${it.runoutDays}d!`
                              : `Safe (${it.runoutDays}d)`}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(it.id, "DECREMENT", 1)}
                              disabled={it.quantity <= 0}
                              className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-30 cursor-pointer"
                              title="Decrement 1 unit"
                            >
                              <Minus className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleQuickAdjust(it.id, "INCREMENT", 1)}
                              className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                              title="Increment 1 unit"
                            >
                              <Plus className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setAdjustTarget(it)
                                setAdjustForm({
                                  action: "SET",
                                  amount: it.quantity,
                                  reason: "MANUAL_RECONCILIATION",
                                  notes: "",
                                })
                                setShowAdjustModal(true)
                              }}
                              className="px-2 py-1 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer"
                            >
                              Adjust
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VARIANT-LEVEL STOCK AUDITING (SIZES & COLORS)                      */}
      {/* ========================================================================= */}
      {activeTab === "variants" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
              <div
                key={it.id}
                className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-sm text-zinc-950 dark:text-zinc-50">{it.productTitle}</h3>
                    <p className="text-xs font-mono text-zinc-500">SKU: {it.sku}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      it.quantity === 0
                        ? "bg-rose-100 text-rose-800"
                        : it.quantity <= it.safetyStock
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {it.quantity} In Stock
                  </span>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Variant Name:</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">{it.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Size / Options:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {it.options?.Size || it.options?.size || "Standard"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Color:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {it.options?.Color || it.options?.color || "Default"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Safety Buffer:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">{it.safetyStock} units</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setAdjustTarget(it)
                    setAdjustForm({
                      action: "SET",
                      amount: it.quantity,
                      reason: "MANUAL_RECONCILIATION",
                      notes: "",
                    })
                    setShowAdjustModal(true)
                  }}
                  className="w-full py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer text-center"
                >
                  Audit Stock / Edit Quantity
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: RESTOCK FORECASTING & PREDICTIVE PURCHASE ORDERS                   */}
      {/* ========================================================================= */}
      {activeTab === "forecast" && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Predictive Restock Forecasting Engine
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                AI algorithms calculate 30-day sales velocity and recommend safety replenishment quantities
              </p>
            </div>

            <button
              onClick={handleGeneratePO}
              disabled={generatingPo}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shadow-xs self-start sm:self-auto shrink-0"
            >
              <ShoppingCart className="w-4 h-4" />
              {generatingPo ? "Generating..." : "Generate Purchase Order (PO)"}
            </button>
          </div>

          {/* Forecasting Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">SKU & Variant</th>
                    <th className="py-3 px-4 text-center">Current Stock</th>
                    <th className="py-3 px-4 text-center">Past 30d Velocity</th>
                    <th className="py-3 px-4">Runout Timeline</th>
                    <th className="py-3 px-4 text-center">Suggested Reorder</th>
                    <th className="py-3 px-4 text-right">Estimated Supplier Cost</th>
                    <th className="py-3 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                  {items
                    .filter((it) => it.healthStatus === "OUT_OF_STOCK" || it.healthStatus === "LOW_STOCK")
                    .map((it) => {
                      const estCost = it.supplierCost * it.suggestedReorder
                      return (
                        <tr key={it.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{it.productTitle}</span>
                            <div className="text-xs font-mono text-zinc-500">
                              {it.name} &middot; SKU: {it.sku}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-rose-600">
                            {it.quantity} units
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono text-xs">
                            {it.velocityPerWeek} units / week
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`text-xs font-bold px-2 py-0.5 rounded ${
                                it.quantity === 0
                                  ? "bg-rose-100 text-rose-800"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {it.quantity === 0 ? "Depleted!" : `Depletes in ~${it.runoutDays} days`}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center font-mono font-bold text-emerald-600">
                            +{it.suggestedReorder} units
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                            {formatInr(estCost)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <button
                              onClick={() => {
                                setAdjustTarget(it)
                                setAdjustForm({
                                  action: "INCREMENT",
                                  amount: it.suggestedReorder,
                                  reason: "RECEIVED_SHIPMENT",
                                  notes: `Quick restock PO intake (+${it.suggestedReorder} units)`,
                                })
                                setShowAdjustModal(true)
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 transition-colors cursor-pointer"
                            >
                              Quick Restock
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Existing Purchase Orders List */}
          {purchaseOrders.length > 0 && (
            <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs space-y-4">
              <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Active Supplier Purchase Orders (PO)
              </h3>

              <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800 text-sm">
                {purchaseOrders.map((po) => (
                  <div key={po.id} className="py-3.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">{po.poNumber}</span>
                        <span className="text-xs px-2 py-0.5 rounded font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {po.status}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{po.supplierName}</p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {formatInr(po.totalCost)}
                      </p>
                      <p className="text-xs text-zinc-500">{po.totalItems} Units across items</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: STOCK ADJUSTMENT LEDGER                                            */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[720px]">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Product Variant</th>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4 text-center">Change</th>
                    <th className="py-3 px-4 text-center">Qty Transition</th>
                    <th className="py-3 px-4">Audit Reason</th>
                    <th className="py-3 px-4">Author & Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <td className="py-3.5 px-4 text-xs font-mono text-zinc-500">
                        {new Date(log.createdAt).toLocaleString("en-IN")}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100">{log.productTitle}</p>
                        <p className="text-xs text-zinc-500">{log.variantName}</p>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {log.sku}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                            log.changeAmount > 0
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.changeAmount > 0 ? `+${log.changeAmount}` : log.changeAmount}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono text-xs text-zinc-600 dark:text-zinc-400">
                        {log.previousQuantity} &rarr; <strong className="text-zinc-900 dark:text-zinc-100">{log.newQuantity}</strong>
                      </td>

                      <td className="py-3.5 px-4">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {log.reason.replace(/_/g, " ")}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                        <p className="font-medium text-zinc-800 dark:text-zinc-200">{log.staffAuthor}</p>
                        <p className="text-[11px] text-zinc-400 italic truncate max-w-[200px]" title={log.notes || ""}>
                          {log.notes || "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── STOCK ADJUSTMENT MODAL ───────────────────────────────────────────── */}
      {showAdjustModal && adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <form
            onSubmit={handleSubmitAdjustment}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">Adjust Inventory Stock</h3>
                <p className="text-xs font-mono text-zinc-500">SKU: {adjustTarget.sku}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <div>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{adjustTarget.productTitle}</p>
              <p className="text-xs text-zinc-500">{adjustTarget.name} &middot; Current: {adjustTarget.quantity} units</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Adjustment Mode
                </label>
                <select
                  value={adjustForm.action}
                  onChange={(e) => setAdjustForm({ ...adjustForm, action: e.target.value })}
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                >
                  <option value="SET">Set Exact Stock</option>
                  <option value="INCREMENT">Add (+) Units</option>
                  <option value="DECREMENT">Deduct (-) Units</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={0}
                  value={adjustForm.amount}
                  onChange={(e) => setAdjustForm({ ...adjustForm, amount: Number(e.target.value) })}
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Audit Reason (Required for Accounting)
              </label>
              <select
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                <option value="RECEIVED_SHIPMENT">Received Shipment / PO Restock</option>
                <option value="ORDER_FULFILLMENT">Order Dispatch Fulfillment</option>
                <option value="MANUAL_RECONCILIATION">Physical Cycle Count Reconciliation</option>
                <option value="DAMAGE_LOSS">Damaged / Expired / Lost Inventory</option>
                <option value="RETURN_RESTOCK">Customer Return Restock</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Internal Remarks / Staff Note
              </label>
              <input
                type="text"
                value={adjustForm.notes}
                onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })}
                placeholder="e.g. Verified by Balaganesh at shelf A4"
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Commit Adjustment to DB
              </button>
              <button
                type="button"
                onClick={() => setShowAdjustModal(false)}
                className="py-2.5 px-4 text-xs font-semibold rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
