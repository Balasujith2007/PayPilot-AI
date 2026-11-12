"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  TrendingUp,
  ShoppingCart,
  Percent,
  CreditCard,
  Smartphone,
  Building,
  Banknote,
  AlertTriangle,
  ArrowUpRight,
  Filter,
  Package,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Tag,
  Boxes,
  Truck,
  Layers,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { formatPrice } from "@/lib/utils"
import { toast } from "sonner"

type TimeRange = "today" | "7d" | "30d" | "all"
type TrendFrequency = "daily" | "weekly" | "monthly"
type ProductSort = "units" | "revenue"

interface AnalyticsData {
  timeRange: string
  kpis: {
    grossSales: number
    voucherDiscounts: number
    taxesCollected: number
    shippingCollected: number
    netSales: number
    totalOrdersCount: number
    completedOrders: number
    aov: number
  }
  paymentBreakdown: Array<{
    name: string
    mode: string
    amount: number
    transactions: number
    percentage: number
  }>
  trends: {
    daily: Array<{ label: string; gross: number; net: number }>
    weekly: Array<{ label: string; gross: number; net: number }>
    monthly: Array<{ label: string; gross: number; net: number }>
  }
  bestSellers: Array<{
    id: string
    name: string
    category: string
    image: string
    price: number
    unitsSold: number
    revenue: number
    stock: number
    growth: string
  }>
  slowMovingProducts: Array<{
    id: string
    name: string
    sku: string
    stock: number
    price: number
    velocity: string
    daysInStock: number
    suggestedDiscount: string
  }>
  categoryStats: Array<{
    name: string
    units: number
    revenue: number
    revenueRatio: number
  }>
  stageCounts: Record<string, number>
}

export default function AdminAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d")
  const [trendFreq, setTrendFreq] = useState<TrendFrequency>("daily")
  const [productSort, setProductSort] = useState<ProductSort>("revenue")
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch genuine database analytics from Neon PostgreSQL
  const loadAnalytics = useCallback(async (range: TimeRange) => {
    try {
      setLoading(true)
      const res = await fetch(`/api/admin/analytics?timeRange=${range}`)
      const json = await res.json()
      if (json.success) {
        setData(json)
      } else {
        toast.error("Failed to load analytics telemetry from database")
      }
    } catch {
      toast.error("Network error loading analytics")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAnalytics(timeRange)
  }, [timeRange, loadAnalytics])

  const kpis = data?.kpis || {
    grossSales: 0,
    voucherDiscounts: 0,
    taxesCollected: 0,
    shippingCollected: 0,
    netSales: 0,
    totalOrdersCount: 0,
    completedOrders: 0,
    aov: 0,
  }

  // Trend data points from database
  const activeTrends = useMemo(() => {
    if (!data?.trends) return []
    return data.trends[trendFreq] || []
  }, [data, trendFreq])

  const maxTrendVal = useMemo(() => {
    if (!activeTrends || activeTrends.length === 0) return 1
    return Math.max(...activeTrends.map((d) => Math.max(d.gross, d.net)), 1)
  }, [activeTrends])

  // Payment Breakdown with visual icons and colors
  const paymentBreakdown = useMemo(() => {
    if (!data?.paymentBreakdown) return []
    return data.paymentBreakdown.map((pm) => {
      let icon = Smartphone
      let color = "bg-emerald-500"
      let badge: string | undefined = undefined

      if (pm.mode === "UPI") {
        icon = Smartphone
        color = "bg-emerald-500"
        badge = "Preferred"
      } else if (pm.mode === "CARD") {
        icon = CreditCard
        color = "bg-blue-500"
      } else if (pm.mode === "NETBANKING") {
        icon = Building
        color = "bg-amber-500"
      } else if (pm.mode === "COD") {
        icon = Banknote
        color = "bg-purple-500"
      }

      return {
        ...pm,
        icon,
        color,
        badge,
      }
    })
  }, [data])

  // Best sellers sorted according to active sort
  const sortedBestSellers = useMemo(() => {
    if (!data?.bestSellers) return []
    return [...data.bestSellers].sort((a, b) =>
      productSort === "revenue" ? b.revenue - a.revenue : b.unitsSold - a.unitsSold
    )
  }, [data, productSort])

  return (
    <div className="space-y-8 pb-12">
      {/* ── TOP HEADER WITH TIMEFRAME FILTERS ───────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="Store Analytics & BI"
          description="Real-time revenue telemetry, conversion funnels, category performance & shopping intelligence from Neon PostgreSQL."
        />

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => loadAnalytics(timeRange)}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer shrink-0"
            title="Refresh database telemetry"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          <div className="flex items-center gap-1 rounded-full bg-white p-1 border border-black/10 shadow-xs overflow-x-auto max-w-full">
            <Filter className="size-3.5 text-black/50 ml-1.5 mr-0.5 shrink-0" />
            {(
              [
                { key: "today", label: "Today" },
                { key: "7d", label: "7 Days" },
                { key: "30d", label: "30 Days" },
                { key: "all", label: "All Time" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTimeRange(t.key)}
                className={`rounded-full px-2.5 sm:px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  timeRange === t.key
                    ? "bg-black text-white shadow-xs"
                    : "text-black/60 hover:text-black hover:bg-[#F0EEED]"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── SECTION 1: REAL-TIME REVENUE & SALES PERFORMANCE ─────────────────── */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-black flex items-center gap-2">
              <TrendingUp className="size-4 sm:size-5 text-black" />
              <span>Real-Time Revenue & Sales Performance</span>
            </h3>
            <p className="text-xs text-black/60">
              Live financial accounting matching gross checkouts, coupon deductions and realized net intake.
            </p>
          </div>
          <span className="self-start sm:self-auto text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Neon DB Live Sync
          </span>
        </div>

        {/* 6 Executive KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* Gross Sales */}
          <Card className="rounded-[18px] border-black/10 bg-white shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-black/60">Gross Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-black tabular-nums">
                {formatPrice(kpis.grossSales)}
              </p>
              <p className="text-[10px] text-black/50 mt-1">Pre-discount item subtotal</p>
            </CardContent>
          </Card>

          {/* Discounts / Vouchers */}
          <Card className="rounded-[18px] border-amber-200 bg-amber-50/50 shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-amber-900 flex items-center justify-between">
                <span>Vouchers & Promos</span>
                <Tag className="size-3 text-amber-700" />
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-amber-950 tabular-nums">
                -{formatPrice(kpis.voucherDiscounts)}
              </p>
              <p className="text-[10px] text-amber-800/80 mt-1">Voucher savings applied</p>
            </CardContent>
          </Card>

          {/* Taxes & Shipping */}
          <Card className="rounded-[18px] border-black/10 bg-white shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-black/60">Tax & Shipping</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-black tabular-nums">
                {formatPrice(kpis.taxesCollected + kpis.shippingCollected)}
              </p>
              <p className="text-[10px] text-black/50 mt-1">
                GST: {formatPrice(kpis.taxesCollected)}
              </p>
            </CardContent>
          </Card>

          {/* Net Sales */}
          <Card className="rounded-[18px] border-black bg-black text-white shadow-xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-white/70">Net Realized Sales</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-white tabular-nums">
                {formatPrice(kpis.netSales)}
              </p>
              <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1 font-semibold">
                <ArrowUpRight className="size-3" /> Live DB Realized Intake
              </p>
            </CardContent>
          </Card>

          {/* Average Order Value (AOV) */}
          <Card className="rounded-[18px] border-black/10 bg-white shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-black/60">Avg Order Value (AOV)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-black tabular-nums">
                {formatPrice(kpis.aov)}
              </p>
              <p className="text-[10px] text-black/50 mt-1">Per completed order</p>
            </CardContent>
          </Card>

          {/* Total Completed Orders */}
          <Card className="rounded-[18px] border-black/10 bg-white shadow-2xs">
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-xs font-semibold text-black/60">Completed Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <p className="text-xl font-black text-black tabular-nums">
                {kpis.completedOrders}
              </p>
              <p className="text-[10px] text-black/50 mt-1">
                {kpis.totalOrdersCount} total placed in DB
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Visual Revenue Trend Chart + Payment Methods Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Trend Visualizer */}
          <Card className="lg:col-span-2 rounded-[20px] border-black/10 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <div>
                  <h4 className="font-bold text-base text-black">Revenue Velocity Trends</h4>
                  <p className="text-xs text-black/60">
                    Comparing Gross Order Value vs. Realized Net Intake from Neon PostgreSQL
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-full bg-[#F0EEED] p-1 self-start">
                  {(["daily", "weekly", "monthly"] as const).map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() => setTrendFreq(freq)}
                      className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-all cursor-pointer ${
                        trendFreq === freq
                          ? "bg-black text-white shadow-xs"
                          : "text-black/60 hover:text-black"
                      }`}
                    >
                      {freq}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bar Chart Visualization */}
              <div className="h-56 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-black/10">
                {activeTrends.map((d, i) => {
                  const grossHeight = Math.max(8, Math.round((d.gross / maxTrendVal) * 100))
                  const netHeight = Math.max(8, Math.round((d.net / maxTrendVal) * 100))

                  return (
                    <div
                      key={i}
                      className="group flex-1 flex flex-col items-center gap-1.5 h-full justify-end relative"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity absolute -top-12 z-20 rounded-lg bg-black text-white px-2 py-1 text-[11px] whitespace-nowrap shadow-lg">
                        <p className="font-bold">{d.label}</p>
                        <p className="text-[10px] text-white/80">Net: {formatPrice(d.net)}</p>
                      </div>

                      {/* Bar Pair */}
                      <div className="w-full max-w-[42px] flex items-end justify-center gap-1 h-full">
                        {/* Gross Bar */}
                        <div
                          style={{ height: `${grossHeight}%` }}
                          className="w-1/2 rounded-t-md bg-[#F0EEED] group-hover:bg-black/20 transition-all"
                          title={`Gross: ${formatPrice(d.gross)}`}
                        />
                        {/* Net Bar */}
                        <div
                          style={{ height: `${netHeight}%` }}
                          className="w-1/2 rounded-t-md bg-black group-hover:bg-black/85 transition-all shadow-2xs"
                          title={`Net: ${formatPrice(d.net)}`}
                        />
                      </div>

                      <span className="text-[11px] font-semibold text-black/60 mt-1">{d.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-black/60">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-[#F0EEED] border border-black/10" />
                  <span>Gross Order Value</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-black" />
                  <strong className="text-black font-semibold">Net Realized Revenue</strong>
                </span>
              </div>
              <span className="text-[11px] text-black/50">Computed from real database orders</span>
            </div>
          </Card>

          {/* Payment Methods Breakdown */}
          <Card className="rounded-[20px] border-black/10 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold text-base text-black flex items-center gap-2">
                  <CreditCard className="size-4" />
                  <span>Payment Methods</span>
                </h4>
                <span className="text-xs text-black/50">By Revenue Share</span>
              </div>

              {/* Progress bar visualizing breakdown */}
              <div className="h-3 w-full rounded-full bg-black/5 overflow-hidden flex mb-5">
                {paymentBreakdown.map((p, i) => (
                  <div
                    key={i}
                    style={{ width: `${p.percentage}%` }}
                    className={`${p.color} h-full transition-all`}
                    title={`${p.name}: ${p.percentage}%`}
                  />
                ))}
              </div>

              {/* List */}
              <div className="space-y-3">
                {paymentBreakdown.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-[#F0EEED]/40 hover:bg-[#F0EEED] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`size-2.5 rounded-full ${p.color}`} />
                      <div>
                        <p className="text-xs font-bold text-black flex items-center gap-1.5">
                          <span>{p.name.split("(")[0]}</span>
                          {p.badge && (
                            <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-full font-semibold">
                              {p.badge}
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-black/50">
                          {p.transactions} orders completed
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-xs font-bold text-black tabular-nums">{formatPrice(p.amount)}</p>
                      <p className="text-[10px] font-semibold text-black/60">{p.percentage}% share</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/5 text-[11px] text-black/50 flex items-center justify-between">
              <span>UPI & Cards represent core intake</span>
              <span className="font-semibold text-emerald-700">100% DB Verified</span>
            </div>
          </Card>
        </div>
      </div>

      {/* ── SECTION 2: CATEGORY & PRODUCT PERFORMANCE ────────────────────────── */}
      <div className="space-y-6 pt-4 border-t border-black/10">
        <div>
          <h3 className="text-lg font-bold text-black flex items-center gap-2">
            <Package className="size-5 text-black" />
            <span>Category & Product Performance</span>
          </h3>
          <p className="text-xs text-black/60">
            Top catalog drivers, slow-moving velocity warnings, and sales distribution by category from DB.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top 10 Best Sellers Table */}
          <Card className="lg:col-span-2 rounded-[20px] border-black/10 bg-white p-5 sm:p-6 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h4 className="font-bold text-base text-black">Top 10 Best-Selling Products</h4>
                <p className="text-xs text-black/60">
                  Highest volume and revenue drivers calculated from real OrderItems
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-full bg-[#F0EEED] p-1 self-start">
                <button
                  type="button"
                  onClick={() => setProductSort("revenue")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    productSort === "revenue"
                      ? "bg-black text-white shadow-xs"
                      : "text-black/60 hover:text-black"
                  }`}
                >
                  By Revenue
                </button>
                <button
                  type="button"
                  onClick={() => setProductSort("units")}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    productSort === "units"
                      ? "bg-black text-white shadow-xs"
                      : "text-black/60 hover:text-black"
                  }`}
                >
                  By Units Sold
                </button>
              </div>
            </div>

            {/* Product Table */}
            <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
              <table className="w-full min-w-[540px] text-left text-xs">
                <thead>
                  <tr className="border-b border-black/10 text-black/50 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-2.5 pl-1">Rank</th>
                    <th className="py-2.5">Product</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5 text-right">Units Sold</th>
                    <th className="py-2.5 text-right">Unit Price</th>
                    <th className="py-2.5 text-right pr-1">Total Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {sortedBestSellers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-black/50">
                        No product order telemetry recorded yet
                      </td>
                    </tr>
                  ) : (
                    sortedBestSellers.map((item, index) => (
                      <tr key={item.id} className="hover:bg-[#F0EEED]/40 transition-colors">
                        <td className="py-2.5 pl-1 font-bold text-black/60">
                          {index === 0 ? (
                            <span className="size-5 rounded-full bg-amber-400 text-black font-black flex items-center justify-center text-[10px]">
                              1
                            </span>
                          ) : (
                            `#${index + 1}`
                          )}
                        </td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-2.5">
                            {item.image ? (
                              <div className="relative size-8 rounded-lg overflow-hidden bg-[#F0EEED] shrink-0 border border-black/5">
                                <Image
                                  src={item.image}
                                  alt={item.name}
                                  fill
                                  unoptimized={Boolean(item.image.startsWith("data:") || item.image.startsWith("http"))}
                                  className="object-cover"
                                />
                              </div>
                            ) : (
                              <div className="size-8 rounded-lg bg-[#F0EEED] flex items-center justify-center shrink-0">
                                <Package className="size-4 text-black/40" />
                              </div>
                            )}
                            <span className="font-semibold text-black line-clamp-1 max-w-[190px]">
                              {item.name}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 text-black/70">
                          <span className="rounded-md bg-black/5 px-2 py-0.5 text-[10px] font-medium">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-semibold text-black tabular-nums">
                          {item.unitsSold}
                        </td>
                        <td className="py-2.5 text-right text-black/70 tabular-nums">
                          {formatPrice(item.price)}
                        </td>
                        <td className="py-2.5 text-right pr-1 font-bold text-black tabular-nums">
                          {formatPrice(item.revenue)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Category Performance & Velocity Alerts */}
          <div className="space-y-6">
            {/* Category Performance Card */}
            <Card className="rounded-[20px] border-black/10 bg-white p-5 shadow-xs">
              <h4 className="font-bold text-sm text-black mb-1 flex items-center gap-1.5">
                <Percent className="size-4" />
                <span>Category Revenue Distribution</span>
              </h4>
              <p className="text-[11px] text-black/60 mb-3.5">
                Realized intake grouped by store category
              </p>

              <div className="space-y-2.5">
                {(data?.categoryStats || []).map((c) => (
                  <div key={c.name} className="p-2.5 rounded-xl border border-black/5 bg-[#F0EEED]/30">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-black">{c.name}</span>
                      <span className="font-black text-black bg-black/10 px-2 py-0.5 rounded-full text-[10px]">
                        {Math.round((c.revenueRatio || 0) * 100)}% Share
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-black/60">
                      <span>{c.units} Units Sold</span>
                      <span className="font-bold text-black tabular-nums">{formatPrice(c.revenue)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Slow-Moving Inventory Alert */}
            <Card className="rounded-[20px] border-amber-300 bg-amber-50/70 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-sm text-amber-950 flex items-center gap-1.5">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Slow-Moving Velocity Warning</span>
                </h4>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  PROMO CANDIDATES
                </span>
              </div>
              <p className="text-[11px] text-amber-900/80 mb-3">
                Items with low or zero sales in this window. Candidates for scheduled flash sales.
              </p>

              <div className="space-y-2">
                {(data?.slowMovingProducts || []).map((p) => (
                  <div
                    key={p.id}
                    className="p-2.5 rounded-xl bg-white border border-amber-200/80 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <p className="font-bold text-black line-clamp-1">{p.name}</p>
                      <p className="text-[10px] text-red-600 font-medium">
                        {p.velocity} • Stock: {p.stock}
                      </p>
                    </div>

                    <Link
                      href="/admin/coupons"
                      className="shrink-0 rounded-full bg-black text-white px-2.5 py-1 text-[10px] font-semibold hover:bg-black/85 active:scale-95 transition-all"
                    >
                      Flash Sale ({p.suggestedDiscount})
                    </Link>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: ORDER LIFECYCLE & FULFILLMENT DISTRIBUTION ────────────── */}
      <div className="space-y-6 pt-4 border-t border-black/10">
        <div>
          <h3 className="text-lg font-bold text-black flex items-center gap-2">
            <ShoppingCart className="size-5 text-black" />
            <span>Order Lifecycle & Operations Radar</span>
          </h3>
          <p className="text-xs text-black/60">
            Real order stages tracked directly across Neon PostgreSQL tables.
          </p>
        </div>

        {/* 5-Stage Live Status Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3.5">
          <Card className="rounded-[18px] border-black/10 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">Delivered</span>
            <p className="text-2xl font-black text-emerald-700 mt-1 tabular-nums">
              {data?.stageCounts?.DELIVERED || 0}
            </p>
            <p className="text-[10px] text-black/50 mt-1">Successfully fulfilled</p>
          </Card>

          <Card className="rounded-[18px] border-black/10 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">In Transit / Shipped</span>
            <p className="text-2xl font-black text-blue-700 mt-1 tabular-nums">
              {data?.stageCounts?.SHIPPED || 0}
            </p>
            <p className="text-[10px] text-black/50 mt-1">With courier partner</p>
          </Card>

          <Card className="rounded-[18px] border-black/10 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">Processing / Packed</span>
            <p className="text-2xl font-black text-amber-700 mt-1 tabular-nums">
              {data?.stageCounts?.PROCESSING || 0}
            </p>
            <p className="text-[10px] text-black/50 mt-1">At fulfillment desk</p>
          </Card>

          <Card className="rounded-[18px] border-black/10 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">Pending Confirmation</span>
            <p className="text-2xl font-black text-black mt-1 tabular-nums">
              {data?.stageCounts?.PENDING || 0}
            </p>
            <p className="text-[10px] text-black/50 mt-1">Awaiting dispatch</p>
          </Card>

          <Card className="rounded-[18px] border-black/10 bg-white p-4 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-black/50">Cancelled / Refunded</span>
            <p className="text-2xl font-black text-red-600 mt-1 tabular-nums">
              {data?.stageCounts?.CANCELLED || 0}
            </p>
            <p className="text-[10px] text-black/50 mt-1">Settled & returned</p>
          </Card>
        </div>
      </div>
    </div>
  )
}
