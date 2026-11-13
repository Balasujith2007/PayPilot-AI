"use client"

import { useState, useEffect, useCallback } from "react"
import {
  FileText,
  DollarSign,
  Receipt,
  Download,
  Printer,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Tag,
  TrendingUp,
  Percent,
  ShieldCheck,
  Building2,
  CreditCard,
  ArrowUpRight,
  ExternalLink,
} from "lucide-react"
import { TaxInvoiceModal, type InvoiceData } from "@/components/admin/tax-invoice-modal"

type ActiveTab = "invoices" | "coupons" | "settlements"

function formatInr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AdminBillingPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("invoices")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Invoices state
  const [invoices, setInvoices] = useState<InvoiceData[]>([])
  const [invoiceMetrics, setInvoiceMetrics] = useState({
    grossInvoiced: 0,
    totalTaxCollected: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
    totalDiscountGiven: 0,
    totalInvoices: 0,
  })
  const [invoiceSearch, setInvoiceSearch] = useState("")
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState("ALL")
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)

  // Coupons audit state
  const [couponsAudit, setCouponsAudit] = useState<{
    summary: {
      totalDiscountExpense: number
      totalGrossRevenue: number
      totalNetRevenue: number
      overallRoi: number
      totalRedemptions: number
    }
    breakdown: Array<{
      code: string
      title: string
      discountType: string
      redemptionCount: number
      totalDiscountGiven: number
      totalOrderRevenue: number
      netRevenue: number
      roiMultiplier: number
      avgOrderValue: number
    }>
    recentRedemptions: Array<{
      id: string
      couponCode: string
      orderNumber: string
      customerEmail: string
      orderTotal: number
      discountAmount: number
      createdAt: string
    }>
  } | null>(null)

  // Settlements state
  const [settlements, setSettlements] = useState<Array<{
    id: string
    orderId: string
    orderNumber: string
    gateway: string
    gatewayTxnId: string
    amount: number
    currency: string
    fee: number
    taxOnFee: number
    netPayout: number
    status: string
    paymentMethod: string
    bankReference: string | null
    settledAt: string | null
    createdAt: string
  }>>([])
  const [settlementMetrics, setSettlementMetrics] = useState({
    totalCaptured: 0,
    totalFees: 0,
    totalTaxOnFees: 0,
    totalNetPayout: 0,
    pendingSettlement: 0,
    refundedVolume: 0,
    totalTransactions: 0,
  })
  const [gatewayFilter, setGatewayFilter] = useState("ALL")
  const [settlementStatusFilter, setSettlementStatusFilter] = useState("ALL")
  const [settlementSearch, setSettlementSearch] = useState("")
  const [reconcilingId, setReconcilingId] = useState<string | null>(null)

  // Fetch Invoices
  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (invoiceSearch) params.set("search", invoiceSearch)
      if (invoiceStatusFilter !== "ALL") params.set("status", invoiceStatusFilter)

      const res = await fetch(`/api/admin/billing/invoices?${params.toString()}`)
      const data = await res.json()
      if (data.invoices) {
        setInvoices(data.invoices)
        setInvoiceMetrics(data.metrics)
      }
    } catch (err) {
      console.error("Failed to load invoices", err)
    }
  }, [invoiceSearch, invoiceStatusFilter])

  // Fetch Coupons Audit
  const fetchCouponsAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/billing/coupons-audit")
      const data = await res.json()
      if (data.summary) {
        setCouponsAudit(data)
      }
    } catch (err) {
      console.error("Failed to load coupons audit", err)
    }
  }, [])

  // Fetch Settlements
  const fetchSettlements = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (gatewayFilter !== "ALL") params.set("gateway", gatewayFilter)
      if (settlementStatusFilter !== "ALL") params.set("status", settlementStatusFilter)
      if (settlementSearch) params.set("search", settlementSearch)

      const res = await fetch(`/api/admin/billing/settlements?${params.toString()}`)
      const data = await res.json()
      if (data.settlements) {
        setSettlements(data.settlements)
        setSettlementMetrics(data.metrics)
      }
    } catch (err) {
      console.error("Failed to load settlements", err)
    }
  }, [gatewayFilter, settlementStatusFilter, settlementSearch])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchInvoices(), fetchCouponsAudit(), fetchSettlements()])
    setLoading(false)
  }, [fetchInvoices, fetchCouponsAudit, fetchSettlements])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchInvoices(), fetchCouponsAudit(), fetchSettlements()])
    setRefreshing(false)
  }

  // Handle inline single reconciliation
  const handleReconcile = async (settlementId: string) => {
    try {
      setReconcilingId(settlementId)
      const res = await fetch("/api/admin/billing/settlements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: [settlementId],
          status: "RECONCILED",
        }),
      })
      if (res.ok) {
        await fetchSettlements()
      }
    } catch (err) {
      console.error("Failed to reconcile settlement", err)
    } finally {
      setReconcilingId(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Billing, Invoicing & Financial Accounting
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Indian GST tax invoices, voucher expense audit & payment gateway reconciliation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
            Sync & Refresh
          </button>
        </div>
      </div>

      {/* Financial Health KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Invoiced Value */}
        <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Total Invoiced Value
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 font-mono mt-3">
            {formatInr(invoiceMetrics.grossInvoiced)}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-zinc-500">
            <span className="font-semibold text-emerald-600">{invoiceMetrics.totalInvoices} Invoices Issued</span>
            <span>&middot;</span>
            <span>100% GST compliant</span>
          </div>
        </div>

        {/* Card 2: GST Tax Liability */}
        <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              GST Tax Collected
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 font-mono mt-3">
            {formatInr(invoiceMetrics.totalTaxCollected)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              CGST: {formatInr(invoiceMetrics.totalCgst)}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
              IGST: {formatInr(invoiceMetrics.totalIgst)}
            </span>
          </div>
        </div>

        {/* Card 3: Voucher Expenditure & ROI */}
        <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Discount Savings Given
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Tag className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 font-mono mt-3">
            {formatInr(couponsAudit?.summary?.totalDiscountExpense || invoiceMetrics.totalDiscountGiven)}
          </p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-600 font-medium">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>ROI Multiplier: {couponsAudit?.summary?.overallRoi || 0}x sales generated</span>
          </div>
        </div>

        {/* Card 4: Net Payout Received */}
        <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Net Bank Payouts
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-bold text-zinc-950 dark:text-zinc-50 font-mono mt-3">
            {formatInr(settlementMetrics.totalNetPayout)}
          </p>
          <div className="flex items-center justify-between mt-2 text-xs text-zinc-500">
            <span>Fees: -{formatInr(settlementMetrics.totalFees + settlementMetrics.totalTaxOnFees)}</span>
            <span className="text-emerald-600 font-medium">Reconciled</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto whitespace-nowrap scrollbar-none pb-0.5">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "invoices"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Receipt className="w-4 h-4" />
          Automated Tax Invoices ({invoiceMetrics.totalInvoices})
        </button>

        <button
          onClick={() => setActiveTab("coupons")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "coupons"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Tag className="w-4 h-4" />
          Discount & Coupon Expenditure Audit
        </button>

        <button
          onClick={() => setActiveTab("settlements")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === "settlements"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Payment Settlement & Reconciliation ({settlementMetrics.totalTransactions})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AUTOMATED TAX INVOICES                                            */}
      {/* ========================================================================= */}
      {activeTab === "invoices" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                placeholder="Search invoice number, customer name, email or state..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="PAID">Paid</option>
                <option value="ISSUED">Issued</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
          </div>

          {/* Invoices Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4">Invoice #</th>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Customer & Supply State</th>
                    <th className="py-3.5 px-4 text-right">Taxable Subtotal</th>
                    <th className="py-3.5 px-4 text-right">GST Breakdown</th>
                    <th className="py-3.5 px-4 text-right">Invoice Total</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Loading GST Tax Invoices...
                      </td>
                    </tr>
                  ) : invoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        No invoices match your query.
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => {
                      const totalTax = inv.cgstTotal + inv.sgstTotal + inv.igstTotal
                      return (
                        <tr key={inv.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                              {inv.invoiceNumber}
                            </span>
                            <div className="text-[11px] font-mono text-zinc-400">
                              Order: {inv.order?.orderNumber || inv.orderId}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400">
                            {new Date(inv.issuedAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">{inv.customerName}</p>
                            <p className="text-xs text-zinc-500 flex items-center gap-1">
                              <span>{inv.placeOfSupply}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 font-mono">
                                {inv.isInterState ? "IGST (Inter-State)" : "CGST+SGST (Intra-State)"}
                              </span>
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-zinc-700 dark:text-zinc-300">
                            {formatInr(inv.subtotal)}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
                              +{formatInr(totalTax)}
                            </span>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              {inv.isInterState
                                ? `IGST: ${formatInr(inv.igstTotal)}`
                                : `C+S: ${formatInr(inv.cgstTotal * 2)}`}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-zinc-950 dark:text-zinc-50">
                            {formatInr(inv.total)}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                inv.status === "PAID"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : inv.status === "REFUNDED"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {inv.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={() => setSelectedInvoice(inv)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer shadow-xs"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              Print / PDF
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DISCOUNT & COUPON EXPENDITURE AUDIT                                */}
      {/* ========================================================================= */}
      {activeTab === "coupons" && couponsAudit && (
        <div className="space-y-6">
          {/* Coupon Summary Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Total Customer Savings
              </span>
              <p className="text-2xl font-bold font-mono text-amber-600 mt-2">
                {formatInr(couponsAudit.summary.totalDiscountExpense)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Direct voucher deductions funded</p>
            </div>

            <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Gross Sales Driven
              </span>
              <p className="text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
                {formatInr(couponsAudit.summary.totalGrossRevenue)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Orders with promo vouchers</p>
            </div>

            <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Net Realized Sales
              </span>
              <p className="text-2xl font-bold font-mono text-emerald-600 mt-2">
                {formatInr(couponsAudit.summary.totalNetRevenue)}
              </p>
              <p className="text-xs text-zinc-500 mt-1">Gross sales minus discount cost</p>
            </div>

            <div className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Overall Campaign ROI
              </span>
              <p className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-2">
                {couponsAudit.summary.overallRoi}x
              </p>
              <p className="text-xs text-zinc-500 mt-1">₹ revenue earned per ₹ discount spent</p>
            </div>
          </div>

          {/* ROI Matrix Table per Coupon Code */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-zinc-200/80 dark:border-zinc-800">
              <h3 className="font-semibold text-base text-zinc-950 dark:text-zinc-50">
                Voucher ROI & Revenue Performance Matrix
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                Financial return on investment comparing marketing discount expense to gross GMV
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">Coupon Code</th>
                    <th className="py-3 px-4">Campaign Title</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4 text-center">Redemptions</th>
                    <th className="py-3 px-4 text-right">Customer Savings</th>
                    <th className="py-3 px-4 text-right">Gross GMV Driven</th>
                    <th className="py-3 px-4 text-right">Net Revenue</th>
                    <th className="py-3 px-4 text-right">Campaign ROI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800">
                  {couponsAudit.breakdown.map((item) => (
                    <tr key={item.code} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-emerald-700 dark:text-emerald-400">
                          {item.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-mono uppercase text-zinc-500">
                        {item.discountType}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-zinc-900 dark:text-zinc-100">
                        {item.redemptionCount}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-amber-600">
                        {formatInr(item.totalDiscountGiven)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-zinc-900 dark:text-zinc-100">
                        {formatInr(item.totalOrderRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                        {formatInr(item.netRevenue)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800">
                          {item.roiMultiplier}x ROI
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Audit Log */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs">
            <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500" />
              Recent Voucher Redemptions Audit Log
            </h3>
            <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800 text-xs">
              {couponsAudit.recentRedemptions.map((r) => (
                <div key={r.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <span className="font-mono font-bold text-emerald-600 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40">
                      {r.couponCode}
                    </span>
                    <span className="font-mono text-zinc-500">Order: {r.orderNumber}</span>
                    <span className="text-zinc-600 dark:text-zinc-400">({r.customerEmail})</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-[11px] sm:text-xs">
                    <span className="text-zinc-500">Order: {formatInr(r.orderTotal)}</span>
                    <span className="font-bold text-amber-600">Saved: -{formatInr(r.discountAmount)}</span>
                    <span className="text-zinc-400">
                      {new Date(r.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PAYMENT SETTLEMENT & RECONCILIATION                                */}
      {/* ========================================================================= */}
      {activeTab === "settlements" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={settlementSearch}
                onChange={(e) => setSettlementSearch(e.target.value)}
                placeholder="Search transaction ID, order # or bank UTR..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={gatewayFilter}
                onChange={(e) => setGatewayFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Gateways</option>
                <option value="Razorpay">Razorpay</option>
                <option value="PhonePe">PhonePe</option>
                <option value="UPI">Direct UPI</option>
                <option value="Cashfree">Cashfree</option>
              </select>

              <select
                value={settlementStatusFilter}
                onChange={(e) => setSettlementStatusFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="RECONCILED">Reconciled</option>
                <option value="CAPTURED">Captured</option>
                <option value="REFUNDED">Refunded</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
          </div>

          {/* Settlements Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[740px] text-left text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4">Gateway Txn ID</th>
                    <th className="py-3.5 px-4">Order #</th>
                    <th className="py-3.5 px-4">Gateway & Mode</th>
                    <th className="py-3.5 px-4 text-right">Gross Amount</th>
                    <th className="py-3.5 px-4 text-right">Fee + GST</th>
                    <th className="py-3.5 px-4 text-right">Net Bank Payout</th>
                    <th className="py-3.5 px-4">Bank UTR / Reference</th>
                    <th className="py-3.5 px-4 text-center">Status</th>
                    <th className="py-3.5 px-4 text-right">Reconcile</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Loading Payment Settlements...
                      </td>
                    </tr>
                  ) : settlements.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-zinc-500">
                        No settlements found.
                      </td>
                    </tr>
                  ) : (
                    settlements.map((s) => {
                      const totalFee = s.fee + s.taxOnFee
                      return (
                        <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-zinc-950 dark:text-zinc-50">
                            {s.gatewayTxnId}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {s.orderNumber}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.gateway}</span>
                            <div className="text-[11px] text-zinc-500 font-mono">{s.paymentMethod}</div>
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-medium text-zinc-900 dark:text-zinc-100">
                            {formatInr(s.amount)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono text-xs text-rose-600">
                            -{formatInr(totalFee)}
                          </td>

                          <td className="py-3.5 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {formatInr(s.netPayout)}
                          </td>

                          <td className="py-3.5 px-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">
                            {s.bankReference || "Pending UTR"}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                s.status === "RECONCILED"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : s.status === "CAPTURED"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  : s.status === "REFUNDED"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              }`}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              {s.status}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            {s.status !== "RECONCILED" ? (
                              <button
                                onClick={() => handleReconcile(s.id)}
                                disabled={reconcilingId === s.id}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer"
                              >
                                {reconcilingId === s.id ? "Reconciling..." : "Reconcile"}
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-400">Settled</span>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Official Tax Invoice Print & Download Modal */}
      {selectedInvoice && (
        <TaxInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}

