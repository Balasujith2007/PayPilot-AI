"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Tag,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  X,
  Percent,
  Calendar,
  Sparkles,
  Flame,
  Megaphone,
  Clock,
  Layers,
  ShoppingBag,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  TrendingUp,
} from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { Card } from "@/components/ui/card"
import { formatPrice, formatDate } from "@/lib/utils"
import { toast } from "sonner"

interface Coupon {
  id: string
  code: string
  title: string
  description: string
  discountType: "fixed" | "percentage"
  discountValue: number // in cents/paise or percentage
  minOrderValue: number | null
  maxDiscountAmount: number | null
  targetScenario: string
  targetCategorySlug: string | null
  targetBrandSlug: string | null
  firstPurchaseOnly: boolean
  isActive: boolean
  usageLimit: number | null
  usedCount: number
  startDate: string | null
  expiresAt: string | null
  createdAt: string
}

interface FlashSale {
  id: string
  title: string
  slug: string
  description: string | null
  discountType: string
  discountValue: number
  appliesTo: "STOREWIDE" | "CATEGORY" | "BRAND"
  targetCategorySlug: string | null
  targetBrandSlug: string | null
  bannerBadge: string | null
  bannerHeadline: string | null
  accentColor: string
  startsAt: string
  endsAt: string
  isActive: boolean
  createdAt: string
}

interface PromotionalBanner {
  id: string
  title: string
  message: string
  promoCode: string | null
  linkText: string | null
  linkUrl: string | null
  badgeText: string | null
  backgroundColor: string
  textColor: string
  priority: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

export default function AdminPromotionsPage() {
  const [activeTab, setActiveTab] = useState<"coupons" | "flash-sales" | "banners">("coupons")
  
  // Data states
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [flashSales, setFlashSales] = useState<FlashSale[]>([])
  const [banners, setBanners] = useState<PromotionalBanner[]>([])
  const [loading, setLoading] = useState(true)

  // Filter states
  const [scenarioFilter, setScenarioFilter] = useState<string>("ALL")

  // Modal states
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false)
  const [isFlashModalOpen, setIsFlashModalOpen] = useState(false)
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Coupon Form state
  const [formCode, setFormCode] = useState("")
  const [formTitle, setFormTitle] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formType, setFormType] = useState<"fixed" | "percentage">("fixed")
  const [formValue, setFormValue] = useState("500")
  const [formMinOrder, setFormMinOrder] = useState("1999")
  const [formMaxDiscount, setFormMaxDiscount] = useState("")
  const [formScenario, setFormScenario] = useState("FESTIVAL_SPECIAL")
  const [formCategorySlug, setFormCategorySlug] = useState("")
  const [formUsageLimit, setFormUsageLimit] = useState("1000")
  const [formExpiryDate, setFormExpiryDate] = useState("")

  // Flash Sale Form state
  const [flashTitle, setFlashTitle] = useState("")
  const [flashDiscountValue, setFlashDiscountValue] = useState("25")
  const [flashAppliesTo, setFlashAppliesTo] = useState<"STOREWIDE" | "CATEGORY">("STOREWIDE")
  const [flashCategorySlug, setFlashCategorySlug] = useState("electronics")
  const [flashBadge, setFlashBadge] = useState("DIWALI SPECIAL")
  const [flashHeadline, setFlashHeadline] = useState("")
  const [flashAccentColor, setFlashAccentColor] = useState("#E11D48")
  const [flashStartDate, setFlashStartDate] = useState(
    new Date().toISOString().slice(0, 16)
  )
  const [flashEndDate, setFlashEndDate] = useState(
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 16)
  )

  // Banner Form state
  const [bannerTitle, setBannerTitle] = useState("")
  const [bannerMessage, setBannerMessage] = useState("")
  const [bannerCode, setBannerCode] = useState("")
  const [bannerLinkText, setBannerLinkText] = useState("Shop Festive Sale")
  const [bannerLinkUrl, setBannerLinkUrl] = useState("/shop")
  const [bannerBadgeText, setBannerBadgeText] = useState("LIMITED TIME")
  const [bannerBgColor, setBannerBgColor] = useState("#000000")
  const [bannerTextColor, setBannerTextColor] = useState("#FFFFFF")

  // Countdown timer for active flash sale
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number }>({
    d: 0,
    h: 0,
    m: 0,
    s: 0,
  })

  // Load all data
  const loadAllData = useCallback(async () => {
    try {
      setLoading(true)
      const [couponsRes, flashRes, bannersRes] = await Promise.all([
        fetch("/api/admin/coupons"),
        fetch("/api/admin/promotions/flash-sales"),
        fetch("/api/admin/promotions/banners"),
      ])

      const couponsData = await couponsRes.json()
      const flashData = await flashRes.json()
      const bannersData = await bannersRes.json()

      if (couponsData.success) setCoupons(couponsData.coupons || [])
      if (flashData.flashSales) setFlashSales(flashData.flashSales || [])
      if (bannersData.success) setBanners(bannersData.banners || [])
    } catch {
      toast.error("Network error loading promotional engine data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Timer loop for active flash sale
  useEffect(() => {
    const activeFlash = flashSales.find((f) => f.isActive && new Date(f.endsAt) > new Date())
    if (!activeFlash) return

    const interval = setInterval(() => {
      const diff = new Date(activeFlash.endsAt).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 })
      } else {
        const d = Math.floor(diff / (1000 * 60 * 60 * 24))
        const h = Math.floor((diff / (1000 * 60 * 60)) % 24)
        const m = Math.floor((diff / 1000 / 60) % 60)
        const s = Math.floor((diff / 1000) % 60)
        setTimeLeft({ d, h, m, s })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [flashSales])

  // ── COUPON ACTIONS ────────────────────────────────────────────────────────
  const handleToggleCoupon = async (c: Coupon) => {
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !c.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Coupon ${c.code} is now ${!c.isActive ? "Active" : "Paused"}`)
        loadAllData()
      } else {
        toast.error("Failed to update coupon status")
      }
    } catch {
      toast.error("Error toggling coupon")
    }
  }

  const handleDeleteCoupon = async (c: Coupon) => {
    if (!confirm(`Delete coupon voucher ${c.code} permanently from database?`)) return
    try {
      const res = await fetch(`/api/admin/coupons/${c.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast.success(`Voucher ${c.code} deleted`)
        loadAllData()
      } else {
        toast.error("Failed to delete coupon")
      }
    } catch {
      toast.error("Error deleting coupon")
    }
  }

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formCode.trim() || !formTitle.trim()) {
      toast.error("Code and Title are required")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formCode.trim().toUpperCase(),
          title: formTitle.trim(),
          description: formDescription.trim(),
          discountType: formType,
          discountValue: parseFloat(formValue) || 10,
          minOrderValue: formMinOrder ? parseFloat(formMinOrder) : null,
          maxDiscountAmount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
          targetScenario: formScenario,
          targetCategorySlug: formCategorySlug.trim() || null,
          usageLimit: formUsageLimit ? parseInt(formUsageLimit) : null,
          expiresAt: formExpiryDate ? new Date(formExpiryDate).toISOString() : null,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Voucher "${formCode.toUpperCase()}" created in Neon PostgreSQL!`)
        setIsCouponModalOpen(false)
        setFormCode("")
        setFormTitle("")
        setFormDescription("")
        setFormMaxDiscount("")
        loadAllData()
      } else {
        toast.error(data.error || "Failed to create coupon")
      }
    } catch {
      toast.error("Network error creating coupon")
    } finally {
      setSaving(false)
    }
  }

  // ── FLASH SALE ACTIONS ────────────────────────────────────────────────────
  const handleToggleFlashSale = async (fs: FlashSale) => {
    try {
      const res = await fetch(`/api/admin/promotions/flash-sales/${fs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !fs.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Flash sale "${fs.title}" is now ${!fs.isActive ? "Active" : "Paused"}`)
        loadAllData()
      } else {
        toast.error("Failed to update flash sale")
      }
    } catch {
      toast.error("Error updating flash sale")
    }
  }

  const handleDeleteFlashSale = async (fs: FlashSale) => {
    if (!confirm(`Delete flash sale "${fs.title}"?`)) return
    try {
      const res = await fetch(`/api/admin/promotions/flash-sales/${fs.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast.success("Flash sale deleted")
        loadAllData()
      } else {
        toast.error("Failed to delete flash sale")
      }
    } catch {
      toast.error("Error deleting flash sale")
    }
  }

  const handleCreateFlashSale = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!flashTitle.trim() || !flashDiscountValue) {
      toast.error("Title and Discount % are required")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/admin/promotions/flash-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: flashTitle.trim(),
          discountValue: parseFloat(flashDiscountValue),
          appliesTo: flashAppliesTo,
          targetCategorySlug: flashAppliesTo === "CATEGORY" ? flashCategorySlug : null,
          bannerBadge: flashBadge.trim() || "FLASH SALE",
          bannerHeadline: flashHeadline.trim() || `${flashTitle}: ${flashDiscountValue}% OFF!`,
          accentColor: flashAccentColor,
          startsAt: new Date(flashStartDate).toISOString(),
          endsAt: new Date(flashEndDate).toISOString(),
          isActive: true,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success(`Flash Sale "${flashTitle}" scheduled & active!`)
        setIsFlashModalOpen(false)
        setFlashTitle("")
        setFlashHeadline("")
        loadAllData()
      } else {
        toast.error(data.error || "Failed to schedule flash sale")
      }
    } catch {
      toast.error("Network error scheduling flash sale")
    } finally {
      setSaving(false)
    }
  }

  // ── BANNER ACTIONS ────────────────────────────────────────────────────────
  const handleToggleBanner = async (b: PromotionalBanner) => {
    try {
      const res = await fetch(`/api/admin/promotions/banners/${b.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !b.isActive }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Banner "${b.title}" is now ${!b.isActive ? "Active" : "Paused"}`)
        loadAllData()
      } else {
        toast.error("Failed to update banner")
      }
    } catch {
      toast.error("Error updating banner")
    }
  }

  const handleDeleteBanner = async (b: PromotionalBanner) => {
    if (!confirm(`Delete banner "${b.title}"?`)) return
    try {
      const res = await fetch(`/api/admin/promotions/banners/${b.id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        toast.success("Banner deleted")
        loadAllData()
      } else {
        toast.error("Failed to delete banner")
      }
    } catch {
      toast.error("Error deleting banner")
    }
  }

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!bannerTitle.trim() || !bannerMessage.trim()) {
      toast.error("Title and Message are required")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/admin/promotions/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: bannerTitle.trim(),
          message: bannerMessage.trim(),
          promoCode: bannerCode.trim() || null,
          linkText: bannerLinkText.trim() || "Shop Now",
          linkUrl: bannerLinkUrl.trim() || "/shop",
          badgeText: bannerBadgeText.trim() || "OFFER",
          backgroundColor: bannerBgColor,
          textColor: bannerTextColor,
          isActive: true,
          priority: 2,
        }),
      })

      const data = await res.json()
      if (data.success) {
        toast.success("Promotional banner published to storefront!")
        setIsBannerModalOpen(false)
        setBannerTitle("")
        setBannerMessage("")
        setBannerCode("")
        loadAllData()
      } else {
        toast.error(data.error || "Failed to create banner")
      }
    } catch {
      toast.error("Network error creating banner")
    } finally {
      setSaving(false)
    }
  }

  // Filtered coupons
  const filteredCoupons = coupons.filter((c) => {
    if (scenarioFilter === "ALL") return true
    return c.targetScenario === scenarioFilter
  })

  // Summary Metrics
  const activeCouponsCount = coupons.filter((c) => c.isActive).length
  const activeFlashSalesCount = flashSales.filter((f) => f.isActive).length
  const totalRedemptions = coupons.reduce((sum, c) => sum + (c.usedCount || 0), 0)

  return (
    <div className="space-y-6 pb-12">
      {/* ── HEADER ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-black/10 pb-5">
        <PageHeader
          title="Promotions, Vouchers & Pricing Engine"
          description="Campaign creator with scenario targeting, scheduled flash sales without editing product codes, and storefront announcement banners."
        />

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
          <button
            type="button"
            onClick={loadAllData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 rounded-full border border-black/10 bg-white p-2.5 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
            title="Refresh database"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {activeTab === "coupons" && (
            <button
              type="button"
              onClick={() => setIsCouponModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-black py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="size-4" />
              <span>Create Voucher Campaign</span>
            </button>
          )}

          {activeTab === "flash-sales" && (
            <button
              type="button"
              onClick={() => setIsFlashModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-rose-600 py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-rose-700 active:scale-95 transition-all cursor-pointer"
            >
              <Flame className="size-4" />
              <span>Schedule Flash Sale</span>
            </button>
          )}

          {activeTab === "banners" && (
            <button
              type="button"
              onClick={() => setIsBannerModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-black py-2.5 px-5 text-xs font-bold text-white shadow-xs hover:bg-black/85 active:scale-95 transition-all cursor-pointer"
            >
              <Megaphone className="size-4" />
              <span>New Announcement Banner</span>
            </button>
          )}
        </div>
      </div>

      {/* ── METRICS SUMMARY BAR ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
        <Card className="rounded-[20px] border-black/10 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/50">
              Active Vouchers
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Tag className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
            {activeCouponsCount} <span className="text-xs font-normal text-black/50">/ {coupons.length}</span>
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-black/60 truncate">Neon PostgreSQL</p>
        </Card>

        <Card className="rounded-[20px] border-black/10 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/50">
              Flash Sales
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <Flame className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-rose-600 tabular-nums">
            {activeFlashSalesCount} Active
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-black/60 truncate">Zero code edits</p>
        </Card>

        <Card className="rounded-[20px] border-black/10 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/50">
              Redemptions
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <TrendingUp className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
            {totalRedemptions.toLocaleString("en-IN")}
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-black/60 truncate">Orders discounted</p>
        </Card>

        <Card className="rounded-[20px] border-black/10 bg-white p-3.5 sm:p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-black/50">
              Banners
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Megaphone className="size-3.5" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-black tabular-nums">
            {banners.filter((b) => b.isActive).length} Live
          </div>
          <p className="mt-1 text-[10px] sm:text-[11px] text-black/60 truncate">Storefront bar</p>
        </Card>
      </div>

      {/* ── TABS NAVIGATION ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-black/10 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("coupons")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "coupons"
              ? "bg-black text-white shadow-xs"
              : "bg-white text-black/70 hover:bg-[#F0EEED] border border-black/10"
          }`}
        >
          <Tag className="size-3.5" />
          <span>Coupon Campaign Creator</span>
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
            {coupons.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("flash-sales")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "flash-sales"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-white text-black/70 hover:bg-[#F0EEED] border border-black/10"
          }`}
        >
          <Flame className="size-3.5" />
          <span>Flash Sales & Timed Discounts</span>
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
            {flashSales.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("banners")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "banners"
              ? "bg-black text-white shadow-xs"
              : "bg-white text-black/70 hover:bg-[#F0EEED] border border-black/10"
          }`}
        >
          <Megaphone className="size-3.5" />
          <span>Promotional Banners</span>
          <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.2 text-[10px]">
            {banners.length}
          </span>
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: COUPON CAMPAIGN CREATOR                                         */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "coupons" && (
        <div className="space-y-4">
          {/* Scenario Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-black/60 mr-1">Scenario Target:</span>
            {[
              { id: "ALL", label: "All Campaigns" },
              { id: "FIRST_PURCHASE", label: "🌟 First-Time Purchase" },
              { id: "FESTIVAL_SPECIAL", label: "🪔 Festival Specials (Diwali/New Year)" },
              { id: "CATEGORY_SPECIFIC", label: "🏷️ Category-Specific" },
              { id: "GENERAL", label: "🌐 Storewide General" },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScenarioFilter(s.id)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                  scenarioFilter === s.id
                    ? "bg-black text-white"
                    : "bg-white text-black/70 border border-black/10 hover:bg-[#F0EEED]"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Vouchers Table */}
          <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 pl-6">Voucher & Code</th>
                    <th className="py-3.5">Target Scenario</th>
                    <th className="py-3.5">Discount Value</th>
                    <th className="py-3.5">Cart Requirement & Cap</th>
                    <th className="py-3.5">Redemptions / Limit</th>
                    <th className="py-3.5 text-center">Status</th>
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-black/50">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="size-4 animate-spin" />
                          <span>Loading vouchers from Neon PostgreSQL...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredCoupons.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-black/50">
                        <p className="font-semibold text-sm">No vouchers match the selected scenario</p>
                      </td>
                    </tr>
                  ) : (
                    filteredCoupons.map((c) => {
                      const usagePercent = c.usageLimit
                        ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100))
                        : null

                      return (
                        <tr key={c.id} className="hover:bg-[#F0EEED]/30 transition-colors">
                          <td className="py-3.5 pl-6">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono font-black text-xs text-black bg-[#F0EEED] px-2.5 py-1 rounded-md border border-black/10">
                                {c.code}
                              </span>
                              <div>
                                <p className="font-bold text-black text-xs">{c.title}</p>
                                <p className="text-[10px] text-black/50 line-clamp-1">{c.description}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5">
                            {c.targetScenario === "FIRST_PURCHASE" || c.firstPurchaseOnly ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-200">
                                <Sparkles className="size-2.5" />
                                <span>First-Time Purchase</span>
                              </span>
                            ) : c.targetScenario === "FESTIVAL_SPECIAL" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-900 border border-rose-200">
                                <Flame className="size-2.5 text-rose-600" />
                                <span>Festival Special</span>
                              </span>
                            ) : c.targetScenario === "CATEGORY_SPECIFIC" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-900 border border-blue-200">
                                <Layers className="size-2.5 text-blue-600" />
                                <span>Category: {c.targetCategorySlug || "Specific"}</span>
                              </span>
                            ) : (
                              <span className="text-black/50 text-[11px] font-medium">Storewide</span>
                            )}
                          </td>

                          <td className="py-3.5 font-bold text-black tabular-nums">
                            {c.discountType === "percentage" ? (
                              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                {c.discountValue}% OFF
                              </span>
                            ) : (
                              <span className="text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                                {formatPrice(c.discountValue)} FLAT OFF
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 text-black/70 tabular-nums">
                            <div>
                              {c.minOrderValue ? (
                                <span className="font-semibold text-black">
                                  Min: {formatPrice(c.minOrderValue)}
                                </span>
                              ) : (
                                <span className="text-black/40">No minimum</span>
                              )}
                            </div>
                            {c.maxDiscountAmount && (
                              <div className="text-[10px] text-black/50">
                                Max cap: {formatPrice(c.maxDiscountAmount)}
                              </div>
                            )}
                          </td>

                          <td className="py-3.5">
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-bold tabular-nums">
                                <span>{c.usedCount} used</span>
                                {c.usageLimit && <span className="text-black/40">/ {c.usageLimit} max</span>}
                              </div>
                              {c.usageLimit && (
                                <div className="h-1.5 w-24 bg-black/10 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full ${
                                      (usagePercent ?? 0) >= 90 ? "bg-red-500" : "bg-black"
                                    }`}
                                    style={{ width: `${usagePercent}%` }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleCoupon(c)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-all hover:scale-105 ${
                                c.isActive
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-black/5 text-black/50"
                              }`}
                            >
                              {c.isActive ? (
                                <>
                                  <CheckCircle2 className="size-3 text-emerald-600" />
                                  <span>Active</span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="size-3 text-black/40" />
                                  <span>Paused</span>
                                </>
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 pr-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteCoupon(c)}
                              title="Delete voucher"
                              className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: FLASH SALES & TIMED DISCOUNTS                                   */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "flash-sales" && (
        <div className="space-y-6">
          {/* Live Flash Sale Spotlight Card */}
          {flashSales.some((f) => f.isActive && new Date(f.endsAt) > new Date()) && (
            <div className="rounded-[24px] bg-gradient-to-r from-rose-900 via-rose-800 to-black p-6 sm:p-8 text-white shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-black uppercase tracking-wider text-rose-200">
                    <Flame className="size-3.5 text-rose-300 animate-pulse" />
                    <span>Live Flash Sale Active Now</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
                    {flashSales.find((f) => f.isActive)?.title}
                  </h3>
                  <p className="text-sm text-white/80 max-w-xl">
                    {flashSales.find((f) => f.isActive)?.description}
                  </p>
                  <div className="flex items-center gap-3 pt-1">
                    <span className="inline-block rounded-xl bg-white px-3 py-1.5 text-sm font-black text-rose-900">
                      {flashSales.find((f) => f.isActive)?.discountValue}% OFF
                    </span>
                    <span className="text-xs text-white/70">
                      Applies: {flashSales.find((f) => f.isActive)?.appliesTo}
                    </span>
                  </div>
                </div>

                {/* Live Countdown Clock */}
                <div className="rounded-2xl bg-black/40 backdrop-blur-md p-5 border border-white/10 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-white/60 mb-2 uppercase tracking-widest">
                    <Clock className="size-3.5" />
                    <span>Ending In</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="bg-white/10 rounded-xl p-2.5 min-w-[55px]">
                      <div className="text-xl sm:text-2xl font-black tabular-nums">{timeLeft.d}</div>
                      <div className="text-[9px] text-white/60 uppercase">Days</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 min-w-[55px]">
                      <div className="text-xl sm:text-2xl font-black tabular-nums">{timeLeft.h}</div>
                      <div className="text-[9px] text-white/60 uppercase">Hours</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 min-w-[55px]">
                      <div className="text-xl sm:text-2xl font-black tabular-nums">{timeLeft.m}</div>
                      <div className="text-[9px] text-white/60 uppercase">Mins</div>
                    </div>
                    <div className="bg-white/10 rounded-xl p-2.5 min-w-[55px]">
                      <div className="text-xl sm:text-2xl font-black tabular-nums text-rose-300">
                        {timeLeft.s}
                      </div>
                      <div className="text-[9px] text-rose-300 uppercase">Secs</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Flash Sales Table */}
          <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 pl-6">Campaign & Title</th>
                    <th className="py-3.5">Scope & Target</th>
                    <th className="py-3.5">Discount Rate</th>
                    <th className="py-3.5">Timeline (Start → End)</th>
                    <th className="py-3.5 text-center">Status</th>
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-black/50">
                        <RefreshCw className="size-4 animate-spin mx-auto mb-2" />
                        <span>Loading flash sales...</span>
                      </td>
                    </tr>
                  ) : flashSales.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-black/50">
                        No flash sales configured. Click &quot;Schedule Flash Sale&quot; to create one.
                      </td>
                    </tr>
                  ) : (
                    flashSales.map((fs) => {
                      const isExpired = new Date(fs.endsAt) < new Date()
                      const isFuture = new Date(fs.startsAt) > new Date()
                      const isRunning = fs.isActive && !isExpired && !isFuture

                      return (
                        <tr key={fs.id} className="hover:bg-[#F0EEED]/30 transition-colors">
                          <td className="py-3.5 pl-6">
                            <div className="flex items-center gap-3">
                              <div
                                className="size-3.5 rounded-full shrink-0"
                                style={{ backgroundColor: fs.accentColor }}
                              />
                              <div>
                                <p className="font-bold text-black text-xs">{fs.title}</p>
                                <p className="text-[10px] text-black/50 line-clamp-1">{fs.description}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5">
                            <span className="font-bold text-black">
                              {fs.appliesTo === "STOREWIDE"
                                ? "🌐 Storewide Catalog"
                                : `🏷️ Category: ${fs.targetCategorySlug}`}
                            </span>
                          </td>

                          <td className="py-3.5 font-bold text-rose-600 text-sm tabular-nums">
                            {fs.discountValue}% OFF
                          </td>

                          <td className="py-3.5 tabular-nums text-black/70">
                            <div>{formatDate(fs.startsAt)}</div>
                            <div className="text-[10px] text-black/40">to {formatDate(fs.endsAt)}</div>
                          </td>

                          <td className="py-3.5 text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleFlashSale(fs)}
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-all hover:scale-105 ${
                                isRunning
                                  ? "bg-rose-100 text-rose-800 border border-rose-200"
                                  : isExpired
                                  ? "bg-black/5 text-black/40"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {isRunning ? (
                                <>
                                  <Flame className="size-3 text-rose-600 animate-pulse" />
                                  <span>Live Active</span>
                                </>
                              ) : isExpired ? (
                                <span>Expired</span>
                              ) : (
                                <span>Scheduled</span>
                              )}
                            </button>
                          </td>

                          <td className="py-3.5 pr-6 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteFlashSale(fs)}
                              className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: PROMOTIONAL ANNOUNCEMENT BANNERS                                 */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "banners" && (
        <div className="space-y-6">
          {/* Live Preview Box */}
          <Card className="rounded-[20px] border-black/10 bg-white p-5 shadow-xs">
            <h4 className="font-bold text-xs uppercase tracking-wider text-black/60 mb-3">
              Storefront Top Bar Live Preview
            </h4>
            <div className="rounded-xl bg-black text-white p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black uppercase text-white tracking-wider">
                  {banners.find((b) => b.isActive)?.badgeText || "OFFER"}
                </span>
                <span className="font-medium">
                  {banners.find((b) => b.isActive)?.message ||
                    "Diwali Special: Flat 25% OFF Storewide + Extra ₹500 OFF with code DIWALI2026"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {banners.find((b) => b.isActive)?.promoCode && (
                  <span className="font-mono font-bold bg-white/20 px-2 py-0.5 rounded text-[10px]">
                    {banners.find((b) => b.isActive)?.promoCode}
                  </span>
                )}
                <span className="underline text-xs font-semibold cursor-pointer">
                  {banners.find((b) => b.isActive)?.linkText || "Shop Now"}
                </span>
              </div>
            </div>
          </Card>

          {/* Banners Table */}
          <Card className="rounded-[20px] border-black/10 bg-white overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#F0EEED]/40 text-black/60 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3.5 pl-6">Banner Headline & Message</th>
                    <th className="py-3.5">Promo Code</th>
                    <th className="py-3.5">CTA Link</th>
                    <th className="py-3.5">Priority</th>
                    <th className="py-3.5 text-center">Status</th>
                    <th className="py-3.5 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-black/50">
                        <RefreshCw className="size-4 animate-spin mx-auto mb-2" />
                        <span>Loading banners...</span>
                      </td>
                    </tr>
                  ) : banners.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-black/50">
                        No promotional banners configured. Click &quot;New Announcement Banner&quot;.
                      </td>
                    </tr>
                  ) : (
                    banners.map((b) => (
                      <tr key={b.id} className="hover:bg-[#F0EEED]/30 transition-colors">
                        <td className="py-3.5 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="rounded bg-black text-white px-1.5 py-0.5 text-[9px] font-black uppercase">
                              {b.badgeText || "BANNER"}
                            </span>
                            <div>
                              <p className="font-bold text-black text-xs">{b.title}</p>
                              <p className="text-[11px] text-black/60 line-clamp-1">{b.message}</p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5">
                          {b.promoCode ? (
                            <span className="font-mono font-bold bg-[#F0EEED] border border-black/10 px-2 py-0.5 rounded text-[11px]">
                              {b.promoCode}
                            </span>
                          ) : (
                            <span className="text-black/40">—</span>
                          )}
                        </td>

                        <td className="py-3.5 text-black/70">
                          <span className="font-semibold">{b.linkText || "Shop Now"}</span>
                          <span className="text-[10px] text-black/40 block">{b.linkUrl}</span>
                        </td>

                        <td className="py-3.5 font-bold tabular-nums">P{b.priority}</td>

                        <td className="py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleBanner(b)}
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold cursor-pointer transition-all hover:scale-105 ${
                              b.isActive
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-black/5 text-black/40"
                            }`}
                          >
                            {b.isActive ? (
                              <>
                                <CheckCircle2 className="size-3 text-emerald-600" />
                                <span>Active</span>
                              </>
                            ) : (
                              <span>Paused</span>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 pr-6 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteBanner(b)}
                            className="p-1.5 rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 1: CREATE COUPON CAMPAIGN                                       */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isCouponModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-[24px] border border-black/10 bg-white p-4 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Tag className="size-5 text-black" />
                <h3 className="font-bold text-base text-black">Create Coupon Campaign</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCouponModalOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="space-y-4">
              {/* Target Scenario Selector */}
              <div>
                <label className="block text-xs font-bold text-black mb-1">Target Scenario *</label>
                <select
                  value={formScenario}
                  onChange={(e) => {
                    const sc = e.target.value
                    setFormScenario(sc)
                    if (sc === "FIRST_PURCHASE") {
                      setFormCode("WELCOME500")
                      setFormTitle("First-Time Purchase Voucher")
                      setFormValue("500")
                      setFormMinOrder("999")
                    } else if (sc === "FESTIVAL_SPECIAL") {
                      setFormCode("DIWALI2026")
                      setFormTitle("Diwali Festival Mega Voucher")
                      setFormValue("25")
                      setFormType("percentage")
                    }
                  }}
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                >
                  <option value="FESTIVAL_SPECIAL">🪔 Festival Special (Diwali / New Year / Eid)</option>
                  <option value="FIRST_PURCHASE">🌟 First-Time Purchase Voucher</option>
                  <option value="CATEGORY_SPECIFIC">🏷️ Category-Specific Discount</option>
                  <option value="GENERAL">🌐 General Storewide Voucher</option>
                </select>
              </div>

              {formScenario === "CATEGORY_SPECIFIC" && (
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Category Slug *</label>
                  <input
                    type="text"
                    required
                    value={formCategorySlug}
                    onChange={(e) => setFormCategorySlug(e.target.value.toLowerCase())}
                    placeholder="e.g. electronics, apparel, footwear"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Coupon Code *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DIWALI500"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-mono font-bold text-black uppercase focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Campaign Title *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Festival Special Discount"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Description</label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Flat ₹500 OFF on festive orders above ₹1,999"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Discount Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as "fixed" | "percentage")}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    <option value="fixed">Flat Amount (₹)</option>
                    <option value="percentage">Percentage (%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Value {formType === "fixed" ? "(₹)" : "(%)"} *
                  </label>
                  <input
                    type="number"
                    required
                    value={formValue}
                    onChange={(e) => setFormValue(e.target.value)}
                    placeholder={formType === "fixed" ? "500" : "20"}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Min Cart Value (₹)
                  </label>
                  <input
                    type="number"
                    value={formMinOrder}
                    onChange={(e) => setFormMinOrder(e.target.value)}
                    placeholder="1999"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Max Discount Cap (₹) (Optional)
                  </label>
                  <input
                    type="number"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">
                    Max Redemptions Limit
                  </label>
                  <input
                    type="number"
                    value={formUsageLimit}
                    onChange={(e) => setFormUsageLimit(e.target.value)}
                    placeholder="1000"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsCouponModalOpen(false)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-black py-2 px-5 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>Save Campaign to Neon DB</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 2: SCHEDULE FLASH SALE                                          */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isFlashModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-[24px] border border-black/10 bg-white p-4 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Flame className="size-5 text-rose-600" />
                <h3 className="font-bold text-base text-black">Schedule Flash Sale</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFlashModalOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFlashSale} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Flash Sale Title *</label>
                <input
                  type="text"
                  required
                  value={flashTitle}
                  onChange={(e) => setFlashTitle(e.target.value)}
                  placeholder="e.g. Diwali Festive Mega Flash Sale"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Catalog Scope</label>
                  <select
                    value={flashAppliesTo}
                    onChange={(e) => setFlashAppliesTo(e.target.value as "STOREWIDE" | "CATEGORY")}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    <option value="STOREWIDE">🌐 Entire Catalog (Storewide)</option>
                    <option value="CATEGORY">🏷️ Specific Category Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Flash Discount (%) *</label>
                  <input
                    type="number"
                    required
                    value={flashDiscountValue}
                    onChange={(e) => setFlashDiscountValue(e.target.value)}
                    placeholder="25"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              {flashAppliesTo === "CATEGORY" && (
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Category Slug *</label>
                  <input
                    type="text"
                    required
                    value={flashCategorySlug}
                    onChange={(e) => setFlashCategorySlug(e.target.value.toLowerCase())}
                    placeholder="electronics, footwear, etc."
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={flashBadge}
                    onChange={(e) => setFlashBadge(e.target.value)}
                    placeholder="DIWALI SPECIAL"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-bold uppercase text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Accent Theme Color</label>
                  <select
                    value={flashAccentColor}
                    onChange={(e) => setFlashAccentColor(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  >
                    <option value="#E11D48">🌹 Festive Crimson Red (#E11D48)</option>
                    <option value="#2563EB">⚡ Royal Blue (#2563EB)</option>
                    <option value="#16A34A">🌿 Emerald Green (#16A34A)</option>
                    <option value="#9333EA">🔮 Royal Violet (#9333EA)</option>
                    <option value="#EA580C">🔥 Sunset Orange (#EA580C)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Starts At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={flashStartDate}
                    onChange={(e) => setFlashStartDate(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Ends At *</label>
                  <input
                    type="datetime-local"
                    required
                    value={flashEndDate}
                    onChange={(e) => setFlashEndDate(e.target.value)}
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsFlashModalOpen(false)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-rose-600 py-2 px-5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>Activate Flash Sale in Neon DB</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL 3: CREATE PROMOTIONAL BANNER                                    */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {isBannerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-[24px] border border-black/10 bg-white p-4 sm:p-7 shadow-2xl text-left max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-black/10 pb-3 mb-5">
              <div className="flex items-center gap-2">
                <Megaphone className="size-5 text-black" />
                <h3 className="font-bold text-base text-black">New Announcement Banner</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBannerModalOpen(false)}
                className="rounded-full p-1.5 text-black/60 hover:bg-[#F0EEED] transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">Banner Title *</label>
                <input
                  type="text"
                  required
                  value={bannerTitle}
                  onChange={(e) => setBannerTitle(e.target.value)}
                  placeholder="Festive Flash Sale Live"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2.5 text-xs font-bold text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">Banner Message *</label>
                <textarea
                  required
                  rows={2}
                  value={bannerMessage}
                  onChange={(e) => setBannerMessage(e.target.value)}
                  placeholder="Diwali Special: Flat 25% OFF Storewide + Extra ₹500 OFF with code DIWALI2026"
                  className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">Promo Code (Optional)</label>
                  <input
                    type="text"
                    value={bannerCode}
                    onChange={(e) => setBannerCode(e.target.value.toUpperCase())}
                    placeholder="DIWALI2026"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-mono font-bold uppercase text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">Badge Text</label>
                  <input
                    type="text"
                    value={bannerBadgeText}
                    onChange={(e) => setBannerBadgeText(e.target.value)}
                    placeholder="LIMITED TIME"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-bold uppercase text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black mb-1">CTA Link Text</label>
                  <input
                    type="text"
                    value={bannerLinkText}
                    onChange={(e) => setBannerLinkText(e.target.value)}
                    placeholder="Shop Festive Sale"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-semibold text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black mb-1">CTA URL</label>
                  <input
                    type="text"
                    value={bannerLinkUrl}
                    onChange={(e) => setBannerLinkUrl(e.target.value)}
                    placeholder="/shop"
                    className="w-full rounded-xl border border-black/10 bg-[#F0EEED]/40 px-3.5 py-2 text-xs font-medium text-black focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-black/10">
                <button
                  type="button"
                  onClick={() => setIsBannerModalOpen(false)}
                  className="rounded-full border border-black/10 py-2 px-4 text-xs font-semibold text-black hover:bg-[#F0EEED] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-black py-2 px-5 text-xs font-bold text-white hover:bg-black/85 disabled:opacity-50 active:scale-95 transition-all cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  {saving && <RefreshCw className="size-3 animate-spin" />}
                  <span>Publish Banner to Storefront</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
