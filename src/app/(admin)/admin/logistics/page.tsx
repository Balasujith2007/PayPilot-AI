"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Truck,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ShieldCheck,
  Send,
  Plus,
  Edit2,
  Calendar,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Sliders,
  DollarSign,
  Package,
} from "lucide-react"

type ActiveTab = "radar" | "partners" | "zones" | "rules"

function formatInr(paise: number) {
  return "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

interface ShipmentItem {
  id: string
  orderId: string
  orderNumber: string
  carrier: string
  awbNumber: string
  status: string
  radarStatus: string
  originCity: string
  destinationCity: string
  destinationPincode: string
  state: string
  weightGrams: number
  shippingCharge: number
  serviceType: string
  estimatedDeliveryDate: string
  actualDeliveryDate?: string | null
  delayReason?: string | null
  lastCheckpoint?: string | null
  checkpoints: Array<{
    status: string
    location: string
    timestamp: string
    remarks: string
  }>
  order?: {
    customerName: string
    customerEmail: string
    total: number
  }
}

interface LogisticsPartner {
  id: string
  name: string
  code: string
  trackingUrlTemplate: string
  activeShipments: number
  deliveredShipments: number
  successRate: number
  avgDeliveryDays: number
  rating: number
  isActive: boolean
}

interface DeliveryZone {
  id: string
  pincode: string
  areaName: string
  city: string
  state: string
  zoneType: string
  isServiceable: boolean
  codAvailable: boolean
  expressAvailable: boolean
  standardDays: number
  expressDays: number
  preferredPartner: string
}

interface ShippingRule {
  id: string
  name: string
  code: string
  description: string
  baseFee: number
  freeThreshold: number | null
  estimatedDaysMin: number
  estimatedDaysMax: number
  isActive: boolean
}

export default function AdminLogisticsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("radar")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Radar Shipments State
  const [shipments, setShipments] = useState<ShipmentItem[]>([])
  const [radarMetrics, setRadarMetrics] = useState({
    total: 0,
    inTransit: 0,
    onSchedule: 0,
    delayed: 0,
    attempted: 0,
    rto: 0,
    delivered: 0,
  })
  const [radarFilter, setRadarFilter] = useState("ALL")
  const [carrierFilter, setCarrierFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedShipment, setSelectedShipment] = useState<ShipmentItem | null>(null)

  // Partners State
  const [partners, setPartners] = useState<LogisticsPartner[]>([])

  // Zones State
  const [zones, setZones] = useState<DeliveryZone[]>([])
  const [zoneMetrics, setZoneMetrics] = useState({
    totalPincodes: 0,
    serviceableCount: 0,
    unserviceableCount: 0,
    codAvailableCount: 0,
    expressAvailableCount: 0,
  })
  const [zoneSearch, setZoneSearch] = useState("")
  const [zoneStateFilter, setZoneStateFilter] = useState("ALL")

  // Rules State
  const [rules, setRules] = useState<ShippingRule[]>([])
  const [editingRule, setEditingRule] = useState<ShippingRule | null>(null)

  // Modals
  const [showAddZoneModal, setShowAddZoneModal] = useState(false)
  const [newZone, setNewZone] = useState({
    pincode: "",
    areaName: "",
    city: "",
    state: "Karnataka",
    zoneType: "TIER_1",
    isServiceable: true,
    codAvailable: true,
    expressAvailable: true,
    standardDays: 3,
    expressDays: 1,
    preferredPartner: "Blue Dart Express",
  })

  const [showDelayModal, setShowDelayModal] = useState(false)
  const [delayTarget, setDelayTarget] = useState<ShipmentItem | null>(null)
  const [delayForm, setDelayForm] = useState({
    radarStatus: "DELAYED",
    delayReason: "Heavy Rain / Highway Transit Delay",
    newEdd: "",
    checkpointLocation: "Transit Sorting Hub",
    checkpointRemark: "Transit delayed due to weather advisory; rescheduled by 24 hours.",
  })

  // Fetch Shipments
  const fetchShipments = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (radarFilter !== "ALL") params.set("radarStatus", radarFilter)
      if (carrierFilter !== "ALL") params.set("carrier", carrierFilter)
      if (searchQuery) params.set("search", searchQuery)

      const res = await fetch(`/api/admin/logistics/shipments?${params.toString()}`)
      const data = await res.json()
      if (data.shipments) {
        setShipments(data.shipments)
        setRadarMetrics(data.radar)
      }
    } catch (err) {
      console.error("Failed to load shipments", err)
    }
  }, [radarFilter, carrierFilter, searchQuery])

  // Fetch Partners
  const fetchPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/logistics/partners")
      const data = await res.json()
      if (data.partners) setPartners(data.partners)
    } catch (err) {
      console.error("Failed to load partners", err)
    }
  }, [])

  // Fetch Zones
  const fetchZones = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (zoneStateFilter !== "ALL") params.set("state", zoneStateFilter)
      if (zoneSearch) params.set("search", zoneSearch)

      const res = await fetch(`/api/admin/logistics/zones?${params.toString()}`)
      const data = await res.json()
      if (data.zones) {
        setZones(data.zones)
        setZoneMetrics(data.metrics)
      }
    } catch (err) {
      console.error("Failed to load zones", err)
    }
  }, [zoneStateFilter, zoneSearch])

  // Fetch Rules
  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/logistics/rules")
      const data = await res.json()
      if (data.rules) setRules(data.rules)
    } catch (err) {
      console.error("Failed to load rules", err)
    }
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchShipments(), fetchPartners(), fetchZones(), fetchRules()])
    setLoading(false)
  }, [fetchShipments, fetchPartners, fetchZones, fetchRules])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([fetchShipments(), fetchPartners(), fetchZones(), fetchRules()])
    setRefreshing(false)
  }

  // Toggle Zone Serviceability
  const handleToggleZone = async (zoneId: string, field: "isServiceable" | "codAvailable" | "expressAvailable", currentVal: boolean) => {
    try {
      const res = await fetch(`/api/admin/logistics/zones/${zoneId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !currentVal }),
      })
      if (res.ok) {
        setZones((prev) =>
          prev.map((z) => (z.id === zoneId ? { ...z, [field]: !currentVal } : z))
        )
      }
    } catch (err) {
      console.error("Failed to update zone", err)
    }
  }

  // Save New Zone
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/admin/logistics/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newZone),
      })
      if (res.ok) {
        setShowAddZoneModal(false)
        await fetchZones()
      }
    } catch (err) {
      console.error("Failed to create zone", err)
    }
  }

  // Submit Delay Update
  const handleSubmitDelay = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!delayTarget) return
    try {
      const res = await fetch(`/api/admin/logistics/shipments/${delayTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          radarStatus: delayForm.radarStatus,
          delayReason: delayForm.delayReason,
          estimatedDeliveryDate: delayForm.newEdd || delayTarget.estimatedDeliveryDate,
          checkpointLocation: delayForm.checkpointLocation,
          checkpointRemark: delayForm.checkpointRemark,
        }),
      })
      if (res.ok) {
        setShowDelayModal(false)
        setDelayTarget(null)
        await fetchShipments()
      }
    } catch (err) {
      console.error("Failed to submit delay", err)
    }
  }

  // Save Rule Edits
  const handleSaveRule = async (ruleId: string, baseFeeRupees: number, freeThresholdRupees: number | null) => {
    try {
      const res = await fetch("/api/admin/logistics/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ruleId,
          baseFee: baseFeeRupees * 100,
          freeThreshold: freeThresholdRupees !== null ? freeThresholdRupees * 100 : null,
        }),
      })
      if (res.ok) {
        setEditingRule(null)
        await fetchRules()
      }
    } catch (err) {
      console.error("Failed to update rule", err)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Shipping, Logistics & Delivery Operations
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Real-time delivery status radar, courier allocation, pincode serviceability & shipping rules
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-emerald-500" : ""}`} />
            Sync Radar
          </button>
        </div>
      </div>

      {/* Delay / Critical Alerts Warning Banner */}
      {radarMetrics.delayed > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {radarMetrics.delayed} Shipment{radarMetrics.delayed > 1 ? "s" : ""} Experiencing Transit Delays
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                Weather blockades & carrier logistics delays detected. Automated delay alerts dispatched to customers.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab("radar")
              setRadarFilter("DELAYED")
            }}
            className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
          >
            Inspect Delayed Shipments
          </button>
        </div>
      )}

      {/* Logistics Radar Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3.5">
        {/* On Schedule */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">On Schedule</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
            {radarMetrics.onSchedule}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">In-transit, on track for EDD</p>
        </div>

        {/* Delayed */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-800 dark:text-amber-400">Delayed</span>
            <AlertTriangle className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-amber-900 dark:text-amber-300 mt-2">
            {radarMetrics.delayed}
          </p>
          <p className="text-[10px] sm:text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-1 truncate">Transit route delay</p>
        </div>

        {/* Attempted Delivery */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-400">Attempted</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-blue-900 dark:text-blue-300 mt-2">
            {radarMetrics.attempted}
          </p>
          <p className="text-[10px] sm:text-[11px] text-blue-700/80 dark:text-blue-400/80 mt-1 truncate">Rescheduled attempt</p>
        </div>

        {/* RTO / Returns */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-400">RTO</span>
            <XCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-900 dark:text-rose-300 mt-2">
            {radarMetrics.rto}
          </p>
          <p className="text-[10px] sm:text-[11px] text-rose-700/80 dark:text-rose-400/80 mt-1 truncate">Returned to hub</p>
        </div>

        {/* Delivered */}
        <div className="p-3.5 sm:p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-500">Delivered</span>
            <Package className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-zinc-950 dark:text-zinc-50 mt-2">
            {radarMetrics.delivered}
          </p>
          <p className="text-[10px] sm:text-[11px] text-zinc-400 mt-1 truncate">Signed & settled</p>
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
          <Truck className="w-4 h-4" />
          Delivery Status Radar ({shipments.length})
        </button>

        <button
          onClick={() => setActiveTab("partners")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "partners"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          Courier Partners ({partners.length})
        </button>

        <button
          onClick={() => setActiveTab("zones")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "zones"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <MapPin className="w-4 h-4" />
          Pincodes & Serviceability ({zones.length})
        </button>

        <button
          onClick={() => setActiveTab("rules")}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === "rules"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Sliders className="w-4 h-4" />
          Shipping Rules & Charges
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DELIVERY STATUS RADAR                                              */}
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
                placeholder="Search AWB tracking #, order #, city, or pincode..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={radarFilter}
                onChange={(e) => setRadarFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Radar Statuses</option>
                <option value="ON_SCHEDULE">On Schedule</option>
                <option value="DELAYED">Delayed</option>
                <option value="ATTEMPTED">Attempted</option>
                <option value="RTO">RTO</option>
                <option value="DELIVERED">Delivered</option>
              </select>

              <select
                value={carrierFilter}
                onChange={(e) => setCarrierFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All Courier Partners</option>
                <option value="Blue Dart Express">Blue Dart Express</option>
                <option value="Delhivery Logistics">Delhivery Logistics</option>
                <option value="Shadowfax Express">Shadowfax Express</option>
                <option value="DTDC Express">DTDC Express</option>
              </select>
            </div>
          </div>

          {/* Shipments Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[760px]">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3.5 px-4">AWB & Order Reference</th>
                    <th className="py-3.5 px-4">Courier Partner</th>
                    <th className="py-3.5 px-4">Destination</th>
                    <th className="py-3.5 px-4">Estimated Delivery (EDD)</th>
                    <th className="py-3.5 px-4">Radar Status</th>
                    <th className="py-3.5 px-4">Latest Checkpoint</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        Scanning shipment radar...
                      </td>
                    </tr>
                  ) : shipments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-zinc-500">
                        No shipments found matching criteria.
                      </td>
                    </tr>
                  ) : (
                    shipments.map((s) => {
                      const isDelayed = s.radarStatus === "DELAYED"
                      return (
                        <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-xs text-zinc-950 dark:text-zinc-50">
                              {s.awbNumber}
                            </span>
                            <div className="text-[11px] text-zinc-500 font-mono">
                              Order: {s.orderNumber}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">{s.carrier}</span>
                            <div className="text-[11px] text-zinc-500 font-mono">{s.serviceType}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <p className="font-medium text-zinc-900 dark:text-zinc-100">
                              {s.destinationCity}, {s.state}
                            </p>
                            <p className="text-xs text-zinc-500 font-mono">PIN: {s.destinationPincode}</p>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                              <span className="font-mono font-medium text-xs text-zinc-800 dark:text-zinc-200">
                                {new Date(s.estimatedDeliveryDate).toLocaleDateString("en-IN", {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                            {isDelayed && (
                              <span className="text-[10px] font-bold text-amber-600 block mt-0.5">
                                Delay: +24h to 48h
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                                s.radarStatus === "ON_SCHEDULE"
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                  : s.radarStatus === "DELAYED"
                                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                  : s.radarStatus === "ATTEMPTED"
                                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                                  : s.radarStatus === "RTO"
                                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                              }`}
                            >
                              {s.radarStatus === "ON_SCHEDULE" && <CheckCircle2 className="w-3 h-3" />}
                              {s.radarStatus === "DELAYED" && <AlertTriangle className="w-3 h-3" />}
                              {s.radarStatus === "ATTEMPTED" && <Clock className="w-3 h-3" />}
                              {s.radarStatus === "RTO" && <XCircle className="w-3 h-3" />}
                              {s.radarStatus}
                            </span>
                            {s.delayReason && (
                              <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px] truncate" title={s.delayReason}>
                                {s.delayReason}
                              </p>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-zinc-600 dark:text-zinc-400 max-w-[180px]">
                            <p className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                              {s.lastCheckpoint || "Sort Center"}
                            </p>
                            <p className="text-[10px] text-zinc-400">
                              {s.checkpoints?.[s.checkpoints.length - 1]?.remarks || "En-route"}
                            </p>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedShipment(s)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer"
                              >
                                Timeline
                              </button>

                              <button
                                onClick={() => {
                                  setDelayTarget(s)
                                  setDelayForm({
                                    radarStatus: s.radarStatus,
                                    delayReason: s.delayReason || "Severe Rain / Highway Transit Delay",
                                    newEdd: new Date(s.estimatedDeliveryDate).toISOString().slice(0, 10),
                                    checkpointLocation: s.lastCheckpoint || "Transit Hub",
                                    checkpointRemark: "Status updated by logistics team",
                                  })
                                  setShowDelayModal(true)
                                }}
                                className="p-1 rounded-lg text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors cursor-pointer"
                                title="Update EDD & Delay Reasons"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
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
      {/* TAB 2: COURIER & LOGISTICS PARTNERS                                       */}
      {/* ========================================================================= */}
      {activeTab === "partners" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((p) => (
              <div
                key={p.id}
                className="p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">{p.name}</h3>
                    <span className="font-mono text-xs text-zinc-400">Code: {p.code}</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      p.isActive
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {p.isActive ? "Active Fleet" : "Inactive"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 bg-zinc-50 dark:bg-zinc-950/50 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 text-xs">
                  <div>
                    <span className="text-zinc-400">Success Rate:</span>
                    <p className="font-mono font-bold text-emerald-600 text-sm">{p.successRate}%</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Average Turnaround:</span>
                    <p className="font-mono font-bold text-zinc-800 dark:text-zinc-200 text-sm">
                      {p.avgDeliveryDays} Days
                    </p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Active In-Transit:</span>
                    <p className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{p.activeShipments}</p>
                  </div>
                  <div>
                    <span className="text-zinc-400">Reliability Rating:</span>
                    <p className="font-mono font-bold text-amber-600">★ {p.rating} / 5.0</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-zinc-500 font-mono">Total Delivered: {p.deliveredShipments}</span>
                  <a
                    href={p.trackingUrlTemplate}
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-600 hover:underline flex items-center gap-1 font-semibold"
                  >
                    Partner Portal <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DELIVERY ZONES & PINCODE SERVICEABILITY                             */}
      {/* ========================================================================= */}
      {activeTab === "zones" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                value={zoneSearch}
                onChange={(e) => setZoneSearch(e.target.value)}
                placeholder="Search PIN code, area, city, or state..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={zoneStateFilter}
                onChange={(e) => setZoneStateFilter(e.target.value)}
                className="px-3 py-2 text-sm rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="ALL">All States</option>
                <option value="Karnataka">Karnataka</option>
                <option value="Maharashtra">Maharashtra</option>
                <option value="Delhi">Delhi</option>
                <option value="Tamil Nadu">Tamil Nadu</option>
                <option value="Telangana">Telangana</option>
                <option value="West Bengal">West Bengal</option>
                <option value="Kerala">Kerala</option>
                <option value="Jammu & Kashmir">Jammu & Kashmir</option>
              </select>

              <button
                onClick={() => setShowAddZoneModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 transition-colors cursor-pointer shadow-xs whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Add PIN Code
              </button>
            </div>
          </div>

          {/* Zones Table */}
          <div className="rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[760px]">
                <thead className="bg-zinc-50 dark:bg-zinc-950/50 border-b border-zinc-200/80 dark:border-zinc-800 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">PIN Code</th>
                    <th className="py-3 px-4">Area & City</th>
                    <th className="py-3 px-4">State</th>
                    <th className="py-3 px-4 text-center">Zone Tier</th>
                    <th className="py-3 px-4 text-center">Delivery Service</th>
                    <th className="py-3 px-4 text-center">COD</th>
                    <th className="py-3 px-4 text-center">Express Air</th>
                    <th className="py-3 px-4 text-center">Est. Days</th>
                    <th className="py-3 px-4">Preferred Courier</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200/80 dark:divide-zinc-800 font-normal">
                  {zones.map((z) => (
                    <tr key={z.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-zinc-950 dark:text-zinc-50">
                        {z.pincode}
                      </td>

                      <td className="py-3 px-4">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{z.areaName}</p>
                        <p className="text-xs text-zinc-500">{z.city}</p>
                      </td>

                      <td className="py-3 px-4 text-zinc-700 dark:text-zinc-300">{z.state}</td>

                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          {z.zoneType}
                        </span>
                      </td>

                      {/* Serviceable Switch */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleZone(z.id, "isServiceable", z.isServiceable)}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-bold cursor-pointer transition-colors ${
                            z.isServiceable
                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                          }`}
                        >
                          {z.isServiceable ? "Serviceable" : "Blocked"}
                        </button>
                      </td>

                      {/* COD Switch */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleZone(z.id, "codAvailable", z.codAvailable)}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-medium cursor-pointer transition-colors ${
                            z.codAvailable
                              ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40"
                              : "text-zinc-400 bg-zinc-100 dark:bg-zinc-800 line-through"
                          }`}
                        >
                          {z.codAvailable ? "COD ON" : "NO COD"}
                        </button>
                      </td>

                      {/* Express Switch */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleToggleZone(z.id, "expressAvailable", z.expressAvailable)}
                          className={`px-2 py-0.5 rounded text-xs font-mono font-medium cursor-pointer transition-colors ${
                            z.expressAvailable
                              ? "text-blue-700 bg-blue-50 dark:bg-blue-950/40"
                              : "text-zinc-400 bg-zinc-100 dark:bg-zinc-800"
                          }`}
                        >
                          {z.expressAvailable ? "Express ON" : "Std Only"}
                        </button>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {z.standardDays}d Std &middot; {z.expressDays}d Exp
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        {z.preferredPartner}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: SHIPPING RULES & DYNAMIC CHARGE THRESHOLDS                         */}
      {/* ========================================================================= */}
      {activeTab === "rules" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {rules.map((r) => (
              <div
                key={r.id}
                className="p-6 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {r.code}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      r.isActive ? "bg-emerald-500/10 text-emerald-600" : "bg-zinc-100 text-zinc-400"
                    }`}
                  >
                    {r.isActive ? "Active Rule" : "Disabled"}
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-lg text-zinc-950 dark:text-zinc-50">{r.name}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{r.description}</p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200/60 dark:border-zinc-800/60 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Base Shipping Charge:</span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-zinc-50">
                      {formatInr(r.baseFee)}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Free Delivery Above:</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {r.freeThreshold ? formatInr(r.freeThreshold) : "Not Applicable"}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-zinc-500">Estimated Delivery:</span>
                    <span className="font-mono text-zinc-700 dark:text-zinc-300">
                      {r.estimatedDaysMin}-{r.estimatedDaysMax} Business Days
                    </span>
                  </div>
                </div>

                {editingRule?.id === r.id ? (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-zinc-500 block mb-1">Base Fee (₹)</label>
                        <input
                          type="number"
                          defaultValue={r.baseFee / 100}
                          id={`fee-${r.id}`}
                          className="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-zinc-500 block mb-1">Free Above (₹)</label>
                        <input
                          type="number"
                          defaultValue={r.freeThreshold ? r.freeThreshold / 100 : ""}
                          placeholder="None"
                          id={`thresh-${r.id}`}
                          className="w-full p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          const feeInput = document.getElementById(`fee-${r.id}`) as HTMLInputElement
                          const threshInput = document.getElementById(`thresh-${r.id}`) as HTMLInputElement
                          const fee = Number(feeInput.value || 0)
                          const thresh = threshInput.value ? Number(threshInput.value) : null
                          handleSaveRule(r.id, fee, thresh)
                        }}
                        className="flex-1 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
                      >
                        Save DB
                      </button>
                      <button
                        onClick={() => setEditingRule(null)}
                        className="py-1.5 px-3 text-xs rounded-lg border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingRule(r)}
                    className="w-full py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Configure Rates & Thresholds
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── TIMELINE & CHECKPOINTS DRAWER ────────────────────────────────────── */}
      {selectedShipment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <div className="relative w-full max-w-xl bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                  Shipment Checkpoints & Timeline
                </h3>
                <p className="font-mono text-xs text-zinc-500">AWB: {selectedShipment.awbNumber}</p>
              </div>
              <button
                onClick={() => setSelectedShipment(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {selectedShipment.checkpoints.map((cp, idx) => (
                <div key={idx} className="flex items-start gap-3 relative">
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 ring-4 ring-emerald-100 dark:ring-emerald-950" />
                    {idx < selectedShipment.checkpoints.length - 1 && (
                      <div className="w-0.5 h-12 bg-zinc-200 dark:bg-zinc-800 my-1" />
                    )}
                  </div>
                  <div className="flex-1 pb-2">
                    <p className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">{cp.status}</p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400">{cp.location}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 italic">{cp.remarks}</p>
                    <p className="text-[10px] text-zinc-400 font-mono mt-1">
                      {new Date(cp.timestamp).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── UPDATE EDD & DELAY MODAL ────────────────────────────────────────── */}
      {showDelayModal && delayTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <form
            onSubmit={handleSubmitDelay}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Update Delivery Radar & EDD
              </h3>
              <button
                type="button"
                onClick={() => setShowDelayModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Radar Operational Status
              </label>
              <select
                value={delayForm.radarStatus}
                onChange={(e) => setDelayForm({ ...delayForm, radarStatus: e.target.value })}
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                <option value="ON_SCHEDULE">On Schedule</option>
                <option value="DELAYED">Delayed</option>
                <option value="ATTEMPTED">Attempted Delivery (Consignee Unavailable)</option>
                <option value="RTO">Return to Origin (RTO)</option>
                <option value="DELIVERED">Delivered & Signed</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Delay Reason / Description
              </label>
              <input
                type="text"
                value={delayForm.delayReason}
                onChange={(e) => setDelayForm({ ...delayForm, delayReason: e.target.value })}
                placeholder="e.g. Heavy Rain / Highway Transit Delay"
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Revised Estimated Delivery Date (EDD)
              </label>
              <input
                type="date"
                value={delayForm.newEdd}
                onChange={(e) => setDelayForm({ ...delayForm, newEdd: e.target.value })}
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Checkpoint Location
              </label>
              <input
                type="text"
                value={delayForm.checkpointLocation}
                onChange={(e) => setDelayForm({ ...delayForm, checkpointLocation: e.target.value })}
                placeholder="e.g. Pune Hub / Mumbai Sorting Center"
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Save & Update Radar
              </button>
              <button
                type="button"
                onClick={() => setShowDelayModal(false)}
                className="py-2.5 px-4 text-xs font-semibold rounded-xl border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── ADD NEW PINCODE MODAL ────────────────────────────────────────────── */}
      {showAddZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4">
          <form
            onSubmit={handleCreateZone}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl p-4 sm:p-6 shadow-2xl border border-zinc-200 dark:border-zinc-800 space-y-4 max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
              <h3 className="font-bold text-base text-zinc-950 dark:text-zinc-50">
                Add PIN Code Serviceability Rule
              </h3>
              <button
                type="button"
                onClick={() => setShowAddZoneModal(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-900"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  6-Digit PIN Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={newZone.pincode}
                  onChange={(e) => setNewZone({ ...newZone, pincode: e.target.value })}
                  placeholder="560001"
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Zone Tier
                </label>
                <select
                  value={newZone.zoneType}
                  onChange={(e) => setNewZone({ ...newZone, zoneType: e.target.value })}
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                >
                  <option value="METRO">Metro</option>
                  <option value="TIER_1">Tier 1</option>
                  <option value="TIER_2">Tier 2</option>
                  <option value="REMOTE">Remote</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Area / Locality
                </label>
                <input
                  type="text"
                  required
                  value={newZone.areaName}
                  onChange={(e) => setNewZone({ ...newZone, areaName: e.target.value })}
                  placeholder="e.g. Indiranagar"
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  City
                </label>
                <input
                  type="text"
                  required
                  value={newZone.city}
                  onChange={(e) => setNewZone({ ...newZone, city: e.target.value })}
                  placeholder="e.g. Bengaluru"
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                State
              </label>
              <input
                type="text"
                required
                value={newZone.state}
                onChange={(e) => setNewZone({ ...newZone, state: e.target.value })}
                placeholder="e.g. Karnataka"
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Standard Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={14}
                  value={newZone.standardDays}
                  onChange={(e) => setNewZone({ ...newZone, standardDays: Number(e.target.value) })}
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                  Express Days
                </label>
                <input
                  type="number"
                  min={1}
                  max={7}
                  value={newZone.expressDays}
                  onChange={(e) => setNewZone({ ...newZone, expressDays: Number(e.target.value) })}
                  className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block mb-1">
                Preferred Courier Partner
              </label>
              <select
                value={newZone.preferredPartner}
                onChange={(e) => setNewZone({ ...newZone, preferredPartner: e.target.value })}
                className="w-full p-2.5 text-sm rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950"
              >
                <option value="Blue Dart Express">Blue Dart Express</option>
                <option value="Delhivery Logistics">Delhivery Logistics</option>
                <option value="Shadowfax Express">Shadowfax Express</option>
                <option value="DTDC Express">DTDC Express</option>
                <option value="India Post Speed Post">India Post Speed Post</option>
              </select>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Save PIN Code to DB
              </button>
              <button
                type="button"
                onClick={() => setShowAddZoneModal(false)}
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

